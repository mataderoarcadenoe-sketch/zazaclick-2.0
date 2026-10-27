// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  Copy, Send, LayoutGrid, Terminal, Radio,
  Moon, Sun, Menu, X, Play, Shield, Image, Mic, MapPin, UserPlus,
  Activity, Globe, CreditCard, AlertTriangle, Code, Zap
} from 'lucide-react';

import { AsyncOperationModal, type AsyncStep, type AsyncStatus } from '../components/AsyncOperationModal';
import { CustomSelect } from '../components/CustomSelect';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ToastNotification } from '../components/ToastNotification';
import { ZazaLogo } from '../components/ZazaLogo';
import { DeveloperPlatformDocs } from '../components/DeveloperPlatformDocs';
import { DeveloperPortal } from '../components/DeveloperPortal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Navegación Principal — 6 Apartados Únicos
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'apikeys' | 'webhooks' | 'playground' | 'docs'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Máquina de Estados de Operaciones Asíncronas
  const [asyncOp, setAsyncOp] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    status: AsyncStatus;
    steps: AsyncStep[];
    errorMessage?: string | null;
    successMessage?: string | null;
    onRetry?: () => void;
  }>({
    open: false,
    title: '',
    status: 'idle',
    steps: []
  });

  // Instancias / Líneas WhatsApp
  const [instances, setInstances] = useState<any[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [selectedEngine] = useState<'evolution_go'>('evolution_go');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<{ open: boolean; instanceName: string; qrCode: string | null }>({
    open: false,
    instanceName: '',
    qrCode: null
  });
  const [qrCountdown, setQrCountdown] = useState<number>(25);
  const [refreshingQr, setRefreshingQr] = useState<boolean>(false);

  // Suscripción & Planes
  const [subscription, setSubscription] = useState<any>(null);

  // Playground API (Único Probador Interactivo: Texto, Media, Audio PTT, Ubicación y Contacto)
  const [playgroundType, setPlaygroundType] = useState<'text' | 'media' | 'audio' | 'location' | 'contact'>('text');
  const [playgroundInstance, setPlaygroundInstance] = useState('');
  const [playgroundPhone, setPlaygroundPhone] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [playgroundMessage, setPlaygroundMessage] = useState('¡Hola! Mensaje de prueba enviado desde la API de WhatsApp Zaza Click 2.0.');
  const [playgroundMediaType, setPlaygroundMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const [playgroundMimeType, setPlaygroundMimeType] = useState('image/jpeg');
  const [playgroundMedia, setPlaygroundMedia] = useState('https://images.unsplash.com/photo-1579202673506-ca3ce28943ef');
  const [playgroundCaption, setPlaygroundCaption] = useState('¡Mira esta imagen enviada vía API!');
  const [playgroundFileName, setPlaygroundFileName] = useState('catalogo.pdf');
  const [playgroundAudio, setPlaygroundAudio] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  const [playgroundLocName, setPlaygroundLocName] = useState('Sede Principal Zaza Click');
  const [playgroundLocAddress, setPlaygroundLocAddress] = useState('Av. República de Panamá 3545, San Isidro, Lima');
  const [playgroundLatitude, setPlaygroundLatitude] = useState(-12.098412);
  const [playgroundLongitude, setPlaygroundLongitude] = useState(-77.028941);
  const [playgroundContactName, setPlaygroundContactName] = useState('Soporte Zaza Click');
  const [playgroundContactPhone, setPlaygroundContactPhone] = useState('+51912345678');

  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);

  // Notificaciones Toast
  const [notification, setNotification] = useState<{ text: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', title?: string) => {
    setNotification({ text, type, title });
  };

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    }
    showNotification('Copiado al portapapeles');
  };

  // Cargar datos principales
  const fetchInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      const res = await api.get('/instances');
      if (res.data?.success) {
        const fetched = res.data.data || [];
        setInstances(fetched);
        if (fetched.length > 0 && !playgroundInstance) {
          setPlaygroundInstance(fetched[0].instance_name);
        }
      }
    } catch (err: any) {
      console.error('Error al cargar instancias:', err);
    } finally {
      setLoadingInstances(false);
    }
  }, [playgroundInstance]);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      }
    } catch (err: any) {
      console.error('Error al cargar suscripción:', err);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    fetchSubscription();
  }, [fetchInstances, fetchSubscription]);

  // Refrescar dinámicamente el código QR antes de que caduque en Whatsmeow
  const refreshQrCode = useCallback(async (instanceName: string) => {
    try {
      setRefreshingQr(true);
      const res = await api.get(`/instances/${instanceName}/connect`);
      if (res.data?.success && res.data.base64) {
        setQrCodeModal(prev => ({ ...prev, qrCode: res.data.base64 }));
        setQrCountdown(25);
      }
    } catch (err: any) {
      console.warn('Error refrescando código QR:', err.message);
    } finally {
      setRefreshingQr(false);
    }
  }, []);

  // Auto-detectar conexión y refrescar QR automáticamente cada 25s
  useEffect(() => {
    if (!qrCodeModal.open || !qrCodeModal.instanceName) return;

    setQrCountdown(25);

    // 1. Sondeo de conexión cada 2 segundos
    const statusInterval = setInterval(async () => {
      try {
        const res = await api.get(`/instances/${qrCodeModal.instanceName}/status`);
        if (res.data?.success && res.data.isConnected) {
          setQrCodeModal({ open: false, instanceName: '', qrCode: null });
          showNotification('¡Línea WhatsApp vinculada exitosamente!', 'success');
          fetchInstances();
        }
      } catch (err: any) {
        console.warn('Error verificando estado de conexión QR:', err.message);
      }
    }, 2000);

    // 2. Contador regresivo de 25s para refrescar automáticamente el QR
    const countdownInterval = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          refreshQrCode(qrCodeModal.instanceName);
          return 25;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(countdownInterval);
    };
  }, [qrCodeModal.open, qrCodeModal.instanceName, fetchInstances, refreshQrCode]);

  // Manejadores de Instancias WhatsApp
  const handleCreateInstance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const instanceName = newInstanceName.trim();
    if (!instanceName) {
      showNotification('Ingresa un nombre para la línea/instancia', 'error');
      return;
    }

    const engineName = 'Evolution Go (Whatsmeow Engine)';
    const initialSteps: AsyncStep[] = [
      { id: '1', label: 'Enviando solicitud de creación al servidor', status: 'active' },
      { id: '2', label: `Inicializando motor WhatsApp API (${engineName})`, status: 'pending' },
      { id: '3', label: 'Guardando credenciales y API Key en PostgreSQL', status: 'pending' }
    ];

    setAsyncOp({
      open: true,
      title: `Creando Instancia "${instanceName}"`,
      subtitle: `Configurando tu nueva línea WhatsApp API con ${engineName}.`,
      status: 'submitting',
      steps: initialSteps,
      errorMessage: null,
      successMessage: null,
      onRetry: () => handleCreateInstance()
    });

    try {
      setLoadingInstances(true);
      const res = await api.post('/instances', { instanceName, engineType: selectedEngine });

      if (res.data?.success) {
        setAsyncOp(prev => ({
          ...prev,
          status: 'success',
          steps: [
            { ...prev.steps[0], status: 'completed' },
            { ...prev.steps[1], status: 'completed' },
            { ...prev.steps[2], status: 'completed' }
          ],
          successMessage: `¡La línea "${instanceName}" ha sido creada exitosamente con motor ${engineName}! Puedes generar su código QR para conectar WhatsApp.`
        }));

        setNewInstanceName('');
        fetchInstances();
      } else {
        setAsyncOp(prev => ({
          ...prev,
          status: 'error',
          steps: prev.steps.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s),
          errorMessage: res.data?.error || 'No se pudo crear la instancia de WhatsApp.'
        }));
      }
    } catch (err: any) {
      setAsyncOp(prev => ({
        ...prev,
        status: 'error',
        steps: prev.steps.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s),
        errorMessage: err.response?.data?.error || err.message || 'Error al comunicarse con el servidor.'
      }));
    } finally {
      setLoadingInstances(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string | React.ReactNode;
    warningNote?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleDeleteInstance = (instanceName: string) => {
    setConfirmModal({
      open: true,
      title: 'Eliminar Instancia WhatsApp',
      message: (
        <span>
          ¿Estás seguro de que deseas eliminar permanentemente la instancia <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{instanceName}</strong>?
        </span>
      ),
      warningNote: 'Esta acción destruirá permanentemente la conexión con WhatsApp y su API Key. No se puede deshacer.',
      type: 'danger',
      confirmText: 'Eliminar Instancia',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          setLoadingInstances(true);
          const res = await api.delete(`/instances/${instanceName}`);
          if (res.data?.success) {
            showNotification('Instancia eliminada correctamente', 'success');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            fetchInstances();
          } else {
            showNotification(res.data?.error || 'No se pudo eliminar la instancia', 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al eliminar la instancia', 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        } finally {
          setLoadingInstances(false);
        }
      }
    });
  };

  const handleGetQrCode = async (instanceName: string) => {
    try {
      setQrCodeModal({ open: true, instanceName, qrCode: null });
      setQrCountdown(25);
      const res = await api.get(`/instances/${instanceName}/connect`);
      if (res.data?.success && res.data.base64) {
        setQrCodeModal({ open: true, instanceName, qrCode: res.data.base64 });
        setQrCountdown(25);
      } else {
        showNotification('No se pudo obtener el código QR de WhatsApp', 'error');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener código QR', 'error');
    }
  };

  const handleDisconnectInstance = (instanceName: string) => {
    setConfirmModal({
      open: true,
      title: 'Desconectar WhatsApp',
      message: (
        <span>
          ¿Deseas cerrar la sesión activa de WhatsApp para la línea <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{instanceName}</strong>?
        </span>
      ),
      warningNote: 'La recepción y emisión de mensajes a través de esta instancia quedará pausada hasta que se vuelva a escanear el QR.',
      type: 'warning',
      confirmText: 'Desconectar Sesión',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.post(`/instances/${instanceName}/logout`);
          if (res.data?.success) {
            showNotification('Línea desconectada de WhatsApp exitosamente', 'success');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            fetchInstances();
          } else {
            showNotification(res.data?.error || 'No se pudo desconectar la línea', 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al desconectar', 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Manejador del Probador de API (Playground)
  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInstance || !playgroundPhone) {
      showNotification('Selecciona una instancia y completa el número de teléfono', 'error');
      return;
    }

    try {
      setPlaygroundLoading(true);
      setPlaygroundResponse(null);

      const targetInst = instances.find(i => i.instance_name === playgroundInstance);
      const apiKey = targetInst?.api_key || 'tu_api_key';

      let endpointUrl = '/webhooks/send-text';
      let payload: any = {
        instanceName: playgroundInstance,
        number: playgroundPhone
      };

      if (playgroundType === 'text') {
        endpointUrl = '/webhooks/send-text';
        payload.text = playgroundMessage;
      } else if (playgroundType === 'media') {
        endpointUrl = '/webhooks/send-media';
        payload.mediatype = playgroundMediaType;
        payload.mimetype = playgroundMimeType;
        payload.media = playgroundMedia;
        if (playgroundCaption) payload.caption = playgroundCaption;
        if (playgroundMediaType === 'document' && playgroundFileName) payload.fileName = playgroundFileName;
      } else if (playgroundType === 'audio') {
        endpointUrl = '/webhooks/send-audio';
        payload.audio = playgroundAudio;
      } else if (playgroundType === 'location') {
        endpointUrl = '/webhooks/send-location';
        payload.name = playgroundLocName;
        payload.address = playgroundLocAddress;
        payload.latitude = playgroundLatitude;
        payload.longitude = playgroundLongitude;
      } else if (playgroundType === 'contact') {
        endpointUrl = '/webhooks/send-contact';
        payload.contact = [
          {
            fullName: playgroundContactName,
            phoneNumber: playgroundContactPhone
          }
        ];
      }

      const res = await api.post(endpointUrl, payload, {
        headers: {
          'x-api-key': apiKey
        }
      });

      setPlaygroundResponse(res.data);
      if (res.data?.success) {
        showNotification(`Mensaje (${playgroundType.toUpperCase()}) enviado exitosamente vía API`);
      } else {
        showNotification(res.data?.error || 'Fallo en la prueba de envío', 'error');
      }
    } catch (err: any) {
      setPlaygroundResponse(err.response?.data || { error: err.message });
      showNotification('Error al ejecutar la prueba de envío', 'error');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // 6 Apartados Únicos — Cero Duplicidades
  const menuItems = [
    { id: 'overview', label: 'Resumen y Plan', icon: LayoutGrid },
    { id: 'instances', label: 'Líneas WhatsApp', icon: Smartphone },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'webhooks', label: 'Webhooks y Logs', icon: Radio },
    { id: 'playground', label: 'Probador de API', icon: Play },
    { id: 'docs', label: 'Documentación', icon: Code },
  ];

  const currentBackendUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : 'https://api.zazaclick.sbs';

  const activeInstancesCount = instances.filter(i => i.status === 'connected').length;
  const maxInstances = subscription?.max_instances || 1;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-white font-sans overflow-hidden relative">

      {/* Toast Notification */}
      <ToastNotification notification={notification} onClose={() => setNotification(null)} />

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Barra Lateral Limpia y Sólida */}
      <aside 
        className={`surface-panel flex flex-col z-50 fixed top-0 left-0 h-full border-r border-slate-200 dark:border-slate-800 ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center border-b border-slate-100 dark:border-slate-800/80 ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <ZazaLogo size={34} />
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza Click <span className="text-emerald-600 dark:text-emerald-400">2.0</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Portal Clientes</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Alternar barra lateral"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
                } rounded-xl relative cursor-pointer ${
                  active 
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon 
                  size={18} 
                  className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {sidebarOpen ? (
                  <span className="ml-3 text-xs tracking-tight">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 surface-elevated text-slate-900 dark:text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen ? (
              <span className="ml-3 text-xs font-semibold">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-full ml-3 px-3 py-1.5 surface-elevated text-slate-900 dark:text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Top Header */}
        <header className="h-16 surface-panel px-4 sm:px-8 lg:px-10 flex items-center justify-between z-30 border-b border-slate-200 dark:border-slate-800 sticky top-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.label || 'Consola WhatsApp API'}
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">
                Infraestructura WhatsApp API sobre Evolution Go (Whatsmeow Engine).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {user?.role === 'admin' && (
              <a
                href="https://admin.zazaclick.sbs"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Shield size={13} />
                <span>Panel SuperAdmin</span>
              </a>
            )}

            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg surface-accent-emerald text-emerald-700 dark:text-emerald-300">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Gateway Operativo</span>
            </div>

            <button
              onClick={toggleDark}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
            </button>

            <button
              onClick={() => {
                fetchInstances();
                fetchSubscription();
              }}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Sincronizar datos"
            >
              <RefreshCw size={16} className={loadingInstances ? 'animate-spin text-emerald-600' : ''} />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{user?.role || 'Cliente'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body — Fondo Sólido y Limpio */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-10 py-7 space-y-6 max-w-[1600px] mx-auto">
            
            {/* ============================================================================
                APARTADO 1: RESUMEN Y PLAN (UNIFICADO, SIN DUPLICAR EN OTRA PESTAÑA)
               ============================================================================ */}
            {activeTab === 'overview' && (
              <div className="space-y-6 text-left">
                
                {/* Cabecera Ejecutiva */}
                <div className="surface-panel p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 surface-accent-emerald rounded-md text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Motor Evolution Go (Whatsmeow) · Cola Asíncrona Activa</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Resumen Operativo y Estado de Suscripción
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                      Supervisa el consumo de tu cuota mensual, el estado de tus líneas de WhatsApp y la vigencia de tu licencia comercial en un solo lugar.
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Gestionar Líneas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('playground')}
                      className="px-4 py-2.5 surface-interactive text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Play size={15} />
                      <span>Abrir Probador API</span>
                    </button>
                  </div>
                </div>

                {/* Alerta de Vencimiento si aplica */}
                {subscription?.is_expired && (
                  <div className="p-4 surface-accent-rose rounded-xl flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-200">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={17} className="text-rose-600 shrink-0" />
                      <span>Tu suscripción se encuentra vencida. El despacho de mensajes por API está pausado hasta renovar la licencia.</span>
                    </div>
                  </div>
                )}

                {/* 4 KPIs Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Consumo de Cuota</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-amber flex items-center justify-center">
                        <Activity size={15} className="text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {subscription?.messages_used || 0} <span className="text-xs font-normal text-slate-400 font-sans">/ {subscription?.messages_limit || 1000}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full ${Number(subscription?.consumption_percentage || 0) > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Number(subscription?.consumption_percentage || 0))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {subscription?.consumption_percentage || 0}% utilizado ({subscription?.available_messages || 0} disponibles)
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-emerald flex items-center justify-center">
                        <Smartphone size={15} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {activeInstancesCount} <span className="text-xs font-normal text-slate-400 font-sans">/ {maxInstances === 99 ? '∞' : maxInstances}</span>
                    </div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{activeInstancesCount > 0 ? 'Sesión activa con WhatsApp' : 'Sin líneas conectadas'}</span>
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">URL Base API</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-indigo flex items-center justify-center">
                        <Globe size={15} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate px-3 py-1.5 surface-interactive rounded-lg" title={currentBackendUrl}>
                      {currentBackendUrl}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(currentBackendUrl, 'base-url')} 
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer pt-1"
                    >
                      {copiedId === 'base-url' ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span>¡URL Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copiar URL Base</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Plan Activo</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-emerald flex items-center justify-center">
                        <CreditCard size={15} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-white uppercase truncate">
                      {subscription?.plan_name || 'Plan Developer'}
                    </div>
                    <div className="pt-1">
                      {subscription?.is_expired ? (
                        <span className="px-2.5 py-1 surface-accent-rose text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-md uppercase">
                          Licencia Vencida
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md uppercase">
                          {subscription?.days_remaining || 0} Días Restantes
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalle Completo de Licencia y Suscripción (Integrado en Resumen) */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <CreditCard size={17} className="text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Detalle de Licencia y Vigencia</h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Cuenta: {user?.email}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 surface-interactive rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">Fecha de Inicio del Ciclo</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        {subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString() : 'Activo'}
                      </span>
                    </div>

                    <div className="p-4 surface-interactive rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">Fecha de Vencimiento</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'Sin vencimiento'}
                      </span>
                    </div>

                    <div className="p-4 surface-interactive rounded-xl space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">Capacidad de Líneas WhatsApp</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        {activeInstancesCount} conectadas de {maxInstances === 99 ? 'Ilimitadas' : maxInstances} permitidas
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================================
                APARTADO 2: LÍNEAS WHATSAPP (INSTANCIAS Y VINCULACIÓN QR)
               ============================================================================ */}
            {activeTab === 'instances' && (
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Smartphone size={19} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Líneas de WhatsApp</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Crea tus instancias y vincula tus números de WhatsApp escaneando el código QR.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('apikeys')}
                    className="px-4 py-2 surface-interactive rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                  >
                    <Key size={14} className="text-emerald-600" />
                    <span>Ir a Bóveda de API Keys</span>
                  </button>
                </div>

                {/* Crear Nueva Instancia */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Crear Nueva Línea WhatsApp</h3>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 surface-accent-indigo text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold">
                      <Zap size={12} />
                      <span>Motor Oficial: Evolution Go (Whatsmeow)</span>
                    </div>
                  </div>

                  <form onSubmit={handleCreateInstance} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="nombre_de_instancia (ej: ventas_lima)"
                      className="flex-1 px-4 py-2.5 surface-interactive rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loadingInstances}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span>Crear Línea</span>
                    </button>
                  </form>
                </div>

                {/* Listado de Instancias */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Registradas ({instances.length})</h3>

                  {instances.length === 0 ? (
                    <div className="surface-panel p-10 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <Smartphone size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">No tienes líneas creadas</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Ingresa un identificador arriba para crear tu primera línea de WhatsApp.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {instances.map((inst) => (
                        <div 
                          key={inst.id || inst.instance_name} 
                          className="surface-panel p-6 rounded-2xl space-y-4 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-mono font-bold text-slate-900 dark:text-white">{inst.instance_name}</h4>
                                <span className="px-2 py-0.5 text-[9px] font-bold rounded uppercase surface-accent-indigo text-indigo-700 dark:text-indigo-300">
                                  Go Engine
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                {inst.phone ? `Número: ${inst.phone}` : 'Sin número vinculado'}
                              </span>
                            </div>

                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase flex items-center gap-1.5 ${
                              inst.status === 'connected' 
                                ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300' 
                                : inst.status === 'reconnecting'
                                  ? 'surface-accent-amber text-amber-700 dark:text-amber-300'
                                  : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                            }`}>
                              {inst.status === 'connected' ? (
                                '● Conectado'
                              ) : inst.status === 'reconnecting' ? (
                                'Reconectando'
                              ) : (
                                '○ Desconectado'
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 pt-1">
                            {inst.status === 'connected' ? (
                              <button
                                type="button"
                                onClick={() => handleDisconnectInstance(inst.instance_name)}
                                className="flex-1 py-2 surface-accent-rose text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl cursor-pointer"
                              >
                                Desconectar Sesión
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleGetQrCode(inst.instance_name)}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Smartphone size={14} />
                                <span>Vincular con Código QR</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl surface-interactive cursor-pointer"
                              title="Eliminar Instancia"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================================
                APARTADO 3: API KEYS (GESTIÓN EXCLUSIVA DE CREDENCIALES)
               ============================================================================ */}
            {activeTab === 'apikeys' && (
              <DeveloperPortal
                section="apikeys"
                instances={instances}
                currentApiKey={instances[0]?.api_key || user?.id || 'zc_live_sec_demo'}
                onRefreshInstances={fetchInstances}
              />
            )}

            {/* ============================================================================
                APARTADO 4: WEBHOOKS Y LOGS (ENTREGAS HMAC + BITÁCORA HTTP)
               ============================================================================ */}
            {activeTab === 'webhooks' && (
              <DeveloperPortal
                section="webhooks"
                instances={instances}
                currentApiKey={instances[0]?.api_key || user?.id || 'zc_live_sec_demo'}
                onRefreshInstances={fetchInstances}
              />
            )}

            {/* ============================================================================
                APARTADO 5: PROBADOR DE API (ÚNICO PLAYGROUND INTERACTIVO)
               ============================================================================ */}
            {activeTab === 'playground' && (
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Terminal size={19} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Probador Interactivo de API</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ejecuta envíos reales de Texto, Multimedia, Notas de Voz PTT, Ubicación y Contactos.</p>
                  </div>
                </div>

                {/* Selector de Tipo de Mensaje */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'text', label: 'Texto', icon: Terminal },
                    { id: 'media', label: 'Multimedia', icon: Image },
                    { id: 'audio', label: 'Audio PTT', icon: Mic },
                    { id: 'location', label: 'Ubicación', icon: MapPin },
                    { id: 'contact', label: 'Contacto', icon: UserPlus },
                  ].map(t => {
                    const Icon = t.icon;
                    const active = playgroundType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPlaygroundType(t.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white font-bold'
                            : 'surface-interactive text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon size={13} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="surface-panel p-6 sm:p-7 rounded-2xl space-y-5">
                  <form onSubmit={handleTestSend} className="space-y-4">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Línea WhatsApp</label>
                        <CustomSelect
                          value={playgroundInstance}
                          onChange={(val) => setPlaygroundInstance(val)}
                          placeholder="Seleccionar instancia..."
                          options={instances.map(i => ({
                            value: i.instance_name,
                            label: i.instance_name,
                            sublabel: i.phone ? `Tel: ${i.phone}` : 'Sin número vinculado',
                            badge: i.status === 'connected' ? 'ONLINE' : 'OFFLINE'
                          }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Número de Destino (con código de país)</label>
                        <input
                          type="text"
                          value={playgroundPhone}
                          onChange={(e) => setPlaygroundPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="ej: 51912345678"
                          className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {playgroundType === 'text' && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Mensaje de Texto</label>
                        <textarea
                          rows={3}
                          value={playgroundMessage}
                          onChange={(e) => setPlaygroundMessage(e.target.value)}
                          className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {playgroundType === 'media' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Tipo de Medio</label>
                            <CustomSelect
                              value={playgroundMediaType}
                              onChange={(val) => {
                                setPlaygroundMediaType(val as any);
                                if (val === 'image') setPlaygroundMimeType('image/jpeg');
                                if (val === 'document') setPlaygroundMimeType('application/pdf');
                                if (val === 'video') setPlaygroundMimeType('video/mp4');
                                if (val === 'audio') setPlaygroundMimeType('audio/mpeg');
                              }}
                              options={[
                                { value: 'image', label: 'Imagen (JPG, PNG, WEBP)' },
                                { value: 'document', label: 'Documento (PDF, DOCX, XLSX)' },
                                { value: 'video', label: 'Video (MP4)' },
                                { value: 'audio', label: 'Audio como Archivo (MP3)' }
                              ]}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">MIME Type</label>
                            <input
                              type="text"
                              value={playgroundMimeType}
                              onChange={(e) => setPlaygroundMimeType(e.target.value)}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">URL Pública o Base64 del Archivo</label>
                          <input
                            type="text"
                            value={playgroundMedia}
                            onChange={(e) => setPlaygroundMedia(e.target.value)}
                            placeholder="https://... o Base64 puro"
                            className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Caption / Descripción (Opcional)</label>
                            <input
                              type="text"
                              value={playgroundCaption}
                              onChange={(e) => setPlaygroundCaption(e.target.value)}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>

                          {playgroundMediaType === 'document' && (
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Nombre del Archivo (fileName)</label>
                              <input
                                type="text"
                                value={playgroundFileName}
                                onChange={(e) => setPlaygroundFileName(e.target.value)}
                                className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {playgroundType === 'audio' && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">URL de Audio para Nota de Voz PTT (MP3/OGG)</label>
                        <input
                          type="text"
                          value={playgroundAudio}
                          onChange={(e) => setPlaygroundAudio(e.target.value)}
                          placeholder="https://.../audio.mp3"
                          className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                          ● Se enviará codificado como Nota de Voz nativa de WhatsApp (PTT).
                        </p>
                      </div>
                    )}

                    {playgroundType === 'location' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Nombre del Lugar</label>
                            <input
                              type="text"
                              value={playgroundLocName}
                              onChange={(e) => setPlaygroundLocName(e.target.value)}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Dirección</label>
                            <input
                              type="text"
                              value={playgroundLocAddress}
                              onChange={(e) => setPlaygroundLocAddress(e.target.value)}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Latitud</label>
                            <input
                              type="number"
                              step="any"
                              value={playgroundLatitude}
                              onChange={(e) => setPlaygroundLatitude(parseFloat(e.target.value))}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Longitud</label>
                            <input
                              type="number"
                              step="any"
                              value={playgroundLongitude}
                              onChange={(e) => setPlaygroundLongitude(parseFloat(e.target.value))}
                              className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {playgroundType === 'contact' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Nombre Completo</label>
                          <input
                            type="text"
                            value={playgroundContactName}
                            onChange={(e) => setPlaygroundContactName(e.target.value)}
                            className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Teléfono del Contacto</label>
                          <input
                            type="text"
                            value={playgroundContactPhone}
                            onChange={(e) => setPlaygroundContactPhone(e.target.value)}
                            className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={playgroundLoading || instances.length === 0}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send size={14} />
                      <span>{playgroundLoading ? 'Enviando petición a WhatsApp...' : `Ejecutar Envío (${playgroundType.toUpperCase()})`}</span>
                    </button>
                  </form>

                  {playgroundResponse && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase block font-mono">Respuesta JSON del Gateway:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(JSON.stringify(playgroundResponse, null, 2), 'pg-resp')}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                        >
                          {copiedId === 'pg-resp' ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copiar JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto">
                        {JSON.stringify(playgroundResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================================
                APARTADO 6: DOCUMENTACIÓN TÉCNICA OFICIAL
               ============================================================================ */}
            {activeTab === 'docs' && (
              <div className="text-left">
                <DeveloperPlatformDocs instances={instances} userApiKey={user?.id} />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal QR Code (Dinámico con Auto-Refresco Continuo) */}
      {qrCodeModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vincular Línea: {qrCodeModal.instanceName}</h3>
              <button onClick={() => setQrCodeModal({ open: false, instanceName: '', qrCode: null })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="relative p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-center min-h-[220px]">
              {qrCodeModal.qrCode ? (
                <>
                  <img src={qrCodeModal.qrCode} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
                  {refreshingQr && (
                    <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                      <RefreshCw size={24} className="animate-spin text-emerald-600" />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2 text-slate-400 text-xs">
                  <RefreshCw size={20} className="animate-spin mx-auto text-emerald-600" />
                  <p>Solicitando código QR al motor...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Expira en: <strong className="font-mono text-slate-800 dark:text-slate-200">{qrCountdown}s</strong>
              </span>
              <button
                type="button"
                onClick={() => refreshQrCode(qrCodeModal.instanceName)}
                disabled={refreshingQr}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshingQr ? 'animate-spin' : ''} />
                Refrescar ahora
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 text-left bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Pasos para conectar:</p>
              <p>1. Abre WhatsApp en tu teléfono ➔ Menú (⋮) o Ajustes ➔ <strong>Dispositivos vinculados</strong>.</p>
              <p>2. Toca <strong>Vincular un dispositivo</strong> y apunta al código QR antes de que termine el contador.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación */}
      <ConfirmationModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        warningNote={confirmModal.warningNote}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
      />

      {/* Modal de Operaciones Asíncronas */}
      <AsyncOperationModal
        open={asyncOp.open}
        title={asyncOp.title}
        subtitle={asyncOp.subtitle}
        status={asyncOp.status}
        steps={asyncOp.steps}
        errorMessage={asyncOp.errorMessage}
        successMessage={asyncOp.successMessage}
        onClose={() => setAsyncOp(prev => ({ ...prev, open: false, status: 'idle' }))}
        onRetry={asyncOp.onRetry}
      />

    </div>
  );
}
