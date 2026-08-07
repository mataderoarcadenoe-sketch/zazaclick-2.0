import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { io, Socket } from 'socket.io-client';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutGrid, Terminal, 
  Moon, Sun, Menu, X, Check, Play, ExternalLink, Sparkles, BookOpen, Clock,
  MessageSquare, Search, MessageCircle, Smile, ArrowLeft,
  Paperclip, FileText, Image, Video, Download, ChevronDown, ChevronLeft, ChevronRight, Users, Users2, Settings,
  Edit2, Phone, User, UserMinus, Tag, MoreVertical, Mail, MapPin, Building, Calendar,
  Star, GitBranch, Grip, Gift, ListTodo
} from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle, Emoji } from 'emoji-picker-react';
import { parse } from '@twemoji/parser';
import { useCrmStore } from '../store/crmStore';

const SMART_TAGS = ['VIP', 'Moroso', 'Pendiente', 'Nuevo', 'Cliente frecuente', 'Prospecto', 'Empresa', 'Mayorista', 'Interesado', 'Pagó', 'Sin responder'];

// Componente para parsear texto y renderizar los mismos Emojis de Apple que usa el selector
const AppleEmojiText = ({ text, size }: { text: string; size?: number }) => {
  // Fix para el handshake de Emoji 14.0 con el mismo tono de piel (ej. 🫱🏻‍🫲🏻)
  // twemoji-parser no lo reconoce como un solo emoji y lo divide en dos manos (🫱🏻 y 🫲🏻)
  // Lo reemplazamos por el handshake base + tono de piel (🤝🏻) que twemoji parsea correctamente.
  const normalizedText = text.replace(/\u{1faf1}([\u{1f3fb}-\u{1f3ff}])\u{200d}\u{1faf2}\1/gu, "\u{1f91d}$1");
  const emojis = parse(normalizedText);
  
  if (emojis.length === 0) return <>{normalizedText}</>;

  // Verificar si el texto consiste unicamente de emojis y espacios/saltos de línea
  const strippedText = normalizedText.replace(/\s/g, '');
  const emojisLengthSum = emojis.reduce((sum, e) => sum + (e.indices[1] - e.indices[0]), 0);
  const isOnlyEmojis = strippedText.length === emojisLengthSum;

  let emojiSize = size || 15;
  if (!size && isOnlyEmojis) {
    if (emojis.length === 1) emojiSize = 36;
    else if (emojis.length === 2) emojiSize = 30;
    else if (emojis.length === 3) emojiSize = 24;
  }

  const nodes = [];
  let lastIndex = 0;

  emojis.forEach((emoji, i) => {
    // Texto antes del emoji
    if (emoji.indices[0] > lastIndex) {
      nodes.push(<span key={`t-${i}`}>{normalizedText.substring(lastIndex, emoji.indices[0])}</span>);
    }
    
    // Extraer el código hex de la URL del parser (ej. 1f600)
    const hex = emoji.url.split('/').pop()?.replace('.svg', '') || '';
    
    // Componente Emoji de Apple idéntico al del picker
    nodes.push(
      <span key={`e-${i}`} className="inline-flex items-center align-middle mx-0.5">
        <Emoji unified={hex} emojiStyle={EmojiStyle.APPLE} size={emojiSize} />
      </span>
    );
    
    lastIndex = emoji.indices[1];
  });

  // Texto restante
  if (lastIndex < normalizedText.length) {
    nodes.push(<span key="t-end">{normalizedText.substring(lastIndex)}</span>);
  }

  return <>{nodes}</>;
};

// Helper para formatear timestamps (sacado del map para evitar redefiniciones)
const formatTimeLocal = (timestamp: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1));
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }
  
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Colores para diferenciar participantes en grupos
const GROUP_SENDER_COLORS = [
  'text-brand-primary', 'text-brand-primary', 'text-brand-primary', 'text-amber-500',
  'text-rose-500', 'text-cyan-500', 'text-brand-primary', 'text-pink-500',
  'text-teal-500', 'text-orange-500'
];
const getSenderColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GROUP_SENDER_COLORS[Math.abs(hash) % GROUP_SENDER_COLORS.length];
};

interface Instance {
  id: string;
  instance_name: string;
  phone: string | null;
  status: 'connected' | 'disconnected';
  api_key: string;
  created_at: string;
}

const PIPELINE_STAGES = [
  'Nuevo',
  'Contactado',
  'Interesado',
  'Cotización enviada',
  'Negociación',
  'Pago pendiente',
  'Cliente',
  'Postventa'
];

export default function DashboardPage() {
  const { user, subscription, logout } = useAuth();
  const {
    instances, setInstances,
    selectedInstanceForChats, setSelectedInstanceForChats,
    activeQrInstance, setActiveQrInstance,
    qrBase64, setQrBase64,
    qrLoading, setQrLoading,
    chats, setChats,
    selectedChat, setSelectedChat,
    messages, setMessages,
    presences, setPresences,
    loadedMedia, setLoadedMedia,
    mediaLoadingStates, setMediaLoadingStates
  } = useCrmStore();

  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  
  // Theme Toggle
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Collapsible Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('client_sidebar');
    return saved !== null ? saved === 'true' : false;
  });

  // Active Tab/Section State
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setActiveTab('admin_overview');
      } else if (user.role === 'agent') {
        setActiveTab('chats');
      } else {
        setActiveTab('overview');
      }
    }
  }, [user]);

  // Modal / Form state for new instance
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Send Test Message State
  const [testInstance, setTestInstance] = useState<string>('');
  const [testNumber, setTestNumber] = useState('');
  const [testText, setTestText] = useState('¡Hola! Este es un mensaje de prueba enviado desde Zaza.click 2.0 🚀');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Notification Banner State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // API Docs Language selection
  const [docLang, setDocLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  const [docTab, setDocTab] = useState<'text' | 'media' | 'create-group' | 'participants-group' | 'invite-group'>('text');

  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatsSearchQuery, setChatsSearchQuery] = useState('');
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileBase64, setAttachedFileBase64] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom dropdown states
  const [showChatsInstanceMenu, setShowChatsInstanceMenu] = useState(false);
  const [showSandboxInstanceMenu, setShowSandboxInstanceMenu] = useState(false);
  const chatsDropdownRef = useRef<HTMLDivElement>(null);
  const sandboxDropdownRef = useRef<HTMLDivElement>(null);

  // Google Contacts Integration States
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleContacts, setGoogleContacts] = useState<any[]>([]);
  const [googleContactsLoading, setGoogleContactsLoading] = useState(false);
  const [searchContactQuery, setSearchContactQuery] = useState('');
  const [isSyncingWhatsAppContacts, setIsSyncingWhatsAppContacts] = useState(false);
  const [showSyncDropdown, setShowSyncDropdown] = useState(false);
  const syncDropdownRef = useRef<HTMLDivElement>(null);
  
  // Contact Form Modal State
  const [contactModal, setContactModal] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    resourceName: string | null;
    etag: string | null;
    givenName: string;
    familyName: string;
    phoneNumber: string;
  }>({
    isOpen: false,
    isEdit: false,
    resourceName: null,
    etag: null,
    givenName: '',
    familyName: '',
    phoneNumber: ''
  });

  // Lightbox Media Viewer State
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    type: 'image' | 'video';
    caption?: string;
  } | null>(null);

  // WhatsApp Group Management States
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  
  // Group creation modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [createGroupSubject, setCreateGroupSubject] = useState('');
  const [createGroupParticipants, setCreateGroupParticipants] = useState('');
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  // Participant management state
  const [addParticipantNumber, setAddParticipantNumber] = useState('');
  const [addParticipantLoading, setAddParticipantLoading] = useState(false);
  const [inviteLinkLabel, setInviteLinkLabel] = useState<string | null>(null);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);

  // CRM Integration States
  const [crmClient, setCrmClient] = useState<any | null>(null);
  const [crmContact, setCrmContact] = useState<any | null>(null);
  const [crmContactMap, setCrmContactMap] = useState<Record<string, string>>({});
  const [crmContactTagsMap, setCrmContactTagsMap] = useState<Record<string, string[]>>({});
  
  // Colaboradores (Equipo) States
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [agentCreateLoading, setAgentCreateLoading] = useState(false);
  const [agentCreateError, setAgentCreateError] = useState<string | null>(null);
  
  // Super Admin Platform States
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminInstances, setAdminInstances] = useState<any[]>([]);
  const [adminInstancesLoading, setAdminInstancesLoading] = useState(false);
  const [editingUserSub, setEditingUserSub] = useState<any | null>(null);
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [adminNewPlanId, setAdminNewPlanId] = useState('plan_basic');
  const [adminNewSubStatus, setAdminNewSubStatus] = useState('active');
  const [adminNewDuration, setAdminNewDuration] = useState('1');
  const [adminSubLoading, setAdminSubLoading] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const tagsButtonRef = useRef<HTMLButtonElement>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const assignButtonRef = useRef<HTMLButtonElement>(null);
  const [crmCategories, setCrmCategories] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmIsEditing, setCrmIsEditing] = useState(false);
  
  // Multi-Notes States
  const [clientNotes, setClientNotes] = useState<any[]>([]);
  const [showNotesFloatingWindow, setShowNotesFloatingWindow] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteLoading, setNewNoteLoading] = useState(false);
  
  // Agent Creation Validation States
  const [agentDocNumber, setAgentDocNumber] = useState('');
  const [agentValidationLoading, setAgentValidationLoading] = useState(false);
  
  // Contact Details Birthday and Language states
  const [crmBirthday, setCrmBirthday] = useState('');
  const [showCrmDatePicker, setShowCrmDatePicker] = useState(false);
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [crmLanguage, setCrmLanguage] = useState('Español');

  // Client Tasks States
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [clientTasks, setClientTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newCustomTaskTitle, setNewCustomTaskTitle] = useState('');
  const [taskDatePickerId, setTaskDatePickerId] = useState<number | null>(null);
  const [datePickerYearTask, setDatePickerYearTask] = useState(new Date().getFullYear());
  const [datePickerMonthTask, setDatePickerMonthTask] = useState(new Date().getMonth());
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState(new Date().getMonth());
  const [showMoreCrmFields, setShowMoreCrmFields] = useState(false);
  
  // CRM Form States
  const [crmDocType, setCrmDocType] = useState<'DNI' | 'RUC'>('DNI');
  const [crmDocNumber, setCrmDocNumber] = useState('');
  const [crmName, setCrmName] = useState('');
  const [crmAddress, setCrmAddress] = useState('');
  const [crmEmail, setCrmEmail] = useState('');
  const [crmNotes, setCrmNotes] = useState('');
  const [crmCategoryId, setCrmCategoryId] = useState<string>('');
  const [crmValidationLoading, setCrmValidationLoading] = useState(false);
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  
  // CRM Modal States
  const [crmMergeModal, setCrmMergeModal] = useState<{
    isOpen: boolean;
    clientName: string;
    docNumber: string;
    oldPhone: string;
    pendingData?: any;
  }>({
    isOpen: false,
    clientName: '',
    docNumber: '',
    oldPhone: ''
  });
  
  const [crmCategoriesModalOpen, setCrmCategoriesModalOpen] = useState(false);
  const [crmNewCategoryName, setCrmNewCategoryName] = useState('');
  const [crmEditingCategoryId, setCrmEditingCategoryId] = useState<number | null>(null);
  const [crmEditingCategoryName, setCrmEditingCategoryName] = useState('');

  // CRM Clients Tab States
  // CRM Global Tasks States
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [showTaskFormDatePicker, setShowTaskFormDatePicker] = useState(false);
  const [taskFormDatePickerYear, setTaskFormDatePickerYear] = useState<number>(new Date().getFullYear());
  const [taskFormDatePickerMonth, setTaskFormDatePickerMonth] = useState<number>(new Date().getMonth());
  // CRM Sidebar Tab Integration (Billing / Catalog)
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingCategory, setBillingCategory] = useState<string>('all');

  const [globalTasks, setGlobalTasks] = useState<any[]>([]);
  const [globalTasksLoading, setGlobalTasksLoading] = useState(false);
  const [tasksFilter, setTasksFilter] = useState<string>('pending');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');
  const [newTaskClientId, setNewTaskClientId] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [newTaskCreating, setNewTaskCreating] = useState<boolean>(false);

  const [crmClients, setCrmClients] = useState<any[]>([]);
  const [crmClientsLoading, setCrmClientsLoading] = useState(false);
  const [crmClientsSearch, setCrmClientsSearch] = useState('');
  const [crmExpandedClientId, setCrmExpandedClientId] = useState<number | null>(null);
  const [crmClientContacts, setCrmClientContacts] = useState<any[]>([]);
  const [crmClientContactsLoading, setCrmClientContactsLoading] = useState(false);
  const [crmContactsSubTab, setCrmContactsSubTab] = useState<'crm' | 'google'>('crm');
  
  // Pipeline States & Refs
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [openMoveDropdownJid, setOpenMoveDropdownJid] = useState<string | null>(null);
  const pipelineDropdownRef = useRef<HTMLDivElement>(null);
  const pipelineButtonRef = useRef<HTMLButtonElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const taskFormDateRef = useRef<HTMLDivElement>(null);

  // Refs para scroll inteligente y emoji picker click-outside
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  // Ref para guardar la referencia estable del chat seleccionado para los callbacks del intervalo
  const selectedChatRef = useRef<any>(null);
  const selectedInstanceRef = useRef<string>('');
  // Chats que el usuario ya ha abierto/leído localmente — evita que el polling restaure el badge
  const readChatsRef = useRef<Set<string>>(new Set());
  // Ref para guardar el JID del chat anterior y evitar parpadeos al actualizar el mismo chat
  const prevSelectedJidRef = useRef<string | null>(null);
  // Ref para almacenar el WebSocket de Socket.io
  const socketRef = useRef<Socket | null>(null);
  // Ref para almacenar los timeouts de limpieza automática de estados de presencia
  const presenceTimeoutsRef = useRef<Record<string, any>>({});

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const [isServerOffline, setIsServerOffline] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('client_sidebar', String(next));
      return next;
    });
  };

  const fetchInstances = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/instances/list');
      if (res.data?.success) {
        setInstances(res.data.data);
        setIsServerOffline(false);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.response?.data?.error || 'Error al cargar instancias');
      } else {
        console.warn('Silently ignoring connection error during polling:', err.message);
      }
      
      // Solo marcar servidor como desconectado si no hay respuesta del servidor (caída/reinicio)
      if (!err.response) {
        setIsServerOffline(true);
      } else {
        setIsServerOffline(false);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    // Auto-poll instance states silently every 10 seconds
    const interval = setInterval(() => {
      fetchInstances(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll connection status more frequently when QR modal is open to auto-close it
  useEffect(() => {
    if (!activeQrInstance) return;

    const checkStatus = async () => {
      try {
        const res = await api.get('/instances/list');
        if (res.data?.success) {
          const list = res.data.data;
          setInstances(list);
          const current = list.find((i: Instance) => i.instance_name === activeQrInstance);
          if (current && current.status === 'connected') {
            showNotification(`¡WhatsApp vinculado con éxito en la línea "${activeQrInstance}"! 🎉`);
            setActiveQrInstance(null);
            setQrBase64(null);
          }
        }
      } catch (err: any) {
        console.error('Error al verificar vinculación:', err);
      }
    };

    // Check once immediately, then poll every 3 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [activeQrInstance]);

  // Sync testInstance default value
  useEffect(() => {
    if (instances.length > 0 && !testInstance) {
      setTestInstance(instances[0].instance_name);
    }
  }, [instances]);

  // Fetch chats list
  const fetchChats = useCallback(async (silent = false) => {
    if (!selectedInstanceForChats) return;
    if (!silent) {
      setChatsLoading(true);
      setChatsError(null);
    }
    try {
      const res = await api.get(`/instances/chats/${selectedInstanceForChats}`);
      if (res.data?.success) {
        const freshChats = res.data.data;
        
        // El chat actualmente abierto siempre muestra 0
        // Para chats previamente leídos, permitir que el badge reaparezca si llegan mensajes nuevos
        const currentSelectedJid = selectedChatRef.current?.remoteJid;
        const processedChats = freshChats.map((c: any) => {
          // El chat actualmente abierto siempre muestra 0
          if (c.remoteJid === currentSelectedJid) {
            return { ...c, unreadCount: 0 };
          }
          // Para chats que marcamos como leídos previamente
          if (readChatsRef.current.has(c.remoteJid)) {
            const serverUnread = Number(c.unreadCount) || 0;
            if (serverUnread === 0) {
              return c; // Ya está en 0, perfecto
            }
            // El servidor dice que hay no leídos: podría ser un mensaje NUEVO que llegó
            // después de que lo leímos. Removemos del set y dejamos que muestre el badge.
            readChatsRef.current.delete(c.remoteJid);
            return c;
          }
          return c;
        });
        
        setChats(processedChats);
        
        // Mantener seleccionado el chat con los datos más recientes en vivo (lastMessage, etc.)
        if (selectedChat) {
          const freshSelected = processedChats.find((c: any) => c.remoteJid === selectedChat.remoteJid);
          if (freshSelected) {
            const hasNewMessages = freshSelected.lastMessage?.messageTimestamp !== selectedChat.lastMessage?.messageTimestamp;
            if (hasNewMessages) {
              setSelectedChat({ ...freshSelected, unreadCount: 0 });
            }
          }
        }
        
        setIsServerOffline(false);
      }
    } catch (err: any) {
      console.warn('Error fetching chats (silent=' + silent + '):', err.message);
      if (!silent) {
        setChatsError(err.response?.data?.error || 'Error al obtener los chats de la línea');
      }
      
      // Solo marcar servidor como desconectado si no hay respuesta del servidor (caída/reinicio)
      if (!err.response) {
        setIsServerOffline(true);
      } else {
        setIsServerOffline(false);
      }
    } finally {
      if (!silent) setChatsLoading(false);
    }
  }, [selectedInstanceForChats, selectedChat, setChats, setSelectedChat]);

  // Fetch messages for a chat (con protección contra race conditions)
  const fetchMessages = useCallback(async (silent = false, targetChat?: any, targetInstance?: string) => {
    const chat = targetChat || selectedChatRef.current;
    const instance = targetInstance || selectedInstanceRef.current;
    if (!instance || !chat || !chat.remoteJid) return;
    
    // Capturar el JID objetivo para proteger contra race conditions
    const targetJid = chat.remoteJid;
    
    // Evitar parpadeos de carga si ya tenemos mensajes en pantalla
    if (!silent) {
      setMessagesLoading(true);
    }
    
    try {
      const remoteJid = chat.remoteJid;
      const originalJid = chat.originalJid;
      const res = await api.post(`/instances/chats/${instance}/messages`, { remoteJid, originalJid });
      if (res.data?.success) {
        const msgs = res.data.data;
        
        // Protección contra race condition: solo actualizar si el chat sigue siendo el mismo
        // Removed race‑condition guard – the selectedChat ref is now set before fetch
        
        setMessages(msgs);
        
        // Auto-descarga de archivos multimedia recientes en segundo plano
        const mediaMsgs = msgs.filter((m: any) => 
          m.message && (m.message.imageMessage || m.message.videoMessage || m.message.audioMessage || m.message.documentMessage)
        );
        if (mediaMsgs.length > 0) {
          setMediaLoadingStates(prevLoading => {
            setLoadedMedia(prevLoaded => {
              mediaMsgs.slice(-15).forEach((m: any) => {
                const mId = m.id || m.key?.id;
                if (mId && !prevLoaded[mId] && !prevLoading[mId]) {
                  setTimeout(() => {
                    downloadMedia(mId, m.key, m.message, instance);
                  }, 150);
                }
              });
              return prevLoaded;
            });
            return prevLoading;
          });
        }
        
        // Marcar como leído SIEMPRE al abrir el chat (no silent = primera carga)
        // También al hacer polling si aún hay mensajes no leídos del servidor
        const shouldMarkRead = !silent || (chat.unreadCount && chat.unreadCount > 0);
        
        if (shouldMarkRead && !readChatsRef.current.has(targetJid) || !silent) {
          const unreadMsgs = msgs.filter((m: any) => !m.key.fromMe);
          let messageIds: string[] = [];
          
          if (unreadMsgs.length > 0) {
            messageIds = unreadMsgs.map((m: any) => m.key.id);
          } else if (chat.lastMessage?.key?.id) {
            messageIds = [chat.lastMessage.key.id];
          }

          const cleanIds = messageIds.filter((id: string) => id && !id.startsWith('temp_'));
          
          // Registrar inmediatamente como leído localmente
          readChatsRef.current.add(targetJid);
          
          // ACTUALIZACIÓN OPTIMISTA: Limpiar el contador de no leídos en React inmediatamente sin esperar la red
          setChats(prevChats => prevChats.map(c => 
            (c.remoteJid === targetJid) ? { ...c, unreadCount: 0 } : c
          ));
          setSelectedChat((prev: any) => prev ? { ...prev, unreadCount: 0 } : prev);
          
          api.post(`/instances/chats/${instance}/read`, {
            remoteJid: originalJid || remoteJid,
            phoneJid: targetJid, // Enviar JID unificado (teléfono) para limpiar Redis correctamente
            messageIds: cleanIds
          }).catch(err => {
            console.error('Error marking messages as read:', err);
          });
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  // Download media item
  const downloadMedia = async (msgId: string, messageKey: any, messageContent: any, instanceName?: string, isManual = false) => {
    const activeInstance = instanceName || selectedInstanceForChats;
    if (!activeInstance || loadedMedia[msgId] || mediaLoadingStates[msgId]) return;
    
    // Si ya sabemos que falló anteriormente, no reintentar
    if (loadedMedia[msgId] === 'FAILED') return;
    
    setMediaLoadingStates(prev => ({ ...prev, [msgId]: true }));
    try {
      const res = await api.post(`/instances/chats/${activeInstance}/media`, {
        messageKey,
        messageContent
      });
      if (res.data?.success) {
        const base64Data = res.data.data.base64 || res.data.data;
        const mimetype = messageContent.stickerMessage?.mimetype || 
                         messageContent.imageMessage?.mimetype || 
                         messageContent.audioMessage?.mimetype || 
                         messageContent.videoMessage?.mimetype || 
                         messageContent.documentMessage?.mimetype || 
                         'application/octet-stream';
        
        const dataUrl = `data:${mimetype};base64,${base64Data}`;
        setLoadedMedia(prev => ({ ...prev, [msgId]: dataUrl }));
      } else {
        // Marcar como fallido si success es falso
        setLoadedMedia(prev => ({ ...prev, [msgId]: 'FAILED' }));
        if (isManual) {
          showNotification(res.data?.error || 'No se pudo descargar el archivo', 'error');
        }
      }
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.message;
      console.error('❌ Error downloading media:', serverError, err.response?.data);
      
      // Marcar como fallido en el estado para evitar reintentos en bucle
      setLoadedMedia(prev => ({ ...prev, [msgId]: 'FAILED' }));
      
      // Solo notificar al usuario si la acción fue explícitamente manual
      if (isManual) {
        showNotification(`Error al descargar archivo: ${serverError}`, 'error');
      }
    } finally {
      setMediaLoadingStates(prev => ({ ...prev, [msgId]: false }));
    }
  };

  // Trigger file input dialog
  const handleTriggerFileInput = (type: 'image' | 'video' | 'document') => {
    setShowAttachMenu(false);
    if (!fileInputRef.current) return;
    
    if (type === 'image') {
      fileInputRef.current.accept = 'image/*';
    } else if (type === 'video') {
      fileInputRef.current.accept = 'video/*';
    } else {
      fileInputRef.current.accept = '*/*';
    }
    fileInputRef.current.click();
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);
    
    // Generar previsualización
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const previewUrl = URL.createObjectURL(file);
      setAttachmentPreview(previewUrl);
    } else {
      setAttachmentPreview(null);
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        setAttachedFileBase64(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  // Clear current attachment
  const handleClearAttachment = () => {
    setAttachedFile(null);
    setAttachedFileBase64(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send chat message (handles both text and media)
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceForChats || !selectedChat || sendingMessage) return;
    
    // Si no hay archivo ni texto, no hacer nada
    if (!attachedFile && !newMessageText.trim()) return;

    setSendingMessage(true);
    try {
      if (attachedFile) {
        // Enviar mensaje multimedia
        if (!attachedFileBase64) {
          showNotification('El archivo aún se está procesando. Inténtalo de nuevo en un segundo.', 'error');
          setSendingMessage(false);
          return;
        }

        let mediatype: 'image' | 'video' | 'document' | 'audio' = 'document';
        if (attachedFile.type.startsWith('image/')) {
          mediatype = 'image';
        } else if (attachedFile.type.startsWith('video/')) {
          mediatype = 'video';
        } else if (attachedFile.type.startsWith('audio/')) {
          mediatype = 'audio';
        }

        const res = await api.post(`/instances/chats/${selectedInstanceForChats}/send-media`, {
          remoteJid: selectedChat.remoteJid,
          media: attachedFileBase64,
          mediatype,
          mimetype: attachedFile.type,
          caption: newMessageText.trim() || undefined,
          fileName: attachedFile.name
        });

        if (res.data?.success) {
          setNewMessageText('');
          handleClearAttachment();
          await fetchMessages(true);
        }
      } else {
        // Enviar mensaje de texto común
        const textToSend = newMessageText.trim();
        
        // Inyectar mensaje en la pantalla inmediatamente (Optimistic UI)
        useCrmStore.getState().addOptimisticMessage(textToSend, selectedChat.remoteJid);
        setNewMessageText('');
        
        const res = await api.post(`/instances/chats/${selectedInstanceForChats}/send`, {
          remoteJid: selectedChat.remoteJid,
          text: textToSend
        });
        
        if (!res.data?.success) {
          showNotification(res.data?.error || 'Error al enviar el mensaje', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      showNotification(err.response?.data?.error || 'Error al enviar el mensaje', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Mantener refs sincronizadas para evitar stale closures en el intervalo
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);
  useEffect(() => {
    selectedInstanceRef.current = selectedInstanceForChats;
    // Limpiar el registro de chats leídos al cambiar de instancia
    readChatsRef.current.clear();
    // Limpiar el chat seleccionado al cambiar de línea
    setSelectedChat(null);
  }, [selectedInstanceForChats, setSelectedChat]);

  // Load chats when tab becomes active or instance changes
  useEffect(() => {
    if (activeTab === 'chats') {
      if (!selectedInstanceForChats && instances.length > 0) {
        const firstConnected = instances.find(i => i.status === 'connected');
        setSelectedInstanceForChats(firstConnected ? firstConnected.instance_name : instances[0].instance_name);
      } else if (selectedInstanceForChats) {
        fetchChats();
      }
    }
  }, [activeTab, selectedInstanceForChats, instances]);

  // Administrar la conexión a Socket.io en tiempo real
  useEffect(() => {
    if (activeTab !== 'chats' || !selectedInstanceForChats) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : window.location.origin;
    console.log('🔌 [Socket.io] Conectando al WebSocket de Zaza en:', socketUrl);

    const socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [Socket.io] Conexión establecida con éxito.');
      socket.emit('join_instance', selectedInstanceForChats);
    });

    socket.on('message:received', (newMsg: any) => {
      const msgJid = newMsg.key?.remoteJid;
      if (!msgJid) return;

      let cleanJid = msgJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
      const fromMe = newMsg.key?.fromMe;

      // 1. Si es el chat abierto actualmente, añadirlo a la lista de mensajes en tiempo real
      const targetJid = selectedChatRef.current?.remoteJid;
      if (cleanJid === targetJid) {
        setMessages(prev => {
          const exists = prev.some(m => m.key?.id === newMsg.key?.id);
          if (exists) return prev;
          if (fromMe) {
            return [newMsg, ...prev.filter(m => !m.key?.id.startsWith('temp_'))];
          }
          return [newMsg, ...prev];
        });

        // Si es un mensaje recibido en el chat abierto, informar al backend inmediatamente para limpiar Redis
        if (!fromMe && selectedInstanceRef.current) {
          const originalJid = selectedChatRef.current?.originalJid;
          const msgId = newMsg.key?.id || newMsg.id;
          api.post(`/instances/chats/${selectedInstanceRef.current}/read`, {
            remoteJid: originalJid || cleanJid,
            messageIds: msgId ? [msgId] : []
          }).catch(err => console.error('Error auto-marking read on WebSocket message:', err));
        }
      }

      // 2. Mover el chat al inicio de la lista lateral y actualizar su lastMessage y unreadCount
      setChats(prevChats => {
        const chatIdx = prevChats.findIndex(c => c.remoteJid === cleanJid);
        if (chatIdx === -1) {
          fetchChats(true);
          return prevChats;
        }

        const oldChat = prevChats[chatIdx];
        const isCurrentChat = selectedChatRef.current?.remoteJid === cleanJid;
        const newUnreadCount = isCurrentChat ? 0 : (Number(oldChat.unreadCount) || 0) + (fromMe ? 0 : 1);

        const updatedChat = {
          ...oldChat,
          unreadCount: newUnreadCount,
          lastMessage: {
            ...newMsg,
            messageTimestamp: newMsg.messageTimestamp
          }
        };

        const newChats = [updatedChat, ...prevChats.filter((_, i) => i !== chatIdx)];
        return newChats;
      });
    });

    socket.on('unread_update', ({ remoteJid, unreadCount }: { remoteJid: string, unreadCount: number }) => {
      // Actualizar el contador lateral en caliente
      setChats(prevChats => prevChats.map(c => {
        if (c.remoteJid === remoteJid) {
          if (c.remoteJid === selectedChatRef.current?.remoteJid) {
            return { ...c, unreadCount: 0 };
          }
          return { ...c, unreadCount };
        }
        return c;
      }));
    });

    socket.on('presence_update', ({ remoteJid, status }: { remoteJid: string, status: string }) => {
      // Limpiar timeout previo si existe para este contacto
      if (presenceTimeoutsRef.current[remoteJid]) {
        clearTimeout(presenceTimeoutsRef.current[remoteJid]);
        delete presenceTimeoutsRef.current[remoteJid];
      }

      setPresences(prev => ({
        ...prev,
        [remoteJid]: status
      }));

      // Si el estado es 'composing' o 'recording', programar una limpieza automática después de 10 segundos
      if (status === 'composing' || status === 'recording') {
        presenceTimeoutsRef.current[remoteJid] = setTimeout(() => {
          setPresences(prev => {
            const updated = { ...prev };
            if (updated[remoteJid] === 'composing' || updated[remoteJid] === 'recording') {
              delete updated[remoteJid];
            }
            return updated;
          });
          delete presenceTimeoutsRef.current[remoteJid];
        }, 10000);
      } else if (status === 'paused' || status === 'unavailable') {
        // Limpiar inmediatamente si el usuario se desconecta o deja de interactuar
        setPresences(prev => {
          const updated = { ...prev };
          delete updated[remoteJid];
          return updated;
        });
      }
    });

    socket.on('connection_status', ({ instance, status }: { instance: string, status: 'connected' | 'disconnected' }) => {
      console.log(`🔌 [Socket.io] connection_status recibida: ${instance} -> ${status}`);
      setInstances(prev => prev.map(inst => {
        if (inst.instance_name === instance) {
          return { ...inst, status };
        }
        return inst;
      }));
    });

    socket.on('qrcode_updated', ({ instance, qrcode }: { instance: string, qrcode: string }) => {
      console.log(`📷 [Socket.io] qrcode_updated recibida para ${instance}`);
      setActiveQrInstance(current => {
        if (current === instance) {
          setQrBase64(qrcode);
        }
        return current;
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ [Socket.io] Conexión perdida.');
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
      // Limpiar todos los timeouts de presencia activos al desmontar
      Object.values(presenceTimeoutsRef.current).forEach(clearTimeout);
      presenceTimeoutsRef.current = {};
    };
  }, [selectedInstanceForChats, activeTab, fetchChats]);

  // Polling para mantener los chats actualizados
  useEffect(() => {
    if (activeTab !== 'chats' || !selectedInstanceForChats) return;

    const interval = setInterval(() => {
      fetchChats(true);
    }, 25000);

    return () => clearInterval(interval);
  }, [activeTab, selectedInstanceForChats]);

  // Load messages when active chat changes
  useEffect(() => {
    if (selectedChat) {
      // Ensure ref is up-to-date before any async fetch to avoid stale-ref race condition
      selectedChatRef.current = selectedChat;
      const isSameChat = prevSelectedJidRef.current === selectedChat.remoteJid;
      prevSelectedJidRef.current = selectedChat.remoteJid;
      
      if (!isSameChat) {
        setMessages([]); // Solo limpiar mensajes si realmente cambiamos de conversación
        fetchMessages(false, selectedChat, selectedInstanceForChats);
      } else {
        // Si es el mismo chat (actualización por polling / mensaje nuevo), fetch silente
        fetchMessages(true, selectedChat, selectedInstanceForChats);
      }
    } else {
      prevSelectedJidRef.current = null;
      setMessages([]);
      setCrmClient(null);
      setCrmContact(null);
    }
  }, [selectedChat, fetchMessages, selectedInstanceForChats]);
  
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Cerrar menú de adjuntos al hacer clic fuera
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node) &&
        attachButtonRef.current && !attachButtonRef.current.contains(e.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  // Cerrar menú de pipeline al hacer clic fuera
  useEffect(() => {
    if (!showPipelineDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pipelineDropdownRef.current && !pipelineDropdownRef.current.contains(e.target as Node) &&
        pipelineButtonRef.current && !pipelineButtonRef.current.contains(e.target as Node)
      ) {
        setShowPipelineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPipelineDropdown]);

  // Cerrar select de chats al hacer clic fuera
  useEffect(() => {
    if (!showChatsInstanceMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (chatsDropdownRef.current && !chatsDropdownRef.current.contains(e.target as Node)) {
        setShowChatsInstanceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChatsInstanceMenu]);

  // Cerrar select de sandbox al hacer clic fuera
  useEffect(() => {
    if (!showSandboxInstanceMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sandboxDropdownRef.current && !sandboxDropdownRef.current.contains(e.target as Node)) {
        setShowSandboxInstanceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSandboxInstanceMenu]);

  // Cerrar select de sincronización de contactos al hacer clic fuera
  useEffect(() => {
    if (!showSyncDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(e.target as Node)) {
        setShowSyncDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSyncDropdown]);

  // Cerrar select de etiquetas al hacer clic fuera
  useEffect(() => {
    if (!showTagsDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagsDropdownRef.current && !tagsDropdownRef.current.contains(e.target as Node) &&
        tagsButtonRef.current && !tagsButtonRef.current.contains(e.target as Node)
      ) {
        setShowTagsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagsDropdown]);

  // Cerrar select de asignación al hacer clic fuera
  useEffect(() => {
    if (!showAssignDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node) &&
        assignButtonRef.current && !assignButtonRef.current.contains(e.target as Node)
      ) {
        setShowAssignDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssignDropdown]);

  // Fetch Google Contacts Connection Status
  const fetchGoogleContactsStatus = useCallback(async () => {
    try {
      const res = await api.get('/instances/google-contacts/status');
      if (res.data?.success) {
        setGoogleConnected(res.data.connected);
        setGoogleEmail(res.data.email || null);
        if (res.data.connected) {
          // Cargar contactos
          setGoogleContactsLoading(true);
          try {
            const listRes = await api.get('/instances/google-contacts/list');
            if (listRes.data?.success) {
              setGoogleContacts(listRes.data.data || []);
            }
          } catch (e) {
            console.error('Error listando contactos:', e);
          } finally {
            setGoogleContactsLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Google Contacts connection status:', err);
    }
  }, []);

  // Fetch Contacts from Google People API
  const fetchGoogleContacts = async () => {
    setGoogleContactsLoading(true);
    try {
      const res = await api.get('/instances/google-contacts/list');
      if (res.data?.success) {
        setGoogleContacts(res.data.data || []);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener contactos de Google', 'error');
    } finally {
      setGoogleContactsLoading(false);
    }
  };

  // Connect Google Contacts OAuth redirect
  const handleConnectGoogleContacts = () => {
    const token = localStorage.getItem('saas_auth_token');
    const hostUrl = api.defaults.baseURL || '/api';
    window.location.href = `${hostUrl}/auth/google-contacts/connect?token=${token}`;
  };

  // Create or Update Contact
  const handleCreateOrUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isEdit, resourceName, etag, givenName, familyName, phoneNumber } = contactModal;
    
    if (!givenName.trim() || !phoneNumber.trim()) {
      showNotification('Nombre y Teléfono son requeridos', 'error');
      return;
    }

    try {
      if (isEdit) {
        const res = await api.put('/instances/google-contacts/update', {
          resourceName,
          etag,
          givenName: givenName.trim(),
          familyName: familyName.trim() || undefined,
          phoneNumber: phoneNumber.trim()
        });
        if (res.data?.success) {
          showNotification('Contacto actualizado exitosamente');
          setContactModal(prev => ({ ...prev, isOpen: false }));
          fetchGoogleContacts();
        }
      } else {
        const res = await api.post('/instances/google-contacts/create', {
          givenName: givenName.trim(),
          familyName: familyName.trim() || undefined,
          phoneNumber: phoneNumber.trim()
        });
        if (res.data?.success) {
          showNotification('Contacto creado exitosamente en Google Contacts');
          setContactModal(prev => ({ ...prev, isOpen: false }));
          fetchGoogleContacts();
        }
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al guardar contacto', 'error');
    }
  };

  // Delete Google Contact
  const handleDeleteContact = async (resourceName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar Contacto?',
      message: 'Esta acción eliminará el contacto permanentemente de tu cuenta de Google Contactos y de tu teléfono.',
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.post('/instances/google-contacts/delete', { resourceName });
          if (res.data?.success) {
            showNotification('Contacto eliminado correctamente.');
            fetchGoogleContacts();
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al eliminar contacto', 'error');
        }
      }
    });
  };

  // Import WhatsApp Contacts to Google Contacts
  const handleSyncWhatsAppContacts = async (instanceName: string) => {
    if (!instanceName) return;
    setIsSyncingWhatsAppContacts(true);
    setShowSyncDropdown(false);
    showNotification('Sincronizando agenda... Esto puede tardar unos segundos.', 'success');
    
    try {
      const res = await api.post('/instances/google-contacts/sync-whatsapp', { instanceName });
      if (res.data?.success) {
        showNotification(res.data.message || 'Sincronización finalizada con éxito.');
        fetchGoogleContacts();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error durante la sincronización de contactos', 'error');
    } finally {
      setIsSyncingWhatsAppContacts(false);
    }
  };

  // --- CRM INTEGRATION FUNCTIONS ---

  // Fetch CRM Contact Map for chats UI
  const fetchCrmContactMap = useCallback(async () => {
    try {
      const res = await api.get('/crm/contacts/map');
      if (res.data?.success) {
        setCrmContactMap(res.data.data || {});
      }
    } catch (err: any) {
      console.error('Error fetching CRM contact map:', err.message);
    }
  }, []);

  // Fetch CRM Contact Tags Map
  const fetchCrmContactTagsMap = useCallback(async () => {
    try {
      const res = await api.get('/crm/contacts/tags-map');
      if (res.data?.success) {
        setCrmContactTagsMap(res.data.data || {});
      }
    } catch (err: any) {
      console.error('Error fetching CRM contact tags map:', err.message);
    }
  }, []);

  const [crmContactAgentsMap, setCrmContactAgentsMap] = useState<Record<string, { id: string, name: string, status: string }>>({});

  // Fetch CRM Contact Agents Map
  const fetchCrmContactAgentsMap = useCallback(async () => {
    try {
      const res = await api.get('/crm/contacts/agents-map');
      if (res.data?.success) {
        setCrmContactAgentsMap(res.data.data || {});
      }
    } catch (err: any) {
      console.error('Error fetching CRM contact agents map:', err.message);
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    if (user?.role !== 'client' && user?.role !== 'agent') return;
    setTeamLoading(true);
    try {
      const res = await api.get('/crm/agents');
      if (res.data?.success) {
        setTeamMembers(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching team members:', err.message);
      showNotification('Error al cargar colaboradores.', 'error');
    } finally {
      setTeamLoading(false);
    }
  }, [user]);

  // Create Team Member (Collaborator)
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentEmail.trim() || !newAgentPassword.trim()) return;
    setAgentCreateLoading(true);
    setAgentCreateError(null);
    try {
      const res = await api.post('/crm/agents', {
        name: newAgentName,
        email: newAgentEmail,
        password: newAgentPassword
      });
      if (res.data?.success) {
        showNotification('Colaborador registrado exitosamente.');
        setNewAgentName('');
        setNewAgentEmail('');
        setNewAgentPassword('');
        setAgentDocNumber('');
        setShowCreateAgentModal(false);
        fetchTeamMembers();
      }
    } catch (err: any) {
      setAgentCreateError(err.response?.data?.error || 'Error al registrar colaborador.');
    } finally {
      setAgentCreateLoading(false);
    }
  };

  // Toggle Agent Status
  const handleToggleAgentStatus = async (agentId: string, currentStatus: string) => {
    const statuses = ['available', 'busy', 'offline'] as const;
    const currentIndex = statuses.indexOf(currentStatus as any);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
      const res = await api.put(`/crm/agents/${agentId}/status`, { status: nextStatus });
      if (res.data?.success) {
        showNotification('Estado del colaborador actualizado.');
        fetchTeamMembers();
      }
    } catch (err: any) {
      showNotification('Error al actualizar estado.', 'error');
    }
  };

  // Delete Agent
  const handleDeleteAgent = (agentId: string, agentName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Colaborador',
      message: `¿Estás seguro de que deseas eliminar a ${agentName}? Se desasignará de todos sus chats.`,
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/crm/agents/${agentId}`);
          if (res.data?.success) {
            showNotification('Colaborador eliminado.');
            fetchTeamMembers();
          }
        } catch (err: any) {
          showNotification('Error al eliminar colaborador.', 'error');
        }
      }
    });
  };

  // Assign chat to Advisor
  const handleAssignAgent = async (agentId: string | null) => {
    if (!selectedChat) return;
    const cleanJid = selectedChat?.remoteJid?.split('@')[0]?.split(':')[0]?.split(':')[0] || '';
    try {
      const res = await api.post('/crm/contacts/assign', {
        phone_number: cleanJid,
        agent_id: agentId
      });
      if (res.data?.success) {
        showNotification(agentId ? 'Chat asignado correctamente.' : 'Chat desasignado.');
        fetchCrmContactAgentsMap();
        // Force refresh active contact
        fetchCrmContactForChat(selectedChat.remoteJid);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al asignar chat.', 'error');
    }
  };

  // Super Admin: Load Platform stats
  const fetchAdminStats = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setAdminStatsLoading(true);
    try {
      const res = await api.get('/admin/stats');
      if (res.data?.success) {
        setAdminStats(res.data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching admin stats:', err.message);
    } finally {
      setAdminStatsLoading(false);
    }
  }, [user]);

  // Super Admin: Load Users list
  const fetchAdminUsers = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setAdminUsersLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data?.success) {
        setAdminUsers(res.data.users || []);
      }
    } catch (err: any) {
      console.error('Error fetching admin users:', err.message);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [user]);

  // Super Admin: Load Instances list
  const fetchAdminInstances = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setAdminInstancesLoading(true);
    try {
      const res = await api.get('/admin/instances');
      if (res.data?.success) {
        setAdminInstances(res.data.instances || []);
      }
    } catch (err: any) {
      console.error('Error fetching admin instances:', err.message);
    } finally {
      setAdminInstancesLoading(false);
    }
  }, [user]);

  // Super Admin: Update subscription
  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserSub) return;
    setAdminSubLoading(true);
    try {
      const res = await api.put(`/admin/users/${editingUserSub.id}/subscription`, {
        planId: adminNewPlanId,
        status: adminNewSubStatus,
        durationMonths: adminNewDuration
      });
      if (res.data?.success) {
        showNotification('Suscripción actualizada correctamente.');
        setShowEditSubModal(false);
        setEditingUserSub(null);
        fetchAdminUsers();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar suscripción.', 'error');
    } finally {
      setAdminSubLoading(false);
    }
  };

  const toggleTag = async (tag: string) => {
    if (!selectedChat) return;
    const currentTags = crmContact?.tags || [];
    let newTags = [...currentTags];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }

    try {
      const cleanJid = selectedChat?.remoteJid?.split('@')[0]?.split(':')[0]?.split(':')[0] || '';
      const res = await api.post('/crm/contacts/tags', {
        phone_number: cleanJid,
        tags: newTags
      });

      if (res.data.success) {
        setCrmContact((prev: any) => prev ? { ...prev, tags: newTags } : {
          id: 0,
          client_id: 0,
          user_id: selectedInstanceRef.current || '',
          phone_number: cleanJid,
          category_id: null,
          is_active: true,
          pipeline_stage: 'Nuevo',
          tags: newTags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        setCrmContactTagsMap((prev: any) => ({
          ...prev,
          [cleanJid]: newTags
        }));
      }
    } catch (err: any) {
      console.error('Error toggling tag:', err.message);
    }
  };

  // Fetch CRM Categories
  const fetchCrmCategories = useCallback(async () => {
    try {
      const res = await api.get('/crm/categories');
      if (res.data?.success) {
        setCrmCategories(res.data.data);
        if (res.data.data.length > 0 && !crmCategoryId) {
          setCrmCategoryId(res.data.data[0].id.toString());
        }
      }
    } catch (err: any) {
      console.error('Error fetching CRM categories:', err.message);
    }
  }, [crmCategoryId]);

  // Fetch CRM details for the active chat JID
  const fetchClientTasks = async (clientId: number) => {
    setTasksLoading(true);
    try {
      const res = await api.get(`/crm/clients/${clientId}/tasks`);
      if (res.data?.success) {
        setClientTasks(res.data.tasks);
      }
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      showNotification('Error al cargar las tareas del cliente', 'error');
    } finally {
      setTasksLoading(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    try {
      setClientTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentCompleted } : t));
      const res = await api.put(`/crm/tasks/${taskId}`, {
        completed: !currentCompleted
      });
      if (!res.data?.success) {
        setClientTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentCompleted } : t));
        showNotification('Error al actualizar la tarea', 'error');
      }
    } catch (err: any) {
      console.error('Error toggling task:', err);
      setClientTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentCompleted } : t));
      showNotification('Error al actualizar la tarea', 'error');
    }
  };

  const handleUpdateTaskDate = async (taskId: number, dateStr: string | null) => {
    try {
      setClientTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: dateStr } : t));
      const res = await api.put(`/crm/tasks/${taskId}`, {
        due_date: dateStr
      });
      if (!res.data?.success) {
        showNotification('Error al guardar la fecha de la tarea', 'error');
      }
    } catch (err: any) {
      console.error('Error updating task date:', err);
      showNotification('Error al guardar la fecha de la tarea', 'error');
    }
  };

  const handleCreateCustomTask = async () => {
    if (!newCustomTaskTitle.trim() || !crmClient) return;
    try {
      const res = await api.post(`/crm/clients/${crmClient.id}/tasks`, {
        title: newCustomTaskTitle.trim()
      });
      if (res.data?.success) {
        setClientTasks(prev => [...prev, res.data.task]);
        setNewCustomTaskTitle('');
      }
    } catch (err: any) {
      console.error('Error creating custom task:', err);
      showNotification('Error al crear la tarea personalizada', 'error');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      setClientTasks(prev => prev.filter(t => t.id !== taskId));
      const res = await api.delete(`/crm/tasks/${taskId}`);
      if (!res.data?.success) {
        showNotification('Error al eliminar la tarea', 'error');
      }
    } catch (err: any) {
      console.error('Error deleting task:', err);
      showNotification('Error al eliminar la tarea', 'error');
    }
  };

  const fetchCrmContactForChat = useCallback(async (chatJid: string) => {
    if (!chatJid || !chatJid.endsWith || chatJid.endsWith('@g.us')) {
      setCrmClient(null);
      setCrmContact(null);
      setClientNotes([]);
      setShowNotesFloatingWindow(false);
      return;
    }
    setCrmLoading(true);
    try {
      const cleanJid = chatJid.split('@')[0].split(':')[0];
      const res = await api.get(`/crm/contacts/${cleanJid}`);
      if (res.data?.success) {
        setCrmClient(res.data.client);
        if (res.data.client) {
          fetchClientTasks(res.data.client.id);
        } else {
          setClientTasks([]);
          setShowTasksModal(false);
        }
        setCrmContact(res.data.contact);
        setCrmIsEditing(false); // Reset to display mode
        setClientNotes(res.data.notes || []);
        setShowNotesFloatingWindow(false);
        
        // Populate inputs if client exists
        if (res.data.client) {
          setCrmDocType(res.data.client.doc_type === 'MANUAL' ? 'DNI' : res.data.client.doc_type);
          setCrmDocNumber(res.data.client.doc_type === 'MANUAL' ? '' : res.data.client.doc_number);
          setCrmName(res.data.client.name);
          setCrmAddress(res.data.client.address || '');
          setCrmEmail(res.data.client.email || '');
          setCrmNotes(res.data.client.notes || '');
          setCrmBirthday(res.data.client.birthday ? res.data.client.birthday.substring(0, 10) : '');
          setCrmLanguage(res.data.client.idioma || 'Español');
        } else {
          // Clear inputs for new chat
          setCrmDocType('DNI');
          setCrmDocNumber('');
          setCrmName('');
          setCrmAddress('');
          setCrmEmail('');
          setCrmNotes('');
          setCrmBirthday('');
          setCrmLanguage('Español');
        }
        if (res.data.contact) {
          setCrmCategoryId(res.data.contact.category_id?.toString() || '');
        } else if (crmCategories.length > 0) {
          setCrmCategoryId(crmCategories[0].id.toString());
        }
      }
    } catch (err: any) {
      console.error('Error fetching CRM contact:', err.message);
    } finally {
      setCrmLoading(false);
    }
  }, [crmCategories]);

  // Fetch pipeline contacts
  const fetchPipelineData = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const res = await api.get('/crm/pipeline');
      if (res.data?.success) {
        setPipelineData(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching pipeline data:', err.message);
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  // Move pipeline stage
  const movePipelineStage = useCallback(async (remoteJid: string, stage: string, pushName?: string) => {
    try {
      const response = await api.post('/crm/pipeline/move', {
        remoteJid,
        stage,
        pushName
      });
      if (response.data?.success) {
        showNotification('Etapa comercial actualizada exitosamente.', 'success');
        if (selectedChat && selectedChat.remoteJid === remoteJid) {
          fetchCrmContactForChat(remoteJid);
        }
        fetchCrmContactMap();
        fetchPipelineData();
      } else {
        showNotification(response.data?.error || 'Error al mover etapa.', 'error');
      }
    } catch (err: any) {
      console.error('Error moving pipeline stage:', err.message);
      showNotification('Error al conectar con el servidor.', 'error');
    }
  }, [selectedChat, fetchCrmContactForChat, fetchCrmContactMap, fetchPipelineData]);

  // Cargar datos CRM al cambiar de chat activo
  useEffect(() => {
    if (selectedChat && selectedChat.remoteJid && selectedChat.remoteJid.endsWith && !selectedChat.remoteJid.endsWith('@g.us')) {
      fetchCrmContactForChat(selectedChat.remoteJid);
    }
  }, [selectedChat, fetchCrmContactForChat]);

  // Consult DNI/RUC from APIPeru
  const handleValidateCrmDoc = async (overrideDocNum?: any) => {
    const docNum = typeof overrideDocNum === 'string' ? overrideDocNum : crmDocNumber;
    if (!docNum || (docNum.length !== 8 && docNum.length !== 11)) {
      showNotification('Ingresa un DNI válido (8 dígitos) o RUC (11 dígitos).', 'error');
      return;
    }
    setCrmValidationLoading(true);
    try {
      const res = await api.post('/crm/validate-doc', { docNumber: docNum });
      if (res.data?.success) {
        setCrmName(res.data.name);
        setCrmDocType(res.data.docType);
        setCrmAddress(res.data.address || '');
        showNotification('Documento consultado exitosamente con APIPerú.', 'success');
      }
    } catch (err: any) {
      console.error('Error validating document:', err.response?.data || err.message);
      showNotification(err.response?.data?.error || 'Documento no encontrado o error en APIPerú.', 'error');
    } finally {
      setCrmValidationLoading(false);
    }
  };

  // Format birthday date string to Spanish
  const formatBirthdayString = (dateStr: string) => {
    if (!dateStr) return 'No registrado';
    try {
      const date = new Date(dateStr);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
      const day = adjustedDate.getDate();
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      const month = monthNames[adjustedDate.getMonth()];
      return `${day} de ${month}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Get days remaining and isToday for client birthday
  const getBirthdayInfo = (client: any) => {
    if (!client.birthday) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bdate = new Date(client.birthday);
    const userTimezoneOffset = bdate.getTimezoneOffset() * 60000;
    const birthdayDate = new Date(bdate.getTime() + userTimezoneOffset);
    birthdayDate.setHours(0, 0, 0, 0);
    
    const nextBirthday = new Date(birthdayDate);
    nextBirthday.setFullYear(today.getFullYear());
    
    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isToday = birthdayDate.getDate() === today.getDate() && birthdayDate.getMonth() === today.getMonth();
    
    const age = today.getFullYear() - birthdayDate.getFullYear();
    
    return {
      date: birthdayDate,
      nextDate: nextBirthday,
      daysRemaining: isToday ? 0 : diffDays,
      isToday,
      age
    };
  };

  const handleWishBirthday = (client: any) => {
    const phone = client.phone_number || '';
    const text = encodeURIComponent(`¡Hola, ${client.name}! 🎂 De parte de todo el equipo, te deseamos un muy feliz cumpleaños. Que pases un excelente día. 🎉`);
    const url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`;
    window.open(url, '_blank');
  };

  // Query collaborator details using APIPeru
  const handleQueryAgentDoc = async () => {
    if (!agentDocNumber || (agentDocNumber.length !== 8 && agentDocNumber.length !== 11)) {
      showNotification('Ingresa un DNI de 8 dígitos o RUC de 11 dígitos.', 'error');
      return;
    }
    setAgentValidationLoading(true);
    try {
      const res = await api.post('/crm/validate-doc', { docNumber: agentDocNumber });
      if (res.data?.success) {
        setNewAgentName(res.data.name);
        showNotification('Documento consultado exitosamente con APIPerú.', 'success');
      }
    } catch (err: any) {
      console.error('Error validating agent document:', err.response?.data || err.message);
      showNotification(err.response?.data?.error || 'Documento no encontrado o error en APIPerú.', 'error');
    } finally {
      setAgentValidationLoading(false);
    }
  };

  // Link Client and WhatsApp Chat (with optional mergeAction)
  const handleSaveCrmContact = async (mergeAction?: string) => {
    if (!selectedChat) return;
    const cleanJid = selectedChat?.remoteJid?.split('@')[0]?.split(':')[0] || '';

    // If manual name with no document number entered
    if (!crmDocNumber.trim()) {
      if (!crmName.trim()) {
        showNotification('Ingresa un nombre para el cliente.', 'error');
        return;
      }
      setCrmSaving(true);
      try {
        const res = await api.post('/crm/link-manual', {
          phone_number: cleanJid,
          name: crmName.trim(),
          email: crmEmail.trim(),
          notes: crmNotes.trim(),
          categoryId: crmCategoryId ? parseInt(crmCategoryId, 10) : null,
          birthday: crmBirthday || null,
          idioma: crmLanguage || 'Español'
        });
        if (res.data?.success) {
          setCrmClient(res.data.client);
          
          let parsedContact = res.data.contact;
          if (parsedContact && typeof parsedContact.tags === 'string') {
            try { parsedContact.tags = JSON.parse(parsedContact.tags); } catch(e) { parsedContact.tags = []; }
          }
          setCrmContact(parsedContact);
          
          if (parsedContact) {
            setCrmContactTagsMap((prev: any) => ({
              ...prev,
              [cleanJid]: parsedContact.tags || []
            }));
          }
          
          setCrmIsEditing(false);
          fetchCrmContactMap();
          showNotification('Contacto guardado exitosamente.', 'success');
        }
      } catch (err: any) {
        showNotification(err.response?.data?.error || 'Error al guardar el contacto.', 'error');
      } finally {
        setCrmSaving(false);
      }
      return;
    }

    // Si no se especifica mergeAction, validamos primero si el DNI/RUC ya existe en la base de datos
    if (!mergeAction) {
      try {
        const checkRes = await api.get(`/crm/clients?search=${crmDocNumber.trim()}`);
        if (checkRes.data?.success && checkRes.data.data.length > 0) {
          const existingClient = checkRes.data.data[0];
          // Solo abrimos el modal si es un cliente diferente
          if (!crmClient || crmClient.id !== existingClient.id) {
            setCrmMergeModal({
              isOpen: true,
              clientName: existingClient.name,
              docNumber: crmDocNumber.trim(),
              oldPhone: '',
              pendingData: {
                phone_number: cleanJid,
                doc_type: crmDocType,
                doc_number: crmDocNumber.trim(),
                name: crmName.trim(),
                address: crmAddress.trim(),
                email: crmEmail.trim(),
                notes: crmNotes.trim(),
                categoryId: crmCategoryId
              }
            });
            return;
          }
        }
      } catch (err) {
        console.error('Error al validar DNI/RUC:', err);
      }
    }

    // Link by DNI/RUC
    setCrmSaving(true);
    try {
      const res = await api.post('/crm/link-doc', {
        phone_number: cleanJid,
        doc_type: crmDocType,
        doc_number: crmDocNumber.trim(),
        name: crmName.trim() || (crmDocType === 'DNI' ? 'DNI ' + crmDocNumber : 'RUC ' + crmDocNumber),
        address: crmAddress.trim(),
        email: crmEmail.trim(),
        notes: crmNotes.trim(),
        categoryId: crmCategoryId ? parseInt(crmCategoryId, 10) : null,
        mergeAction,
        birthday: crmBirthday || null,
        idioma: crmLanguage || 'Español'
      });

      if (res.data?.success) {
        setCrmClient(res.data.client);
        
        let parsedContact = res.data.contact;
        if (parsedContact && typeof parsedContact.tags === 'string') {
          try { parsedContact.tags = JSON.parse(parsedContact.tags); } catch(e) { parsedContact.tags = []; }
        }
        setCrmContact(parsedContact);
        
        if (parsedContact) {
          setCrmContactTagsMap((prev: any) => ({
            ...prev,
            [cleanJid]: parsedContact.tags || []
          }));
        }
        
        setCrmIsEditing(false);
        setCrmMergeModal(prev => ({ ...prev, isOpen: false }));
        fetchCrmContactMap();
        showNotification('Cliente y contacto vinculados correctamente.', 'success');
      }
    } catch (err: any) {
      console.error('Error linking DNI/RUC:', err.response?.data || err.message);
      showNotification(err.response?.data?.error || 'Error al vincular cliente.', 'error');
    } finally {
      setCrmSaving(false);
    }
  };

  // Add a new independent note
  const handleAddNewNote = async () => {
    if (!crmClient) return;
    if (!newNoteText.trim()) return;
    setNewNoteLoading(true);
    try {
      const res = await api.post(`/crm/clients/${crmClient.id}/notes`, {
        content: newNoteText.trim()
      });
      if (res.data?.success) {
        setClientNotes(prev => [res.data.note, ...prev]);
        setNewNoteText('');
        showNotification('Nota agregada exitosamente.', 'success');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al agregar la nota.', 'error');
    } finally {
      setNewNoteLoading(false);
    }
  };

  // Delete an independent note
  const handleDeleteNote = async (noteId: number) => {
    if (!crmClient) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta nota?')) return;
    try {
      const res = await api.delete(`/crm/clients/${crmClient.id}/notes/${noteId}`);
      if (res.data?.success) {
        setClientNotes(prev => prev.filter((n: any) => n.id !== noteId));
        showNotification('Nota eliminada exitosamente.', 'success');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al eliminar la nota.', 'error');
    }
  };

  // Categories CRUD
  const handleCreateCrmCategory = async () => {
    if (!crmNewCategoryName || !crmNewCategoryName.trim()) return;
    try {
      const res = await api.post('/crm/categories', { name: crmNewCategoryName.trim() });
      if (res.data?.success) {
        showNotification('Categoría creada exitosamente.', 'success');
        setCrmNewCategoryName('');
        fetchCrmCategories();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al crear la categoría.', 'error');
    }
  };

  const handleUpdateCrmCategory = async (id: number) => {
    if (!crmEditingCategoryName || !crmEditingCategoryName.trim()) return;
    try {
      const res = await api.put(`/crm/categories/${id}`, { name: crmEditingCategoryName.trim() });
      if (res.data?.success) {
        showNotification('Categoría renombrada exitosamente.', 'success');
        setCrmEditingCategoryId(null);
        setCrmEditingCategoryName('');
        fetchCrmCategories();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar la categoría.', 'error');
    }
  };

  const handleDeleteCrmCategory = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta categoría? Los contactos vinculados quedarán sin categoría.')) return;
    try {
      const res = await api.delete(`/crm/categories/${id}`);
      if (res.data?.success) {
        showNotification('Categoría eliminada con éxito.', 'success');
        fetchCrmCategories();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al eliminar la categoría.', 'error');
    }
  };

  
  // Fetch global CRM tasks
  const fetchGlobalTasks = useCallback(async () => {
    setGlobalTasksLoading(true);
    try {
      const res = await api.get('/crm/tasks');
      if (res.data?.success) {
        setGlobalTasks(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching CRM tasks:', err.message);
    } finally {
      setGlobalTasksLoading(false);
    }
  }, []);

  const handleToggleGlobalTask = async (task: any) => {
    try {
      const newCompleted = !task.completed;
      const res = await api.put(`/crm/tasks/${task.id}`, {
        completed: newCompleted,
        due_date: task.due_date
      });
      if (res.data?.success) {
        setGlobalTasks(prev => 
          prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t)
        );
        showNotification(newCompleted ? 'Tarea marcada como completada.' : 'Tarea marcada como pendiente.', 'success');
      }
    } catch (err: any) {
      showNotification('Error al actualizar la tarea.', 'error');
    }
  };

  const handleDeleteGlobalTask = async (taskId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;
    try {
      const res = await api.delete(`/crm/tasks/${taskId}`);
      if (res.data?.success) {
        setGlobalTasks(prev => prev.filter(t => t.id !== taskId));
        showNotification('Tarea eliminada correctamente.', 'success');
      }
    } catch (err: any) {
      showNotification('Error al eliminar la tarea.', 'error');
    }
  };

  const handleUpdateGlobalTaskDate = async (task: any, newDate: string | null) => {
    try {
      const res = await api.put(`/crm/tasks/${task.id}`, {
        completed: task.completed,
        due_date: newDate
      });
      if (res.data?.success) {
        setGlobalTasks(prev => 
          prev.map(t => t.id === task.id ? { ...t, due_date: newDate } : t)
        );
        showNotification('Fecha límite de la tarea actualizada.', 'success');
      }
    } catch (err: any) {
      showNotification('Error al actualizar la fecha de la tarea.', 'error');
    }
  };

  const handleCreateGlobalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskClientId) {
      showNotification('Selecciona un cliente para la tarea.', 'error');
      return;
    }
    if (!newTaskTitle.trim()) {
      showNotification('Ingresa la descripción de la tarea.', 'error');
      return;
    }
    setNewTaskCreating(true);
    try {
      const res = await api.post(`/crm/clients/${newTaskClientId}/tasks`, {
        title: newTaskTitle.trim(),
        due_date: newTaskDueDate || null
      });
      if (res.data?.success) {
        fetchGlobalTasks();
        setNewTaskTitle('');
        setNewTaskDueDate('');
        showNotification('Tarea creada exitosamente.', 'success');
      }
    } catch (err: any) {
      showNotification('Error al crear la tarea.', 'error');
    } finally {
      setNewTaskCreating(false);
    }
  };

  const handleGoToChat = (phone: string, clientName: string) => {
    const matchingChat = chats.find(c => c && c.remoteJid && c.remoteJid.split('@')[0].split(':')[0] === phone);
    if (matchingChat) {
      setSelectedChat(matchingChat);
    } else {
      setSelectedChat({
        remoteJid: `${phone}@s.whatsapp.net`,
        pushName: clientName,
        unreadCount: 0
      });
    }
    setActiveTab('chats');
  };

  
  const handleSendProductToChat = async (product: any) => {
    if (!selectedChat) {
      showNotification('Selecciona una conversación activa para enviar el producto.', 'error');
      return;
    }
    const captionText = `📦 *${product.name}*
💵 *Precio*: ${product.price}

📝 *Detalles*: ${product.description}`;

    try {
      const res = await api.post(`/instances/chats/${selectedInstanceForChats}/send-media`, {
        remoteJid: selectedChat.remoteJid,
        media: product.originalImage,
        mediatype: 'image',
        mimetype: 'image/jpeg',
        caption: captionText,
        fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
      });
      if (res.data?.success) {
        showNotification('Ficha de producto enviada con imagen.', 'success');
        await fetchMessages(true);
      }
    } catch (err: any) {
      showNotification('Error al enviar el producto con imagen.', 'error');
    }
  };

  const handleSendQuoteToChat = async (product: any) => {
    if (!selectedChat) {
      showNotification('Selecciona una conversación activa para enviar la cotización.', 'error');
      return;
    }
    const quoteId = Math.floor(100000 + Math.random() * 900000);
    const messageText = `🧾 *COTIZACIÓN PRELIMINAR #${quoteId}*
---------------------------------------
👤 *Cliente*: ${selectedChat.pushName || 'Contacto'}
📦 *Producto*: ${product.name}
💵 *Subtotal*: ${product.price}
📊 *IGV (18%)*: Incluido
---------------------------------------
💰 *TOTAL A PAGAR*: ${product.price}

*Nota*: Esta cotización tiene una validez de 7 días hábiles. Si deseas proceder con la compra, confírmanos por este medio.`;

    try {
      // Inyectar cotización en UI inmediatamente (Optimistic UI)
      useCrmStore.getState().addOptimisticMessage(messageText, selectedChat.remoteJid);
      
      const res = await api.post(`/instances/chats/${selectedInstanceForChats}/send`, {
        remoteJid: selectedChat.remoteJid,
        text: messageText
      });
      if (res.data?.success) {
        showNotification('Cotización formal enviada al chat.', 'success');
      } else {
        showNotification('Error al enviar la cotización.', 'error');
      }
    } catch (err: any) {
      showNotification('Error al enviar la cotización.', 'error');
    }
  };

  const getLocalDateString = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const offset = d.getTimezoneOffset();
    const localD = new Date(d.getTime() - (offset * 60 * 1000));
    return localD.toISOString().substring(0, 10);
  };

// Fetch CRM Clients for the Clients Tab
  const fetchCrmClients = useCallback(async (searchQuery?: string) => {
    setCrmClientsLoading(true);
    try {
      const params = searchQuery?.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const res = await api.get(`/crm/clients${params}`);
      if (res.data?.success) {
        setCrmClients(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching CRM clients:', err.message);
    } finally {
      setCrmClientsLoading(false);
    }
  }, []);

  // Fetch contacts for a specific client (expand row)
  const fetchCrmClientContacts = useCallback(async (clientId: number) => {
    setCrmClientContactsLoading(true);
    try {
      const res = await api.get(`/crm/clients/${clientId}/contacts`);
      if (res.data?.success) {
        setCrmClientContacts(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching client contacts:', err.message);
    } finally {
      setCrmClientContactsLoading(false);
    }
  }, []);

  // Load CRM clients when contacts or birthdays tab is active
  
  // Load global tasks when tasks tab is active
  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchGlobalTasks();
      // Load clients list too so they can be assigned in the select dropdown
      fetchCrmClients();
    }
  }, [activeTab, fetchGlobalTasks, fetchCrmClients]);

useEffect(() => {
    if (activeTab === 'contacts' || activeTab === 'birthdays') {
      fetchCrmClients();
    }
  }, [activeTab, fetchCrmClients]);

  // Load pipeline data when pipeline tab is active
  useEffect(() => {
    if (activeTab === 'pipeline') {
      fetchPipelineData();
    }
  }, [activeTab, fetchPipelineData]);

  // Check URL parameters for Google Contacts connection status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleContactsStatus = params.get('google_contacts');
    if (googleContactsStatus === 'success') {
      showNotification('¡Google Contactos conectado exitosamente!', 'success');
      setActiveTab('contacts');
      // Limpiar query params de la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleContactsStatus === 'error') {
      showNotification('Error al conectar Google Contactos. Inténtalo de nuevo.', 'error');
      // Limpiar query params de la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Cargar estado de Google Contactos al iniciar
  useEffect(() => {
    fetchGoogleContactsStatus();
  }, [fetchGoogleContactsStatus]);

  // Cargar categorías CRM al arrancar
  useEffect(() => {
    fetchCrmCategories();
    fetchCrmContactMap();
    fetchCrmContactTagsMap();
    fetchCrmContactAgentsMap();
  }, [fetchCrmCategories, fetchCrmContactMap, fetchCrmContactTagsMap, fetchCrmContactAgentsMap]);

  // Cargar colaboradores y vistas de Super Admin al cambiar de pestaña
  useEffect(() => {
    if (activeTab === 'team' || activeTab === 'chats') {
      fetchTeamMembers();
    } else if (activeTab === 'admin_overview') {
      fetchAdminStats();
    } else if (activeTab === 'admin_users') {
      fetchAdminUsers();
    } else if (activeTab === 'admin_instances') {
      fetchAdminInstances();
    }
  }, [activeTab, fetchTeamMembers, fetchAdminStats, fetchAdminUsers, fetchAdminInstances]);

  // Cargar grupos cuando se activa la pestaña y hay instancia seleccionada
  useEffect(() => {
    if (activeTab === 'groups' && selectedInstanceForChats) {
      fetchGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedInstanceForChats]);

  // Fetch WhatsApp Groups
  const fetchGroups = async () => {
    if (!selectedInstanceForChats) return;
    setGroupsLoading(true);
    try {
      const res = await api.get(`/instances/groups/${selectedInstanceForChats}`);
      if (res.data?.success) {
        const fetchedGroups = res.data.data || [];
        setGroups(fetchedGroups);
        
        // Si hay un grupo seleccionado actualmente, actualizar sus datos locales
        if (selectedGroup) {
          const fresh = fetchedGroups.find((g: any) => g.id === selectedGroup.id);
          if (fresh) {
            setSelectedGroup(fresh);
          }
        }
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener los grupos de WhatsApp', 'error');
    } finally {
      setGroupsLoading(false);
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceForChats) return;
    if (!createGroupSubject.trim()) {
      setCreateGroupError('El nombre del grupo es obligatorio.');
      return;
    }

    setCreateGroupLoading(true);
    setCreateGroupError(null);

    // Convert string of comma separated phone numbers to array
    const parts = createGroupParticipants
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      const res = await api.post(`/instances/groups/${selectedInstanceForChats}/create`, {
        subject: createGroupSubject,
        participants: parts
      });

      if (res.data?.success) {
        showNotification('Grupo creado exitosamente');
        setShowCreateGroupModal(false);
        setCreateGroupSubject('');
        setCreateGroupParticipants('');
        fetchGroups();
      }
    } catch (err: any) {
      setCreateGroupError(err.response?.data?.error || 'Error al crear el grupo');
    } finally {
      setCreateGroupLoading(false);
    }
  };

  // Update participant action (add, remove, promote, demote)
  const handleUpdateGroupParticipant = async (action: 'add' | 'remove' | 'promote' | 'demote', targetPhone: string) => {
    if (!selectedInstanceForChats || !selectedGroup) return;

    try {
      const cleanPhone = targetPhone.replace(/\D/g, '');
      const phoneWithSuffix = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
      
      const res = await api.put(`/instances/groups/${selectedInstanceForChats}/participants`, {
        groupJid: selectedGroup.id,
        action,
        participants: [phoneWithSuffix]
      });

      if (res.data?.success) {
        showNotification('Participante actualizado correctamente');
        fetchGroups();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al modificar participante', 'error');
    }
  };

  // Add a participant from panel input form
  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addParticipantNumber.trim() || !selectedGroup) return;

    setAddParticipantLoading(true);
    try {
      const cleanPhone = addParticipantNumber.replace(/\D/g, '');
      const phoneWithSuffix = `${cleanPhone}@s.whatsapp.net`;
      
      const res = await api.put(`/instances/groups/${selectedInstanceForChats}/participants`, {
        groupJid: selectedGroup.id,
        action: 'add',
        participants: [phoneWithSuffix]
      });

      if (res.data?.success) {
        showNotification('Participante agregado correctamente');
        setAddParticipantNumber('');
        fetchGroups();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al agregar participante', 'error');
    } finally {
      setAddParticipantLoading(false);
    }
  };

  // Fetch group invite code
  const handleFetchInviteLink = async (groupJid: string) => {
    if (!selectedInstanceForChats) return;
    setInviteLinkLoading(true);
    try {
      const res = await api.get(`/instances/groups/${selectedInstanceForChats}/invite-code`, {
        params: { groupJid }
      });
      if (res.data?.success) {
        const code = res.data.data?.code;
        if (code) {
          const link = `https://chat.whatsapp.com/${code}`;
          setInviteLinkLabel(link);
          navigator.clipboard.writeText(link);
          showNotification('¡Enlace de invitación copiado al portapapeles!');
        } else {
          showNotification('No se pudo generar el código del grupo', 'error');
        }
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener código del grupo', 'error');
    } finally {
      setInviteLinkLoading(false);
    }
  };

  // Revoke group invite code
  const handleRevokeInviteLink = async (groupJid: string) => {
    if (!selectedInstanceForChats) return;
    setInviteLinkLoading(true);
    try {
      const res = await api.post(`/instances/groups/${selectedInstanceForChats}/revoke-invite`, { groupJid });
      if (res.data?.success) {
        showNotification('Código de invitación revocado con éxito');
        setInviteLinkLabel(null);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al revocar código del grupo', 'error');
    } finally {
      setInviteLinkLoading(false);
    }
  };

  // Auto-scroll inteligente: solo scroll si llegan mensajes nuevos (no en cada render)
  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevMessagesCountRef.current) {
      prevMessagesCountRef.current = messages.length;
      // Pequeño delay para que el DOM se actualice antes del scroll
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [messages.length]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await api.post('/instances/create', { instanceName: newInstanceName.trim() });
      if (res.data?.success) {
        showNotification('Instancia creada correctamente.');
        setShowCreateModal(false);
        setNewInstanceName('');
        fetchInstances(true);
        setActiveTab('instances');
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Error al crear instancia');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGetQr = async (instanceName: string) => {
    setActiveQrInstance(instanceName);
    setQrBase64(null);
    setQrLoading(true);

    try {
      const res = await api.get(`/instances/qr/${instanceName}`);
      if (res.data?.success) {
        setQrBase64(res.data.qrcode);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener QR', 'error');
      setActiveQrInstance(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogoutInstance = (instanceName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cerrar Sesión',
      message: `¿Estás seguro de cerrar sesión en la instancia ${instanceName}?`,
      confirmText: 'Cerrar Sesión',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.post(`/instances/logout/${instanceName}`);
          if (res.data?.success) {
            showNotification('Sesión cerrada correctamente.');
            fetchInstances(true);
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al cerrar sesión', 'error');
        }
      }
    });
  };

  const handleDeleteInstance = (instanceName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Instancia',
      message: `¿Estás seguro de ELIMINAR la instancia ${instanceName}? Esto borrará la sesión de WhatsApp de forma permanente.`,
      confirmText: 'Eliminar Instancia',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/instances/delete/${instanceName}`);
          if (res.data?.success) {
            showNotification('Instancia eliminada correctamente.');
            fetchInstances(true);
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al eliminar instancia', 'error');
        }
      }
    });
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInstance || !testNumber.trim() || !testText.trim()) return;

    const inst = instances.find(i => i.instance_name === testInstance);
    if (!inst) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      let formattedNumber = testNumber.trim();
      if (formattedNumber.length === 9 && formattedNumber.startsWith('9')) {
        formattedNumber = `51${formattedNumber}`;
      }

      const res = await api.post('/instances/send', {
        instanceName: testInstance,
        apiKey: inst.api_key,
        number: formattedNumber,
        text: testText.trim()
      });

      if (res.data?.success) {
        setTestResult({ success: true, message: 'Mensaje enviado exitosamente en vivo 🚀' });
        setTestNumber('');
        showNotification('Mensaje enviado con éxito');
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Error al enviar mensaje' });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Copiado al portapapeles!');
  };

  const menuItems = [
    // Super Admin Tabs
    ...(user?.role === 'admin' ? [
      { id: 'admin_overview', label: 'Resumen Global', icon: LayoutGrid },
      { id: 'admin_users', label: 'Empresas / Clientes', icon: Building },
      { id: 'admin_instances', label: 'Líneas Totales', icon: Smartphone },
    ] : []),

    // Tenant / Client Admin Tabs
    ...(user?.role === 'client' ? [
      { id: 'overview', label: 'Resumen', icon: LayoutGrid },
      { id: 'instances', label: 'Líneas / QR', icon: Smartphone },
      { id: 'chats', label: 'Chats en Vivo', icon: MessageSquare },
      { id: 'pipeline', label: 'Pipeline Comercial', icon: GitBranch },
      { id: 'tasks', label: 'Tareas CRM', icon: ListTodo },
      { id: 'contacts', label: 'Clientes / Agenda', icon: Users },
      { id: 'birthdays', label: 'Cumpleaños', icon: Gift },
      { id: 'groups', label: 'Grupos (WhatsApp)', icon: Users2 },
      { id: 'team', label: 'Mi Equipo', icon: User },
      { id: 'playground', label: 'Probar Envío', icon: Play },
      { id: 'docs', label: 'Documentación API', icon: Terminal },
      { id: 'subscription', label: 'Suscripción', icon: Key },
    ] : []),

    // Collaborator / Agent Tabs
    ...(user?.role === 'agent' ? [
      { id: 'chats', label: 'Chats en Vivo', icon: MessageSquare },
      { id: 'contacts', label: 'Clientes / Agenda', icon: Users },
      { id: 'birthdays', label: 'Cumpleaños', icon: Gift },
      { id: 'tasks', label: 'Tareas CRM', icon: ListTodo },
    ] : []),
  ];

  const currentBackendUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : 'https://zaza-click-20-production.up.railway.app';

  // API Documentation text generator
  const getDocCode = () => {
    const selectedInst = instances[0] || { instance_name: 'mi_instancia', api_key: 'tu_api_key' };
    
    let path = '';
    let method = 'POST';
    let payloadObj: any = {};
    let queryParamsStr = '';

    if (docTab === 'text') {
      path = '/api/instances/send';
      method = 'POST';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        apiKey: selectedInst.api_key,
        number: '51987654321',
        text: 'Hola, este es un mensaje automático.'
      };
    } else if (docTab === 'media') {
      path = '/api/instances/send-media';
      method = 'POST';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        apiKey: selectedInst.api_key,
        number: '51987654321',
        mediaUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5',
        mediaType: 'image',
        caption: 'Mira esta imagen enviada desde el API 🎨'
      };
    } else if (docTab === 'create-group') {
      path = `/api/instances/groups/${selectedInst.instance_name}/create`;
      method = 'POST';
      payloadObj = {
        subject: 'Mi Grupo de Ventas 🚀',
        participants: ['51987654321', '51912345678']
      };
    } else if (docTab === 'participants-group') {
      path = `/api/instances/groups/${selectedInst.instance_name}/participants`;
      method = 'PUT';
      payloadObj = {
        groupJid: '1203630248384@g.us',
        action: 'add',
        participants: ['51987654321@s.whatsapp.net']
      };
    } else if (docTab === 'invite-group') {
      path = `/api/instances/groups/${selectedInst.instance_name}/invite-code`;
      method = 'GET';
      queryParamsStr = '?groupJid=1203630248384@g.us';
    }

    const payload = JSON.stringify(payloadObj, null, 2);

    switch (docLang) {
      case 'js':
        if (method === 'GET') {
          return `fetch('${currentBackendUrl}${path}${queryParamsStr}')
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`;
        }
        return `fetch('${currentBackendUrl}${path}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${payload.replace(/\n/g, '\n  ')})
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`;

      case 'python':
        if (method === 'GET') {
          return `import requests

url = "${currentBackendUrl}${path}"
params = {
    "groupJid": "1203630248384@g.us"
}

response = requests.get(url, params=params)
print(response.json())`;
        }
        return `import requests

url = "${currentBackendUrl}${path}"
payload = ${payload}
headers = {
    "Content-Type": "application/json"
}

response = requests.${method.toLowerCase()}(url, json=payload, headers=headers)
print(response.json())`;

      case 'php':
        if (method === 'GET') {
          return `<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "${currentBackendUrl}${path}${queryParamsStr}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => "GET",
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`;
        }
        return `<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "${currentBackendUrl}${path}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => "${method}",
  CURLOPT_POSTFIELDS => '${payload.replace(/'/g, "\\'")}',
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json"
  ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`;

      case 'curl':
      default:
        if (method === 'GET') {
          return `curl -X GET "${currentBackendUrl}${path}${queryParamsStr}"`;
        }
        return `curl -X ${method} "${currentBackendUrl}${path}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`;
    }
  };

  const getPipelineColumns = () => {
    const columns: Record<string, any[]> = {};
    
    PIPELINE_STAGES.forEach(stg => {
      columns[stg] = [];
    });

    pipelineData.forEach(contact => {
      const stage = contact.pipeline_stage || 'Nuevo';
      if (columns[stage]) {
        columns[stage].push({
          type: 'crm',
          remoteJid: `${contact.phone_number}@s.whatsapp.net`,
          name: contact.client_name,
          phone: contact.phone_number,
          category: contact.category_name,
          notes: contact.notes,
          contactId: contact.contact_id
        });
      }
    });

    const crmPhones = new Set(pipelineData.map(p => p.phone_number.replace(/\D/g, '')));
    chats.forEach(chat => {
      if (!chat.remoteJid || !chat.remoteJid.endsWith || chat.remoteJid.endsWith('@g.us')) return;
      const phone = chat.remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
      if (!crmPhones.has(phone)) {
        columns['Nuevo'].push({
          type: 'chat',
          remoteJid: chat.remoteJid,
          name: chat.pushName || `Contacto ${phone}`,
          phone: phone,
          lastMsg: chat.lastMessage?.message?.conversation || chat.lastMessage?.message?.extendedTextMessage?.text || ''
        });
      }
    });

    return columns;
  };

  const activeInstancesCount = instances.filter(i => i.status === 'connected').length;
  const maxInstances = subscription?.max_instances || 1;

  return (
    <div className="flex h-screen mesh-gradient text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl border shadow-premium-lg flex items-center gap-2.5 text-xs font-bold animate-fadeIn ${
          notification.type === 'success'
            ? 'bg-pastel-100/50 border-pastel-100/40 text-brand-secondary dark:text-brand-primary'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-brand-primary" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Offline Banner */}
      {isServerOffline && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-brand-secondary backdrop-blur-sm text-white text-xs font-bold py-1.5 px-4 text-center shadow-md animate-fadeIn flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin" />
          <span>Actualizando servidor (Railway)... Manteniendo la conexión en espera...</span>
        </div>
      )}

      {/* Sidebar Overlay (Visible when open) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Spacer for fixed sidebar on desktop */}
      <div className="hidden lg:block w-20 flex-shrink-0 transition-all duration-300" />

      {/* Sidebar */}
      <aside 
        className={`bg-[#1E293B] dark:bg-surface-950 flex flex-col transition-all duration-300 shadow-premium z-50 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand header */}
        <div className={`h-[72px] flex items-center ${sidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-white/5`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-md shadow-brand-primary/25">
                <Smartphone size={18} />
              </div>
              <span className="font-semibold text-white tracking-wide">
                Zaza.click <span className="text-brand-primary">2.0</span>
              </span>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const showDivider = item.id === 'playground';

            return (
              <React.Fragment key={item.id}>
                {showDivider && sidebarOpen && (
                  <div className="pt-4 pb-2 px-4">
                    <div className="text-[10px] font-extrabold text-white/30 uppercase tracking-widest">Herramientas</div>
                  </div>
                )}
                {showDivider && !sidebarOpen && (
                  <div className="py-2 flex justify-center">
                    <div className="w-6 h-px bg-white/10"></div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full group flex items-center ${
                    sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                  } rounded-2xl transition-all duration-300 relative cursor-pointer ${
                    active 
                      ? 'bg-[#12a160] text-white font-bold'
                      : 'text-slate-300 dark:text-surface-400 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                >
                  <Icon 
                    size={20} 
                    className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}
                    strokeWidth={active ? 2.5 : 2}
                    fill={active && item.id === 'chats' ? 'currentColor' : 'none'}
                  />
                  {sidebarOpen ? (
                    <span className="ml-3.5 text-[13.5px] tracking-wide">{item.label}</span>
                  ) : (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                      {item.label}
                    </span>
                  )}
                  {sidebarOpen && item.id === 'chats' && (
                    <span className={`ml-auto text-[10px] font-extrabold px-1.5 h-5 min-w-[20px] rounded-full flex items-center justify-center ${
                      active ? 'bg-white text-[#12a160]' : 'bg-white/10 text-white'}`}>
                      {chats.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0) > 0 
                        ? chats.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0) 
                        : 8}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer profile actions */}
        <div className="p-3 border-t border-white/10 dark:border-slate-800/60 bg-[#071e22] dark:bg-surface-950">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-500/20 text-white/80 hover:text-rose-300 transition-all duration-200 cursor-pointer`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen ? (
              <span className="ml-3 text-xs font-bold">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <header className="h-16 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl px-6 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-surface-500 dark:text-surface-400 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {activeTab === 'chats' ? 'Chats en Vivo' : (menuItems.find(i => i.id === activeTab)?.label || 'Panel')}
              </h2>
              {activeTab === 'chats' ? (
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-medium leading-none mt-0.5 hidden sm:block">
                  Administra tus conversaciones de WhatsApp en tiempo real.
                </p>
              ) : activeTab === 'pipeline' ? (
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-medium leading-none mt-0.5 hidden sm:block">
                  Visualiza y gestiona las etapas de tus prospectos y clientes.
                </p>
              ) : activeTab === 'tasks' ? (
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-medium leading-none mt-0.5 hidden sm:block">
                  Visualiza, administra y completa las tareas asignadas a tus clientes.
                </p>
              ) : activeTab === 'contacts' ? (
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-medium leading-none mt-0.5 hidden sm:block">
                  Gestiona tu base de clientes, contactos y agenda de Google.
                </p>
              ) : activeTab === 'birthdays' ? (
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-medium leading-none mt-0.5 hidden sm:block">
                  Seguimiento de cumpleaños de tus contactos del CRM para fortalecer relaciones comerciales.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Header Line Selector */}
            {activeTab === 'chats' && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-800/40 shadow-premium-sm">
                <span className="text-[10px] font-bold text-surface-400 whitespace-nowrap">Línea activa:</span>
                <div className="relative font-sans" ref={chatsDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowChatsInstanceMenu(!showChatsInstanceMenu)}
                    className="px-2.5 py-1 bg-slate-100/60 dark:bg-slate-800/60 rounded-xl text-[10px] text-slate-800 dark:text-white hover:bg-slate-200 transition-all font-bold cursor-pointer flex items-center justify-between gap-1.5 min-w-[130px] focus:outline-none"
                  >
                    {selectedInstanceForChats ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-emerald-500 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-8.884 9.888-8.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </span>
                        <span className="truncate">{selectedInstanceForChats}</span>
                      </div>
                    ) : (
                      <span className="text-surface-400">Seleccionar línea...</span>
                    )}
                    <ChevronDown size={11} className={`text-surface-400 transition-transform duration-200 ${showChatsInstanceMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showChatsInstanceMenu && (
                    <div className="absolute top-[100%] right-0 mt-1.5 z-50 bg-[#1E293B] dark:bg-slate-900 rounded-2xl shadow-premium-lg p-1.5 flex flex-col gap-1 min-w-[200px] border-0 text-left animate-fadeIn">
                      {instances.length === 0 ? (
                        <span className="p-3 text-[10px] text-surface-400 dark:text-surface-500 font-bold block text-center">No hay líneas creadas</span>
                      ) : (
                        instances.map(inst => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => {
                              setSelectedInstanceForChats(inst.instance_name);
                              setSelectedChat(null);
                              setShowChatsInstanceMenu(false);
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer text-left \${
                              selectedInstanceForChats === inst.instance_name 
                                ? 'bg-[#0D9488] dark:bg-slate-800/60 text-white dark:text-white' 
                                : 'text-slate-100 dark:text-surface-400 hover:bg-[#0D9488]/40 dark:hover:bg-slate-800/40 hover:text-white dark:hover:text-white'
                            }`}
                          >
                            <span className="truncate">{inst.instance_name}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold \${
                              inst.status === 'connected' 
                                ? 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary' 
                                : 'bg-slate-100 dark:bg-slate-950 text-surface-500'
                            }`}>
                              {inst.status === 'connected' ? 'En línea' : 'Desconectada'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => fetchChats(false)}
                  disabled={chatsLoading}
                  type="button"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 text-surface-400 hover:text-slate-600 cursor-pointer border-0"
                  title="Refrescar chats"
                >
                  <RefreshCw size={12} className={chatsLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
            {/* Online Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-pastel-100 dark:bg-emerald-950/30 rounded-xl">
              <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-brand-secondary dark:text-brand-primary uppercase tracking-wider">En Línea</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
              title="Cambiar tema"
            >
              {isDark ? <Sun size={18} className="text-slate-400 dark:text-slate-300" /> : <Moon size={18} className="text-slate-600 dark:text-slate-400" />}
            </button>

            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand-500/20 uppercase">
                {user?.email?.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-white">{user?.email}</span>
                <span className="text-[9px] text-surface-400 font-bold uppercase tracking-wider">Cliente SaaS</span>
              </div>
            </div>
          </div>
        </header>

        {/* Interactive Content Container */}
        <main className={`flex-1 bg-transparent relative ${activeTab === 'chats' ? 'overflow-hidden p-3.5 md:p-4 pb-4' : 'p-4 sm:p-6 lg:p-6 overflow-y-auto'}`}>
          
          {/* Active Section Renderer */}
          <div className={`w-full ${activeTab === 'chats' ? 'h-full flex flex-col space-y-0' : 'space-y-6'}`}>
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Upgrade/Welcome Card Banner */}
                <div className="p-6 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-brand-primary/10 text-white">
                  <div className="space-y-2 text-left relative z-10">
                    <span className="px-2.5 py-1 bg-white/20 border border-white/30 rounded-md text-[9px] font-bold text-white uppercase tracking-widest">
                      Licencia Activa
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {subscription?.plan_name?.toLowerCase().startsWith('plan') ? subscription.plan_name : `Plan ${subscription?.plan_name || 'Básico'}`}
                    </h3>
                    <p className="text-xs text-white/90 max-w-lg leading-relaxed">
                      Vincula tu línea de WhatsApp escaneando el código QR. Puedes enviar notificaciones automatizadas utilizando las credenciales de tu instancia.
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap relative z-10">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      disabled={instances.length >= maxInstances}
                      className="px-4 py-2.5 bg-white hover:bg-white/95 text-brand-secondary font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                      <span>Nueva Instancia</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('docs')}
                      className="px-4 py-2.5 bg-white/20 border border-white/30 hover:bg-white/30 text-white font-bold text-xs rounded-xl hover-lift shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <BookOpen size={16} />
                      <span>Ver Docs</span>
                    </button>
                  </div>

                  {/* Backdrop lights */}
                  <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] pointer-events-none" />
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Líneas Vinculadas */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl hover-lift shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest block">Líneas Vinculadas</span>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                        {instances.length} <span className="text-xs text-surface-400 font-medium">de</span> {maxInstances}
                      </h3>
                      <p className="text-[10px] text-surface-500">Capacidad para crear instancias.</p>
                    </div>
                    <div className="p-3 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl flex-shrink-0">
                      <Smartphone size={22} />
                    </div>
                  </div>

                  {/* Card 2: Instancias Online */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl hover-lift shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest block">Instancias Online</span>
                      <h3 className="text-2xl font-black text-brand-primary">
                        {activeInstancesCount} <span className="text-xs text-surface-450 font-medium">de</span> {instances.length || 0}
                      </h3>
                      <p className="text-[10px] text-surface-500">Números con WhatsApp en línea.</p>
                    </div>
                    <div className="p-3 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary rounded-2xl flex-shrink-0">
                      <CheckCircle2 size={22} />
                    </div>
                  </div>

                  {/* Card 3: Próxima Renovación */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl hover-lift shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest block">Próxima Renovación</span>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                        {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                      </h3>
                      <p className="text-[10px] text-surface-500">Vence tu suscripción mensual.</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-2xl flex-shrink-0">
                      <Clock size={22} />
                    </div>
                  </div>
                </div>

                {/* Dashboard Instance Table Summary */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-surface-500">Estado de Líneas</h4>
                    <button 
                      onClick={() => fetchInstances()} 
                      disabled={loading}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-surface-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {instances.length === 0 ? (
                    <div className="py-10 text-center text-xs text-surface-400">
                      No hay líneas agregadas. Ve a la pestaña de <button onClick={() => setActiveTab('instances')} className="text-brand-primary font-bold hover:underline">Líneas / QR</button> para comenzar.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-surface-400 font-bold">
                            <th className="pb-3">Nombre Instancia</th>
                            <th className="pb-3">Número Celular</th>
                            <th className="pb-3">Estado Conexión</th>
                            <th className="pb-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {instances.map(inst => (
                            <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                              <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">{inst.instance_name}</td>
                              <td className="py-3.5 text-surface-600 dark:text-surface-400 font-medium">{inst.phone || 'Pendiente vinculación'}</td>
                              <td className="py-3.5">
                                {inst.status === 'connected' ? (
                                  <span className="px-2 py-0.5 bg-pastel-100/50 border border-pastel-100/40 text-[9px] font-bold text-brand-secondary dark:text-brand-primary rounded-md">CONNECTED</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-500/10 border border-slate-200/50 dark:border-slate-800/50 text-[9px] font-bold text-surface-500 rounded-md">DISCONNECTED</span>
                                )}
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => {
                                    if (inst.status === 'disconnected') {
                                      handleGetQr(inst.instance_name);
                                    } else {
                                      setActiveTab('instances');
                                    }
                                  }}
                                  className="text-[10px] text-brand-secondary dark:text-brand-primary font-bold hover:underline cursor-pointer"
                                >
                                  {inst.status === 'disconnected' ? 'Vincular QR' : 'Administrar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* INSTANCES SECTION */}
            {activeTab === 'instances' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="text-left space-y-0.5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Líneas de WhatsApp</h3>
                    <p className="text-xs text-surface-400">Escanea los códigos QR para iniciar sesión y habilitar los envíos.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={instances.length >= maxInstances}
                    className="px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-sm-custom flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Agregar Instancia</span>
                  </button>
                </div>

                {instances.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl py-20 text-center space-y-4">
                    <Smartphone className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No tienes instancias activas</h4>
                      <p className="text-xs text-surface-400 max-w-sm mx-auto leading-relaxed">
                        Crea tu primera instancia de WhatsApp para obtener tus credenciales de envío y escanear el QR.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-pastel-100/50 hover:bg-pastel-100/70 text-brand-secondary dark:text-brand-primary text-xs font-bold rounded-xl border border-pastel-100/40 transition-all cursor-pointer"
                    >
                      Crear Primera Instancia
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {instances.map(inst => (
                      <div 
                        key={inst.id} 
                        className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 hover-lift flex flex-col justify-between gap-5 relative overflow-hidden"
                      >
                        {/* Background light indicator */}
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none ${
                          inst.status === 'connected' ? 'bg-pastel-100/20' : 'bg-rose-500/5'
                        }`} />

                        {/* Card Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 relative z-10">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm text-slate-800 dark:text-white">{inst.instance_name}</span>
                            {inst.status === 'connected' ? (
                              <span className="px-2 py-0.5 bg-pastel-100/50 border border-pastel-100/40 text-[9px] font-bold text-brand-secondary dark:text-brand-primary rounded-md">CONECTADO</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-500/10 border border-slate-200/50 dark:border-slate-800/50 text-[9px] font-bold text-surface-500 rounded-md">DESCONECTADO</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setTestInstance(inst.instance_name);
                                setTestResult(null);
                                setActiveTab('playground');
                              }}
                              className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-brand-primary rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                              title="Probar Envío"
                            >
                              <Send size={13} />
                            </button>

                            <button
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/20 text-surface-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                              title="Eliminar Instancia"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Connection action button */}
                        <div className="relative z-10 flex flex-col gap-2">
                          <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider text-left">Acción de WhatsApp</span>
                          {inst.status === 'disconnected' ? (
                            <button
                              onClick={() => handleGetQr(inst.instance_name)}
                              className="w-full py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-xl shadow-lg shadow-sm-custom transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Key size={14} />
                              <span>Vincular Código QR</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLogoutInstance(inst.instance_name)}
                              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200/30 dark:border-rose-800/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <LogOut size={14} />
                              <span>Cerrar Sesión</span>
                            </button>
                          )}
                        </div>

                        {/* Middle: API Credentials */}
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-5 space-y-2.5 text-xs text-left relative z-10">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">Instance Name</span>
                            <div className="flex items-center gap-2">
                              <code className="text-slate-800 dark:text-white font-mono font-bold text-[11px]">{inst.instance_name}</code>
                              <button 
                                onClick={() => copyToClipboard(inst.instance_name)} 
                                className="text-surface-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/40">
                            <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">API Token (Key)</span>
                            <div className="flex items-center gap-2">
                              <code className="text-slate-800 dark:text-white font-mono text-[11px]">{inst.api_key}</code>
                              <button 
                                onClick={() => copyToClipboard(inst.api_key)} 
                                className="text-surface-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CHATS SECTION */}
            {activeTab === 'chats' && (
              <div className="animate-fadeIn h-full flex flex-col min-h-0">
                {/* Validation warnings */}
                {instances.length === 0 ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <Smartphone size={48} className="text-slate-300 dark:text-surface-600" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No hay líneas vinculadas</h4>
                      <p className="text-xs text-surface-400 max-w-sm">Crea y escanea una línea de WhatsApp en la pestaña "Líneas / QR" para poder comenzar a chatear.</p>
                    </div>
                  </div>
                ) : !selectedInstanceForChats ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-xs text-surface-400">Por favor, selecciona una línea de WhatsApp en el menú superior.</p>
                  </div>
                ) : instances.find(i => i.instance_name === selectedInstanceForChats)?.status !== 'connected' ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <AlertCircle size={48} className="text-amber-500" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Línea Desconectada</h4>
                      <p className="text-xs text-surface-400 max-w-sm">La línea "{selectedInstanceForChats}" no está vinculada. Por favor, ve a la pestaña "Líneas / QR", obtén el código QR y escanéalo con tu teléfono.</p>
                    </div>
                  </div>
                ) : (
                  /* Connected Chat Interface */
                  <div className="flex-1 min-h-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl overflow-hidden flex md:grid md:grid-cols-12 shadow-premium-lg text-left">
                    
                    {/* LEFT PANEL: Chats List */}
                    <div className={`${selectedChat ? (selectedChat.remoteJid && selectedChat.remoteJid.endsWith && !selectedChat.remoteJid.endsWith('@g.us') ? 'md:col-span-2' : 'md:col-span-3') : 'md:col-span-4'} bg-white dark:bg-slate-950 flex-col min-h-0 w-full md:w-auto ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                      {/* Search Bar */}
                      <div className="p-4 pb-2 relative">
                        <input
                          type="text"
                          placeholder="Buscar conversación..."
                          value={chatsSearchQuery}
                          onChange={(e) => setChatsSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/20 font-medium transition-all"
                        />
                        <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-surface-400" />
                      </div>

                      {/* Barra de Filtro de Etiquetas */}
                      <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto hide-scrollbar scroll-smooth">
                        <button
                          onClick={() => setSelectedFilterTag(null)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                            selectedFilterTag === null
                              ? 'bg-brand-primary text-white'
                              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          Todo
                        </button>
                        {SMART_TAGS.map(tag => {
                          const isSelected = selectedFilterTag === tag;
                          return (
                            <button
                              key={tag}
                              onClick={() => setSelectedFilterTag(isSelected ? null : tag)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                isSelected
                                  ? 'bg-brand-primary text-white'
                                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>

                      {/* Chats List Body */}
                      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 scrollbar-hide">
                        {chatsLoading && chats.length === 0 ? (
                          <div className="p-4 text-center text-xs text-surface-400 animate-pulse">Cargando conversaciones...</div>
                        ) : chatsError ? (
                          <div className="p-4 text-center text-xs text-red-500">{chatsError}</div>
                        ) : chats.length === 0 ? (
                          <div className="p-4 text-center text-xs text-surface-400">No se encontraron conversaciones activas.</div>
                        ) : (
                          chats
                            .filter(chat => chat && chat.remoteJid)
                            .filter(chat => {
                              const cleanRemoteJid = chat.remoteJid.split('@')[0].split(':')[0];
                              const contactName = (crmContactMap[cleanRemoteJid] || chat.pushName || cleanRemoteJid).toLowerCase();
                              const searchLower = chatsSearchQuery.toLowerCase();
                              const tags = crmContactTagsMap[cleanRemoteJid] || [];

                              // 1. Filtrar por etiqueta seleccionada
                              if (selectedFilterTag && !tags.includes(selectedFilterTag)) {
                                return false;
                              }

                              // 2. Filtrar por texto de búsqueda
                              if (searchLower) {
                                const nameMatch = contactName.includes(searchLower);
                                const tagMatch = tags.some(t => t.toLowerCase().includes(searchLower));
                                return nameMatch || tagMatch;
                              }

                              return true;
                            })
                            .map((chat) => {
                              const isActive = selectedChat?.remoteJid === chat.remoteJid;
                              const unreadCount = Number(chat.unreadCount) || 0;
                              const isUnread = unreadCount > 0;
                              const cleanRemoteJid = chat?.remoteJid?.split('@')[0]?.split(':')[0]?.split(':')[0] || '';
                              const contactName = crmContactMap[cleanRemoteJid] || chat.pushName || cleanRemoteJid;
                              
                              // Extract last message text
                              const content = chat.lastMessage?.message;
                              let lastMsgText = '';
                              if (content) {
                                if (content.conversation) {
                                  lastMsgText = content.conversation;
                                } else if (content.extendedTextMessage?.text) {
                                  lastMsgText = content.extendedTextMessage.text;
                                } else if (content.imageMessage) {
                                  lastMsgText = '📷 Imagen';
                                } else if (content.videoMessage) {
                                  lastMsgText = '🎥 Video';
                                } else if (content.audioMessage) {
                                  lastMsgText = '🎵 Audio';
                                } else {
                                  lastMsgText = chat.lastMessage?.messageType 
                                    ? `[${chat.lastMessage.messageType.replace('Message', '')}]` 
                                    : 'Mensaje';
                                }
                              }

                                return (
                                  <button
                                    key={chat.remoteJid}
                                    onClick={() => setSelectedChat(chat)}
                                    type="button"
                                    className={`w-full py-3.5 px-3.5 flex items-center gap-3 text-left transition-all duration-300 cursor-pointer rounded-2xl relative ${isActive ? 'bg-pastel-100/20 dark:bg-brand-secondary/20' : 'hover:bg-white/45 dark:hover:bg-slate-800/20'}`}
                                  >
                                    {/* Active indicator pill */}
                                    {isActive && (
                                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full" />
                                    )}

                                    {/* Profile Photo */}
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                      {chat.profilePicUrl ? (
                                        <img src={chat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <MessageCircle size={18} className="text-surface-400" />
                                      )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <span className={`text-xs truncate ${isActive || isUnread ? 'text-slate-900 dark:text-white font-bold' : 'text-surface-500 dark:text-surface-400 font-normal'}`}>
                                            {contactName}
                                          </span>
                                          {crmContactAgentsMap[cleanRemoteJid] && (
                                            <span className="px-1 py-0.5 rounded text-[7.5px] bg-indigo-500/10 text-indigo-500 font-bold truncate max-w-[65px] flex-shrink-0" title={`Asignado a: ${crmContactAgentsMap[cleanRemoteJid].name}`}>
                                              👤 {crmContactAgentsMap[cleanRemoteJid].name.split(' ')[0]}
                                            </span>
                                          )}
                                        </div>
                                        <span className={`text-[10px] font-medium ${isUnread ? 'text-brand-primary font-bold' : 'text-surface-400'} flex-shrink-0`}>
                                          {formatTimeLocal(chat.lastMessage?.messageTimestamp)}
                                        </span>
                                      </div>
                                      {/* Tags badges in sidebar card */}
                                      {crmContactTagsMap[cleanRemoteJid] && crmContactTagsMap[cleanRemoteJid].length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {crmContactTagsMap[cleanRemoteJid].slice(0, 2).map(tag => {
                                            let colorClass = "bg-slate-500 text-white";
                                            if (tag === 'VIP') colorClass = "bg-amber-500 text-white";
                                            else if (tag === 'Moroso') colorClass = "bg-rose-600 text-white";
                                            else if (tag === 'Pendiente') colorClass = "bg-blue-500 text-white";
                                            else if (tag === 'Nuevo') colorClass = "bg-emerald-500 text-white";
                                            return (
                                              <span key={tag} className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded-full ${colorClass}`}>
                                                {tag}
                                              </span>
                                            );
                                          })}
                                          {crmContactTagsMap[cleanRemoteJid].length > 2 && (
                                            <span className="text-[8px] text-slate-400">+{crmContactTagsMap[cleanRemoteJid].length - 2}</span>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between mt-1">
                                        <p className={`text-[11px] leading-relaxed pb-0.5 truncate flex-1 flex items-center gap-1 ${isUnread ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-surface-400 dark:text-surface-500 font-normal'}`}>
                                          <span className="flex-1 block truncate"><AppleEmojiText text={lastMsgText} size={13} /></span>
                                        </p>
                                        {isUnread && (
                                          <div className="bg-brand-primary text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                            {unreadCount}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                            })
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: Message Area */}
                    <div className={`${selectedChat ? (selectedChat.remoteJid && selectedChat.remoteJid.endsWith && !selectedChat.remoteJid.endsWith('@g.us') ? 'md:col-span-4' : 'md:col-span-9') : 'md:col-span-8'} flex-col min-h-0 bg-gradient-to-b from-slate-50/50 via-slate-100/20 to-indigo-50/15 dark:from-slate-950/65 dark:via-slate-900/40 dark:to-slate-950/55 w-full md:w-auto ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                      {selectedChat ? (
                        <div className="flex-1 flex flex-col min-h-0">
                          
                          {/* Chat Window Header */}
                          <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 flex flex-col z-20 relative">
                            {/* Top Row */}
                            <div className="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                              <div className="flex items-center gap-3.5">
                                {/* Botón volver en mobile */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedChat(null)}
                                  className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-surface-500 dark:text-surface-400 cursor-pointer"
                                >
                                  <ArrowLeft size={18} />
                                </button>
                                
                                {/* Profile Pic */}
                                <div className="w-12 h-12 rounded-full bg-[#12a160] text-white flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                                  {selectedChat.profilePicUrl ? (
                                    <img src={selectedChat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="uppercase tracking-wide">{String(crmContactMap[selectedChat?.remoteJid?.split('@')[0]?.split(':')[0] || ''] || selectedChat.pushName || selectedChat.remoteJid).substring(0, 2)}</span>
                                  )}
                                </div>
                                
                                {/* Contact Info */}
                                <div className="flex flex-col justify-center text-left">
                                  <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-white uppercase tracking-tight">
                                    {crmContactMap[selectedChat?.remoteJid?.split('@')[0]?.split(':')[0] || ''] || selectedChat.pushName || selectedChat?.remoteJid?.split('@')[0]?.split(':')[0] || ''}
                                  </h4>
                                  
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    {crmContact?.tags && crmContact.tags.map((tag: string) => {
                                      let colorClass = "bg-slate-500 text-white shadow-sm";
                                      if (tag === 'VIP') colorClass = "bg-amber-500 text-white shadow-sm";
                                      else if (tag === 'Moroso') colorClass = "bg-rose-600 text-white shadow-sm";
                                      else if (tag === 'Pendiente') colorClass = "bg-blue-500 text-white shadow-sm";
                                      else if (tag === 'Nuevo') colorClass = "bg-emerald-500 text-white shadow-sm";
                                      else if (tag === 'Interesado') colorClass = "bg-purple-500 text-white shadow-sm";
                                      else if (tag === 'Pagó') colorClass = "bg-teal-500 text-white shadow-sm";
                                      
                                      return (
                                        <span key={tag} className={`px-2 py-0.5 text-[8.5px] font-bold rounded-full transition-all duration-300 transform hover:scale-105 ${colorClass}`}>
                                          {tag}
                                        </span>
                                      );
                                    })}
                                    
                                    {/* Assigned Advisor badge */}
                                    {(() => {
                                      const cleanPhone = selectedChat?.remoteJid?.split('@')[0]?.split(':')[0]?.split(':')[0] || '';
                                      const assignedAgent = crmContactAgentsMap[cleanPhone];
                                      if (!assignedAgent) return null;
                                      return (
                                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                          <span>Asignado: {assignedAgent.name}</span>
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  
                                  {selectedChat.remoteJid && selectedChat.remoteJid.endsWith && !selectedChat.remoteJid.endsWith('@g.us') ? (
                                    (() => {
                                      const presenceState = presences[selectedChat.remoteJid];
                                      let presenceDotClass = "";
                                      let presenceText = "";
                                      
                                      if (presenceState === 'composing') {
                                        presenceDotClass = "bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.6)]";
                                        presenceText = "Escribiendo...";
                                      } else if (presenceState === 'recording') {
                                        presenceDotClass = "bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.6)]";
                                        presenceText = "Grabando audio...";
                                      } else if (presenceState === 'available') {
                                        presenceDotClass = "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]";
                                        presenceText = "En línea";
                                      }

                                      return (
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold animate-fadeIn">
                                          {presenceText && (
                                            <>
                                              <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${presenceDotClass}`}></div>
                                                <span className={
                                                  presenceState === 'composing' 
                                                    ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
                                                    : presenceState === 'recording' 
                                                    ? 'text-amber-600 dark:text-amber-400 font-extrabold' 
                                                    : 'text-emerald-600 dark:text-emerald-400 font-bold'
                                                }>
                                                  {presenceText}
                                                </span>
                                              </div>
                                              <span className="text-slate-300 dark:text-slate-600 font-normal">|</span>
                                            </>
                                          )}
                                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                            <MapPin size={11} className="text-slate-400" />
                                            <span>Lima, Perú</span>
                                          </div>
                                          <span className="text-slate-300 dark:text-slate-600 font-normal">|</span>
                                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                            <Phone size={11} className="text-slate-400" />
                                            <span>+{selectedChat?.remoteJid?.split('@')[0]?.split(':')[0] || ''}</span>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                                      Grupo de WhatsApp
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Right Icons (Top Row) */}
                              <div className="flex items-center gap-2 hidden sm:flex">
                                <button className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all cursor-pointer">
                                  <Star size={14} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all cursor-pointer">
                                  <Tag size={14} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all cursor-pointer">
                                  <MoreVertical size={14} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Bottom Row - Actions Toolbar */}
                            <div className="px-4 py-2.5 flex items-center gap-2.5 overflow-visible flex-wrap bg-slate-50/50 dark:bg-slate-900/50">
                              <div className="relative">
                                <button
                                  ref={assignButtonRef}
                                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                                  className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    showAssignDropdown
                                      ? 'bg-brand-primary text-white border-brand-primary'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <User size={13} className={showAssignDropdown ? "text-white" : "text-slate-400 dark:text-slate-400"} />
                                  <span>Asignar</span>
                                  <ChevronDown size={12} className={showAssignDropdown ? "text-white ml-1" : "text-slate-400 ml-1"} />
                                </button>

                                {showAssignDropdown && (
                                  <div
                                    ref={assignDropdownRef}
                                    className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fadeIn text-left"
                                  >
                                    <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-surface-400">Asignar Asesor</div>
                                    
                                    <button
                                      onClick={() => {
                                        handleAssignAgent(null);
                                        setShowAssignDropdown(false);
                                      }}
                                      className="w-full px-2.5 py-2 hover:bg-rose-500/10 text-rose-500 rounded-xl text-xs font-bold text-left transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <UserMinus size={14} />
                                      <span>Sin Asignar (Disponible)</span>
                                    </button>

                                    <div className="border-t border-slate-100 dark:border-slate-800/40 my-1" />

                                    {teamMembers.length === 0 ? (
                                      <div className="px-3 py-2 text-[10px] text-surface-400 italic font-semibold">No hay colaboradores registrados.</div>
                                    ) : (
                                      teamMembers.map((agent: any) => {
                                        const cleanPhone = selectedChat && selectedChat.remoteJid ? selectedChat.remoteJid.split('@')[0].split(':')[0].split(':')[0] : '';
                                        const currentAssigned = crmContactAgentsMap[cleanPhone]?.id === agent.id;
                                        return (
                                          <button
                                            key={agent.id}
                                            onClick={() => {
                                              handleAssignAgent(agent.id);
                                              setShowAssignDropdown(false);
                                            }}
                                            className={`w-full px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-left transition-colors flex items-center justify-between cursor-pointer ${
                                              currentAssigned ? 'text-brand-primary bg-pastel-100/30' : 'text-slate-700 dark:text-slate-300'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className={`w-1.5 h-1.5 rounded-full ${
                                                agent.status === 'available' ? 'bg-emerald-500' : agent.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
                                              }`} />
                                              <span>{agent.name}</span>
                                            </div>
                                            {currentAssigned && <Check size={12} className="text-brand-primary" />}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <button 
                                  ref={tagsButtonRef}
                                  onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                                  className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    showTagsDropdown 
                                      ? 'bg-brand-primary text-white border-brand-primary' 
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <Tag size={13} className={showTagsDropdown ? "text-white" : "text-slate-400 dark:text-slate-400"} />
                                  <span>Etiquetar</span>
                                  <ChevronDown size={12} className={showTagsDropdown ? "text-white ml-1" : "text-slate-400 ml-1"} />
                                </button>

                                {showTagsDropdown && (
                                  <div 
                                    ref={tagsDropdownRef}
                                    className="absolute left-0 mt-1.5 w-56 bg-[#1E293B] dark:bg-slate-950 rounded-2xl shadow-premium-lg border-0 py-2.5 px-1 z-50 animate-fadeIn"
                                  >
                                    <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1.5">
                                      Etiquetas Inteligentes
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-0.5 px-2">
                                      {SMART_TAGS.map((tag) => {
                                        const hasTag = (crmContact?.tags || []).includes(tag);
                                        return (
                                          <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between hover:bg-white/10 text-white transition-colors cursor-pointer"
                                          >
                                            <span>{tag}</span>
                                            <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                                              hasTag 
                                                ? 'bg-brand-primary border-brand-primary text-white' 
                                                : 'border-white/20 bg-transparent'
                                            }`}>
                                              {hasTag && <Check size={10} strokeWidth={3} />}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <button 
                                  ref={pipelineButtonRef}
                                  onClick={() => setShowPipelineDropdown(!showPipelineDropdown)}
                                  className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    showPipelineDropdown 
                                      ? 'bg-brand-primary text-white border-brand-primary' 
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <GitBranch size={13} className={showPipelineDropdown ? "text-white" : "text-slate-400 dark:text-slate-400"} />
                                  <span>{crmContact?.pipeline_stage || 'Pipeline'}</span>
                                  <ChevronDown size={12} className={showPipelineDropdown ? "text-white ml-1" : "text-slate-400 ml-1"} />
                                </button>
                                
                                {showPipelineDropdown && (
                                  <div 
                                    ref={pipelineDropdownRef}
                                    className="absolute left-0 mt-1.5 w-48 bg-[#1E293B] dark:bg-slate-950 rounded-2xl shadow-premium-lg border-0 py-2 z-50 animate-fadeIn"
                                  >
                                    <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1">
                                      Etapa Comercial
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                      {PIPELINE_STAGES.map((stg) => (
                                        <button
                                          key={stg}
                                          onClick={() => {
                                            movePipelineStage(
                                              selectedChat.remoteJid,
                                              stg,
                                              selectedChat.pushName || (selectedChat.remoteJid && selectedChat.remoteJid.split ? selectedChat.remoteJid.split('@')[0].split(':')[0] : '')
                                            );
                                            setShowPipelineDropdown(false);
                                          }}
                                          className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                                            (crmContact?.pipeline_stage || 'Nuevo') === stg 
                                              ? 'text-brand-primary bg-white/5' 
                                              : 'text-white'
                                          }`}
                                        >
                                          <span>{stg}</span>
                                          {(crmContact?.pipeline_stage || 'Nuevo') === stg && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                                  className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    showActionsDropdown
                                      ? 'bg-brand-primary text-white border-brand-primary'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <Grip size={13} className={showActionsDropdown ? "text-white" : "text-slate-400 dark:text-slate-400"} />
                                  <span>Más acciones</span>
                                  <ChevronDown size={12} className={showActionsDropdown ? "text-white ml-1" : "text-slate-400 ml-1"} />
                                </button>

                                {showActionsDropdown && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setShowActionsDropdown(false)} />
                                    <div className="absolute right-0 mt-1.5 w-52 bg-[#1E293B] dark:bg-slate-950 rounded-2xl shadow-premium-lg border-0 py-2 z-40 animate-fadeIn text-left">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowActionsDropdown(false);
                                          if (crmClient) {
                                            fetchClientTasks(crmClient.id);
                                            setShowTasksModal(true);
                                          } else {
                                            showNotification('Registra los datos del cliente primero para gestionar tareas.', 'error');
                                          }
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-white/10 text-white transition-colors cursor-pointer"
                                      >
                                        <CheckCircle2 size={13} className="text-slate-300" />
                                        <span>Tareas del Cliente</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Chat Window Messages */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 flex flex-col bg-[#f4faf6] dark:bg-[#0b141a]">
                            {messagesLoading && messages.length === 0 ? (
                              <div className="my-auto text-center text-xs text-surface-400 animate-pulse">Cargando conversación...</div>
                            ) : messages.length === 0 ? (
                              <div className="my-auto text-center text-xs text-surface-400">No hay mensajes en este chat.</div>
                            ) : (
                              messages
                                .slice()
                                .reverse()
                                .map((msg) => {
                                  const fromMe = msg.key?.fromMe;
                                  const date = new Date(msg.messageTimestamp * (msg.messageTimestamp < 10000000000 ? 1000 : 1));
                                  const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                  const msgId = msg.id || msg.key?.id || `msg_${msg.messageTimestamp}_${Math.random()}`;

                                  // Determine checks icon
                                  let statusIcon = null;
                                  if (fromMe) {
                                    if (msg.MessageUpdate) {
                                      const statuses = msg.MessageUpdate.map((u: any) => u.status);
                                      if (statuses.includes('READ')) {
                                        statusIcon = <span className="text-[9px] text-sky-600 dark:text-sky-300 font-bold ml-1">✓✓</span>;
                                      } else if (statuses.includes('DELIVERY_ACK')) {
                                        statusIcon = <span className="text-[9px] text-slate-500/80 dark:text-white/60 font-bold ml-1">✓✓</span>;
                                      } else if (statuses.includes('SERVER_ACK')) {
                                    } else {
                                      // Mensajes enviados sin MessageUpdate aún: mostrar ✓ por defecto
                                      statusIcon = <span className="text-[9px] text-slate-500/80 dark:text-white/60 font-bold ml-1">✓</span>;
                                    }
                                  }

                                  // Render Message Content
                                  const renderMessageContent = () => {
                                    const content = msg.message;
                                    if (!content) return null;

                                    if (content.stickerMessage) {
                                      const isFailed = loadedMedia[msgId] === 'FAILED';
                                      const isLoaded = !!loadedMedia[msgId] && !isFailed;
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (!isLoaded && !isLoading && !isFailed) {
                                        setTimeout(() => {
                                          downloadMedia(msgId, msg.key, content);
                                        }, 0);
                                      }

                                      if (isFailed) {
                                        return (
                                          <div className="w-[120px] h-[120px] bg-slate-100 dark:bg-slate-900/60 rounded-xl flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-500">
                                            <FileText size={16} className="text-slate-400" />
                                            <span className="text-[8px] font-bold">Sticker no disponible</span>
                                          </div>
                                        );
                                      }

                                      if (isLoaded) {
                                        return (
                                          <div className="text-center p-1">
                                            <img 
                                              src={loadedMedia[msgId]} 
                                              alt="Sticker" 
                                              className="w-[120px] h-[120px] object-contain rounded-lg hover:scale-105 transition-transform cursor-pointer"
                                              onClick={() => setLightboxMedia({
                                                url: loadedMedia[msgId],
                                                type: 'image'
                                              })}
                                            />
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="w-[120px] h-[120px] bg-slate-100 dark:bg-slate-900/60 rounded-xl flex items-center justify-center animate-pulse">
                                          <span className="text-[9px] font-bold text-surface-400 dark:text-surface-500">Cargando sticker...</span>
                                        </div>
                                      );
                                    }

                                    if (content.imageMessage) {
                                      const isFailed = loadedMedia[msgId] === 'FAILED';
                                      const isLoaded = !!loadedMedia[msgId] && !isFailed;
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (isFailed) {
                                        return (
                                          <div className="w-[240px] p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center text-slate-500">
                                            <FileText size={22} className="text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Imagen no disponible</span>
                                            <span className="text-[8px] text-slate-400">Expirado o eliminado en WhatsApp</span>
                                          </div>
                                        );
                                      }

                                      if (isLoaded) {
                                        return (
                                          <div className="space-y-1.5 text-left">
                                            <img 
                                              src={loadedMedia[msgId]} 
                                              alt="WhatsApp Media" 
                                              className="max-w-[240px] rounded-2xl cursor-pointer hover:opacity-95 transition-opacity" 
                                              onClick={() => setLightboxMedia({
                                                url: loadedMedia[msgId],
                                                type: 'image',
                                                caption: content.imageMessage.caption || undefined
                                              })}
                                            />
                                            {content.imageMessage.caption && (
                                              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 mt-1">{content.imageMessage.caption}</p>
                                            )}
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div 
                                          onClick={() => downloadMedia(msgId, msg.key, content, undefined, true)}
                                          className="w-[240px] h-[160px] bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-all duration-200 group relative"
                                        >
                                          {isLoading ? (
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md animate-spin">
                                              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full block" />
                                            </div>
                                          ) : (
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md group-hover:scale-105 transition-transform text-surface-600 dark:text-surface-400">
                                              <Image size={20} />
                                            </div>
                                          )}
                                          <span className="text-[9px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                                            {isLoading ? 'Descargando...' : 'Ver Imagen'}
                                          </span>
                                        </div>
                                      );
                                    }
                                    
                                    if (content.audioMessage) {
                                      const isFailed = loadedMedia[msgId] === 'FAILED';
                                      const isLoaded = !!loadedMedia[msgId] && !isFailed;
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (isFailed) {
                                        return (
                                          <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-xl text-left flex items-center gap-2 w-[240px] text-slate-500">
                                            <FileText size={16} className="text-slate-400" />
                                            <span className="text-[9px] font-bold">Nota de voz no disponible (expirada)</span>
                                          </div>
                                        );
                                      }

                                      if (isLoaded) {
                                        return (
                                          <audio controls src={loadedMedia[msgId]} className="max-w-[240px] mt-1 h-9" />
                                        );
                                      }
                                      
                                      return (
                                        <button 
                                          onClick={() => downloadMedia(msgId, msg.key, content, undefined, true)}
                                          disabled={isLoading}
                                          type="button"
                                          className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
                                        >
                                          {isLoading ? (
                                            <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin block" />
                                          ) : (
                                            <Play size={12} className="fill-brand-primary" />
                                          )}
                                          <span>{isLoading ? 'Descargando...' : 'Escuchar Nota de Voz'}</span>
                                        </button>
                                      );
                                    }

                                    if (content.documentMessage) {
                                      const fileName = content.documentMessage.fileName || 'Documento';
                                      const isFailed = loadedMedia[msgId] === 'FAILED';
                                      const isLoaded = !!loadedMedia[msgId] && !isFailed;
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (isFailed) {
                                        return (
                                          <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-2xl text-left flex items-center gap-3 w-[260px] text-slate-500">
                                            <div className="p-2.5 bg-slate-200/50 rounded-xl text-slate-400">
                                              <FileText size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-0.5">
                                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{fileName}</p>
                                              <p className="text-[9px] text-slate-400 font-medium">No disponible (expirado)</p>
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div 
                                          onClick={isLoaded ? undefined : () => downloadMedia(msgId, msg.key, content, undefined, true)}
                                          className={`p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl text-left flex items-center gap-3 w-[260px] relative overflow-hidden ${!isLoaded ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors' : ''}`}
                                        >
                                          <div className="p-2.5 bg-pastel-100/50 rounded-xl text-brand-secondary dark:text-brand-primary">
                                            <FileText size={20} />
                                          </div>
                                          <div className="flex-1 min-w-0 space-y-0.5">
                                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{fileName}</p>
                                            <p className="text-[9px] text-surface-400 font-medium">
                                              {isLoading ? 'Descargando...' : isLoaded ? 'Descargado' : 'Haga clic para descargar'}
                                            </p>
                                          </div>
                                          {isLoaded ? (
                                            <a 
                                              href={loadedMedia[msgId]} 
                                              download={fileName}
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl shadow-md transition-colors"
                                            >
                                              <Download size={14} />
                                            </a>
                                          ) : (
                                            <div className="p-2 text-surface-400">
                                              {isLoading ? (
                                                <span className="w-4 h-4 border-2 border-slate-300 border-t-brand-primary rounded-full animate-spin block" />
                                              ) : (
                                                <Download size={14} />
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (content.videoMessage) {
                                      const isFailed = loadedMedia[msgId] === 'FAILED';
                                      const isLoaded = !!loadedMedia[msgId] && !isFailed;
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (isFailed) {
                                        return (
                                          <div className="w-[240px] p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center text-slate-500">
                                            <FileText size={22} className="text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Video no disponible</span>
                                            <span className="text-[8px] text-slate-400">Expirado o eliminado en WhatsApp</span>
                                          </div>
                                        );
                                      }

                                      if (isLoaded) {
                                        return (
                                          <div className="space-y-1.5 text-left">
                                            <div 
                                              onClick={() => setLightboxMedia({
                                                url: loadedMedia[msgId],
                                                type: 'video',
                                                caption: content.videoMessage.caption || undefined
                                              })}
                                              className="max-w-[240px] rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm hover:opacity-95 transition-all"
                                            >
                                              <video 
                                                src={loadedMedia[msgId]} 
                                                className="w-full h-auto object-cover max-h-[160px]" 
                                                muted
                                                playsInline
                                              />
                                              {/* Play Overlay */}
                                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                                                <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-full shadow-lg text-slate-800 dark:text-white group-hover:scale-105 transition-transform">
                                                  <Play size={20} fill="currentColor" className="ml-0.5 text-brand-primary" />
                                                </div>
                                              </div>
                                            </div>
                                            {content.videoMessage.caption && (
                                              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 mt-1">{content.videoMessage.caption}</p>
                                            )}
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div 
                                          onClick={() => downloadMedia(msgId, msg.key, content, undefined, true)}
                                          className="w-[240px] h-[160px] bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-all duration-200 group relative"
                                        >
                                          {isLoading ? (
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md animate-spin">
                                              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full block" />
                                            </div>
                                          ) : (
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md group-hover:scale-105 transition-transform text-surface-600 dark:text-surface-400">
                                              <Video size={20} />
                                            </div>
                                          )}
                                          <span className="text-[9px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                                            {isLoading ? 'Descargando...' : 'Ver Video'}
                                          </span>
                                        </div>
                                      );
                                    }

                                    const text = content.conversation || content.extendedTextMessage?.text || '';
                                    return (
                                      <p className="text-[11px] leading-relaxed break-words text-left">
                                        <AppleEmojiText text={text} />
                                      </p>
                                    );
                                  };

                                  return (
                                    <div 
                                      key={msgId} 
                                      className={`flex flex-col max-w-[70%] ${fromMe ? 'self-end items-end' : 'self-start items-start'}`}
                                    >
                                      {/* Sender header for groups */}
                                      {!fromMe && selectedChat.remoteJid && selectedChat.remoteJid.endsWith && selectedChat.remoteJid.endsWith('@g.us') && msg.pushName && (
                                        <span className={`text-[9px] font-bold mb-0.5 ml-1.5 ${getSenderColor(msg.pushName)}`}>{msg.pushName}</span>
                                      )}

                                      {/* Bubble */}
                                      <div className={`p-3 rounded-2xl ${fromMe ? 'bg-[#D8F3DC] dark:bg-[#005c4b] text-slate-800 dark:text-slate-100 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700/50'}`}>
                                        {renderMessageContent()}
                                        
                                        {/* Timestamp and Checks */}
                                        <div className={`flex items-center justify-end mt-1 text-[9px] font-medium ${fromMe ? 'text-slate-500 dark:text-white/60' : 'text-surface-400 dark:text-surface-500'}`}>
                                          <span>{timestamp}</span>
                                          {statusIcon}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                            
                            {/* Auto-scroll anchor (controlado por useEffect inteligente) */}
                            <div ref={bottomRef} />
                          </div>

                          {/* Chat Window Send Form */}
                          <div className="relative">
                            {/* Input Oculto de Archivos */}
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handleFileChange} 
                              className="hidden" 
                            />

                            {showAttachMenu && (
                              <div ref={attachMenuRef} className="absolute bottom-[100%] mb-2 left-12 z-50 animate-fadeIn bg-white dark:bg-slate-900 shadow-premium-lg rounded-2xl p-2 flex flex-col gap-1 w-40 text-left">
                                <button
                                  type="button"
                                  onClick={() => handleTriggerFileInput('image')}
                                  className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Image size={15} className="text-brand-primary" />
                                  <span>Imagen</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerFileInput('video')}
                                  className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Video size={15} className="text-brand-primary" />
                                  <span>Video</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerFileInput('document')}
                                  className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <FileText size={15} className="text-brand-primary" />
                                  <span>Documento</span>
                                </button>
                              </div>
                            )}

                            {/* Previsualizador de Adjunto */}
                            {attachedFile && (
                              <div className="absolute bottom-[100%] left-0 w-full bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800/40 animate-slideUp z-40 rounded-t-3xl shadow-lg flex items-center gap-4 text-left">
                                {attachmentPreview ? (
                                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative shadow-inner">
                                    {attachedFile.type.startsWith('image/') ? (
                                      <img src={attachmentPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                      <video src={attachmentPreview} className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-900 flex items-center justify-center text-surface-500">
                                    <FileText size={28} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{attachedFile.name}</p>
                                  <p className="text-[10px] text-surface-400 font-medium">{(attachedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleClearAttachment}
                                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}

                            {showEmojiPicker && (
                              <div ref={emojiPickerRef} className="absolute bottom-[100%] mb-2 left-4 z-50 animate-fadeIn shadow-premium-lg rounded-2xl overflow-hidden">
                                <EmojiPicker
                                  onEmojiClick={(emojiData) => {
                                    setNewMessageText(prev => prev + emojiData.emoji);
                                  }}
                                  theme={isDark ? Theme.DARK : Theme.LIGHT}
                                  emojiStyle={EmojiStyle.APPLE}
                                  searchPlaceHolder="Buscar emoji"
                                />
                              </div>
                            )}
                            <form 
                              onSubmit={handleSendChatMessage}
                              className="p-4 bg-transparent flex items-center gap-2.5"
                            >
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  ref={emojiButtonRef}
                                  type="button"
                                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                  className={`p-2 transition-colors cursor-pointer rounded-xl ${showEmojiPicker ? 'bg-pastel-100/50 text-brand-primary' : 'text-surface-400 hover:text-surface-600 dark:hover:text-slate-300'}`}
                                >
                                  <Smile size={20} />
                                </button>
                                <button
                                  ref={attachButtonRef}
                                  type="button"
                                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                                  className={`p-2 transition-colors cursor-pointer rounded-xl ${showAttachMenu ? 'bg-pastel-100/50 text-brand-primary' : 'text-surface-400 hover:text-surface-600 dark:hover:text-slate-300'}`}
                                >
                                  <Paperclip size={20} />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={newMessageText}
                                onChange={(e) => setNewMessageText(e.target.value)}
                                placeholder={attachedFile ? "Escribe un comentario/pie para tu archivo..." : "Escribe un mensaje aquí..."}
                                disabled={sendingMessage}
                                className="flex-1 px-4 py-3 bg-white/95 dark:bg-slate-900/95 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-medium disabled:opacity-50 transition-all shadow-premium"
                              />
                              <button
                                type="submit"
                                disabled={(!newMessageText.trim() && !attachedFile) || sendingMessage}
                                className="p-2.5 bg-brand-primary hover:bg-brand-secondary active:scale-95 text-white rounded-2xl transition-all shadow-md shadow-md-custom flex-shrink-0 disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer"
                              >
                                <Send size={14} className={sendingMessage ? 'animate-fly' : ''} />
                              </button>
                            </form>
                          </div>

                        </div>
                      ) : (
                        <div className="my-auto text-center space-y-2">
                          <MessageSquare size={36} className="text-slate-300 dark:text-slate-700 mx-auto animate-bounce" />
                          <p className="text-xs text-surface-400 dark:text-surface-500">Selecciona una conversación en la lista izquierda para comenzar a chatear.</p>
                        </div>
                      )}
                    </div>

                    {/* CRM Sidebar Pane */}
                    {selectedChat && selectedChat.remoteJid && selectedChat.remoteJid.endsWith && !selectedChat.remoteJid.endsWith('@g.us') && (
                      <div className="md:col-span-6 grid grid-cols-1 lg:grid-cols-2 min-h-0 relative">
                        {/* Column 1: CRM Details */}
                        <div className="flex flex-col min-h-0 bg-slate-50/45 dark:bg-slate-950 text-left relative overflow-hidden">
                          {crmLoading ? (
                            <div className="flex-1 flex items-center justify-center py-8 text-center text-[11px] text-surface-400 animate-pulse p-4">Cargando datos CRM...</div>
                          ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {!crmIsEditing && crmClient ? (
                              <div className="space-y-3.5 pb-6">
                                {/* Professional Header Card */}
                                <div className="relative rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-sm text-left">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[13px] font-bold text-slate-600 dark:text-slate-300 flex-shrink-0 uppercase tracking-wide">
                                      {crmClient.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || 'C'}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8 space-y-1.5">
                                      <h4 className="text-[12.5px] font-extrabold text-slate-800 dark:text-white uppercase truncate leading-tight" title={crmClient.name}>
                                        {crmClient.name}
                                      </h4>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {crmClient.doc_number && !crmClient.doc_number.startsWith('MANUAL-') && (
                                          <span className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">{crmClient.doc_type || 'DOC'}</span>
                                            {crmClient.doc_number}
                                          </span>
                                        )}
                                        {(() => {
                                          const cat = crmContact?.category_name || 'Cliente';
                                          let pillColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                                          if (cat === 'VIP' || cat === 'Cliente frecuente') pillColor = 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400';
                                          else if (cat === 'Moroso' || cat === 'Pendiente') pillColor = 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400';
                                          else if (cat === 'Interesado' || cat === 'Prospecto') pillColor = 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400';
                                          else if (cat === 'Pagó') pillColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
                                          return <span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded-md ${pillColor}`}>{cat}</span>;
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCrmDocType(crmClient.doc_type === 'MANUAL' ? 'DNI' : crmClient.doc_type);
                                      setCrmDocNumber(crmClient.doc_type === 'MANUAL' ? '' : crmClient.doc_number);
                                      setCrmName(crmClient.name);
                                      setCrmAddress(crmClient.address || '');
                                      setCrmEmail(crmClient.email || '');
                                      setCrmNotes(crmClient.notes || '');
                                      setCrmLanguage(crmClient.language || 'Español');
                                      setCrmBirthday(crmClient.birthday || '');
                                      if (crmClient.category_id) {
                                        setCrmCategoryId(crmClient.category_id.toString());
                                      } else {
                                        setCrmCategoryId('');
                                      }
                                      setCrmIsEditing(true);
                                    }}
                                    className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Editar ficha"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              
                                {/* Información del contacto */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Información del contacto</h5>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCrmDocType(crmClient.doc_type === 'MANUAL' ? 'DNI' : crmClient.doc_type);
                                        setCrmDocNumber(crmClient.doc_type === 'MANUAL' ? '' : crmClient.doc_number);
                                        setCrmName(crmClient.name);
                                        setCrmAddress(crmClient.address || '');
                                        setCrmEmail(crmClient.email || '');
                                        setCrmNotes(crmClient.notes || '');
                                        setCrmCategoryId(crmContact?.category_id?.toString() || '');
                                        setCrmBirthday(crmClient.birthday ? crmClient.birthday.substring(0, 10) : '');
                                        setCrmLanguage(crmClient.idioma || 'Español');
                                        setCrmIsEditing(true);
                                      }}
                                      className="text-[9.5px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                                    >
                                      Editar
                                    </button>
                                  </div>
                              
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                    {/* Teléfono */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <Smartphone size={10} className="text-slate-350" />
                                        Teléfono
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        +{crmContact?.phone_number || selectedChat?.remoteJid?.split('@')[0]}
                                      </span>
                                    </div>
                              
                                    {/* Correo */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <Mail size={10} className="text-slate-350" />
                                        Correo
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        {crmClient.email || 'No registrado'}
                                      </span>
                                    </div>
                              
                                    {/* Empresa */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <Building size={10} className="text-slate-350" />
                                        Empresa
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        {crmClient.doc_type === 'RUC' ? crmClient.name : 'No registrada'}
                                      </span>
                                    </div>
                              
                                    {/* Ciudad */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <MapPin size={10} className="text-slate-350" />
                                        Ciudad
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        {crmClient.address || 'No registrado'}
                                      </span>
                                    </div>
                              
                                    {/* Idioma */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={10} className="text-slate-350" />
                                        Idioma
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        {crmClient.idioma || 'Español'}
                                      </span>
                                    </div>
                              
                                    {/* Cumpleaños */}
                                    <div className="text-left space-y-1">
                                      <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <Gift size={10} className="text-slate-350" />
                                        Cumpleaños
                                      </span>
                                      <span className="text-[10.5px] text-slate-800 dark:text-slate-200 font-semibold block leading-tight">
                                        {crmClient.birthday ? formatBirthdayString(crmClient.birthday) : 'No registrado'}
                                      </span>
                                    </div>
                                  </div>
                              
                                  {/* Collapsible More Fields */}
                                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/40">
                                    <button
                                      type="button"
                                      onClick={() => setShowMoreCrmFields(!showMoreCrmFields)}
                                      className="w-full flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                                    >
                                      <span>{showMoreCrmFields ? 'Ocultar campos adicionales' : 'Ver más campos (6)'}</span>
                                      <ChevronDown size={10} className={`transition-transform duration-200 ${showMoreCrmFields ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {showMoreCrmFields && (
                                      <div className="mt-3 space-y-2 animate-fadeIn">
                                        <div className="flex justify-between items-center text-[10px] py-1">
                                          <span className="text-slate-400 font-medium">Tipo de documento</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{crmClient.doc_type}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50 dark:border-slate-800/30">
                                          <span className="text-slate-400 font-medium">Nro de documento</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{crmClient.doc_number.startsWith('MANUAL-') ? 'No registrado' : crmClient.doc_number}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50 dark:border-slate-800/30">
                                          <span className="text-slate-400 font-medium">Primer contacto</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                            {crmClient.created_at ? new Date(crmClient.created_at).toLocaleDateString('es-ES') : 'No registrado'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50 dark:border-slate-800/30">
                                          <span className="text-slate-400 font-medium">Categoría</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{crmContact?.category_name || 'Sin Categoría'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50 dark:border-slate-800/30">
                                          <span className="text-slate-400 font-medium">Asesor Asignado</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                            {crmContact?.assigned_agent_name || 'Sin Asignar'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50 dark:border-slate-800/30">
                                          <span className="text-slate-400 font-medium">ID Cliente</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-semibold">#{crmClient.id}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              
                                {/* Notas del contacto */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Notas del contacto</h5>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setNewNoteText('');
                                        setShowNotesFloatingWindow(true);
                                      }}
                                      className="text-[9.5px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors flex items-center gap-1"
                                    >
                                      {clientNotes.length > 0 ? (
                                        <span>Ver notas ({clientNotes.length})</span>
                                      ) : (
                                        <>
                                          <Plus size={10} />
                                          <span>Agregar nota</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  
                                  {clientNotes.length > 0 ? (
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl">
                                      <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                                        {clientNotes[0].content}
                                      </p>
                                      <div className="text-[8.5px] text-slate-400 mt-2.5 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 font-medium">
                                          <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[7.5px] font-bold flex items-center justify-center">
                                            {clientNotes[0].agent_name?.charAt(0).toUpperCase() || 'A'}
                                          </span>
                                          {clientNotes[0].agent_name || 'Asesor'}
                                        </span>
                                        <span className="font-medium">{new Date(clientNotes[0].created_at).toLocaleDateString('es-ES')}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 text-center py-3 italic">Sin notas registradas.</p>
                                  )}
                                </div>
                              
                                {/* Etiquetas */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Etiquetas</h5>
                                    <button className="text-[9.5px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors flex items-center gap-0.5">
                                      <Plus size={10} />
                                      Agregar
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-semibold rounded-lg flex items-center gap-1">
                                      <Tag size={9} />
                                      {crmContact?.category_name || 'Cliente'}
                                    </span>
                                    <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-[9px] font-semibold rounded-lg">
                                      Interesado
                                    </span>
                                    <span className="px-2.5 py-1 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 text-[9px] font-semibold rounded-lg">
                                      Plan Trimestral
                                    </span>
                                    <button className="w-6 h-6 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-350 hover:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer">
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                </div>
                              
                                {/* Historial de conversaciones */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Historial de conversaciones</h5>
                                    <button className="text-[9.5px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors">Ver todo</button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-center">
                                      <span className="text-slate-800 dark:text-slate-100 font-bold text-[15px] leading-none block">18</span>
                                      <span className="text-[8px] text-slate-400 font-medium mt-1.5 block">Conversaciones</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-center">
                                      <span className="text-slate-800 dark:text-slate-100 font-bold text-[15px] leading-none block">2d 4h</span>
                                      <span className="text-[8px] text-slate-400 font-medium mt-1.5 block">Tiempo promedio</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-center">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[15px] leading-none block">98%</span>
                                      <span className="text-[8px] text-slate-400 font-medium mt-1.5 block">Respondidas</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Create / Edit Form Mode */
                              <div className="space-y-3">
                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-505 dark:text-surface-400 uppercase tracking-wider block">Identificación DNI / RUC</label>
                                  <div className="flex gap-1.5">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all cursor-pointer min-w-[65px] justify-between focus:outline-none"
                                      >
                                        <span>{crmDocType}</span>
                                        <ChevronDown size={10} className={`text-surface-400 transition-transform duration-200 \${isDocTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                      </button>

                                      {isDocTypeDropdownOpen && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-30" 
                                            onClick={() => setIsDocTypeDropdownOpen(false)} 
                                          />
                                          <div className="absolute left-0 mt-1 w-24 bg-[#1E293B] dark:bg-slate-950 rounded-xl border-0 shadow-premium-lg py-1 z-40 animate-fadeIn">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmDocType('DNI');
                                                setCrmDocNumber('');
                                                setCrmName('');
                                                setCrmAddress('');
                                                setIsDocTypeDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-bold hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer \${crmDocType === 'DNI' ? 'text-white bg-[#0D9488]' : 'text-slate-100 dark:text-slate-200'}`}
                                            >
                                              DNI
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmDocType('RUC');
                                                setCrmDocNumber('');
                                                setCrmName('');
                                                setCrmAddress('');
                                                setIsDocTypeDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-bold hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer \${crmDocType === 'RUC' ? 'text-white bg-[#0D9488]' : 'text-slate-100 dark:text-slate-200'}`}
                                            >
                                              RUC
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    <div className="flex-1 relative flex items-center">
                                      <input
                                        type="text"
                                        placeholder={crmDocType === 'DNI' ? "Ingresa DNI de 8 dígitos" : "Ingresa RUC de 11 dígitos"}
                                        value={crmDocNumber}
                                        onChange={(e) => setCrmDocNumber(e.target.value)}
                                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-655 focus:outline-none focus:bg-white dark:focus:bg-slate-900/40 focus:ring-1 focus:ring-brand-primary/20 font-medium transition-all"
                                      />
                                      {crmDocNumber.trim().length >= 8 && (
                                        <button
                                          type="button"
                                          onClick={() => handleValidateCrmDoc()}
                                          disabled={crmValidationLoading}
                                          className="absolute right-2 text-brand-primary hover:text-brand-secondary transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center p-1"
                                          title="Buscar en APIPerú"
                                        >
                                          {crmValidationLoading ? (
                                            <span className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Search size={12} />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-550 dark:text-surface-400 uppercase tracking-wider block">Nombre / Razón Social</label>
                                  <input
                                    type="text"
                                    placeholder="Nombre completo"
                                    value={crmName}
                                    onChange={(e) => setCrmName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-900/40 focus:ring-1 focus:ring-brand-primary/20 font-medium transition-all"
                                  />
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Categoría de Contacto</label>
                                  <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                      <button
                                        type="button"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all cursor-pointer focus:outline-none"
                                      >
                                        <span>
                                          {crmCategories.find(c => c.id.toString() === crmCategoryId)?.name || 'Sin Categoría'}
                                        </span>
                                        <ChevronDown size={11} className={`text-surface-400 transition-transform duration-200 \${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                      </button>

                                      {isCategoryDropdownOpen && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-30" 
                                            onClick={() => setIsCategoryDropdownOpen(false)} 
                                          />
                                          <div className="absolute left-0 right-0 mt-1 bg-[#1E293B] dark:bg-slate-950 rounded-xl border-0 shadow-premium-lg py-1 z-40 max-h-40 overflow-y-auto animate-fadeIn">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmCategoryId('');
                                                setIsCategoryDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer \${crmCategoryId === '' ? 'text-white bg-[#0D9488]' : 'text-slate-100 dark:text-slate-200'}`}
                                            >
                                              Sin Categoría
                                            </button>
                                            {crmCategories.map((cat: any) => (
                                              <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                  setCrmCategoryId(cat.id.toString());
                                                  setIsCategoryDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer \${crmCategoryId === cat.id.toString() ? 'text-white bg-[#0D9488]' : 'text-slate-100 dark:text-slate-200'}`}
                                              >
                                                {cat.name}
                                              </button>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setCrmCategoriesModalOpen(true)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-500 dark:text-surface-400 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                                      title="Gestionar Categorías"
                                    >
                                      <Settings size={13} />
                                    </button>
                                  </div>
                                </div>

                                {crmDocType === 'RUC' && (
                                  <div className="space-y-1 text-left">
                                    <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Dirección Fiscal</label>
                                    <textarea
                                      placeholder="Dirección fiscal SUNAT"
                                      rows={2}
                                      value={crmAddress}
                                      onChange={(e) => setCrmAddress(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-900/40 focus:ring-1 focus:ring-brand-primary/20 resize-none font-medium transition-all"
                                    />
                                  </div>
                                )}

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Email</label>
                                  <input
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={crmEmail}
                                    onChange={(e) => setCrmEmail(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-900/40 focus:ring-1 focus:ring-brand-primary/20 font-medium transition-all"
                                  />
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Cumpleaños</label>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowCrmDatePicker(!showCrmDatePicker);
                                        if (crmBirthday) {
                                          const d = new Date(crmBirthday + 'T00:00:00');
                                          if (!isNaN(d.getTime())) {
                                            setDatePickerYear(d.getFullYear());
                                            setDatePickerMonth(d.getMonth());
                                          }
                                        } else {
                                          setDatePickerYear(new Date().getFullYear());
                                          setDatePickerMonth(new Date().getMonth());
                                        }
                                      }}
                                      className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-850 dark:text-slate-200 focus:outline-none hover:bg-slate-200/50 dark:hover:bg-slate-900/80 transition-all font-medium text-left cursor-pointer"
                                    >
                                      <span>
                                        {crmBirthday 
                                          ? formatBirthdayString(crmBirthday) 
                                          : 'Seleccionar fecha'}
                                      </span>
                                      <Calendar size={12} className="text-slate-400" />
                                    </button>

                                    {showCrmDatePicker && (
                                      <>
                                        <div 
                                          className="fixed inset-0 z-30" 
                                          onClick={() => setShowCrmDatePicker(false)} 
                                        />
                                        <div className="absolute left-0 bottom-full mb-1.5 w-[250px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3.5 z-40 animate-fadeIn text-left">
                                          {/* Calendar Header */}
                                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
                                            <div className="flex items-center gap-1.5">
                                              <select
                                                value={datePickerMonth}
                                                onChange={(e) => setDatePickerMonth(parseInt(e.target.value))}
                                                className="bg-transparent text-xs font-extrabold text-slate-800 dark:text-white border-0 p-0 focus:ring-0 focus:outline-none cursor-pointer"
                                              >
                                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                                                  <option key={m} value={idx} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold">{m}</option>
                                                ))}
                                              </select>
                                              <select
                                                value={datePickerYear}
                                                onChange={(e) => setDatePickerYear(parseInt(e.target.value))}
                                                className="bg-transparent text-xs font-extrabold text-slate-800 dark:text-white border-0 p-0 focus:ring-0 focus:outline-none cursor-pointer"
                                              >
                                                {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                  <option key={year} value={year} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold">{year}</option>
                                                ))}
                                              </select>
                                            </div>
                                            
                                            <div className="flex gap-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (datePickerMonth === 0) {
                                                    setDatePickerMonth(11);
                                                    setDatePickerYear(datePickerYear - 1);
                                                  } else {
                                                    setDatePickerMonth(datePickerMonth - 1);
                                                  }
                                                }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                                              >
                                                <ChevronLeft size={13} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (datePickerMonth === 11) {
                                                    setDatePickerMonth(0);
                                                    setDatePickerYear(datePickerYear + 1);
                                                  } else {
                                                    setDatePickerMonth(datePickerMonth + 1);
                                                  }
                                                }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                                              >
                                                <ChevronRight size={13} />
                                              </button>
                                            </div>
                                          </div>
                                          
                                          {/* Weekday headers */}
                                          <div className="grid grid-cols-7 gap-1 text-center py-2">
                                            {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map(day => (
                                              <span key={day} className="text-[9px] font-bold text-surface-400 uppercase tracking-wider">{day}</span>
                                            ))}
                                          </div>
                                          
                                          {/* Days Grid */}
                                          <div className="grid grid-cols-7 gap-1 justify-items-center">
                                            {(() => {
                                              const firstDayOfMonth = new Date(datePickerYear, datePickerMonth, 1).getDay();
                                              const daysInMonth = new Date(datePickerYear, datePickerMonth + 1, 0).getDate();
                                              
                                              const dayElements = [];
                                              
                                              // Empty cells for first week offset
                                              for (let i = 0; i < firstDayOfMonth; i++) {
                                                dayElements.push(<div key={`empty-${i}`} className="h-6 w-6" />);
                                              }
                                              
                                              // Selected date parts
                                              const selectedDate = crmBirthday ? new Date(crmBirthday + 'T00:00:00') : null;
                                              const isSelectedYear = selectedDate && selectedDate.getFullYear() === datePickerYear;
                                              const isSelectedMonth = selectedDate && selectedDate.getMonth() === datePickerMonth;
                                              
                                              for (let day = 1; day <= daysInMonth; day++) {
                                                const isSelected = selectedDate && isSelectedYear && isSelectedMonth && selectedDate.getDate() === day;
                                                const dateStr = `${datePickerYear}-${String(datePickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                
                                                dayElements.push(
                                                  <button
                                                    key={`day-${day}`}
                                                    type="button"
                                                    onClick={() => {
                                                      setCrmBirthday(dateStr);
                                                      setShowCrmDatePicker(false);
                                                    }}
                                                    className={`h-6 w-6 text-[10px] font-extrabold rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                      isSelected 
                                                        ? 'bg-brand-primary text-white shadow-sm'
                                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                                  >
                                                    {day}
                                                  </button>
                                                );
                                              }
                                              
                                              return dayElements;
                                            })()}
                                          </div>
                                          
                                          {/* Footer buttons */}
                                          <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-[10px] font-bold">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmBirthday('');
                                                setShowCrmDatePicker(false);
                                              }}
                                              className="text-red-500 hover:underline cursor-pointer"
                                            >
                                              Borrar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const today = new Date();
                                                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                                setCrmBirthday(todayStr);
                                                setShowCrmDatePicker(false);
                                              }}
                                              className="text-brand-primary hover:underline cursor-pointer"
                                            >
                                              Hoy
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Idioma</label>
                                  <input
                                    type="text"
                                    placeholder="Español, Inglés, etc."
                                    value={crmLanguage}
                                    onChange={(e) => setCrmLanguage(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-100/70 dark:bg-slate-950 border-0 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-900/40 focus:ring-1 focus:ring-brand-primary/20 font-medium transition-all"
                                  />
                                </div>

                                <div className="flex gap-2 pt-1.5">
                                  {crmClient && (
                                    <button
                                      type="button"
                                      onClick={() => setCrmIsEditing(false)}
                                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-400 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCrmContact()}
                                    disabled={crmSaving}
                                    className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-secondary text-white text-[11px] font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer text-center"
                                  >
                                    {crmSaving ? 'Guardando...' : 'Guardar Ficha'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          )}
                          
                          {/* Floating Notes Panel (No Bloqueante) */}
                                                  {showNotesFloatingWindow && crmClient && (
                                                    <div className="absolute inset-0 bg-white dark:bg-slate-900/95 z-50 flex flex-col p-4 animate-fadeIn border-l border-slate-100 dark:border-slate-800 shadow-2xl">
                                                      {/* Header */}
                                                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-shrink-0">
                                                        <div className="min-w-0 space-y-0.5 text-left">
                                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[8px] font-bold uppercase tracking-wider border border-brand-primary/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
                                                            Notas de Negocio
                                                          </span>
                                                          <h4 className="text-[12px] font-extrabold text-slate-800 dark:text-white uppercase tracking-tight truncate pr-2">
                                                            {crmClient.name}
                                                          </h4>
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={() => setShowNotesFloatingWindow(false)}
                                                          className="p-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer border border-slate-100 dark:border-slate-800"
                                                        >
                                                          <X size={14} />
                                                        </button>
                                                      </div>
                          
                                                      {/* List of notes */}
                                                      <div className="flex-1 overflow-y-auto space-y-3.5 py-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                                        {clientNotes.length > 0 ? (
                                                          clientNotes.map((note: any, idx: number) => {
                                                            const noteColors = [
                                                              { bg: 'bg-emerald-50 dark:bg-emerald-950/30', hover: 'hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50', avatar: 'bg-emerald-200 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', text: 'text-emerald-600/70 dark:text-emerald-400/70' },
                                                              { bg: 'bg-blue-50 dark:bg-blue-950/30', hover: 'hover:bg-blue-100/70 dark:hover:bg-blue-950/50', avatar: 'bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300', text: 'text-blue-600/70 dark:text-blue-400/70' },
                                                              { bg: 'bg-violet-50 dark:bg-violet-950/30', hover: 'hover:bg-violet-100/70 dark:hover:bg-violet-950/50', avatar: 'bg-violet-200 dark:bg-violet-900 text-violet-700 dark:text-violet-300', text: 'text-violet-600/70 dark:text-violet-400/70' },
                                                              { bg: 'bg-amber-50 dark:bg-amber-950/30', hover: 'hover:bg-amber-100/70 dark:hover:bg-amber-950/50', avatar: 'bg-amber-200 dark:bg-amber-900 text-amber-700 dark:text-amber-300', text: 'text-amber-600/70 dark:text-amber-400/70' },
                                                              { bg: 'bg-rose-50 dark:bg-rose-950/30', hover: 'hover:bg-rose-100/70 dark:hover:bg-rose-950/50', avatar: 'bg-rose-200 dark:bg-rose-900 text-rose-700 dark:text-rose-300', text: 'text-rose-600/70 dark:text-rose-400/70' },
                                                            ];
                                                            const color = noteColors[idx % noteColors.length];
                                                            return (
                                                              <div 
                                                                key={note.id} 
                                                                className={`${color.bg} ${color.hover} p-3.5 rounded-2xl text-left space-y-2.5 transition-all duration-200`}
                                                              >
                                                                <p className="text-[10.5px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium pr-5">
                                                                  {note.content}
                                                                </p>
                                                                
                                                                <div className={`flex items-center justify-between text-[8px] font-bold ${color.text}`}>
                                                                  <span className="flex items-center gap-1.5">
                                                                    <span className={`w-4 h-4 rounded-full ${color.avatar} text-[8px] font-extrabold flex items-center justify-center`}>
                                                                      {note.agent_name?.charAt(0).toUpperCase() || 'A'}
                                                                    </span>
                                                                    <span className="max-w-[100px] truncate">{note.agent_name || 'Asesor'}</span>
                                                                  </span>
                                                                  
                                                                  <div className="flex items-center gap-1.5">
                                                                    <span>{new Date(note.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleDeleteNote(note.id)}
                                                                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer"
                                                                      title="Eliminar nota"
                                                                    >
                                                                      <Trash2 size={10} />
                                                                    </button>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            );
                                                          })
                                                        ) : (
                                                          <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2">
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">No hay notas registradas para este cliente.</span>
                                                          </div>
                                                        )}
                                                      </div>
                          
                                                      {/* Footer (Add note form) */}
                                                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex-shrink-0 space-y-2.5">
                                                        <textarea
                                                          value={newNoteText}
                                                          onChange={(e) => setNewNoteText(e.target.value)}
                                                          rows={3}
                                                          placeholder="Escribe una nueva nota interna..."
                                                          className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-white rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 resize-none font-medium placeholder-slate-400 transition-all"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={handleAddNewNote}
                                                          disabled={newNoteLoading || !newNoteText.trim()}
                                                          className="w-full py-2.5 bg-brand-500 hover:bg-brand-secondary text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                                                        >
                                                          {newNoteLoading ? (
                                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                          ) : (
                                                            <span>+ Agregar Nota</span>
                                                          )}
                                                        </button>
                                                      </div>
                                                    </div>
                                                  )}
                        </div>

                        {/* Column 2: Facturación / Catálogo */}
                        <div className="border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col min-h-0 bg-slate-50/45 dark:bg-slate-950 text-left relative overflow-hidden">
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-950/20">
                            <div className="space-y-4">
                              {/* Integration Header */}
                              <div className="pb-3.5 border-b border-slate-100 dark:border-slate-800/80 text-left">
                                <h5 className="text-[12px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText size={13} className="text-brand-primary" />
                                  <span>Facturación API</span>
                                </h5>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed font-medium">
                                  Catálogo integrado con tu Facturador Electrónico para enviar fichas de productos y cotizaciones.
                                </p>
                              </div>

                              {/* Search & Category Tabs */}
                              <div className="space-y-2.5">
                                <div className="relative font-sans">
                                  <Search size={12} className="absolute left-3 top-2.5 text-slate-450" />
                                  <input 
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={billingSearchQuery}
                                    onChange={(e) => setBillingSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary font-medium"
                                  />
                                </div>

                                <div className="flex bg-slate-100/60 dark:bg-slate-900 p-0.5 rounded-xl gap-0.5 border border-slate-200/20 dark:border-slate-800/50">
                                  {[
                                    { id: 'all', label: 'Todos' },
                                    { id: 'soft', label: 'Software' },
                                    { id: 'hard', label: 'Equipos' }
                                  ].map(cat => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => setBillingCategory(cat.id)}
                                      className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                                        billingCategory === cat.id
                                          ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                          : 'text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350'
                                      }`}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Products List */}
                              <div className="space-y-3">
                                {(() => {
                                  const products = [
                                    {
                                      id: 1,
                                      name: 'Facturación Electrónica Pro',
                                      price: 'S/ 150.00',
                                      category: 'soft',
                                      description: 'Sistema ERP completo de facturación electrónica. Emite boletas, facturas y notas de crédito homologado por la SUNAT.',
                                      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=120&auto=format&fit=crop&q=60',
                                      originalImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c'
                                    },
                                    {
                                      id: 2,
                                      name: 'Ticketera Térmica Bluetooth 58mm',
                                      price: 'S/ 120.00',
                                      category: 'hard',
                                      description: 'Impresora térmica de tickets de alta velocidad. Conectividad Bluetooth y USB, ideal para emitir boletas de venta rápidas.',
                                      image: 'https://images.unsplash.com/photo-1616083778396-75a4a90d05ee?w=120&auto=format&fit=crop&q=60',
                                      originalImage: 'https://images.unsplash.com/photo-1616083778396-75a4a90d05ee'
                                    },
                                    {
                                      id: 3,
                                      name: 'Lector de Código de Barras Láser',
                                      price: 'S/ 180.00',
                                      category: 'hard',
                                      description: 'Escáner de mano ergonómico con conexión USB plug & play. Lectura rápida y precisa de códigos UPC, EAN y 1D.',
                                      image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=120&auto=format&fit=crop&q=60',
                                      originalImage: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7'
                                    },
                                    {
                                      id: 4,
                                      name: 'Kit Comercial Facturación',
                                      price: 'S/ 450.00',
                                      category: 'hard',
                                      description: 'Combo premium: Ticketera térmica + Lector láser + Licencia de Facturación Electrónica por 6 meses.',
                                      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=120&auto=format&fit=crop&q=60',
                                      originalImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d'
                                    }
                                  ];

                                  const filtered = products
                                    .filter(p => billingCategory === 'all' || p.category === billingCategory)
                                    .filter(p => !billingSearchQuery.trim() || p.name.toLowerCase().includes(billingSearchQuery.toLowerCase()));

                                  if (filtered.length === 0) {
                                    return <div className="text-center py-8 text-xs text-slate-400 italic">No se encontraron productos.</div>;
                                  }

                                  return filtered.map(prod => (
                                    <div key={prod.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3.5 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
                                      <div className="flex items-start gap-3.5 text-left">
                                        <img 
                                          src={prod.image} 
                                          alt={prod.name} 
                                          onError={(e) => {
                                            e.currentTarget.src = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=100';
                                          }}
                                          className="w-14 h-14 rounded-lg object-cover border border-slate-200/40 dark:border-slate-800/60 flex-shrink-0 shadow-sm"
                                        />
                                        <div className="flex-1 min-w-0 space-y-1">
                                          <h6 className="text-[11.5px] font-bold text-slate-800 dark:text-white truncate leading-tight tracking-wide">{prod.name}</h6>
                                          <span className="inline-block px-2 py-0.5 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border border-teal-500/10 text-[9px] font-extrabold rounded-md">
                                            {prod.price}
                                          </span>
                                          <p className="text-[9.5px] text-slate-400 dark:text-slate-500 leading-normal line-clamp-2 pr-1 font-medium">{prod.description}</p>
                                        </div>
                                      </div>

                                      <div className="flex gap-2 pt-2.5 border-t border-slate-100/60 dark:border-slate-800/50">
                                        <button
                                          type="button"
                                          onClick={() => handleSendProductToChat(prod)}
                                          className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-secondary text-white font-extrabold text-[9px] uppercase rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm shadow-brand-500/10"
                                        >
                                          <Send size={9} className="stroke-[2.5]" />
                                          <span>Enviar Ficha</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSendQuoteToChat(prod)}
                                          className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-350 border border-slate-200/45 dark:border-slate-800 font-extrabold text-[9px] uppercase rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                                        >
                                          <FileText size={9} className="stroke-[2.5]" />
                                          <span>Cotizar</span>
                                        </button>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}


            {/* PIPELINE COMERCIAL (KANBAN BOARD) */}
            {activeTab === 'pipeline' && (
              <div className="space-y-5 animate-fadeIn h-full flex flex-col min-h-0 text-left">
                <div className="flex items-center justify-end gap-3 flex-shrink-0">
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchPipelineData()}
                      disabled={pipelineLoading}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
                    >
                      <RefreshCw size={13} className={pipelineLoading ? 'animate-spin' : ''} />
                      <span>Actualizar Tablero</span>
                    </button>
                  </div>
                </div>

                {pipelineLoading && pipelineData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2.5">
                      <RefreshCw size={24} className="animate-spin text-brand-primary mx-auto" />
                      <p className="text-xs text-surface-400 font-bold">Cargando tablero comercial...</p>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const columns = getPipelineColumns();
                    return (
                      <div className="flex-1 overflow-x-auto pb-4 flex gap-4.5 items-start min-h-0 hide-scrollbar select-none">
                        {PIPELINE_STAGES.map((columnName) => {
                          const items = columns[columnName] || [];
                          return (
                            <div 
                              key={columnName} 
                              className="w-72 shrink-0 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl flex flex-col max-h-[72vh]"
                            >
                              {/* Column Header */}
                              <div className="p-3.5 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 rounded-t-2xl">
                                <h4 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider truncate mr-2">
                                  {columnName}
                                </h4>
                                <span className="bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {items.length}
                                </span>
                              </div>

                              {/* Column Body / Cards List */}
                              <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-2.5 min-h-[200px]">
                                {items.length === 0 ? (
                                  <div className="h-28 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-[10px] text-slate-400 font-medium">
                                    Sin contactos
                                  </div>
                                ) : (
                                  items.map((item, index) => {
                                    const initials = item.name.substring(0, 2).toUpperCase();
                                    const isCrm = item.type === 'crm';
                                    return (
                                      <div 
                                        key={item.remoteJid}
                                        className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3 flex flex-col gap-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left relative group cursor-pointer"
                                        onClick={() => {
                                          const matchingChat = chats.find(c => c.remoteJid === item.remoteJid);
                                          if (matchingChat) {
                                            setSelectedChat(matchingChat);
                                          } else {
                                            setSelectedChat({
                                              remoteJid: item.remoteJid,
                                              pushName: item.name,
                                              unreadCount: 0
                                            });
                                          }
                                          setActiveTab('chats');
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-[#12a160] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                              {initials}
                                            </div>
                                            <div className="truncate text-left">
                                              <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate uppercase tracking-tight font-sans">
                                                {item.name}
                                              </h5>
                                              <span className="text-[9px] text-surface-400 font-medium block mt-0.5">
                                                +{item.phone}
                                              </span>
                                            </div>
                                          </div>
                                          
                                          {/* Dropdown de cambio rápido de etapa */}
                                          <div 
                                            className="relative flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button 
                                              onClick={() => setOpenMoveDropdownJid(openMoveDropdownJid === item.remoteJid ? null : item.remoteJid)}
                                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
                                              title="Mover de etapa"
                                            >
                                              <ChevronDown size={14} />
                                            </button>

                                            {openMoveDropdownJid === item.remoteJid && (
                                                <div className={`absolute right-0 w-44 bg-[#1E293B] dark:bg-slate-950 rounded-xl shadow-premium-lg border-0 py-1.5 z-40 animate-fadeIn ${
                                                  index > 0 && index === items.length - 1
                                                    ? 'bottom-full mb-1 origin-bottom-right'
                                                    : 'top-full mt-1 origin-top-right'
                                                }`}>
                                                <div className="px-2.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1">
                                                  Cambiar a etapa:
                                                </div>
                                                {PIPELINE_STAGES.map((stg) => (
                                                  <button
                                                    key={stg}
                                                    onClick={() => {
                                                      movePipelineStage(item.remoteJid, stg, item.name);
                                                      setOpenMoveDropdownJid(null);
                                                    }}
                                                    className={`w-full px-2.5 py-1.5 text-left text-[10px] font-semibold flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                                                      columnName === stg ? 'text-brand-primary bg-white/5' : 'text-white'
                                                    }`}
                                                  >
                                                    <span>{stg}</span>
                                                    {columnName === stg && (
                                                      <div className="w-1 h-1 rounded-full bg-brand-primary" />
                                                    )}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {isCrm && item.category && (
                                          <div className="flex mt-1">
                                            <span className="px-1.5 py-0.5 bg-pastel-100/50 dark:bg-brand-primary/10 text-brand-secondary dark:text-brand-primary text-[8.5px] font-bold rounded-md">
                                              {item.category}
                                            </span>
                                          </div>
                                        )}
                                        
                                        {!isCrm && item.lastMsg && (
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1 leading-normal italic font-sans">
                                            {item.lastMsg}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            
            {/* TASKS CRM SECTION */}
            {activeTab === 'tasks' && (
              <div className="space-y-6 animate-fadeIn text-left">
                {/* Stats Counters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tareas</p>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">{globalTasks.length}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <ListTodo size={20} />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendientes</p>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">{globalTasks.filter(t => !t.completed).length}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-500">
                      <Clock size={20} />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completadas</p>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">{globalTasks.filter(t => t.completed).length}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vencidas</p>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">
                        {globalTasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0))).length}
                      </h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500">
                      <AlertCircle size={20} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Create task form */}
                  <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4 self-start">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <Plus size={14} className="text-brand-primary" />
                      <span>Nueva Tarea CRM</span>
                    </h4>
                    <form onSubmit={handleCreateGlobalTask} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Asignar a Cliente</label>
                        <div className="relative font-sans" ref={clientDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer focus:outline-none"
                          >
                            <span className="truncate">
                              {newTaskClientId 
                                ? crmClients.find(c => c.id.toString() === newTaskClientId)?.name || 'Seleccionar Cliente'
                                : 'Seleccionar Cliente'}
                            </span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isClientDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsClientDropdownOpen(false)} />
                              <div className="absolute left-0 right-0 mt-1.5 bg-[#1E293B] dark:bg-slate-950 rounded-xl border-0 shadow-premium-lg py-1 z-40 max-h-48 overflow-y-auto animate-fadeIn text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewTaskClientId('');
                                    setIsClientDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-slate-350 dark:text-slate-450 hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer"
                                >
                                  -- Seleccionar Cliente --
                                </button>
                                {crmClients.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setNewTaskClientId(c.id.toString());
                                      setIsClientDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2 text-xs hover:bg-[#0D9488]/40 hover:text-white transition-colors cursor-pointer ${
                                      newTaskClientId === c.id.toString() 
                                        ? 'text-white bg-[#0D9488]' 
                                        : 'text-slate-100 dark:text-slate-200'
                                    }`}
                                  >
                                    {c.name} ({c.doc_type}: {c.doc_number.startsWith('MANUAL-') ? 'No registrado' : c.doc_number})
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Descripción de Tarea</label>
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Ej: Llamarlo mañana..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Límite</label>
                        <div className="relative" ref={taskFormDateRef}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowTaskFormDatePicker(!showTaskFormDatePicker);
                              const d = newTaskDueDate ? new Date(newTaskDueDate + 'T00:00:00') : new Date();
                              setTaskFormDatePickerYear(d.getFullYear());
                              setTaskFormDatePickerMonth(d.getMonth());
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer text-left"
                          >
                            <span>
                              {newTaskDueDate 
                                ? formatBirthdayString(newTaskDueDate)
                                : 'Seleccionar fecha'}
                            </span>
                            <Calendar size={13} className="text-slate-450" />
                          </button>

                          {showTaskFormDatePicker && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setShowTaskFormDatePicker(false)} />
                              <div className="absolute left-0 top-full mt-1.5 w-60 bg-[#1E293B] dark:bg-slate-950 border-0 rounded-2xl shadow-premium-lg p-3.5 z-40 animate-fadeIn font-sans">
                                <div className="flex items-center justify-between mb-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (taskFormDatePickerMonth === 0) {
                                        setTaskFormDatePickerMonth(11);
                                        setTaskFormDatePickerYear(taskFormDatePickerYear - 1);
                                      } else {
                                        setTaskFormDatePickerMonth(taskFormDatePickerMonth - 1);
                                      }
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors cursor-pointer"
                                  >
                                    <ChevronLeft size={13} />
                                  </button>
                                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][taskFormDatePickerMonth]} {taskFormDatePickerYear}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (taskFormDatePickerMonth === 11) {
                                        setTaskFormDatePickerMonth(0);
                                        setTaskFormDatePickerYear(taskFormDatePickerYear + 1);
                                      } else {
                                        setTaskFormDatePickerMonth(taskFormDatePickerMonth + 1);
                                      }
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors cursor-pointer"
                                  >
                                    <ChevronRight size={13} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1.5">
                                  {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => (
                                    <div key={d} className="h-5 flex items-center justify-center">{d}</div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                  {(() => {
                                    const days = [];
                                    const firstDay = new Date(taskFormDatePickerYear, taskFormDatePickerMonth, 1).getDay();
                                    const totalDays = new Date(taskFormDatePickerYear, taskFormDatePickerMonth + 1, 0).getDate();

                                    for (let i = 0; i < firstDay; i++) {
                                      days.push(<div key={`empty-${i}`} className="h-6 w-6" />);
                                    }

                                    const selectedDate = newTaskDueDate ? new Date(newTaskDueDate + 'T00:00:00') : null;
                                    const isSelectedYear = selectedDate && selectedDate.getFullYear() === taskFormDatePickerYear;
                                    const isSelectedMonth = selectedDate && selectedDate.getMonth() === taskFormDatePickerMonth;

                                    for (let d = 1; d <= totalDays; d++) {
                                      const isSelected = selectedDate && isSelectedYear && isSelectedMonth && selectedDate.getDate() === d;
                                      const dateStr = `${taskFormDatePickerYear}-${String(taskFormDatePickerMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                                      days.push(
                                        <button
                                          key={`day-${d}`}
                                          type="button"
                                          onClick={() => {
                                            setNewTaskDueDate(dateStr);
                                            setShowTaskFormDatePicker(false);
                                          }}
                                          className={`h-6 w-6 text-[9.5px] font-extrabold rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-brand-primary text-white shadow-sm'
                                              : 'text-slate-100 hover:bg-white/10'
                                          }`}
                                        >
                                          {d}
                                        </button>
                                      );
                                    }

                                    return days;
                                  })()}
                                </div>

                                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-750 text-[9.5px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewTaskDueDate('');
                                      setShowTaskFormDatePicker(false);
                                    }}
                                    className="text-rose-450 hover:underline cursor-pointer"
                                  >
                                    Borrar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const today = new Date();
                                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-\ ${String(today.getDate()).padStart(2, '0')}`.replace(/\s/g, '');
                                      setNewTaskDueDate(todayStr);
                                      setShowTaskFormDatePicker(false);
                                    }}
                                    className="text-brand-primary hover:underline cursor-pointer"
                                  >
                                    Hoy
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={newTaskCreating}
                        className="w-full py-2.5 bg-brand-500 hover:bg-brand-secondary text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Crear Tarea</span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Tasks list with filters */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
                    {/* Filters & Search Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      {/* Filter Switcher Tabs */}
                      <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-xl p-0.5 self-start">
                        {[
                          { id: 'pending', label: 'Pendientes' },
                          { id: 'completed', label: 'Completadas' },
                          { id: 'overdue', label: 'Vencidas' },
                          { id: 'all', label: 'Todas' }
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setTasksFilter(f.id)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                              tasksFilter === f.id 
                                ? 'bg-white dark:bg-slate-700 text-slate-850 dark:text-white shadow-sm' 
                                : 'text-slate-450 hover:text-slate-700'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {/* Search Bar */}
                      <div className="relative w-full sm:w-56 font-sans">
                        <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={tasksSearchQuery}
                          onChange={(e) => setTasksSearchQuery(e.target.value)}
                          placeholder="Buscar tareas..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>

                    {/* Tasks List */}
                    {globalTasksLoading ? (
                      <div className="py-12 text-center text-xs text-slate-400 animate-pulse">Cargando la lista de tareas...</div>
                    ) : (
                      (() => {
                        const filtered = globalTasks
                          .filter(t => {
                            if (tasksFilter === 'pending') return !t.completed;
                            if (tasksFilter === 'completed') return t.completed;
                            if (tasksFilter === 'overdue') {
                              return !t.completed && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0));
                            }
                            return true;
                          })
                          .filter(t => {
                            if (!tasksSearchQuery.trim()) return true;
                            const q = tasksSearchQuery.toLowerCase();
                            return t.title.toLowerCase().includes(q) || (t.client_name && t.client_name.toLowerCase().includes(q));
                          });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-16 text-center space-y-3">
                              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto border border-dashed border-slate-200 dark:border-slate-700/60">
                                <ListTodo size={20} />
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-350">No hay tareas encontradas</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">Prueba cambiando los filtros o buscando otro término.</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                            {filtered.map(task => {
                              const isOverdue = !task.completed && task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                              const isDueToday = !task.completed && task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                              
                              return (
                                <div
                                  key={task.id}
                                  className={`p-3.5 bg-slate-50/50 dark:bg-slate-900/40 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:-translate-y-0.5 transition-all duration-200 ${
                                    task.completed 
                                      ? 'border-slate-100 dark:border-slate-800/40 opacity-75'
                                      : isOverdue 
                                      ? 'border-rose-100 dark:border-rose-900/20 bg-rose-50/10'
                                      : isDueToday
                                      ? 'border-amber-100 dark:border-amber-900/20 bg-amber-50/10'
                                      : 'border-slate-200/50 dark:border-slate-800/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleGlobalTask(task)}
                                      className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                                        task.completed 
                                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                                          : isOverdue 
                                          ? 'border-rose-300 hover:border-rose-500 bg-rose-50 dark:bg-rose-950/20'
                                          : 'border-slate-300 hover:border-slate-400 bg-white dark:bg-slate-800'
                                      }`}
                                    >
                                      {task.completed && <Check size={12} className="stroke-[3]" />}
                                    </button>

                                    <div className="text-left min-w-0">
                                      <h5 className={`text-xs font-bold truncate leading-snug ${
                                        task.completed 
                                          ? 'text-slate-400 line-through' 
                                          : 'text-slate-850 dark:text-white'
                                      }`}>
                                        {task.title}
                                      </h5>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[150px]">
                                          👤 {task.client_name}
                                        </span>
                                        {task.client_phone && (
                                          <button
                                            type="button"
                                            onClick={() => handleGoToChat(task.client_phone, task.client_name)}
                                            className="text-[9.5px] text-brand-primary hover:text-brand-secondary font-black hover:underline cursor-pointer flex items-center gap-0.5"
                                          >
                                            <span>• Ir al chat</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold ${
                                      task.completed
                                        ? 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200/20 text-slate-400'
                                        : isOverdue
                                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/30 text-rose-600 dark:text-rose-450'
                                        : isDueToday
                                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/30 text-amber-600 dark:text-amber-450'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/60 text-slate-600 dark:text-slate-400'
                                    }`}>
                                      <Calendar size={11} className="flex-shrink-0" />
                                      <input
                                        type="date"
                                        value={getLocalDateString(task.due_date)}
                                        onChange={(e) => handleUpdateGlobalTaskDate(task, e.target.value || null)}
                                        className="bg-transparent border-0 p-0 text-[10px] font-bold text-inherit focus:outline-none cursor-pointer w-[80px]"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteGlobalTask(task.id)}
                                      className="p-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
                                      title="Eliminar tarea"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTACTS / CRM SECTION */}
            {activeTab === 'contacts' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Header con sub-tabs */}
                <div className="flex items-center justify-end gap-3 flex-shrink-0">
                  {/* Sub-tab switcher */}
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => setCrmContactsSubTab('crm')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${crmContactsSubTab === 'crm' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                      >
                        Clientes CRM
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrmContactsSubTab('google')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${crmContactsSubTab === 'google' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                      >
                        Agenda Google
                      </button>
                    </div>
                  </div>
                </div>

                {/* ===== SUB-TAB: CRM CLIENTS ===== */}
                {crmContactsSubTab === 'crm' && (
                  <div className="space-y-4">
                    {/* Search + Actions Bar */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                            <Search size={15} />
                          </span>
                          <input
                            type="text"
                            value={crmClientsSearch}
                            onChange={(e) => {
                              setCrmClientsSearch(e.target.value);
                              fetchCrmClients(e.target.value);
                            }}
                            placeholder="Buscar por nombre, DNI, RUC..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fetchCrmClients(crmClientsSearch)}
                            disabled={crmClientsLoading}
                            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            title="Recargar"
                          >
                            <RefreshCw size={14} className={crmClientsLoading ? 'animate-spin' : ''} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCrmCategoriesModalOpen(true)}
                            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                            title="Gestionar Categorías"
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Clients Table */}
                      {crmClientsLoading && crmClients.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-surface-400">
                          <RefreshCw size={24} className="animate-spin text-brand-primary" />
                          <span className="text-xs font-medium">Cargando clientes...</span>
                        </div>
                      ) : crmClients.length === 0 ? (
                        <div className="py-12 text-center text-surface-400 space-y-2">
                          <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                          <p className="text-xs font-semibold">No hay clientes registrados aún</p>
                          <p className="text-[10px] text-surface-400 dark:text-surface-500">Los clientes se crean automáticamente al registrar un contacto desde un chat de WhatsApp.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                                <th className="pb-3 text-left">Cliente</th>
                                <th className="pb-3 text-left">Documento</th>
                                <th className="pb-3 text-left hidden sm:table-cell">Email</th>
                                <th className="pb-3 text-left hidden md:table-cell">Registro</th>
                                <th className="pb-3 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                              {crmClients.map((client: any) => (
                                <React.Fragment key={client.id}>
                                  <tr 
                                    className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer ${crmExpandedClientId === client.id ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
                                    onClick={() => {
                                      if (crmExpandedClientId === client.id) {
                                        setCrmExpandedClientId(null);
                                        setCrmClientContacts([]);
                                      } else {
                                        setCrmExpandedClientId(client.id);
                                        fetchCrmClientContacts(client.id);
                                      }
                                    }}
                                  >
                                    <td className="py-3.5">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-pastel-100/50 flex items-center justify-center text-brand-primary font-bold text-xs flex-shrink-0">
                                          {client.doc_type === 'RUC' ? <Users size={14} /> : client.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 dark:text-white truncate leading-tight">{client.name}</p>
                                          {client.address && <p className="text-[10px] text-surface-400 truncate max-w-[200px]">{client.address}</p>}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5">
                                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${client.doc_type === 'RUC' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : client.doc_type === 'DNI' ? 'bg-amber-500/10 text-amber-600 dark:text-slate-400 dark:text-slate-300' : 'bg-slate-200/60 text-surface-500 dark:bg-slate-800 dark:text-surface-400'}`}>
                                        {client.doc_type === 'MANUAL' ? 'Manual' : `${client.doc_type}: ${client.doc_number}`}
                                      </span>
                                    </td>
                                    <td className="py-3.5 text-surface-500 dark:text-surface-400 font-medium hidden sm:table-cell truncate max-w-[150px]">
                                      {client.email || '—'}
                                    </td>
                                    <td className="py-3.5 text-surface-400 font-medium hidden md:table-cell">
                                      {new Date(client.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })}
                                    </td>
                                    <td className="py-3.5 text-right">
                                      <ChevronDown size={14} className={`inline-block text-surface-400 transition-transform duration-200 ${crmExpandedClientId === client.id ? 'rotate-180' : ''}`} />
                                    </td>
                                  </tr>

                                  {/* Expanded Row: Client Contacts */}
                                  {crmExpandedClientId === client.id && (
                                    <tr>
                                      <td colSpan={5} className="p-0">
                                        <div className="bg-slate-50/80 dark:bg-slate-950/30 p-4 space-y-3 border-l-2 border-brand-500">
                                          {/* Notes */}
                                          {client.notes && (
                                            <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/10 rounded-xl border border-amber-200/30 dark:border-amber-800/20">
                                              <span className="text-[9px] text-amber-600 dark:text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider block mb-0.5">Notas de Negocio</span>
                                              <p className="text-[11px] text-surface-600 dark:text-surface-400 font-medium whitespace-pre-line">{client.notes}</p>
                                            </div>
                                          )}

                                          {/* Contacts Header */}
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Contactos Vinculados</span>
                                          </div>

                                          {/* Contacts List */}
                                          {crmClientContactsLoading ? (
                                            <div className="py-4 text-center text-xs text-surface-400 animate-pulse">Cargando contactos...</div>
                                          ) : crmClientContacts.length === 0 ? (
                                            <div className="py-4 text-center text-xs text-surface-400">Sin contactos vinculados.</div>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {crmClientContacts.map((contact: any) => (
                                                <div key={contact.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/40 dark:border-slate-800/60">
                                                  <div className="flex items-center gap-2.5">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${contact.is_active ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                                    <div>
                                                      <p className="text-xs font-bold text-slate-800 dark:text-white font-mono">+{contact.phone_number}</p>
                                                      <p className="text-[10px] text-surface-400">{contact.is_active ? 'Activo' : 'Inactivo'}</p>
                                                    </div>
                                                  </div>
                                                  <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full border ${contact.category_name ? 'bg-pastel-100/50 text-brand-primary border-pastel-100/30' : 'bg-slate-100 dark:bg-slate-800 text-surface-400 border-slate-200/50 dark:border-slate-700/50'}`}>
                                                    {contact.category_name || 'Sin categoría'}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== SUB-TAB: GOOGLE CONTACTS ===== */}
                {crmContactsSubTab === 'google' && (
                  <div className="space-y-6">
                    {!googleConnected ? (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center max-w-2xl mx-auto space-y-6 shadow-premium">
                        <div className="w-16 h-16 rounded-3xl bg-pastel-100/50 flex items-center justify-center text-brand-primary mx-auto">
                          <Users size={32} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-bold text-slate-800 dark:text-white">Sincroniza tus contactos en la nube</h4>
                          <p className="text-xs text-surface-500 dark:text-surface-400 max-w-md mx-auto leading-relaxed">
                            Conecta tu cuenta de Google para sincronizar contactos de forma instantánea. Al crear, editar o eliminar contactos desde este panel, se actualizarán inmediatamente en tu cuenta de Google y se reflejarán en tu celular y chats de WhatsApp.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectGoogleContacts}
                          className="inline-flex items-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-secondary active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-brand-500/20 cursor-pointer"
                        >
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.072 0-5.561-2.49-5.561-5.561s2.49-5.561 5.561-5.561c1.396 0 2.67.513 3.655 1.353l3.14-3.14C18.796 3.738 15.748 2.5 12.24 2.5 6.42 2.5 1.7 7.22 1.7 13s4.72 10.5 10.54 10.5c5.8 0 10.46-4.7 10.46-10.5 0-.712-.082-1.395-.224-2.073h-10.236z"/>
                          </svg>
                          <span>Conectar con Google Contactos</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Connection Info header card */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm text-left">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-pastel-100/50 text-brand-primary flex items-center justify-center flex-shrink-0">
                              <Users size={22} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Google Contactos Activo</h4>
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                              </div>
                              <p className="text-xs text-surface-400 font-medium">Cuenta vinculada: <strong className="text-surface-600 dark:text-slate-300">{googleEmail}</strong></p>
                            </div>
                          </div>

                          {/* Header Actions */}
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Import/Sync from WhatsApp Dropdown */}
                            <div className="relative" ref={syncDropdownRef}>
                              <button
                                type="button"
                                onClick={() => setShowSyncDropdown(!showSyncDropdown)}
                                disabled={isSyncingWhatsAppContacts}
                                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                              >
                                <RefreshCw size={13} className={isSyncingWhatsAppContacts ? 'animate-spin' : ''} />
                                <span>Sincronizar Celular</span>
                              </button>
                              
                              {showSyncDropdown && (
                                <div className="absolute top-[100%] right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-premium-lg p-2 flex flex-col gap-1 min-w-[220px] border border-slate-100 dark:border-slate-800/40 text-left">
                                  <span className="p-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800/60 pb-1.5 mb-1.5">Importar desde línea:</span>
                                  {instances.filter(i => i.status === 'connected').length === 0 ? (
                                    <span className="p-3 text-[10px] text-surface-400 dark:text-surface-500 font-bold block text-center">No hay líneas conectadas</span>
                                  ) : (
                                    instances.filter(i => i.status === 'connected').map(inst => (
                                      <button
                                        key={inst.id}
                                        type="button"
                                        onClick={() => handleSyncWhatsAppContacts(inst.instance_name)}
                                        className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl text-left cursor-pointer transition-colors"
                                      >
                                        🚀 {inst.instance_name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setContactModal({
                                isOpen: true,
                                isEdit: false,
                                resourceName: null,
                                etag: null,
                                givenName: '',
                                familyName: '',
                                phoneNumber: ''
                              })}
                              className="px-4 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-brand-500/20 cursor-pointer flex items-center gap-1.5"
                            >
                              <Plus size={14} />
                              <span>Nuevo Contacto</span>
                            </button>
                          </div>
                        </div>

                        {/* Contacts Agenda Table list */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm text-left">
                          {/* Search bar input */}
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                              <Search size={15} />
                            </span>
                            <input
                              type="text"
                              value={searchContactQuery}
                              onChange={(e) => setSearchContactQuery(e.target.value)}
                              placeholder="Buscar contactos por nombre, apellido o número..."
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                            />
                          </div>

                          {googleContactsLoading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3 text-surface-400">
                              <RefreshCw size={24} className="animate-spin text-brand-primary" />
                              <span className="text-xs font-medium">Cargando contactos de Google...</span>
                            </div>
                          ) : (
                            <div className="overflow-hidden">
                              {googleContacts.filter(c => {
                                const q = searchContactQuery.toLowerCase().trim();
                                if (!q) return true;
                                return (
                                  c.displayName.toLowerCase().includes(q) ||
                                  c.phoneNumber.toLowerCase().includes(q)
                                );
                              }).length === 0 ? (
                                <div className="py-12 text-center text-surface-400 space-y-2">
                                  <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                                  <p className="text-xs font-semibold">No se encontraron contactos en tu agenda</p>
                                  <p className="text-[10px] text-surface-400 dark:text-surface-500">Usa el botón "Nuevo Contacto" o conecta / sincroniza tu celular.</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                                        <th className="pb-3 text-left w-12">Foto</th>
                                        <th className="pb-3 text-left">Nombre</th>
                                        <th className="pb-3 text-left">Teléfono</th>
                                        <th className="pb-3 text-right">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                      {googleContacts
                                        .filter(c => {
                                          const q = searchContactQuery.toLowerCase().trim();
                                          if (!q) return true;
                                          return (
                                            c.displayName.toLowerCase().includes(q) ||
                                            c.phoneNumber.toLowerCase().includes(q)
                                          );
                                        })
                                        .map(contact => {
                                          const initials = contact.givenName ? contact.givenName.charAt(0).toUpperCase() : (contact.displayName ? contact.displayName.charAt(0).toUpperCase() : 'U');
                                          
                                          return (
                                            <tr key={contact.resourceName} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                                              <td className="py-3">
                                                {contact.photoUrl ? (
                                                  <img src={contact.photoUrl} alt={contact.displayName} className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                  <div className="w-8 h-8 rounded-full bg-pastel-100/50 text-brand-secondary dark:text-brand-primary flex items-center justify-center font-bold text-xs">
                                                    {initials}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-3 font-semibold text-slate-700 dark:text-slate-200">
                                                {contact.displayName}
                                              </td>
                                              <td className="py-3 font-mono text-surface-500 dark:text-surface-400 font-bold">
                                                {contact.phoneNumber || 'Sin teléfono'}
                                              </td>
                                              <td className="py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => setContactModal({
                                                      isOpen: true,
                                                      isEdit: true,
                                                      resourceName: contact.resourceName,
                                                      etag: contact.etag,
                                                      givenName: contact.givenName,
                                                      familyName: contact.familyName,
                                                      phoneNumber: contact.phoneNumber
                                                    })}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-surface-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                                                    title="Editar contacto"
                                                  >
                                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteContact(contact.resourceName)}
                                                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-surface-400 hover:text-rose-600 transition-colors cursor-pointer"
                                                    title="Eliminar contacto"
                                                  >
                                                    <Trash2 size={13.5} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* WHATSAPP GROUPS SECTION */}
            {activeTab === 'groups' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Grupos de WhatsApp</h3>
                  <p className="text-xs text-surface-400">Administra los grupos, miembros y accesos de tu línea conectada.</p>
                </div>

                {!selectedInstanceForChats ? (
                  // Select instance warning screen
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center max-w-2xl mx-auto space-y-4 shadow-sm text-left">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-brand-primary flex items-center justify-center mx-auto">
                      <Smartphone size={26} />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Selecciona una línea activa</h4>
                      <p className="text-xs text-surface-400 max-w-sm mx-auto leading-relaxed">
                        Debes seleccionar una instancia de WhatsApp conectada para poder listar y administrar sus grupos.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Main group content layout (Split screen: Groups List on left, Selected Group details on right)
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Groups List */}
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm text-left">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Lista de Grupos ({groups.length})</h4>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={fetchGroups}
                            disabled={groupsLoading}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            title="Recargar grupos"
                          >
                            <RefreshCw size={14} className={groupsLoading ? 'animate-spin' : ''} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setCreateGroupError(null);
                              setShowCreateGroupModal(true);
                            }}
                            className="px-3.5 py-2.5 bg-brand-500 hover:bg-brand-secondary active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer flex items-center gap-1"
                          >
                            <Plus size={13} />
                            <span>Crear Grupo</span>
                          </button>
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                          <Search size={15} />
                        </span>
                        <input
                          type="text"
                          value={searchGroupQuery}
                          onChange={(e) => setSearchGroupQuery(e.target.value)}
                          placeholder="Buscar grupos por nombre o JID..."
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                        />
                      </div>

                      {groupsLoading && groups.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-surface-400">
                          <RefreshCw size={24} className="animate-spin text-brand-primary" />
                          <span className="text-xs font-medium">Recuperando grupos de WhatsApp...</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                          {groups.filter(g => {
                            const q = searchGroupQuery.toLowerCase().trim();
                            if (!q) return true;
                            const subject = (g.subject || '').toLowerCase();
                            const jid = (g.id || '').toLowerCase();
                            return subject.includes(q) || jid.includes(q);
                          }).length === 0 ? (
                            <div className="py-12 text-center text-surface-400 space-y-2">
                              <Users2 size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                              <p className="text-xs font-semibold">No se encontraron grupos</p>
                              <p className="text-[10px] text-surface-400 dark:text-surface-500">¿Estás seguro de que tu línea de WhatsApp tiene grupos activos?</p>
                            </div>
                          ) : (
                            groups
                              .filter(g => {
                                const q = searchGroupQuery.toLowerCase().trim();
                                if (!q) return true;
                                const subject = (g.subject || '').toLowerCase();
                                const jid = (g.id || '').toLowerCase();
                                return subject.includes(q) || jid.includes(q);
                              })
                              .map(group => {
                                const isSelected = selectedGroup?.id === group.id;
                                const initials = group.subject ? group.subject.charAt(0).toUpperCase() : 'G';
                                
                                return (
                                  <div
                                    key={group.id}
                                    onClick={() => {
                                      setSelectedGroup(group);
                                      setInviteLinkLabel(null);
                                    }}
                                    className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all border text-left ${
                                      isSelected
                                        ? 'bg-slate-50 dark:bg-slate-800/40 border-emerald-500/30'
                                        : 'bg-slate-50/50 dark:bg-slate-950/20 border-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/20'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {group.size > 0 && group.subject ? (
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-slate-600 dark:text-slate-400 dark:text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                          {initials}
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-surface-400 flex items-center justify-center flex-shrink-0">
                                          <Users2 size={16} />
                                        </div>
                                      )}
                                      
                                      <div className="min-w-0">
                                        <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                          {group.subject || 'Grupo sin Nombre'}
                                        </h5>
                                        <span className="text-[9px] font-mono text-surface-400 dark:text-surface-500 block truncate font-bold select-all">
                                          {group.id}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-950 text-[9px] font-bold text-surface-500 dark:text-surface-400">
                                        👥 {group.size || (group.participants ? group.participants.length : 0)} miembros
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Selected Group Detail Panel */}
                    <div className="lg:col-span-5 space-y-6">
                      {selectedGroup ? (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm text-left">
                          {/* Panel Header */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/40">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight truncate">{selectedGroup.subject}</h4>
                              <span className="text-[9px] font-mono text-surface-400 dark:text-surface-500 block truncate max-w-[220px] font-bold select-all" title={selectedGroup.id}>
                                ID: {selectedGroup.id}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedGroup(null)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-white cursor-pointer flex items-center justify-center"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {/* Group Invite Link Box */}
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Enlace de Invitación</span>
                              {inviteLinkLabel && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInviteLink(selectedGroup.id)}
                                  className="text-[9px] text-rose-500 hover:text-rose-600 font-bold transition-colors cursor-pointer"
                                  disabled={inviteLinkLoading}
                                >
                                  Revocar
                                </button>
                              )}
                            </div>

                            {inviteLinkLabel ? (
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-950/50 p-2 rounded-xl border border-slate-100 dark:border-slate-900">
                                <span className="text-[10px] font-mono text-surface-600 dark:text-slate-300 truncate flex-1">{inviteLinkLabel}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(inviteLinkLabel)}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-surface-400 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                                  title="Copiar enlace"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFetchInviteLink(selectedGroup.id)}
                                disabled={inviteLinkLoading}
                                className="w-full py-2 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-900 rounded-xl text-[10px] text-surface-600 dark:text-slate-300 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {inviteLinkLoading ? (
                                  <RefreshCw size={10} className="animate-spin text-brand-primary" />
                                ) : (
                                  <ExternalLink size={10} />
                                )}
                                <span>Generar y Copiar Enlace</span>
                              </button>
                            )}
                          </div>

                          {/* Add Participant input form */}
                          <form onSubmit={handleAddParticipantSubmit} className="space-y-2">
                            <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Agregar Miembro</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={addParticipantNumber}
                                onChange={(e) => setAddParticipantNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Ej: 51987654321 (con código)"
                                required
                                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                              />
                              <button
                                type="submit"
                                disabled={addParticipantLoading || !addParticipantNumber.trim()}
                                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all flex-shrink-0"
                              >
                                {addParticipantLoading ? 'Agregando...' : 'Agregar'}
                              </button>
                            </div>
                          </form>

                          {/* Participants List */}
                          <div className="space-y-3.5">
                            <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800/40 pb-1.5">
                              Miembros ({selectedGroup.participants ? selectedGroup.participants.length : 0})
                            </span>
                            
                            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                              {(selectedGroup.participants || []).map((participant: any) => {
                                const cleanId = participant.id.split('@')[0];
                                const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
                                
                                return (
                                  <div key={participant.id} className="group flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono truncate">+{cleanId}</span>
                                        {isAdmin && (
                                          <span className="px-1.5 py-0.5 rounded bg-pastel-100/50 text-brand-secondary dark:text-brand-primary text-[8.5px] font-bold">
                                            Admin
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Buttons for participant */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {isAdmin ? (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateGroupParticipant('demote', cleanId)}
                                          className="p-1 bg-white dark:bg-slate-900 text-surface-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Degradar a miembro"
                                        >
                                          Degradar
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateGroupParticipant('promote', cleanId)}
                                          className="p-1 bg-white dark:bg-slate-900 text-surface-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Ascender a admin"
                                        >
                                          Promover
                                        </button>
                                      )}
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateGroupParticipant('remove', cleanId)}
                                        className="p-1 bg-white hover:bg-rose-50 dark:bg-slate-900 text-surface-400 hover:text-rose-600 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer shadow-sm transition-colors flex items-center justify-center"
                                        title="Eliminar del grupo"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-sm text-surface-400 space-y-2">
                          <Users2 size={28} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                          <p className="text-xs font-semibold">Ningún grupo seleccionado</p>
                          <p className="text-[10px] text-surface-400 dark:text-surface-500">Selecciona un grupo de la lista para administrar sus miembros y enlace.</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* PLAYGROUND SECTION */}
            {activeTab === 'playground' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Probar Envío de Mensaje</h3>
                  <p className="text-xs text-surface-400">Verifica el funcionamiento de tus instancias enviándote un mensaje de prueba.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Test Form */}
                  <form onSubmit={handleSendTestMessage} className="md:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-3xl space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">Seleccionar Instancia</label>
                      {/* Custom Select Dropdown */}
                      <div className="relative w-full" ref={sandboxDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowSandboxInstanceMenu(!showSandboxInstanceMenu)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-xs text-slate-800 dark:text-white hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-all font-bold cursor-pointer flex items-center justify-between gap-2 shadow-inner"
                        >
                          {testInstance ? (
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                instances.find(i => i.instance_name === testInstance)?.status === 'connected' ? 'bg-brand-primary' : 'bg-slate-400'
                              }`} />
                              <span className="truncate">
                                {testInstance}
                              </span>
                            </div>
                          ) : (
                            <span className="text-surface-400 font-medium">Elegir instancia...</span>
                          )}
                          <ChevronDown size={14} className={`text-surface-400 transition-transform duration-200 ${showSandboxInstanceMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showSandboxInstanceMenu && (
                          <div className="absolute top-[100%] left-0 w-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-premium-lg p-1.5 flex flex-col gap-1 text-left animate-fadeIn">
                            {instances.length === 0 ? (
                              <span className="p-3 text-[10px] text-surface-400 dark:text-surface-500 font-bold block text-center">No hay instancias creadas</span>
                            ) : (
                              instances.map(inst => (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => {
                                    setTestInstance(inst.instance_name);
                                    setTestResult(null);
                                    setShowSandboxInstanceMenu(false);
                                  }}
                                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer text-left ${
                                    testInstance === inst.instance_name 
                                      ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-white' 
                                      : 'text-surface-600 dark:text-surface-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-white'
                                  }`}
                                >
                                  <span className="truncate">{inst.instance_name}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold ${
                                    inst.status === 'connected' 
                                      ? 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary' 
                                      : 'bg-slate-100 dark:bg-slate-950 text-surface-500'
                                  }`}>
                                    {inst.status === 'connected' ? 'Conectada' : 'Desconectada'}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">Número Destino (9 dígitos)</label>
                      <div className="flex relative items-center w-full shadow-inner rounded-2xl overflow-hidden">
                        <div className="px-3.5 py-3 bg-slate-100/50 dark:bg-slate-900/50 text-surface-500 dark:text-surface-400 flex items-center gap-1.5 select-none font-bold text-xs">
                          <span>🇵🇪 +51</span>
                        </div>
                        <input
                          type="text"
                          value={testNumber}
                          onChange={(e) => setTestNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                          placeholder="Ej: 987654321"
                          required
                          maxLength={9}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950/50 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">Mensaje de Texto</label>
                      <textarea
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        rows={4}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-medium resize-none shadow-inner"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={testLoading || !testInstance || instances.find(i => i.instance_name === testInstance)?.status !== 'connected'}
                      className="w-full py-3.5 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-lg shadow-brand-500/15 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {testLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Enviar Mensaje de Prueba</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Result Box */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl text-left space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-surface-500">Resultado del Envío</h4>
                      
                      {testResult ? (
                        <div className={`p-4 rounded-2xl border text-xs font-bold animate-fadeIn ${
                          testResult.success 
                            ? 'bg-pastel-100/50 border-pastel-100/40 text-brand-secondary dark:text-brand-primary' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? <Check size={16} /> : <X size={16} />}
                            <span>{testResult.success ? 'Envío Exitoso' : 'Error en Envío'}</span>
                          </div>
                          <p className="text-[11px] font-medium text-surface-500 dark:text-surface-400 mt-2 leading-relaxed">
                            {testResult.message}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-surface-400 leading-relaxed font-medium">
                          Selecciona una instancia activa, introduce el número de WhatsApp receptor en formato internacional y pulsa enviar para ver el log de envío aquí.
                        </p>
                      )}
                    </div>

                    <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl text-left space-y-2">
                      <h5 className="text-xs font-bold text-slate-600 dark:text-slate-400 dark:text-indigo-400 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-brand-primary" />
                        <span>Consejo Rápido</span>
                      </h5>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed">
                        Asegúrate de agregar el código de país al número de teléfono. Ejemplo: <strong>51</strong> para Perú, <strong>54</strong> para Argentina, <strong>57</strong> para Colombia.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* API DOCUMENTATION SECTION */}
            {/* DOCUMENTATION SECTION */}
            {activeTab === 'docs' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Documentación de Integración</h3>
                  <p className="text-xs text-surface-400">Ejemplos para conectar el API de envío con tus sistemas internos y plataformas externas.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: API endpoints sub-tabs */}
                  <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 pb-2 border-b border-slate-100 dark:border-slate-800/40">
                      Endpoints Disponibles
                    </h4>
                    
                    <div className="space-y-2">
                      {[
                        { id: 'text', label: 'Enviar Mensaje Texto', method: 'POST', color: 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary' },
                        { id: 'media', label: 'Enviar Mensaje Media', method: 'POST', color: 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary' },
                        { id: 'create-group', label: 'Crear Grupo WhatsApp', method: 'POST', color: 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary' },
                        { id: 'participants-group', label: 'Administrar Miembros', method: 'PUT', color: 'bg-amber-500/10 text-amber-600 dark:text-slate-400 dark:text-slate-300' },
                        { id: 'invite-group', label: 'Obtener Link Grupo', method: 'GET', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
                      ].map(endpoint => {
                        const isActive = docTab === endpoint.id;
                        return (
                          <button
                            key={endpoint.id}
                            onClick={() => setDocTab(endpoint.id as any)}
                            className={`w-full p-3 rounded-xl flex items-center justify-between gap-3 text-left transition-all border cursor-pointer ${
                              isActive
                                ? 'bg-slate-50 dark:bg-slate-800/40 border-brand-500/30'
                                : 'bg-transparent border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-850'
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{endpoint.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold ${endpoint.color}`}>
                              {endpoint.method}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Endpoint Code Details */}
                  <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                          {docTab === 'text' && 'Enviar Mensaje de Texto'}
                          {docTab === 'media' && 'Enviar Mensaje con Media (Imagen/Video/Doc)'}
                          {docTab === 'create-group' && 'Crear Grupo de WhatsApp'}
                          {docTab === 'participants-group' && 'Administrar Miembros en Grupo'}
                          {docTab === 'invite-group' && 'Obtener Enlace de Invitación'}
                        </h4>
                        <span className="text-[10px] text-surface-400 block mt-0.5">
                          {docTab === 'text' && 'Endpoint para envíos de texto plano masivos o individuales'}
                          {docTab === 'media' && 'Soporta el envío de archivos adjuntos usando URLs públicas'}
                          {docTab === 'create-group' && 'Crea un grupo de WhatsApp y agrega miembros automáticamente'}
                          {docTab === 'participants-group' && 'Añade, elimina, promueve o degrada administradores en un grupo'}
                          {docTab === 'invite-group' && 'Genera el enlace público de invitación oficial del grupo'}
                        </span>
                      </div>
                      
                      {/* Language Selector */}
                      <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl text-[10px] font-bold">
                        {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                          <button
                            key={lang}
                            onClick={() => setDocLang(lang)}
                            className={`px-3 py-1.5 rounded-lg uppercase transition-all cursor-pointer ${
                              docLang === lang 
                                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' 
                                : 'text-surface-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            {lang === 'js' ? 'Fetch JS' : lang}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Method & Path Display Box */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                        docTab === 'invite-group' 
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' 
                          : docTab === 'participants-group' 
                            ? 'bg-amber-500/10 text-amber-600 dark:text-slate-400 dark:text-slate-300'
                            : 'bg-pastel-100/50 text-brand-secondary dark:text-brand-primary'
                      }`}>
                        {docTab === 'invite-group' ? 'GET' : docTab === 'participants-group' ? 'PUT' : 'POST'}
                      </span>
                      <span className="text-xs font-mono text-surface-600 dark:text-slate-300 select-all truncate">
                        {currentBackendUrl}
                        {docTab === 'text' && '/api/instances/send'}
                        {docTab === 'media' && '/api/instances/send-media'}
                        {docTab === 'create-group' && '/api/instances/groups/{instanceName}/create'}
                        {docTab === 'participants-group' && '/api/instances/groups/{instanceName}/participants'}
                        {docTab === 'invite-group' && '/api/instances/groups/{instanceName}/invite-code?groupJid={groupJid}'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-surface-500 leading-relaxed font-medium">
                        Realiza una petición HTTP hacia la URI indicada. Asegúrate de pasar las credenciales de la instancia correctas:
                      </p>

                      {/* Code Container */}
                      <div className="relative group">
                        <pre className="bg-slate-950 text-brand-primary dark:text-emerald-300 font-mono text-[10.5px] p-5 rounded-2xl overflow-x-auto leading-relaxed shadow-inner">
                          {getDocCode()}
                        </pre>
                        
                        <button
                          onClick={() => copyToClipboard(getDocCode())}
                          className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900 text-surface-400 hover:text-white rounded-lg hover-lift shadow transition-all cursor-pointer opacity-100 group-hover:opacity-100"
                          title="Copiar código"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* API response specifications */}
                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/40">
                      <h5 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider font-bold">Respuesta Esperada (JSON)</h5>
                      <pre className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl font-mono text-[10px] text-surface-600 dark:text-surface-400 overflow-x-auto">
                        {docTab === 'text' && JSON.stringify({
                          success: true,
                          message: "Mensaje enviado exitosamente en vivo 🚀"
                        }, null, 2)}
                        {docTab === 'media' && JSON.stringify({
                          success: true,
                          message: "Mensaje enviado exitosamente en vivo 🚀"
                        }, null, 2)}
                        {docTab === 'create-group' && JSON.stringify({
                          success: true,
                          message: "Grupo creado exitosamente",
                          data: {
                            id: "1203630248384@g.us",
                            participants: [
                              "51987654321@s.whatsapp.net",
                              "51912345678@s.whatsapp.net"
                            ]
                          }
                        }, null, 2)}
                        {docTab === 'participants-group' && JSON.stringify({
                          success: true,
                          message: "Participante actualizado correctamente"
                        }, null, 2)}
                        {docTab === 'invite-group' && JSON.stringify({
                          success: true,
                          data: {
                            code: "Fk8Y2bLp0QzX..."
                          }
                        }, null, 2)}
                      </pre>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SUBSCRIPTION SECTION */}
            {activeTab === 'subscription' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Estado de la Suscripción</h3>
                  <p className="text-xs text-surface-400">Detalles de las características vigentes y límites de tu plan SaaS.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                  
                  {/* Plan specs */}
                  <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-pastel-100/50 rounded-xl text-brand-primary">
                          <Key size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest">Plan Contratado</span>
                          <h4 className="text-lg font-bold text-slate-800 dark:text-white">{subscription?.plan_name || 'Básico'}</h4>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-surface-500">Estado de Cuenta</span>
                          <span className="text-brand-primary font-bold uppercase">Activo</span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-surface-500">Instancias Máximas</span>
                          <span className="text-slate-800 dark:text-white font-bold">{subscription?.max_instances || 1} líneas</span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-surface-500">Fecha de Alta</span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-surface-500">Fecha de Expiración</span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed font-medium">
                      Para solicitar la ampliación de tu límite de líneas de WhatsApp, modificaciones de plan o cancelación, contacta con tu administrador.
                    </div>
                  </div>

                  {/* Reseller Banner Info */}
                  <div className="md:col-span-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6 rounded-3xl flex flex-col justify-between gap-6 relative overflow-hidden">
                    <div className="space-y-3 relative z-10">
                      <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 dark:text-indigo-400 uppercase tracking-wider">¿Necesitas más capacidad?</h4>
                      <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed font-medium">
                        Ofrecemos planes corporativos a medida que se adaptan a las necesidades y volúmenes de tu infraestructura de mensajería empresarial.
                      </p>
                      
                      <div className="space-y-1.5 pt-2 text-[11px] text-surface-600 dark:text-surface-400 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-brand-primary" />
                          <span>Instancias de WhatsApp ilimitadas</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-brand-primary" />
                          <span>Infraestructura dedicada Redis</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-brand-primary" />
                          <span>Soporte prioritario 24/7</span>
                        </div>
                      </div>
                    </div>

                    <a 
                      href="https://wa.me/51944399377" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-500/20 text-center flex items-center justify-center gap-1 transition-all cursor-pointer relative z-10"
                    >
                      <span>Hablar con Soporte</span>
                      <ExternalLink size={12} />
                    </a>

                    {/* background graphic */}
                    <div className="absolute right-[-20%] bottom-[-20%] w-48 h-48 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none" />
                  </div>

                </div>
              </div>
            )}

            {/* TEAM SECTION */}
            {activeTab === 'team' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Mi Equipo de Asesores</h3>
                    <p className="text-xs text-surface-400">Gestiona las cuentas de los colaboradores de tu empresa y supervisa sus chats activos.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateAgentModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer font-medium"
                  >
                    <Plus size={16} />
                    <span>Agregar Colaborador</span>
                  </button>
                </div>

                {teamLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={24} className="animate-spin text-brand-primary" />
                    <span className="text-xs text-surface-400 font-bold uppercase">Cargando colaboradores...</span>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-8 rounded-3xl text-center space-y-3">
                    <Users2 className="mx-auto w-10 h-10 text-slate-400 dark:text-slate-600" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No tienes colaboradores registrados</h4>
                    <p className="text-xs text-surface-400 max-w-sm mx-auto">Crea cuentas individuales para tus agentes. Podrás asignarles chats específicos en tiempo real.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teamMembers.map((agent: any) => {
                      const isActiveStatus = agent.status === 'available';
                      const isBusyStatus = agent.status === 'busy';
                      return (
                        <div key={agent.id} className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-3xl space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm uppercase">
                                  {agent.name.slice(0, 2)}
                                </div>
                                <div className="text-left">
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{agent.name}</h4>
                                  <p className="text-[10px] text-surface-400">{agent.email}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleToggleAgentStatus(agent.id, agent.status)}
                                className={`px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isActiveStatus 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                    : isBusyStatus 
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isActiveStatus ? 'bg-emerald-500' : isBusyStatus ? 'bg-amber-500' : 'bg-slate-400'
                                }`} />
                                <span>
                                  {agent.status === 'available' && 'Disponible'}
                                  {agent.status === 'busy' && 'Ocupado'}
                                  {agent.status === 'offline' && 'Desconectado'}
                                </span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl text-center">
                                <span className="block text-[10px] text-surface-400 font-bold uppercase tracking-wider font-bold">Chats Activos</span>
                                <span className="text-base font-bold text-slate-800 dark:text-white mt-1 block">{agent.active_chats || 0}</span>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl text-center">
                                <span className="block text-[10px] text-surface-400 font-bold uppercase tracking-wider font-bold">Respuesta Promedio</span>
                                <span className="text-base font-bold text-slate-800 dark:text-white mt-1 block">{agent.response_time_sec || 45}s</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-3">
                            <span className="text-[9px] font-bold text-surface-400 uppercase">
                              Creado el {new Date(agent.created_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handleDeleteAgent(agent.id, agent.name)}
                              className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-all cursor-pointer"
                              title="Eliminar Colaborador"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* BIRTHDAYS CALENDAR SECTION */}
            {activeTab === 'birthdays' && (() => {
              const clientsWithBirthdays = crmClients
                .filter((c: any) => c.birthday)
                .map((c: any) => ({
                  ...c,
                  bInfo: getBirthdayInfo(c)
                }))
                .filter((c: any) => c.bInfo !== null);

              const monthClients = clientsWithBirthdays
                .filter((c: any) => c.bInfo.date.getMonth() === selectedBirthdayMonth)
                .sort((a: any, b: any) => a.bInfo.date.getDate() - b.bInfo.date.getDate());

              const countForMonth = monthClients.length;

              return (
                <div className="space-y-6 animate-fadeIn text-left">
                  

                  {/* Filtros y Contadores */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800/80">
                    <div className="relative">
                      <select
                        value={selectedBirthdayMonth}
                        onChange={(e) => setSelectedBirthdayMonth(parseInt(e.target.value))}
                        className="appearance-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 pr-9 rounded-2xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-primary cursor-pointer w-44"
                      >
                        {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                          <option key={m} value={idx}>{m}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                      {countForMonth} {countForMonth === 1 ? 'cumpleaños' : 'cumpleaños'} en {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedBirthdayMonth]}
                    </span>
                  </div>

                  {crmClientsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <RefreshCw size={24} className="animate-spin text-brand-primary" />
                      <span className="text-xs text-surface-400 font-bold uppercase">Cargando cumpleaños...</span>
                    </div>
                  ) : monthClients.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-8 rounded-3xl text-center space-y-3">
                      <Gift className="mx-auto w-10 h-10 text-slate-400 dark:text-slate-600" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No hay cumpleaños registrados</h4>
                      <p className="text-xs text-surface-400 max-w-sm mx-auto">No se encontraron cumpleaños registrados para este mes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {monthClients.map((client: any) => {
                        const isToday = client.bInfo.isToday;
                        const birthDay = client.bInfo.date.getDate();
                        const birthMonthAbbr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][client.bInfo.date.getMonth()];
                        const age = client.bInfo.age;
                        const formattedDayMonth = `${birthDay} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][client.bInfo.date.getMonth()]}`;

                        return (
                          <div 
                            key={client.id}
                            className={`p-5 rounded-[24px] border flex items-center justify-between transition-all duration-300 group hover:-translate-y-0.5 ${
                              isToday 
                                ? 'bg-gradient-to-br from-pink-50/60 to-rose-50/40 dark:from-pink-950/10 dark:to-rose-950/5 border-pink-200 dark:border-pink-900/60 shadow-premium-lg shadow-pink-500/5'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700/80'
                            }`}
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              {/* Left Date Badge */}
                              <div className={`w-12 h-12 rounded-[18px] flex flex-col items-center justify-center font-black flex-shrink-0 text-center select-none shadow-sm transition-transform duration-300 group-hover:scale-105 ${
                                isToday 
                                  ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-pink-500/20'
                                  : 'bg-[#7c8ca0] dark:bg-slate-800 text-white dark:text-slate-200'
                              }`}>
                                <span className="text-[14px] leading-none">{birthDay}</span>
                                <span className="text-[7.5px] font-black tracking-widest mt-0.5 opacity-90 uppercase">{birthMonthAbbr}</span>
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0 space-y-1 text-left">
                                <h5 className="text-[12px] font-black text-slate-800 dark:text-white uppercase truncate flex items-center gap-1.5 tracking-tight">
                                  <span>{client.name}</span>
                                  {isToday && (
                                    <span className="px-1.5 py-0.5 bg-pink-500 text-white text-[7.5px] font-black rounded-lg uppercase tracking-wider shadow-sm shadow-pink-500/10">
                                      Hoy 🎁
                                    </span>
                                  )}
                                </h5>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 text-[9.5px] font-black rounded-lg border ${
                                    isToday 
                                      ? 'bg-pink-100/50 dark:bg-pink-950/30 border-pink-200/30 text-pink-600 dark:text-pink-400'
                                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100/50 dark:border-rose-900/10 text-rose-600 dark:text-rose-450'
                                  }`}>
                                    {age} años
                                  </span>
                                  <span className={`text-[10px] font-bold ${
                                    isToday 
                                      ? 'text-pink-600 dark:text-pink-400'
                                      : 'text-slate-400 dark:text-slate-500'
                                  }`}>
                                    • {formattedDayMonth}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                  <Phone size={10} className="text-slate-400 dark:text-slate-500" />
                                  <span>{client.phone_number || 'Sin teléfono'}</span>
                                </div>

                                {isToday && (
                                  <div className="flex items-center gap-1 text-[9.5px] text-pink-600 dark:text-pink-400 font-black mt-0.5 animate-pulse">
                                    <span>🎁 ¡Cumpleaños hoy!</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Action */}
                            <div className="ml-2">
                              {isToday ? (
                                <button
                                  type="button"
                                  onClick={() => handleWishBirthday(client)}
                                  className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="Felicitar por WhatsApp"
                                >
                                  <Send size={13} className="ml-[1px] mt-[-0.5px]" />
                                </button>
                              ) : (
                                <div className="w-7 h-7 flex items-center justify-center text-rose-500 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300 select-none">
                                  <Sparkles size={14} className="animate-pulse" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* SUPER ADMIN OVERVIEW SECTION */}
            {activeTab === 'admin_overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Panel Global de Super Admin</h3>
                  <p className="text-xs text-surface-400">Estadísticas globales de uso y actividad del SaaS Zaza.click 2.0.</p>
                </div>

                {adminStatsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={24} className="animate-spin text-brand-primary" />
                    <span className="text-xs text-surface-400 font-bold uppercase">Cargando estadísticas globales...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: 'Empresas Registradas', value: adminStats?.total_users || 0, color: 'text-indigo-500' },
                      { label: 'Instancias Totales', value: adminStats?.total_instances || 0, color: 'text-brand-primary' },
                      { label: 'Líneas Conectadas', value: adminStats?.connected_instances || 0, color: 'text-emerald-500' },
                      { label: 'Suscripciones Activas', value: adminStats?.active_subscriptions || 0, color: 'text-amber-500' },
                    ].map((card, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-3xl shadow-sm">
                        <span className="block text-[10px] text-surface-400 font-bold uppercase tracking-wider">{card.label}</span>
                        <span className={`text-2xl font-bold mt-2 block ${card.color}`}>{card.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUPER ADMIN USERS SECTION */}
            {activeTab === 'admin_users' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Administración de Empresas</h3>
                  <p className="text-xs text-surface-400">Listado de empresas clientes y control de sus suscripciones y licencias.</p>
                </div>

                {adminUsersLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={24} className="animate-spin text-brand-primary" />
                    <span className="text-xs text-surface-400 font-bold uppercase">Cargando empresas...</span>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800/40">
                        <thead className="bg-slate-50 dark:bg-slate-950/40 text-[10px] font-bold text-surface-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Empresa / Email</th>
                            <th className="px-6 py-4">Líneas</th>
                            <th className="px-6 py-4">Plan Actual</th>
                            <th className="px-6 py-4">Vencimiento Plan</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium text-slate-700 dark:text-slate-300">
                          {adminUsers.map((client: any) => (
                            <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-800 dark:text-white block">{client.email}</span>
                                <span className="text-[9px] text-surface-400 font-mono">ID: {client.id}</span>
                              </td>
                              <td className="px-6 py-4">{client.instances_count || 0} de {client.max_instances || 1}</td>
                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary font-bold rounded-xl uppercase text-[9px]">
                                  {client.plan_name || 'Básico'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {client.subscription_end_date ? new Date(client.subscription_end_date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  client.subscription_status === 'active' 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {client.subscription_status || 'Sin Plan'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => {
                                    setEditingUserSub(client);
                                    setAdminNewPlanId(client.plan_id || 'plan_basic');
                                    setAdminNewSubStatus(client.subscription_status || 'active');
                                    setShowEditSubModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all cursor-pointer text-[10px]"
                                >
                                  Modificar Licencia
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUPER ADMIN INSTANCES SECTION */}
            {activeTab === 'admin_instances' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Líneas de WhatsApp del Sistema</h3>
                  <p className="text-xs text-surface-400">Supervisión general de instancias creadas por todas las empresas.</p>
                </div>

                {adminInstancesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={24} className="animate-spin text-brand-primary" />
                    <span className="text-xs text-surface-400 font-bold uppercase">Cargando líneas globales...</span>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800/40">
                        <thead className="bg-slate-50 dark:bg-slate-950/40 text-[10px] font-bold text-surface-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Dueño (Empresa)</th>
                            <th className="px-6 py-4">Línea</th>
                            <th className="px-6 py-4">Número</th>
                            <th className="px-6 py-4">Fecha de Alta</th>
                            <th className="px-6 py-4">Estado Conexión</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium text-slate-700 dark:text-slate-300">
                          {adminInstances.map((inst: any) => (
                            <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                              <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{inst.owner_email}</td>
                              <td className="px-6 py-4 font-mono">{inst.instance_name}</td>
                              <td className="px-6 py-4">{inst.phone || 'Sin vincular'}</td>
                              <td className="px-6 py-4">{new Date(inst.created_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase ${
                                  inst.status === 'connected' 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {inst.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </main>
      </div>

      {/* QR Code Scan overlay Box Modal */}
      {activeQrInstance && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-sm p-6 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-center">
            
            <button
              onClick={() => {
                setActiveQrInstance(null);
                setQrBase64(null);
              }}
              className="absolute top-4 right-4 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Escanear WhatsApp QR</h4>
              <p className="text-[10px] text-surface-400 font-bold">Instancia: <strong className="text-brand-primary">{activeQrInstance}</strong></p>
            </div>

            <div className="w-52 h-52 bg-white rounded-2xl mx-auto flex items-center justify-center border border-slate-200/20 shadow-inner overflow-hidden relative">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="w-6 h-6 border-2 border-emerald-500/30 border-t-brand-primary rounded-full animate-spin" />
                  <span className="text-[10px] text-surface-400 font-bold uppercase">Generando QR...</span>
                </div>
              ) : qrBase64 ? (
                <img src={qrBase64} alt="WhatsApp QR Code" className="w-full h-full object-cover p-1" />
              ) : (
                <div className="text-xs text-rose-500 font-bold">Fallo al generar código QR.</div>
              )}
            </div>

            <p className="text-[10px] text-surface-500 dark:text-surface-400 leading-relaxed max-w-xs mx-auto font-medium">
              Abre WhatsApp en tu teléfono inteligente → Ve a Dispositivos Vinculados → Vincular un dispositivo. Escanea este código para iniciar sesión.
            </p>

            <button
              onClick={() => {
                setActiveQrInstance(null);
                setQrBase64(null);
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-sm p-6 sm:p-7 rounded-3xl space-y-5 shadow-premium-lg relative text-center">
            
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-500' : 'bg-pastel-100/50 text-brand-primary'}`}>
              <AlertCircle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">{confirmDialog.title}</h3>
              <p className="text-xs text-surface-400">{confirmDialog.message}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={() => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer ${
                  confirmDialog.isDanger 
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/15' 
                    : 'bg-brand-primary hover:bg-brand-secondary shadow-sm-custom'
                }`}
              >
                {confirmDialog.confirmText || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Instancia */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => {
                setShowCreateModal(false);
                setNewInstanceName('');
                setCreateError(null);
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Nueva Instancia de WhatsApp</h3>
              <p className="text-xs text-surface-400">Las instancias representan las líneas celulares de WhatsApp que vincularás.</p>
            </div>

            {createError && (
              <div className="p-3 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Nombre de la Instancia</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="Ej: ventas_lima"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                />
                <span className="text-[9px] text-surface-400 font-bold uppercase tracking-wider block">Solo se permiten letras, números y guiones.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewInstanceName('');
                    setCreateError(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createLoading || !newInstanceName.trim()}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer"
                >
                  {createLoading ? 'Creando...' : 'Crear Instancia'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      {/* Modal para Fusión de Contacto CRM */}
      {crmMergeModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            <button
              onClick={() => setCrmMergeModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={18} />
                <span>Cliente ya Registrado</span>
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                El documento <strong>{crmMergeModal.docNumber}</strong> ya está registrado a nombre de <strong>{crmMergeModal.clientName}</strong>. 
                ¿Cómo deseas vincular este nuevo número de WhatsApp a la ficha del cliente?
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveCrmContact('promote')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/50 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-left cursor-pointer transition-all flex flex-col gap-0.5 group"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-brand-primary">Hacer este número Primario</span>
                <span className="text-[10px] text-surface-400">Este número será el principal. El anterior se guardará como Secundario. (Ambos quedan activos)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveCrmContact('keep')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/50 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-left cursor-pointer transition-all flex flex-col gap-0.5 group"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-brand-primary">Registrar como Secundario</span>
                <span className="text-[10px] text-surface-400">Guarda este número como secundario sin modificar el número principal actual. (Ambos quedan activos)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveCrmContact('deactivate')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/50 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-left cursor-pointer transition-all flex flex-col gap-0.5 group"
              >
                <span className="text-xs font-bold text-[#e11d48] group-hover:text-red-500">Desactivar número anterior</span>
                <span className="text-[10px] text-surface-400">Desactiva el número de WhatsApp anterior del cliente y establece este nuevo como Primario.</span>
              </button>
            </div>

            <div className="flex pt-2">
              <button
                type="button"
                onClick={() => setCrmMergeModal(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-surface-400 text-xs font-bold rounded-2xl transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Modal de Tareas del Cliente */}
      {showTasksModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            <button
              onClick={() => {
                setShowTasksModal(false);
                setTaskDatePickerId(null);
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5 pr-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-primary" />
                <span>Tareas del Cliente</span>
              </h3>
              <p className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">
                {crmClient?.name || 'Cliente'}
              </p>
            </div>

            {/* List of Tasks */}
            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 min-h-[120px] flex flex-col justify-start">
              {tasksLoading ? (
                <div className="flex-1 flex items-center justify-center py-6 text-xs text-surface-400 animate-pulse">
                  Cargando tareas...
                </div>
              ) : clientTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6 text-xs text-surface-400 italic">
                  Sin tareas registradas.
                </div>
              ) : (
                clientTasks.map((task: any) => {
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task.id, task.completed)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                            task.completed 
                              ? 'bg-brand-primary border-brand-primary text-white shadow-sm' 
                              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {task.completed && <Check size={12} strokeWidth={3} />}
                        </button>
                        <span className={`text-[11.5px] truncate pr-2 ${
                          task.completed 
                            ? 'line-through text-slate-400 dark:text-slate-500 font-medium' 
                            : 'text-slate-700 dark:text-slate-200 font-extrabold'
                        }`}>
                          {task.title}
                        </span>
                      </div>

                      {/* Right column - date or delete */}
                      <div className="flex items-center gap-2">
                        {/* Selector de fecha para "Programar visita" */}
                        {task.title === 'Programar visita' && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (taskDatePickerId === task.id) {
                                  setTaskDatePickerId(null);
                                } else {
                                  setTaskDatePickerId(task.id);
                                  if (task.due_date) {
                                    const d = new Date(task.due_date + 'T00:00:00');
                                    if (!isNaN(d.getTime())) {
                                      setDatePickerYearTask(d.getFullYear());
                                      setDatePickerMonthTask(d.getMonth());
                                    }
                                  } else {
                                    setDatePickerYearTask(new Date().getFullYear());
                                    setDatePickerMonthTask(new Date().getMonth());
                                  }
                                }
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-extrabold border transition-all cursor-pointer ${
                                task.due_date
                                  ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Calendar size={10} />
                              <span>{task.due_date ? formatBirthdayString(task.due_date) : 'Definir Fecha'}</span>
                            </button>

                            {taskDatePickerId === task.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setTaskDatePickerId(null)} />
                                <div className="absolute right-0 bottom-full mb-1.5 w-[230px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xl p-3 z-40 animate-fadeIn text-left">
                                  {/* Datepicker header */}
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60">
                                    <div className="flex items-center gap-1">
                                      <select
                                        value={datePickerMonthTask}
                                        onChange={(e) => setDatePickerMonthTask(parseInt(e.target.value))}
                                        className="bg-transparent text-[10px] font-bold text-slate-800 dark:text-white border-0 p-0 focus:ring-0 focus:outline-none cursor-pointer"
                                      >
                                        {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, idx) => (
                                          <option key={m} value={idx} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold">{m}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={datePickerYearTask}
                                        onChange={(e) => setDatePickerYearTask(parseInt(e.target.value))}
                                        className="bg-transparent text-[10px] font-bold text-slate-800 dark:text-white border-0 p-0 focus:ring-0 focus:outline-none cursor-pointer"
                                      >
                                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                                          <option key={year} value={year} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold">{year}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (datePickerMonthTask === 0) {
                                            setDatePickerMonthTask(11);
                                            setDatePickerYearTask(datePickerYearTask - 1);
                                          } else {
                                            setDatePickerMonthTask(datePickerMonthTask - 1);
                                          }
                                        }}
                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                                      >
                                        <ChevronLeft size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (datePickerMonthTask === 11) {
                                            setDatePickerMonthTask(0);
                                            setDatePickerYearTask(datePickerYearTask + 1);
                                          } else {
                                            setDatePickerMonthTask(datePickerMonthTask + 1);
                                          }
                                        }}
                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                                      >
                                        <ChevronRight size={11} />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Week headers */}
                                  <div className="grid grid-cols-7 gap-0.5 text-center py-1 text-[8px] font-bold text-slate-400">
                                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <span key={d}>{d}</span>)}
                                  </div>
                                  
                                  {/* Days Grid */}
                                  <div className="grid grid-cols-7 gap-0.5 justify-items-center">
                                    {(() => {
                                      const firstDay = new Date(datePickerYearTask, datePickerMonthTask, 1).getDay();
                                      const days = new Date(datePickerYearTask, datePickerMonthTask + 1, 0).getDate();
                                      const cells = [];
                                      for (let i = 0; i < firstDay; i++) {
                                        cells.push(<div key={`empty-${i}`} className="h-4 w-4" />);
                                      }
                                      for (let d = 1; d <= days; d++) {
                                        const formatted = `${datePickerYearTask}-${String(datePickerMonthTask + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const isSel = task.due_date === formatted;
                                        cells.push(
                                          <button
                                            key={`day-${d}`}
                                            type="button"
                                            onClick={() => {
                                              handleUpdateTaskDate(task.id, formatted);
                                              setTaskDatePickerId(null);
                                            }}
                                            className={`h-4.5 w-4.5 text-[9px] font-bold rounded flex items-center justify-center cursor-pointer ${
                                              isSel ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            {d}
                                          </button>
                                        );
                                      }
                                      return cells;
                                    })()}
                                  </div>
                                  
                                  {/* Footer */}
                                  <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800/60 text-[9px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateTaskDate(task.id, null);
                                        setTaskDatePickerId(null);
                                      }}
                                      className="text-red-500 hover:underline cursor-pointer"
                                    >
                                      Limpiar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const today = new Date();
                                        const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                        handleUpdateTaskDate(task.id, formatted);
                                        setTaskDatePickerId(null);
                                      }}
                                      className="text-brand-primary hover:underline cursor-pointer"
                                    >
                                      Hoy
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Delete button */}
                        {!['Llamarlo mañana', 'Enviar factura', 'Cobrar', 'Renovación', 'Programar visita'].includes(task.title) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create custom task */}
            <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <input
                type="text"
                placeholder="Nueva tarea personalizada..."
                value={newCustomTaskTitle}
                onChange={(e) => setNewCustomTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCustomTask();
                }}
                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-white rounded-xl focus:outline-none focus:border-brand-primary placeholder-slate-400 dark:placeholder-slate-600"
              />
              <button
                type="button"
                onClick={handleCreateCustomTask}
                className="px-3.5 bg-brand-primary hover:bg-brand-secondary text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
              >
                <span>+</span>
                <span>Añadir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Gestión de Categorías CRM */}
      {crmCategoriesModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            <button
              onClick={() => {
                setCrmCategoriesModalOpen(false);
                setCrmEditingCategoryId(null);
                setCrmEditingCategoryName('');
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Gestionar Categorías</h3>
              <p className="text-xs text-surface-400">Agrega, renombra o elimina categorías para tus contactos.</p>
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {crmCategories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  {crmEditingCategoryId === cat.id ? (
                    <div className="flex-1 flex gap-1.5 pr-2">
                      <input
                        type="text"
                        value={crmEditingCategoryName}
                        onChange={(e) => setCrmEditingCategoryName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdateCrmCategory(cat.id)}
                        className="px-2.5 py-1.5 bg-brand-500 hover:bg-brand-secondary text-white text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setCrmEditingCategoryId(null)}
                        className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-surface-600 dark:text-surface-400 text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-300">{cat.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCrmEditingCategoryId(cat.id);
                            setCrmEditingCategoryName(cat.name);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-surface-500 rounded-md transition-colors cursor-pointer"
                          title="Renombrar"
                        >
                          <RefreshCw size={12} />
                        </button>
                        {cat.name !== 'Contacto Primario' && cat.name !== 'Contacto Secundario' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCrmCategory(cat.id)}
                            className="p-1 hover:bg-red-500/10 text-rose-500 rounded-md transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add inline form */}
            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2">
              <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Agregar Nueva Categoría</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Ej: Delivery, Facturación..."
                  value={crmNewCategoryName}
                  onChange={(e) => setCrmNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateCrmCategory}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-secondary text-white text-xs font-bold rounded-xl transition-all cursor-pointer font-medium"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear / Editar Contacto */}
      {contactModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => setContactModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {contactModal.isEdit ? 'Editar Contacto' : 'Nuevo Contacto en Google'}
              </h3>
              <p className="text-xs text-surface-400">
                {contactModal.isEdit ? 'Edita los datos del contacto en Google.' : 'Registra el contacto directamente en tu cuenta de Google.'}
              </p>
            </div>

            <form onSubmit={handleCreateOrUpdateContact} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Nombre</label>
                <input
                  type="text"
                  value={contactModal.givenName}
                  onChange={(e) => setContactModal(prev => ({ ...prev, givenName: e.target.value }))}
                  placeholder="Ej: Juan"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Apellido (Opcional)</label>
                <input
                  type="text"
                  value={contactModal.familyName}
                  onChange={(e) => setContactModal(prev => ({ ...prev, familyName: e.target.value }))}
                  placeholder="Ej: Pérez"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Teléfono (con Código de País)</label>
                <input
                  type="text"
                  value={contactModal.phoneNumber}
                  onChange={(e) => setContactModal(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Ej: +51999888777"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setContactModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] text-xs text-white font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer"
                >
                  {contactModal.isEdit ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal para Crear Grupo de WhatsApp */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => {
                setShowCreateGroupModal(false);
                setCreateGroupSubject('');
                setCreateGroupParticipants('');
                setCreateGroupError(null);
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Crear Grupo de WhatsApp</h3>
              <p className="text-xs text-surface-400">Crea un grupo de forma instantánea en tu línea celular de WhatsApp vinculada.</p>
            </div>

            {createGroupError && (
              <div className="p-3 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                ⚠️ {createGroupError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Asunto del Grupo (Nombre)</label>
                <input
                  type="text"
                  value={createGroupSubject}
                  onChange={(e) => setCreateGroupSubject(e.target.value)}
                  placeholder="Ej: Ventas Urgentes 🚀"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Participantes Iniciales (Números con código de país)</label>
                <textarea
                  value={createGroupParticipants}
                  onChange={(e) => setCreateGroupParticipants(e.target.value)}
                  placeholder="Separados por comas: 51987654321, 51912345678"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 font-medium resize-none"
                  rows={3}
                />
                <span className="text-[9px] text-surface-400 font-bold uppercase tracking-wider block">Nota: Debes incluir obligatoriamente el código de país.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setCreateGroupSubject('');
                    setCreateGroupParticipants('');
                    setCreateGroupError(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createGroupLoading || !createGroupSubject.trim()}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer"
                >
                  {createGroupLoading ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Lightbox para videos e imágenes (Estilo WhatsApp Web) */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between animate-fadeIn">
          {/* Top Header Bar */}
          <div className="p-4 flex items-center justify-between text-white relative z-10 select-none">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center">
                {lightboxMedia.type === 'image' ? <Image size={15} className="text-brand-primary" /> : <Video size={15} className="text-brand-primary" />}
              </div>
              <span className="text-xs font-bold text-slate-300">
                {lightboxMedia.type === 'image' ? 'Visualizador de Imagen' : 'Reproductor de Video'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <a
                href={lightboxMedia.url}
                download={`zaza-media-${Date.now()}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl hover-lift shadow transition-all cursor-pointer flex items-center justify-center"
                title="Descargar archivo"
              >
                <Download size={16} />
              </a>
              <button
                onClick={() => setLightboxMedia(null)}
                className="p-2 bg-slate-800/80 hover:bg-rose-600 hover:text-white text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Middle Media Container */}
          <div className="flex-1 flex items-center justify-center p-4 relative min-h-0" onClick={() => setLightboxMedia(null)}>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              {lightboxMedia.type === 'image' ? (
                <img 
                  src={lightboxMedia.url} 
                  alt="Zoomed Media" 
                  className="max-w-full max-h-[75vh] md:max-h-[80vh] rounded-2xl shadow-2xl object-contain animate-scaleIn select-none" 
                />
              ) : (
                <video 
                  src={lightboxMedia.url} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-[75vh] md:max-h-[80vh] rounded-2xl shadow-2xl object-contain animate-scaleIn" 
                />
              )}
            </div>
          </div>

          {/* Bottom Caption Bar */}
          {lightboxMedia.caption ? (
            <div className="p-5 bg-gradient-to-t from-black/80 to-transparent text-white text-center pb-8 z-10 select-none">
              <p className="text-xs font-medium max-w-xl mx-auto leading-relaxed">
                <AppleEmojiText text={lightboxMedia.caption} />
              </p>
            </div>
          ) : (
            <div className="h-10" />
          )}
        </div>
      )}

      {/* Modal para Registrar Colaborador */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => {
                setShowCreateAgentModal(false);
                setNewAgentName('');
                setNewAgentEmail('');
                setNewAgentPassword('');
                setAgentDocNumber('');
                setAgentCreateError(null);
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Nuevo Colaborador</h3>
              <p className="text-xs text-surface-400">Registra un nuevo colaborador. Recibirá su propio usuario para ingresar a la plataforma y atender chats.</p>
            </div>

            {agentCreateError && (
              <div className="p-3 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                ⚠️ {agentCreateError}
              </div>
            )}

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest block">Consultar DNI / RUC (Opcional)</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={agentDocNumber}
                    onChange={(e) => setAgentDocNumber(e.target.value)}
                    placeholder="Ingresa DNI de 8 dígitos o RUC de 11"
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                  />
                  {agentDocNumber.trim().length >= 8 && (
                    <button
                      type="button"
                      onClick={handleQueryAgentDoc}
                      disabled={agentValidationLoading}
                      className="absolute right-3 text-brand-primary hover:text-brand-secondary transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center p-1"
                      title="Buscar en APIPerú"
                    >
                      {agentValidationLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search size={15} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Nombre Completo</label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Ej: Carlos Ortega"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Correo de Acceso</label>
                <input
                  type="email"
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  placeholder="carlos@tuempresa.com"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Contraseña</label>
                <input
                  type="password"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAgentModal(false);
                    setNewAgentName('');
                    setNewAgentEmail('');
                    setNewAgentPassword('');
                    setAgentCreateError(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={agentCreateLoading}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer font-medium"
                >
                  {agentCreateLoading ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Modificar Licencia / Plan de Clientes (Super Admin) */}
      {showEditSubModal && editingUserSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => {
                setShowEditSubModal(false);
                setEditingUserSub(null);
              }}
              className="absolute top-5 right-5 text-surface-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Modificar Suscripción</h3>
              <p className="text-xs text-surface-400">Actualiza las condiciones de la licencia para: <strong>{editingUserSub.email}</strong>.</p>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Plan</label>
                <select
                  value={adminNewPlanId}
                  onChange={(e) => setAdminNewPlanId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="plan_basic">Básico (1 número)</option>
                  <option value="plan_standard">Estándar (3 números)</option>
                  <option value="plan_pro">Pro (ILIMITADO)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Estado</label>
                <select
                  value={adminNewSubStatus}
                  onChange={(e) => setAdminNewSubStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="active">Activo</option>
                  <option value="expired">Expirado / Impago</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">Duración (Meses)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={adminNewDuration}
                  onChange={(e) => setAdminNewDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white focus:outline-none font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSubModal(false);
                    setEditingUserSub(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={adminSubLoading}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-secondary active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-brand-500/10 transition-all cursor-pointer font-medium"
                >
                  {adminSubLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
