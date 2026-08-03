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
  Paperclip, FileText, Image, Video, Download, ChevronDown, Users, Users2
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
  'text-emerald-500', 'text-blue-500', 'text-purple-500', 'text-amber-500',
  'text-rose-500', 'text-cyan-500', 'text-indigo-500', 'text-pink-500',
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
    { id: 'contacts', label: 'Agenda (Google)', icon: Users },
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
    const payload = JSON.stringify({
      instanceName: selectedInst.instance_name,
      apiKey: selectedInst.api_key,
      number: "51987654321",
      text: "Hola, este es un mensaje automático."
    }, null, 2);

    switch (docLang) {
      case 'js':
        return `fetch('${currentBackendUrl}/api/instances/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${payload.replace(/\n/g, '\n  ')})
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`;

      case 'python':
        return `import requests

url = "${currentBackendUrl}/api/instances/send"
payload = ${payload}
headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

      case 'php':
        return `<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "${currentBackendUrl}/api/instances/send",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => "POST",
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
        return `curl -X POST "${currentBackendUrl}/api/instances/send" \\
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
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Offline Banner */}
      {isServerOffline && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-amber-500/90 backdrop-blur-sm text-white text-xs font-bold py-1.5 px-4 text-center shadow-md animate-fadeIn flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin" />
          <span>Actualizando servidor (Railway)... Manteniendo la conexión en espera...</span>
        </div>
      )}

      {/* Sidebar */}
      <aside 
        className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col transition-all duration-300 shadow-premium z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${sidebarOpen ? 'fixed lg:relative h-full' : 'hidden lg:flex'}`}
      >
        {/* Brand header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Smartphone size={18} />
              </div>
              <span className="font-semibold text-slate-800 dark:text-white tracking-wide">
                Zaza.click <span className="text-emerald-500">2.0</span>
              </span>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/10 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-white font-medium'
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
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 cursor-pointer`}
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
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white capitalize">
              {menuItems.find(i => i.id === activeTab)?.label || 'Panel'}
            </h2>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Online Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">En Línea</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
              title="Cambiar tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
            </button>

            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-500/20 uppercase">
                {user?.email?.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-white">{user?.email}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cliente SaaS</span>
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
                <div className="p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left relative z-10">
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      Licencia Activa
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
                      Plan {subscription?.plan_name || 'Básico'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                      Vincula tu línea de WhatsApp escaneando el código QR. Puedes enviar notificaciones automatizadas utilizando las credenciales de tu instancia.
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap relative z-10">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      disabled={instances.length >= maxInstances}
                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/15 flex items-center gap-1.5 transition-all cursor-pointer"
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
                  <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Líneas Vinculadas</span>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                      {instances.length} / <span className="text-slate-400">{maxInstances}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500">Capacidad disponible para crear instancias.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-emerald-500">Instancias Online</span>
                    <h3 className="text-2xl font-bold text-emerald-500">
                      {activeInstancesCount} / <span className="text-slate-400">{instances.length || 0}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500">Números con WhatsApp en línea.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Próxima Renovación</span>
                    <h3 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                      <Clock size={20} />
                      <span className="text-lg">
                        {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500">Vence tu suscripción mensual.</p>
                  </div>
                </div>

                {/* Dashboard Instance Table Summary */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Estado de Líneas</h4>
                    <button 
                      onClick={() => fetchInstances()} 
                      disabled={loading}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {instances.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No hay líneas agregadas. Ve a la pestaña de <button onClick={() => setActiveTab('instances')} className="text-emerald-500 font-bold hover:underline">Líneas / QR</button> para comenzar.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
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
                              <td className="py-3.5 text-slate-600 dark:text-slate-400 font-medium">{inst.phone || 'Pendiente vinculación'}</td>
                              <td className="py-3.5">
                                {inst.status === 'connected' ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 rounded-md">CONNECTED</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-500/10 border border-slate-200/50 dark:border-slate-800/50 text-[9px] font-bold text-slate-500 rounded-md">DISCONNECTED</span>
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
                                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
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
                    <p className="text-xs text-slate-400">Escanea los códigos QR para iniciar sesión y habilitar los envíos.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={instances.length >= maxInstances}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/15 flex items-center gap-1.5 transition-colors cursor-pointer"
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
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Crea tu primera instancia de WhatsApp para obtener tus credenciales de envío y escanear el QR.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 transition-all cursor-pointer"
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
                          inst.status === 'connected' ? 'bg-emerald-500/5' : 'bg-rose-500/5'
                        }`} />

                        {/* Card Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 relative z-10">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm text-slate-800 dark:text-white">{inst.instance_name}</span>
                            {inst.status === 'connected' ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 rounded-md">CONECTADO</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-500/10 border border-slate-200/50 dark:border-slate-800/50 text-[9px] font-bold text-slate-500 rounded-md">DESCONECTADO</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setTestInstance(inst.instance_name);
                                setTestResult(null);
                                setActiveTab('playground');
                              }}
                              className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-emerald-500 rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                              title="Probar Envío"
                            >
                              <Send size={13} />
                            </button>

                            <button
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                              title="Eliminar Instancia"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Connection action button */}
                        <div className="relative z-10 flex flex-col gap-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-left">Acción de WhatsApp</span>
                          {inst.status === 'disconnected' ? (
                            <button
                              onClick={() => handleGetQr(inst.instance_name)}
                              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Instance Name</span>
                            <div className="flex items-center gap-2">
                              <code className="text-slate-800 dark:text-white font-mono font-bold text-[11px]">{inst.instance_name}</code>
                              <button 
                                onClick={() => copyToClipboard(inst.instance_name)} 
                                className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/40">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">API Token (Key)</span>
                            <div className="flex items-center gap-2">
                              <code className="text-slate-800 dark:text-white font-mono text-[11px]">{inst.api_key}</code>
                              <button 
                                onClick={() => copyToClipboard(inst.api_key)} 
                                className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
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
                    <p className="text-xs text-slate-400">Administra tus conversaciones de WhatsApp en tiempo real.</p>
                  </div>
                  
                  {/* Select Instance */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Línea:</label>
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
                              instances.find(i => i.instance_name === selectedInstanceForChats)?.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                            <span className="truncate">
                              {selectedInstanceForChats}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Seleccionar línea...</span>
                        )}
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showChatsInstanceMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showChatsInstanceMenu && (
                        <div className="absolute top-[100%] right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-premium-lg p-1.5 flex flex-col gap-1 min-w-[200px] border border-slate-100 dark:border-slate-800/40 text-left animate-fadeIn">
                          {instances.length === 0 ? (
                            <span className="p-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold block text-center">No hay líneas creadas</span>
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
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-white'
                                }`}
                              >
                                <span className="truncate">{inst.instance_name}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold ${
                                  inst.status === 'connected' 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-slate-100 dark:bg-slate-950 text-slate-500'
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
                      className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors disabled:opacity-50 text-slate-600 dark:text-slate-400 cursor-pointer border-0 shadow-sm"
                    >
                      <RefreshCw size={14} className={chatsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Validation warnings */}
                {instances.length === 0 ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <Smartphone size={48} className="text-slate-300 dark:text-slate-600" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No hay líneas vinculadas</h4>
                      <p className="text-xs text-slate-400 max-w-sm">Crea y escanea una línea de WhatsApp en la pestaña "Líneas / QR" para poder comenzar a chatear.</p>
                    </div>
                  </div>
                ) : !selectedInstanceForChats ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-xs text-slate-400">Por favor, selecciona una línea de WhatsApp en el menú superior.</p>
                  </div>
                ) : instances.find(i => i.instance_name === selectedInstanceForChats)?.status !== 'connected' ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <AlertCircle size={48} className="text-amber-500" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Línea Desconectada</h4>
                      <p className="text-xs text-slate-400 max-w-sm">La línea "{selectedInstanceForChats}" no está vinculada. Por favor, ve a la pestaña "Líneas / QR", obtén el código QR y escanéalo con tu teléfono.</p>
                    </div>
                  </div>
                ) : (
                  /* Connected Chat Interface */
                  <div className="flex-1 min-h-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl overflow-hidden flex md:grid md:grid-cols-12 shadow-premium-lg text-left">
                    
                    {/* LEFT PANEL: Chats List */}
                    <div className={`md:col-span-4 bg-slate-50/45 dark:bg-slate-950/20 flex-col min-h-0 w-full md:w-auto ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                      {/* Search Bar */}
                      <div className="p-4 relative">
                        <input
                          type="text"
                          placeholder="Buscar conversación..."
                          value={chatsSearchQuery}
                          onChange={(e) => setChatsSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white/60 dark:bg-slate-900/40 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 font-medium transition-all"
                        />
                        <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>

                      {/* Chats List Body */}
                      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 scrollbar-hide">
                        {chatsLoading && chats.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 animate-pulse">Cargando conversaciones...</div>
                        ) : chatsError ? (
                          <div className="p-4 text-center text-xs text-red-500">{chatsError}</div>
                        ) : chats.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">No se encontraron conversaciones activas.</div>
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
                                    className={`w-full py-3.5 px-3.5 flex items-center gap-3 text-left transition-all duration-300 cursor-pointer rounded-2xl relative ${isActive ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20' : 'hover:bg-white/45 dark:hover:bg-slate-800/20'}`}
                                  >
                                    {/* Active indicator pill */}
                                    {isActive && (
                                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                                    )}

                                    {/* Profile Photo */}
                                    <div className="w-10 h-10 rounded-full bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                      {chat.profilePicUrl ? (
                                        <img src={chat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <MessageCircle size={18} className="text-slate-400" />
                                      )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs truncate ${isActive || isUnread ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 font-normal'}`}>
                                          {contactName}
                                        </span>
                                        <span className={`text-[10px] font-medium ${isUnread ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                                          {formatTimeLocal(chat.lastMessage?.messageTimestamp)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className={`text-[11px] leading-relaxed pb-0.5 truncate flex-1 flex items-center gap-1 ${isUnread ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
                                          <span className="flex-1 block truncate"><AppleEmojiText text={lastMsgText} size={13} /></span>
                                        </p>
                                        {isUnread && (
                                          <div className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 shadow-sm animate-pulseGlow">
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
                    <div className={`md:col-span-8 flex-col min-h-0 bg-gradient-to-b from-slate-50/50 via-slate-100/20 to-indigo-50/15 dark:from-slate-950/65 dark:via-slate-900/40 dark:to-slate-950/55 w-full md:w-auto ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                      {selectedChat ? (
                        <div className="flex-1 flex flex-col min-h-0">
                          
                          {/* Chat Window Header */}
                          <div className="p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Botón volver en mobile */}
                              <button
                                type="button"
                                onClick={() => setSelectedChat(null)}
                                className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
                              >
                                <ArrowLeft size={18} />
                              </button>
                              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                {selectedChat.profilePicUrl ? (
                                  <img src={selectedChat.profilePicUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <MessageCircle size={18} className="text-slate-400" />
                                )}
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
                                        className="px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[8.5px] rounded-md transition-colors cursor-pointer flex items-center gap-0.5"
                                        title="Guardar en Google Contactos"
                                      >
                                        <Plus size={9} />
                                        <span>Guardar</span>
                                      </button>
                                    )}
                                  </h4>
                                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">
                                    {selectedChat.remoteJid}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Chat Window Messages */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 flex flex-col bg-gradient-to-b from-teal-50/15 via-indigo-50/25 to-emerald-50/15 dark:from-slate-950/35 dark:via-slate-900/20 dark:to-slate-950/30">
                            {messagesLoading && messages.length === 0 ? (
                              <div className="my-auto text-center text-xs text-slate-400 animate-pulse">Cargando conversación...</div>
                            ) : messages.length === 0 ? (
                              <div className="my-auto text-center text-xs text-slate-400">No hay mensajes en este chat.</div>
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
                                        statusIcon = <span className="text-[9px] text-slate-400 font-bold ml-1">✓✓</span>;
                                      } else if (statuses.includes('SERVER_ACK')) {
                                        statusIcon = <span className="text-[9px] text-slate-400 font-bold ml-1">✓</span>;
                                      }
                                    } else {
                                      // Mensajes enviados sin MessageUpdate aún: mostrar ✓ por defecto
                                      statusIcon = <span className="text-[9px] text-slate-400 font-bold ml-1">✓</span>;
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
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md group-hover:scale-105 transition-transform text-slate-600 dark:text-slate-400">
                                              <Image size={20} />
                                            </div>
                                          )}
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                                          className="text-[10px] px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer animate-pulse"
                                        >
                                          {isLoading ? (
                                            <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin block" />
                                          ) : (
                                            <Play size={12} className="fill-emerald-500" />
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
                                          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                                            <FileText size={20} />
                                          </div>
                                          <div className="flex-1 min-w-0 space-y-0.5">
                                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{fileName}</p>
                                            <p className="text-[9px] text-slate-400 font-medium">
                                              {isLoading ? 'Descargando...' : isLoaded ? 'Descargado' : 'Haga clic para descargar'}
                                            </p>
                                          </div>
                                          {isLoaded ? (
                                            <a 
                                              href={loadedMedia[msgId]} 
                                              download={fileName}
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md transition-colors"
                                            >
                                              <Download size={14} />
                                            </a>
                                          ) : (
                                            <div className="p-2 text-slate-400">
                                              {isLoading ? (
                                                <span className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin block" />
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
                                                  <Play size={20} fill="currentColor" className="ml-0.5 text-emerald-500" />
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
                                            <div className="p-3 bg-white/80 dark:bg-slate-950/80 rounded-full shadow-md group-hover:scale-105 transition-transform text-slate-600 dark:text-slate-400">
                                              <Video size={20} />
                                            </div>
                                          )}
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                                      <div className={`p-3 rounded-2xl text-slate-800 dark:text-slate-100 ${fromMe ? 'bg-gradient-to-br from-emerald-100/90 to-teal-50/90 dark:from-emerald-900/40 dark:to-teal-900/30 text-emerald-950 dark:text-emerald-50 rounded-tr-none' : 'bg-gradient-to-br from-indigo-50/90 to-slate-100/90 dark:from-slate-800/80 dark:to-slate-800/40 text-indigo-950 dark:text-slate-100 rounded-tl-none'}`}>
                                        {renderMessageContent()}
                                        
                                        {/* Timestamp and Checks */}
                                        <div className="flex items-center justify-end mt-1 text-[9px] text-slate-400 dark:text-slate-500 font-medium">
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
                                  <Image size={15} className="text-emerald-500" />
                                  <span>Imagen</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerFileInput('video')}
                                  className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Video size={15} className="text-blue-500" />
                                  <span>Video</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerFileInput('document')}
                                  className="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <FileText size={15} className="text-indigo-500" />
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
                                  <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-900 flex items-center justify-center text-slate-500">
                                    <FileText size={28} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{attachedFile.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{(attachedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleClearAttachment}
                                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
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
                                  className={`p-2 transition-colors cursor-pointer rounded-xl ${showEmojiPicker ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                  <Smile size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                                  className={`p-2 transition-colors cursor-pointer rounded-xl ${showAttachMenu ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
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
                                className="flex-1 px-4 py-3 bg-white/95 dark:bg-slate-900/95 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 font-medium disabled:opacity-50 transition-all shadow-premium"
                              />
                              <button
                                type="submit"
                                disabled={(!newMessageText.trim() && !attachedFile) || sendingMessage}
                                className="p-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl transition-all shadow-md shadow-emerald-500/20 flex-shrink-0 disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer"
                              >
                                <Send size={14} className={sendingMessage ? 'animate-fly' : ''} />
                              </button>
                            </form>
                          </div>

                        </div>
                      ) : (
                        <div className="my-auto text-center space-y-2">
                          <MessageSquare size={36} className="text-slate-300 dark:text-slate-700 mx-auto animate-bounce" />
                          <p className="text-xs text-slate-400 dark:text-slate-500">Selecciona una conversación en la lista izquierda para comenzar a chatear.</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* GOOGLE CONTACTS SECTION */}
            {activeTab === 'contacts' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Agenda de Contactos</h3>
                  <p className="text-xs text-slate-400">Sincroniza tus contactos de Google con WhatsApp de forma bidireccional.</p>
                </div>

                {!googleConnected ? (
                  // Screen for disconnected state
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center max-w-2xl mx-auto space-y-6 shadow-premium">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-500 mx-auto">
                      <Users size={32} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-slate-800 dark:text-white">Sincroniza tus contactos en la nube</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        Conecta tu cuenta de Google para sincronizar contactos de forma instantánea. Al crear, editar o eliminar contactos desde este panel, se actualizarán inmediatamente en tu cuenta de Google y se reflejarán en tu celular y chats de WhatsApp.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectGoogleContacts}
                      className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.072 0-5.561-2.49-5.561-5.561s2.49-5.561 5.561-5.561c1.396 0 2.67.513 3.655 1.353l3.14-3.14C18.796 3.738 15.748 2.5 12.24 2.5 6.42 2.5 1.7 7.22 1.7 13s4.72 10.5 10.54 10.5c5.8 0 10.46-4.7 10.46-10.5 0-.712-.082-1.395-.224-2.073h-10.236z"/>
                      </svg>
                      <span>Conectar con Google Contactos</span>
                    </button>
                  </div>
                ) : (
                  // Screen for connected state
                  <div className="space-y-6">
                    {/* Connection Info header card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm text-left">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Users size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Google Contactos Activo</h4>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Cuenta vinculada: <strong className="text-slate-600 dark:text-slate-300">{googleEmail}</strong></p>
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
                              <span className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800/60 pb-1.5 mb-1.5">Importar desde línea:</span>
                              {instances.filter(i => i.status === 'connected').length === 0 ? (
                                <span className="p-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold block text-center">No hay líneas conectadas</span>
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
                          className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
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
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Search size={15} />
                        </span>
                        <input
                          type="text"
                          value={searchContactQuery}
                          onChange={(e) => setSearchContactQuery(e.target.value)}
                          placeholder="Buscar contactos por nombre, apellido o número..."
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                        />
                      </div>

                      {googleContactsLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                          <RefreshCw size={24} className="animate-spin text-emerald-500" />
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
                            <div className="py-12 text-center text-slate-400 space-y-2">
                              <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                              <p className="text-xs font-semibold">No se encontraron contactos en tu agenda</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">Usa el botón "Nuevo Contacto" o conecta / sincroniza tu celular.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                                              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                                                {initials}
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-3 font-semibold text-slate-700 dark:text-slate-200">
                                            {contact.displayName}
                                          </td>
                                          <td className="py-3 font-mono text-slate-500 dark:text-slate-400 font-bold">
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
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                                                title="Editar contacto"
                                              >
                                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                </svg>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteContact(contact.resourceName)}
                                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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

            {/* WHATSAPP GROUPS SECTION */}
            {activeTab === 'groups' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Grupos de WhatsApp</h3>
                  <p className="text-xs text-slate-400">Administra los grupos, miembros y accesos de tu línea conectada.</p>
                </div>

                {!selectedInstanceForChats ? (
                  // Select instance warning screen
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center max-w-2xl mx-auto space-y-4 shadow-sm text-left">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                      <Smartphone size={26} />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Selecciona una línea activa</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
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
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
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
                            className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1"
                          >
                            <Plus size={13} />
                            <span>Crear Grupo</span>
                          </button>
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Search size={15} />
                        </span>
                        <input
                          type="text"
                          value={searchGroupQuery}
                          onChange={(e) => setSearchGroupQuery(e.target.value)}
                          placeholder="Buscar grupos por nombre o JID..."
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                        />
                      </div>

                      {groupsLoading && groups.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                          <RefreshCw size={24} className="animate-spin text-emerald-500" />
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
                            <div className="py-12 text-center text-slate-400 space-y-2">
                              <Users2 size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                              <p className="text-xs font-semibold">No se encontraron grupos</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">¿Estás seguro de que tu línea de WhatsApp tiene grupos activos?</p>
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
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                          {initials}
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center flex-shrink-0">
                                          <Users2 size={16} />
                                        </div>
                                      )}
                                      
                                      <div className="min-w-0">
                                        <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                          {group.subject || 'Grupo sin Nombre'}
                                        </h5>
                                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block truncate font-bold select-all">
                                          {group.id}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-950 text-[9px] font-bold text-slate-500 dark:text-slate-400">
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
                              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block truncate max-w-[220px] font-bold select-all" title={selectedGroup.id}>
                                ID: {selectedGroup.id}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedGroup(null)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer flex items-center justify-center"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {/* Group Invite Link Box */}
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enlace de Invitación</span>
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
                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate flex-1">{inviteLinkLabel}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(inviteLinkLabel)}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer transition-colors flex items-center justify-center"
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
                                className="w-full py-2 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-900 rounded-xl text-[10px] text-slate-600 dark:text-slate-300 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {inviteLinkLoading ? (
                                  <RefreshCw size={10} className="animate-spin text-emerald-500" />
                                ) : (
                                  <ExternalLink size={10} />
                                )}
                                <span>Generar y Copiar Enlace</span>
                              </button>
                            )}
                          </div>

                          {/* Add Participant input form */}
                          <form onSubmit={handleAddParticipantSubmit} className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Agregar Miembro</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={addParticipantNumber}
                                onChange={(e) => setAddParticipantNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Ej: 51987654321 (con código)"
                                required
                                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
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
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800/40 pb-1.5">
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
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-bold">
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
                                          className="p-1 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Degradar a miembro"
                                        >
                                          Degradar
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateGroupParticipant('promote', cleanId)}
                                          className="p-1 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors text-[9px] font-semibold"
                                          title="Ascender a admin"
                                        >
                                          Promover
                                        </button>
                                      )}
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateGroupParticipant('remove', cleanId)}
                                        className="p-1 bg-white hover:bg-rose-50 dark:bg-slate-900 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-100 dark:border-slate-850 cursor-pointer shadow-sm transition-colors flex items-center justify-center"
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
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-sm text-slate-400 space-y-2">
                          <Users2 size={28} className="mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                          <p className="text-xs font-semibold">Ningún grupo seleccionado</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">Selecciona un grupo de la lista para administrar sus miembros y enlace.</p>
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
                  <p className="text-xs text-slate-400">Verifica el funcionamiento de tus instancias enviándote un mensaje de prueba.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Test Form */}
                  <form onSubmit={handleSendTestMessage} className="md:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-3xl space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seleccionar Instancia</label>
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
                                instances.find(i => i.instance_name === testInstance)?.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`} />
                              <span className="truncate">
                                {testInstance}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">Elegir instancia...</span>
                          )}
                          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showSandboxInstanceMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showSandboxInstanceMenu && (
                          <div className="absolute top-[100%] left-0 w-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-premium-lg p-1.5 flex flex-col gap-1 text-left animate-fadeIn">
                            {instances.length === 0 ? (
                              <span className="p-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold block text-center">No hay instancias creadas</span>
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
                                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-white'
                                  }`}
                                >
                                  <span className="truncate">{inst.instance_name}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold ${
                                    inst.status === 'connected' 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-slate-100 dark:bg-slate-950 text-slate-500'
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
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Número Destino (9 dígitos)</label>
                      <div className="flex relative items-center w-full shadow-inner rounded-2xl overflow-hidden">
                        <div className="px-3.5 py-3 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 flex items-center gap-1.5 select-none font-bold text-xs">
                          <span>🇵🇪 +51</span>
                        </div>
                        <input
                          type="text"
                          value={testNumber}
                          onChange={(e) => setTestNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                          placeholder="Ej: 987654321"
                          required
                          maxLength={9}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950/50 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mensaje de Texto</label>
                      <textarea
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        rows={4}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 font-medium resize-none shadow-inner"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={testLoading || !testInstance || instances.find(i => i.instance_name === testInstance)?.status !== 'connected'}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Resultado del Envío</h4>
                      
                      {testResult ? (
                        <div className={`p-4 rounded-2xl border text-xs font-bold animate-fadeIn ${
                          testResult.success 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? <Check size={16} /> : <X size={16} />}
                            <span>{testResult.success ? 'Envío Exitoso' : 'Error en Envío'}</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            {testResult.message}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                          Selecciona una instancia activa, introduce el número de WhatsApp receptor en formato internacional y pulsa enviar para ver el log de envío aquí.
                        </p>
                      )}
                    </div>

                    <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl text-left space-y-2">
                      <h5 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-indigo-500" />
                        <span>Consejo Rápido</span>
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Asegúrate de agregar el código de país al número de teléfono. Ejemplo: <strong>51</strong> para Perú, <strong>54</strong> para Argentina, <strong>57</strong> para Colombia.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* API DOCUMENTATION SECTION */}
            {activeTab === 'docs' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Documentación de Integración</h3>
                  <p className="text-xs text-slate-400">Ejemplos para conectar el API de envío con tus sistemas internos y plataformas externas.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Enviar Mensaje de Texto</span>
                    
                    {/* Language Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl text-[10px] font-bold">
                      {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setDocLang(lang)}
                          className={`px-3 py-1.5 rounded-lg uppercase transition-all cursor-pointer ${
                            docLang === lang 
                              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          {lang === 'js' ? 'Fetch JS' : lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Realiza un HTTP request de tipo <code>POST</code> hacia la URI del servicio. Recuerda incluir las credenciales correctas en el cuerpo JSON:
                    </p>

                    {/* Code Container */}
                    <div className="relative group">
                      <pre className="bg-slate-950 text-emerald-400 dark:text-emerald-300 font-mono text-[10.5px] p-5 rounded-2xl overflow-x-auto leading-relaxed shadow-inner">
                        {getDocCode()}
                      </pre>
                      
                      <button
                        onClick={() => copyToClipboard(getDocCode())}
                        className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg hover-lift shadow transition-all cursor-pointer opacity-100 group-hover:opacity-100"
                        title="Copiar código"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  {/* API response specifications */}
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/40">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Respuesta Esperada (JSON)</h5>
                    <pre className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl font-mono text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto">
{`{
  "success": true,
  "message": "Mensaje enviado exitosamente en vivo 🚀"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* SUBSCRIPTION SECTION */}
            {activeTab === 'subscription' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Estado de la Suscripción</h3>
                  <p className="text-xs text-slate-400">Detalles de las características vigentes y límites de tu plan SaaS.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                  
                  {/* Plan specs */}
                  <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                          <Key size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plan Contratado</span>
                          <h4 className="text-lg font-bold text-slate-800 dark:text-white">{subscription?.plan_name || 'Básico'}</h4>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-slate-500">Estado de Cuenta</span>
                          <span className="text-emerald-500 font-bold uppercase">Activo</span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-slate-500">Instancias Máximas</span>
                          <span className="text-slate-800 dark:text-white font-bold">{subscription?.max_instances || 1} líneas</span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-slate-500">Fecha de Alta</span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2.5 font-medium">
                          <span className="text-slate-500">Fecha de Expiración</span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Para solicitar la ampliación de tu límite de líneas de WhatsApp, modificaciones de plan o cancelación, contacta con tu administrador.
                    </div>
                  </div>

                  {/* Reseller Banner Info */}
                  <div className="md:col-span-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6 rounded-3xl flex flex-col justify-between gap-6 relative overflow-hidden">
                    <div className="space-y-3 relative z-10">
                      <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">¿Necesitas más capacidad?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Ofrecemos planes corporativos a medida que se adaptan a las necesidades y volúmenes de tu infraestructura de mensajería empresarial.
                      </p>
                      
                      <div className="space-y-1.5 pt-2 text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-indigo-500" />
                          <span>Instancias de WhatsApp ilimitadas</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-indigo-500" />
                          <span>Infraestructura dedicada Redis</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check size={14} className="text-indigo-500" />
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
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Escanear WhatsApp QR</h4>
              <p className="text-[10px] text-slate-400 font-bold">Instancia: <strong className="text-emerald-500">{activeQrInstance}</strong></p>
            </div>

            <div className="w-52 h-52 bg-white rounded-2xl mx-auto flex items-center justify-center border border-slate-200/20 shadow-inner overflow-hidden relative">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Generando QR...</span>
                </div>
              ) : qrBase64 ? (
                <img src={qrBase64} alt="WhatsApp QR Code" className="w-full h-full object-cover p-1" />
              ) : (
                <div className="text-xs text-rose-500 font-bold">Fallo al generar código QR.</div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto font-medium">
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
            
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <AlertCircle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-400">{confirmDialog.message}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/15'
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
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Nueva Instancia de WhatsApp</h3>
              <p className="text-xs text-slate-400">Las instancias representan las líneas celulares de WhatsApp que vincularás.</p>
            </div>

            {createError && (
              <div className="p-3 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nombre de la Instancia</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="Ej: ventas_lima"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Solo se permiten letras, números y guiones.</span>
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
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
                >
                  {createLoading ? 'Creando...' : 'Crear Instancia'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      {/* Modal para Crear / Editar Contacto */}
      {contactModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 w-full max-w-md p-6 sm:p-7 rounded-3xl space-y-4 shadow-premium-lg relative animate-fadeIn text-left">
            
            <button
              onClick={() => setContactModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {contactModal.isEdit ? 'Editar Contacto' : 'Nuevo Contacto en Google'}
              </h3>
              <p className="text-xs text-slate-400">
                {contactModal.isEdit ? 'Edita los datos del contacto en Google.' : 'Registra el contacto directamente en tu cuenta de Google.'}
              </p>
            </div>

            <form onSubmit={handleCreateOrUpdateContact} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nombre</label>
                <input
                  type="text"
                  value={contactModal.givenName}
                  onChange={(e) => setContactModal(prev => ({ ...prev, givenName: e.target.value }))}
                  placeholder="Ej: Juan"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Apellido (Opcional)</label>
                <input
                  type="text"
                  value={contactModal.familyName}
                  onChange={(e) => setContactModal(prev => ({ ...prev, familyName: e.target.value }))}
                  placeholder="Ej: Pérez"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Teléfono (con Código de País)</label>
                <input
                  type="text"
                  value={contactModal.phoneNumber}
                  onChange={(e) => setContactModal(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Ej: +51999888777"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
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
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] text-xs text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
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
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Crear Grupo de WhatsApp</h3>
              <p className="text-xs text-slate-400">Crea un grupo de forma instantánea en tu línea celular de WhatsApp vinculada.</p>
            </div>

            {createGroupError && (
              <div className="p-3 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                ⚠️ {createGroupError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Asunto del Grupo (Nombre)</label>
                <input
                  type="text"
                  value={createGroupSubject}
                  onChange={(e) => setCreateGroupSubject(e.target.value)}
                  placeholder="Ej: Ventas Urgentes 🚀"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Participantes Iniciales (Números con código de país)</label>
                <textarea
                  value={createGroupParticipants}
                  onChange={(e) => setCreateGroupParticipants(e.target.value)}
                  placeholder="Separados por comas: 51987654321, 51912345678"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium resize-none"
                  rows={3}
                />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Nota: Debes incluir obligatoriamente el código de país.</span>
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
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-40 text-xs text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
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
                {lightboxMedia.type === 'image' ? <Image size={15} className="text-emerald-400" /> : <Video size={15} className="text-emerald-400" />}
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
