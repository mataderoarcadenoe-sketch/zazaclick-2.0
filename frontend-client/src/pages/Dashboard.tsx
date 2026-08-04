import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { io, Socket } from 'socket.io-client';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutDashboard, Terminal, 
  Moon, Sun, Menu, X, Check, Play, ExternalLink, Sparkles, BookOpen, Clock,
  MessageSquare, Search, MessageCircle, Smile, ArrowLeft,
  Paperclip, FileText, Image, Video, Download, ChevronDown, Users, Users2, Settings
} from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle, Emoji } from 'emoji-picker-react';
import { parse } from '@twemoji/parser';

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

export default function DashboardPage() {
  const { user, subscription, logout } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  
  // Theme Toggle
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Collapsible Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('client_sidebar');
    return saved !== null ? saved === 'true' : true;
  });

  // Active Tab/Section State
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'chats' | 'contacts' | 'groups' | 'playground' | 'docs' | 'subscription'>('overview');

  // Modal / Form state for new instance
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // QR Modal state
  const [activeQrInstance, setActiveQrInstance] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

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

  // Chat States
  const [selectedInstanceForChats, setSelectedInstanceForChats] = useState<string>('');
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatsSearchQuery, setChatsSearchQuery] = useState('');
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [mediaLoadingStates, setMediaLoadingStates] = useState<Record<string, boolean>>({});
  const [loadedMedia, setLoadedMedia] = useState<Record<string, string>>({}); // Maps message ID to local media source (data URL)
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
  const [crmCategories, setCrmCategories] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [showCrmSidebar, setShowCrmSidebar] = useState(true);
  const [crmIsEditing, setCrmIsEditing] = useState(false);
  
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
  const [crmClients, setCrmClients] = useState<any[]>([]);
  const [crmClientsLoading, setCrmClientsLoading] = useState(false);
  const [crmClientsSearch, setCrmClientsSearch] = useState('');
  const [crmExpandedClientId, setCrmExpandedClientId] = useState<number | null>(null);
  const [crmClientContacts, setCrmClientContacts] = useState<any[]>([]);
  const [crmClientContactsLoading, setCrmClientContactsLoading] = useState(false);
  const [crmContactsSubTab, setCrmContactsSubTab] = useState<'crm' | 'google'>('crm');

  // Refs para scroll inteligente y emoji picker click-outside
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  // Ref para guardar la referencia estable del chat seleccionado para los callbacks del intervalo
  const selectedChatRef = useRef<any>(null);
  const selectedInstanceRef = useRef<string>('');
  // Chats que el usuario ya ha abierto/leído localmente — evita que el polling restaure el badge
  const readChatsRef = useRef<Set<string>>(new Set());
  // Ref para guardar el JID del chat anterior y evitar parpadeos al actualizar el mismo chat
  const prevSelectedJidRef = useRef<string | null>(null);
  // Ref para almacenar el WebSocket de Socket.io
  const socketRef = useRef<Socket | null>(null);

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
      } catch (err) {
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
  const fetchChats = async (silent = false) => {
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
  };

  // Fetch messages for a chat (con protección contra race conditions)
  const fetchMessages = useCallback(async (silent = false, targetChat?: any, targetInstance?: string) => {
    const chat = targetChat || selectedChatRef.current;
    const instance = targetInstance || selectedInstanceRef.current;
    if (!instance || !chat) return;
    
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
        if (selectedChatRef.current?.remoteJid !== targetJid) return;
        
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
            messageIds
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
  const downloadMedia = async (msgId: string, messageKey: any, messageContent: any, instanceName?: string) => {
    const activeInstance = instanceName || selectedInstanceForChats;
    if (!activeInstance || loadedMedia[msgId] || mediaLoadingStates[msgId]) return;
    
    setMediaLoadingStates(prev => ({ ...prev, [msgId]: true }));
    try {
      const res = await api.post(`/instances/chats/${activeInstance}/media`, {
        messageKey,
        messageContent
      });
      if (res.data?.success) {
        const base64Data = res.data.data.base64 || res.data.data;
        const mimetype = messageContent.imageMessage?.mimetype || 
                         messageContent.audioMessage?.mimetype || 
                         messageContent.videoMessage?.mimetype || 
                         messageContent.documentMessage?.mimetype || 
                         'application/octet-stream';
        
        const dataUrl = `data:${mimetype};base64,${base64Data}`;
        setLoadedMedia(prev => ({ ...prev, [msgId]: dataUrl }));
      }
    } catch (err) {
      console.error('Error downloading media:', err);
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
        const res = await api.post(`/instances/chats/${selectedInstanceForChats}/send`, {
          remoteJid: selectedChat.remoteJid,
          text: textToSend
        });
        if (res.data?.success) {
          setNewMessageText('');
          await fetchMessages(true);
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
  }, [selectedInstanceForChats]);

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
          // Si es un chat nuevo que no estaba en el sidebar, hacemos un reload rápido
          fetchChats(true);
          return prevChats;
        }

        const oldChat = prevChats[chatIdx];

        const updatedChat = {
          ...oldChat,
          lastMessage: {
            ...newMsg,
            messageTimestamp: newMsg.messageTimestamp
          }
        };

        const remainingChats = prevChats.filter(c => c.remoteJid !== cleanJid);
        return [updatedChat, ...remainingChats];
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

    socket.on('disconnect', () => {
      console.log('❌ [Socket.io] Conexión perdida.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeTab, selectedInstanceForChats]);

  // Polling de respaldo súper lento (cada 25 segundos) solo para asegurar sincronización en caídas de red
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

  // Cerrar emoji picker al hacer clic fuera
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
  const fetchCrmContactForChat = useCallback(async (chatJid: string) => {
    if (!chatJid || chatJid.endsWith('@g.us')) {
      setCrmClient(null);
      setCrmContact(null);
      return;
    }
    setCrmLoading(true);
    try {
      const cleanJid = chatJid.split('@')[0];
      const res = await api.get(`/crm/contacts/${cleanJid}`);
      if (res.data?.success) {
        setCrmClient(res.data.client);
        setCrmContact(res.data.contact);
        setCrmIsEditing(false); // Reset to display mode
        
        // Populate inputs if client exists
        if (res.data.client) {
          setCrmDocType(res.data.client.doc_type === 'MANUAL' ? 'DNI' : res.data.client.doc_type);
          setCrmDocNumber(res.data.client.doc_type === 'MANUAL' ? '' : res.data.client.doc_number);
          setCrmName(res.data.client.name);
          setCrmAddress(res.data.client.address || '');
          setCrmEmail(res.data.client.email || '');
          setCrmNotes(res.data.client.notes || '');
        } else {
          // Clear inputs for new chat
          setCrmDocType('DNI');
          setCrmDocNumber('');
          setCrmName('');
          setCrmAddress('');
          setCrmEmail('');
          setCrmNotes('');
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

  // Cargar datos CRM al cambiar de chat activo
  useEffect(() => {
    if (selectedChat && !selectedChat.remoteJid.endsWith('@g.us')) {
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

  // Link Client and WhatsApp Chat (with optional mergeAction)
  const handleSaveCrmContact = async (mergeAction?: string) => {
    if (!selectedChat) return;
    const cleanJid = selectedChat.remoteJid.split('@')[0];

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
          categoryId: crmCategoryId ? parseInt(crmCategoryId, 10) : null
        });
        if (res.data?.success) {
          setCrmClient(res.data.client);
          setCrmContact(res.data.contact);
          setCrmIsEditing(false);
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
        mergeAction
      });

      if (res.data?.success) {
        setCrmClient(res.data.client);
        setCrmContact(res.data.contact);
        setCrmIsEditing(false);
        setCrmMergeModal(prev => ({ ...prev, isOpen: false }));
        showNotification('Cliente y contacto vinculados correctamente.', 'success');
      }
    } catch (err: any) {
      console.error('Error linking DNI/RUC:', err.response?.data || err.message);
      showNotification(err.response?.data?.error || 'Error al vincular cliente.', 'error');
    } finally {
      setCrmSaving(false);
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

  // Load CRM clients when contacts tab is active
  useEffect(() => {
    if (activeTab === 'contacts') {
      fetchCrmClients();
    }
  }, [activeTab, fetchCrmClients]);

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
  }, [fetchCrmCategories]);

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
    { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
    { id: 'instances', label: 'Líneas / QR', icon: Smartphone },
    { id: 'chats', label: 'Chats en Vivo', icon: MessageSquare },
    { id: 'contacts', label: 'Clientes / Agenda', icon: Users },
    { id: 'groups', label: 'Grupos (WhatsApp)', icon: Users2 },
    { id: 'playground', label: 'Probar Envío', icon: Play },
    { id: 'docs', label: 'Documentación API', icon: Terminal },
    { id: 'subscription', label: 'Suscripción', icon: Key },
  ] as const;

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

      {/* Sidebar */}
      <aside 
        className={`bg-surface-50 dark:bg-surface-950 flex flex-col transition-all duration-300 shadow-premium z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${sidebarOpen ? 'fixed lg:relative h-full' : 'hidden lg:flex'}`}
      >
        {/* Brand header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Smartphone size={18} />
              </div>
              <span className="font-semibold text-slate-800 dark:text-white tracking-wide">
                Zaza.click <span className="text-brand-primary">2.0</span>
              </span>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-surface-500 dark:text-surface-400 cursor-pointer"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-3 space-y-1.5">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false); // Auto close sidebar on mobile
                  }
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                } rounded-2xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 font-bold'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-800 dark:hover:text-white font-semibold'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen ? (
                  <span className="ml-3 text-xs tracking-tight">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer profile actions */}
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-surface-50 dark:bg-surface-900">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-surface-600 dark:text-surface-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 cursor-pointer`}
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
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white capitalize">
              {menuItems.find(i => i.id === activeTab)?.label || 'Panel'}
            </h2>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Online Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-pastel-100 dark:bg-emerald-950/30 rounded-xl">
              <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-brand-secondary dark:text-brand-primary uppercase tracking-wider">En Línea</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-surface-500 dark:text-surface-400 cursor-pointer"
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent relative">
          
          {/* Active Section Renderer */}
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Upgrade/Welcome Card Banner */}
                <div className="p-6 bg-pastel-100/50 dark:bg-pastel-100/20 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left relative z-10">
                    <span className="px-2.5 py-1 bg-pastel-100/50 border border-pastel-100/40 rounded-md text-[9px] font-bold text-brand-primary dark:text-brand-primary uppercase tracking-widest">
                      Licencia Activa
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
                      Plan {subscription?.plan_name || 'Básico'}
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 max-w-lg leading-relaxed">
                      Vincula tu línea de WhatsApp escaneando el código QR. Puedes enviar notificaciones automatizadas utilizando las credenciales de tu instancia.
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap relative z-10">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      disabled={instances.length >= maxInstances}
                      className="px-4 py-2.5 bg-brand-500 hover:bg-brand-secondary disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/15 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Nueva Instancia</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('docs')}
                      className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover-lift shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <BookOpen size={16} />
                      <span>Ver Docs</span>
                    </button>
                  </div>

                  {/* Backdrop lights */}
                  <div className="absolute right-0 top-0 w-64 h-64 bg-pastel-100/20 rounded-full blur-[80px] pointer-events-none" />
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest">Líneas Vinculadas</span>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                      {instances.length} / <span className="text-surface-400">{maxInstances}</span>
                    </h3>
                    <p className="text-[10px] text-surface-500">Capacidad disponible para crear instancias.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest text-brand-primary">Instancias Online</span>
                    <h3 className="text-2xl font-bold text-brand-primary">
                      {activeInstancesCount} / <span className="text-surface-400">{instances.length || 0}</span>
                    </h3>
                    <p className="text-[10px] text-surface-500">Números con WhatsApp en línea.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest">Próxima Renovación</span>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Clock size={20} />
                      <span className="text-lg">
                        {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </h3>
                    <p className="text-[10px] text-surface-500">Vence tu suscripción mensual.</p>
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
              <div className="space-y-6 animate-fadeIn h-[calc(100vh-140px)] flex flex-col">
                {/* Header Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Chats en Vivo</h3>
                    <p className="text-xs text-surface-400">Administra tus conversaciones de WhatsApp en tiempo real.</p>
                  </div>
                  
                  {/* Select Instance */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-surface-500 dark:text-surface-400 whitespace-nowrap">Línea:</label>
                    {/* Custom Select Dropdown */}
                    <div className="relative" ref={chatsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowChatsInstanceMenu(!showChatsInstanceMenu)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold cursor-pointer flex items-center justify-between gap-2 shadow-sm relative min-w-[170px]"
                      >
                        {selectedInstanceForChats ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              instances.find(i => i.instance_name === selectedInstanceForChats)?.status === 'connected' ? 'bg-brand-primary' : 'bg-slate-400'
                            }`} />
                            <span className="truncate">
                              {selectedInstanceForChats}
                            </span>
                          </div>
                        ) : (
                          <span className="text-surface-400">Seleccionar línea...</span>
                        )}
                        <ChevronDown size={14} className={`text-surface-400 transition-transform duration-200 ${showChatsInstanceMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showChatsInstanceMenu && (
                        <div className="absolute top-[100%] right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-premium-lg p-1.5 flex flex-col gap-1 min-w-[200px] border border-slate-100 dark:border-slate-800/40 text-left animate-fadeIn">
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
                                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer text-left ${
                                  selectedInstanceForChats === inst.instance_name 
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
                      className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors disabled:opacity-50 text-surface-600 dark:text-surface-400 cursor-pointer border-0 shadow-sm"
                    >
                      <RefreshCw size={14} className={chatsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

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
                    <div className={`${selectedChat ? 'md:col-span-3' : 'md:col-span-4'} bg-slate-50/45 dark:bg-slate-950/20 flex-col min-h-0 w-full md:w-auto ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                      {/* Search Bar */}
                      <div className="p-4 relative">
                        <input
                          type="text"
                          placeholder="Buscar conversación..."
                          value={chatsSearchQuery}
                          onChange={(e) => setChatsSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white/60 dark:bg-slate-900/40 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-medium transition-all"
                        />
                        <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-surface-400" />
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
                            .filter(chat => {
                              const name = (chat.pushName || chat.remoteJid || '').toLowerCase();
                              return name.includes(chatsSearchQuery.toLowerCase());
                            })
                            .map((chat) => {
                              const isActive = selectedChat?.remoteJid === chat.remoteJid;
                              const unreadCount = Number(chat.unreadCount) || 0;
                              const isUnread = unreadCount > 0;
                              const contactName = chat.pushName || chat.remoteJid.split('@')[0];
                              
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
                                    className={`w-full py-3.5 px-3.5 flex items-center gap-3 text-left transition-all duration-300 cursor-pointer rounded-2xl relative ${isActive ? 'bg-pastel-100/50 dark:bg-brand-secondary/20' : 'hover:bg-white/45 dark:hover:bg-slate-800/20'}`}
                                  >
                                    {/* Active indicator pill */}
                                    {isActive && (
                                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full" />
                                    )}

                                    {/* Profile Photo */}
                                    <div className="w-10 h-10 rounded-full bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                      {chat.profilePicUrl ? (
                                        <img src={chat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <MessageCircle size={18} className="text-surface-400" />
                                      )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs truncate ${isActive || isUnread ? 'text-slate-900 dark:text-white font-bold' : 'text-surface-500 dark:text-surface-400 font-normal'}`}>
                                          {contactName}
                                        </span>
                                        <span className={`text-[10px] font-medium ${isUnread ? 'text-brand-primary font-bold' : 'text-surface-400'}`}>
                                          {formatTimeLocal(chat.lastMessage?.messageTimestamp)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className={`text-[11px] leading-relaxed pb-0.5 truncate flex-1 flex items-center gap-1 ${isUnread ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-surface-400 dark:text-surface-500 font-normal'}`}>
                                          <span className="flex-1 block truncate"><AppleEmojiText text={lastMsgText} size={13} /></span>
                                        </p>
                                        {isUnread && (
                                          <div className="bg-brand-primary text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 shadow-sm animate-pulseGlow">
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
                    <div className={`${selectedChat ? (showCrmSidebar && !selectedChat.remoteJid.endsWith('@g.us') ? 'md:col-span-6' : 'md:col-span-9') : 'md:col-span-8'} flex-col min-h-0 bg-gradient-to-b from-slate-50/50 via-slate-100/20 to-indigo-50/15 dark:from-slate-950/65 dark:via-slate-900/40 dark:to-slate-950/55 w-full md:w-auto ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                      {selectedChat ? (
                        <div className="flex-1 flex flex-col min-h-0">
                          
                          {/* Chat Window Header */}
                          <div className="p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Botón volver en mobile */}
                              <button
                                type="button"
                                onClick={() => setSelectedChat(null)}
                                className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-surface-500 dark:text-surface-400 cursor-pointer"
                              >
                                <ArrowLeft size={18} />
                              </button>
                              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                {selectedChat.profilePicUrl ? (
                                  <img src={selectedChat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <MessageCircle size={18} className="text-surface-400" />
                                ) }
                              </div>
                              <div className="text-left flex items-center">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                    {selectedChat.pushName || selectedChat.remoteJid.split('@')[0]}
                                    {googleConnected && !selectedChat.remoteJid.endsWith('@g.us') && !googleContacts.some(c => {
                                      const cleanSaved = c.phoneNumber.replace(/\D/g, '');
                                      const cleanChat = selectedChat.remoteJid.split('@')[0].replace(/\D/g, '');
                                      return cleanSaved === cleanChat || (cleanSaved && cleanChat && (cleanSaved.endsWith(cleanChat) || cleanChat.endsWith(cleanSaved)));
                                    }) && (
                                      <button
                                        type="button"
                                        onClick={() => setContactModal({
                                          isOpen: true,
                                          isEdit: false,
                                          resourceName: null,
                                          etag: null,
                                          givenName: selectedChat.pushName || selectedChat.remoteJid.split('@')[0],
                                          familyName: '',
                                          phoneNumber: `+${selectedChat.remoteJid.split('@')[0]}`
                                        })}
                                        className="px-1.5 py-0.5 bg-pastel-100/50 hover:bg-pastel-100/70 text-brand-secondary dark:text-brand-primary font-bold text-[8.5px] rounded-md transition-colors cursor-pointer flex items-center gap-0.5"
                                        title="Guardar en Google Contactos"
                                      >
                                        <Plus size={9} />
                                        <span>Guardar</span>
                                      </button>
                                    )}
                                  </h4>
                                  <span className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 block">
                                    {selectedChat.remoteJid}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* CRM Toggle Button */}
                            {!selectedChat.remoteJid.endsWith('@g.us') && (
                              <button
                                type="button"
                                onClick={() => setShowCrmSidebar(!showCrmSidebar)}
                                className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ${showCrmSidebar ? 'text-brand-primary' : 'text-surface-400 hover:text-surface-600 dark:hover:text-slate-300'}`}
                                title={showCrmSidebar ? "Ocultar Panel CRM" : "Mostrar Panel CRM"}
                              >
                                <Users size={18} />
                              </button>
                            )}
                          </div>

                          {/* Chat Window Messages */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
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
                                        statusIcon = <span className="text-[9px] text-sky-500 font-bold ml-1">✓✓</span>;
                                      } else if (statuses.includes('DELIVERY_ACK')) {
                                        statusIcon = <span className="text-[9px] text-surface-400 font-bold ml-1">✓✓</span>;
                                      } else if (statuses.includes('SERVER_ACK')) {
                                        statusIcon = <span className="text-[9px] text-surface-400 font-bold ml-1">✓</span>;
                                      }
                                    } else {
                                      // Mensajes enviados sin MessageUpdate aún: mostrar ✓ por defecto
                                      statusIcon = <span className="text-[9px] text-surface-400 font-bold ml-1">✓</span>;
                                    }
                                  }

                                  // Render Message Content
                                  const renderMessageContent = () => {
                                    const content = msg.message;
                                    if (!content) return null;

                                    if (content.imageMessage) {
                                      const isLoaded = !!loadedMedia[msgId];
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
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
                                          onClick={() => downloadMedia(msgId, msg.key, content)}
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
                                      const isLoaded = !!loadedMedia[msgId];
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      if (isLoaded) {
                                        return (
                                          <audio controls src={loadedMedia[msgId]} className="max-w-[240px] mt-1 h-9" />
                                        );
                                      }
                                      
                                      return (
                                        <button 
                                          onClick={() => downloadMedia(msgId, msg.key, content)}
                                          disabled={isLoading}
                                          type="button"
                                          className="text-[10px] px-3.5 py-2 bg-pastel-100/50 hover:bg-pastel-100/70 text-brand-secondary dark:text-brand-primary font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer animate-pulse"
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
                                      const isLoaded = !!loadedMedia[msgId];
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
                                      return (
                                        <div 
                                          onClick={isLoaded ? undefined : () => downloadMedia(msgId, msg.key, content)}
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
                                      const isLoaded = !!loadedMedia[msgId];
                                      const isLoading = !!mediaLoadingStates[msgId];
                                      
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
                                          onClick={() => downloadMedia(msgId, msg.key, content)}
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
                                      {!fromMe && selectedChat.remoteJid.endsWith('@g.us') && msg.pushName && (
                                        <span className={`text-[9px] font-bold mb-0.5 ml-1.5 ${getSenderColor(msg.pushName)}`}>{msg.pushName}</span>
                                      )}

                                      {/* Bubble */}
                                      <div className={`p-3 rounded-2xl text-slate-800 dark:text-slate-100 ${fromMe ? 'bg-brand-primary dark:bg-brand-primary text-white dark:text-white rounded-tr-none shadow-sm-custom' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700/50 shadow-sm-custom'}`}>
                                        {renderMessageContent()}
                                        
                                        {/* Timestamp and Checks */}
                                        <div className="flex items-center justify-end mt-1 text-[9px] text-surface-400 dark:text-surface-500 font-medium">
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

                            {/* Menú de Adjuntos Flotante */}
                            {showAttachMenu && (
                              <div className="absolute bottom-[100%] mb-2 left-12 z-50 animate-fadeIn bg-white dark:bg-slate-900 shadow-premium-lg rounded-2xl p-2 flex flex-col gap-1 w-40 text-left">
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
                    {selectedChat && showCrmSidebar && !selectedChat.remoteJid.endsWith('@g.us') && (
                      <div className="md:col-span-3 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col min-h-0 bg-slate-50/45 dark:bg-slate-955 p-4 overflow-y-auto space-y-4 text-left">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2.5">
                          <h3 className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-wider">Detalles del Cliente</h3>
                          <button 
                            type="button" 
                            onClick={() => setShowCrmSidebar(false)}
                            className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-lg transition-colors text-surface-400 cursor-pointer"
                            title="Ocultar Panel"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        {crmLoading ? (
                          <div className="py-8 text-center text-[11px] text-surface-400 animate-pulse">Cargando datos CRM...</div>
                        ) : (
                          <div className="space-y-3.5">
                            {/* Contact info card (Display Mode) */}
                            {!crmIsEditing && crmClient ? (
                              <div className="space-y-3.5">
                                {/* Display client details */}
                                <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-2.5 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-pastel-100/50 flex items-center justify-center text-brand-primary">
                                      {crmClient.doc_type === 'RUC' ? <Users size={14} /> : <MessageCircle size={14} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight truncate">{crmClient.name}</h4>
                                      <span className="text-[9px] text-surface-400 font-bold block truncate mt-0.5">
                                        {crmClient.doc_type !== 'MANUAL' ? `${crmClient.doc_type}: ${crmClient.doc_number}` : 'Registro Manual'}
                                      </span>
                                    </div>
                                  </div>

                                  {crmClient.address && (
                                    <div className="space-y-0.5">
                                      <span className="text-[8.5px] text-surface-400 dark:text-surface-500 font-bold uppercase tracking-wider block">Dirección Fiscal</span>
                                      <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium leading-normal">{crmClient.address}</p>
                                    </div>
                                  )}

                                  {crmClient.email && (
                                    <div className="space-y-0.5">
                                      <span className="text-[8.5px] text-surface-400 dark:text-surface-500 font-bold uppercase tracking-wider block">Email</span>
                                      <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium truncate">{crmClient.email}</p>
                                    </div>
                                  )}

                                  <div className="space-y-0.5">
                                    <span className="text-[8.5px] text-surface-400 dark:text-surface-500 font-bold uppercase tracking-wider block">Categoría de Contacto</span>
                                    <span className="inline-flex px-2 py-0.5 bg-pastel-100/50 text-brand-primary text-[9px] font-bold rounded-full mt-0.5 border border-pastel-100/30">
                                      {crmContact?.category_name || 'Sin Categoría'}
                                    </span>
                                  </div>
                                </div>

                                {crmClient.notes && (
                                  <div className="bg-slate-100/50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-200/20 dark:border-slate-800/10 space-y-0.5">
                                    <span className="text-[8.5px] text-surface-400 dark:text-surface-500 font-bold uppercase tracking-wider block">Notas Comerciales</span>
                                    <p className="text-[10px] text-surface-600 dark:text-surface-400 font-medium leading-relaxed whitespace-pre-line">{crmClient.notes}</p>
                                  </div>
                                )}

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
                                    setCrmIsEditing(true);
                                  }}
                                  className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center"
                                >
                                  Editar Datos
                                </button>
                              </div>
                            ) : (
                              /* Create / Edit Form Mode */
                              <div className="space-y-3">
                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Identificación DNI / RUC</label>
                                  <div className="flex gap-1.5">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer min-w-[65px] justify-between shadow-premium-sm focus:outline-none"
                                      >
                                        <span>{crmDocType}</span>
                                        <ChevronDown size={10} className={`text-surface-400 transition-transform duration-200 ${isDocTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                      </button>

                                      {isDocTypeDropdownOpen && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-30" 
                                            onClick={() => setIsDocTypeDropdownOpen(false)} 
                                          />
                                          <div className="absolute left-0 mt-1 w-24 bg-white dark:bg-slate-955 rounded-xl border border-slate-100 dark:border-slate-800 shadow-premium-lg py-1 z-40 animate-fadeIn">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmDocType('DNI');
                                                setCrmDocNumber('');
                                                setCrmName('');
                                                setCrmAddress('');
                                                setIsDocTypeDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-bold hover:bg-pastel-100/50 hover:text-brand-primary transition-colors cursor-pointer ${crmDocType === 'DNI' ? 'text-brand-primary bg-pastel-100/20' : 'text-slate-700 dark:text-slate-200'}`}
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
                                              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-bold hover:bg-pastel-100/50 hover:text-brand-primary transition-colors cursor-pointer ${crmDocType === 'RUC' ? 'text-brand-primary bg-pastel-100/20' : 'text-slate-700 dark:text-slate-200'}`}
                                            >
                                              RUC
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <div className="relative flex-1">
                                      <input
                                        type="text"
                                        placeholder={crmDocType === 'DNI' ? '8 dígitos' : '11 dígitos'}
                                        value={crmDocNumber}
                                        maxLength={crmDocType === 'DNI' ? 8 : 11}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '');
                                          setCrmDocNumber(val);
                                          const expectedLen = crmDocType === 'DNI' ? 8 : 11;
                                          if (val.length === expectedLen) {
                                            setTimeout(() => handleValidateCrmDoc(val), 0);
                                          }
                                        }}
                                        className="w-full pl-2.5 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none font-medium"
                                      />
                                      {crmDocNumber.trim() && (
                                        <button
                                          type="button"
                                          onClick={handleValidateCrmDoc}
                                          disabled={crmValidationLoading}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-primary disabled:opacity-50 transition-colors cursor-pointer"
                                          title="Consultar APIPeru"
                                        >
                                          {crmValidationLoading ? (
                                            <RefreshCw size={11} className="animate-spin text-brand-primary" />
                                          ) : (
                                            <Search size={11} />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Nombre / Razón Social</label>
                                  <input
                                    type="text"
                                    placeholder="Nombre completo o Empresa"
                                    value={crmName}
                                    onChange={(e) => setCrmName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none font-medium"
                                  />
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Categoría de Contacto</label>
                                  <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                      <button
                                        type="button"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-premium-sm focus:outline-none"
                                      >
                                        <span>
                                          {crmCategories.find(c => c.id.toString() === crmCategoryId)?.name || 'Sin Categoría'}
                                        </span>
                                        <ChevronDown size={11} className={`text-surface-400 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                      </button>

                                      {isCategoryDropdownOpen && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-30" 
                                            onClick={() => setIsCategoryDropdownOpen(false)} 
                                          />
                                          <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-955 rounded-xl border border-slate-100 dark:border-slate-800 shadow-premium-lg py-1 z-40 max-h-40 overflow-y-auto animate-fadeIn">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCrmCategoryId('');
                                                setIsCategoryDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-pastel-100/50 hover:text-brand-primary transition-colors cursor-pointer ${crmCategoryId === '' ? 'text-brand-primary bg-pastel-100/20' : 'text-slate-700 dark:text-slate-200'}`}
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
                                                className={`w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-pastel-100/50 hover:text-brand-primary transition-colors cursor-pointer ${crmCategoryId === cat.id.toString() ? 'text-brand-primary bg-pastel-100/20' : 'text-slate-700 dark:text-slate-200'}`}
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
                                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none resize-none font-medium"
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
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none font-medium"
                                  />
                                </div>

                                <div className="space-y-1 text-left">
                                  <label className="text-[8.5px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">Notas de Negocio</label>
                                  <textarea
                                    placeholder="Acuerdos, precios, descuentos especiales..."
                                    rows={3}
                                    value={crmNotes}
                                    onChange={(e) => setCrmNotes(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none resize-none font-medium"
                                  />
                                </div>

                                <div className="flex gap-2 pt-1.5">
                                  {crmClient && (
                                    <button
                                      type="button"
                                      onClick={() => setCrmIsEditing(false)}
                                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-600 dark:text-slate-450 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
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
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* CONTACTS / CRM SECTION */}
            {activeTab === 'contacts' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Header con sub-tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-left space-y-0.5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Agenda de Clientes</h3>
                    <p className="text-xs text-surface-400">Gestiona tu base de clientes, contactos y agenda de Google.</p>
                  </div>
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
                                          className="p-1 bg-white dark:bg-slate-900 text-surface-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Degradar a miembro"
                                        >
                                          Degradar
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateGroupParticipant('promote', cleanId)}
                                          className="p-1 bg-white dark:bg-slate-900 text-surface-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Ascender a admin"
                                        >
                                          Promover
                                        </button>
                                      )}
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateGroupParticipant('remove', cleanId)}
                                        className="p-1 bg-white hover:bg-rose-50 dark:bg-slate-900 text-surface-400 hover:text-rose-600 rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors flex items-center justify-center"
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

    </div>
  );
}
