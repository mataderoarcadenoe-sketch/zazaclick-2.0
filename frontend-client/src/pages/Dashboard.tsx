// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutGrid, Terminal, 
  Moon, Sun, Menu, X, Play, Shield, Building, Image, Mic, MapPin, UserPlus, ArrowRight,
  Activity, Globe, CreditCard, AlertTriangle, Code, Zap
} from 'lucide-react';

import { AsyncOperationModal, type AsyncStep, type AsyncStatus } from '../components/AsyncOperationModal';
import { CustomSelect } from '../components/CustomSelect';
import { InteractiveGravityMesh } from '../components/InteractiveGravityMesh';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ToastNotification } from '../components/ToastNotification';
import { ZazaLogo } from '../components/ZazaLogo';
import { DeveloperPlatformDocs } from '../components/DeveloperPlatformDocs';
import { DeveloperPortal } from '../components/DeveloperPortal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // State Management - WhatsApp API SaaS Core
  const [activeTab, setActiveTab] = useState<string>(user?.role === 'admin' ? 'admin_overview' : 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  const [selectedEngine, setSelectedEngine] = useState<'evolution_api' | 'evolution_go'>('evolution_api');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [reconnectingInst, setReconnectingInst] = useState<string | null>(null);
  const [qrCodeModal, setQrCodeModal] = useState<{ open: boolean; instanceName: string; qrCode: string | null }>({
    open: false,
    instanceName: '',
    qrCode: null
  });

  // Suscripción & Planes
  const [subscription, setSubscription] = useState<any>(null);

  // SuperAdmin Data
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminInstances, setAdminInstances] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);

  // Playground API (Probar Envío con soporte de Texto, Media, Audio PTT, Ubicación y Contacto)
  const [playgroundType, setPlaygroundType] = useState<'text' | 'media' | 'audio' | 'location' | 'contact'>('text');
  const [playgroundInstance, setPlaygroundInstance] = useState('');
  const [playgroundPhone, setPlaygroundPhone] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Parámetros de Texto
  const [playgroundMessage, setPlaygroundMessage] = useState('¡Hola! Mensaje de prueba enviado desde la API de WhatsApp Zaza.click.');
  
  // Parámetros Multimedia
  const [playgroundMediaType, setPlaygroundMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const [playgroundMimeType, setPlaygroundMimeType] = useState('image/jpeg');
  const [playgroundMedia, setPlaygroundMedia] = useState('https://images.unsplash.com/photo-1579202673506-ca3ce28943ef');
  const [playgroundCaption, setPlaygroundCaption] = useState('¡Mira esta imagen enviada vía API!');
  const [playgroundFileName, setPlaygroundFileName] = useState('catalogo.pdf');
  
  // Parámetros Audio PTT
  const [playgroundAudio, setPlaygroundAudio] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  
  // Parámetros Ubicación
  const [playgroundLocName, setPlaygroundLocName] = useState('Sede Principal Zaza Click');
  const [playgroundLocAddress, setPlaygroundLocAddress] = useState('Av. República de Panamá 3545, San Isidro, Lima');
  const [playgroundLatitude, setPlaygroundLatitude] = useState(-12.098412);
  const [playgroundLongitude, setPlaygroundLongitude] = useState(-77.028941);

  // Parámetros Contacto
  const [playgroundContactName, setPlaygroundContactName] = useState('Soporte Zaza Click');
  const [playgroundContactPhone, setPlaygroundContactPhone] = useState('+51912345678');

  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);

  // Documentación API
  const [docEndpoint, setDocEndpoint] = useState<'send-text' | 'send-media' | 'send-audio' | 'send-location' | 'send-contact'>('send-text');
  const [docLang, setDocLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');

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
    showNotification('Copiado al portapapeles!');
  };

  // Cargar datos principales al montar
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

  const fetchAdminData = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [usersRes, instRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/instances'),
        api.get('/admin/stats')
      ]);
      if (usersRes.data?.success) setAdminUsers(usersRes.data.data || []);
      if (instRes.data?.success) setAdminInstances(instRes.data.data || []);
      if (statsRes.data?.success) setAdminStats(statsRes.data.data || null);
    } catch (err: any) {
      console.error('Error al cargar datos de admin:', err);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchInstances();
    fetchSubscription();
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [fetchInstances, fetchSubscription, fetchAdminData, user?.role]);

  // Auto-detectar la conexión de WhatsApp mientras el modal de QR esté abierto
  useEffect(() => {
    if (!qrCodeModal.open || !qrCodeModal.instanceName) return;

    const intervalId = setInterval(async () => {
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

    return () => clearInterval(intervalId);
  }, [qrCodeModal.open, qrCodeModal.instanceName, fetchInstances]);

  // Manejadores de Instancias WhatsApp
  const handleCreateInstance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const instanceName = newInstanceName.trim();
    if (!instanceName) {
      showNotification('Ingresa un nombre para la línea/instancia', 'error');
      return;
    }

    const engineName = selectedEngine === 'evolution_go' ? 'Evolution Go (Fast Engine)' : 'Evolution API 2.4.0-rc2';
    const initialSteps: AsyncStep[] = [
      { id: '1', label: 'Enviando solicitud de creación al servidor', status: 'active' },
      { id: '2', label: `Inicializando motor WhatsApp API (${engineName})`, status: 'pending' },
      { id: '3', label: 'Guardando credenciales y generador de API Key en PostgreSQL', status: 'pending' }
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

  // Modal de Confirmación Personalizado
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
      const res = await api.get(`/instances/${instanceName}/connect`);
      if (res.data?.success && res.data.base64) {
        setQrCodeModal({ open: true, instanceName, qrCode: res.data.base64 });
      } else {
        showNotification('No se pudo obtener el código QR de WhatsApp', 'error');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al obtener código QR', 'error');
    }
  };

  const handleReconnectInstance = async (instanceName: string) => {
    try {
      setReconnectingInst(instanceName);
      showNotification(`Intentando reactivar sesión para "${instanceName}"...`, 'info');
      const res = await api.post(`/instances/${instanceName}/reconnect`);

      if (res.data?.success && res.data?.isConnected) {
        showNotification(`¡Línea "${instanceName}" restablecida exitosamente!`, 'success');
        fetchInstances();
      } else if (res.data?.requiresQr) {
        showNotification('La sesión anterior expiró en el móvil. Abriendo código QR...', 'warning');
        handleGetQrCode(instanceName);
      } else {
        showNotification(`Estado actual: ${res.data?.state || 'reconectando'}. Reintentando en segundo plano...`, 'info');
        fetchInstances();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'No se pudo reconectar automáticamente. Abriendo código QR...', 'error');
      handleGetQrCode(instanceName);
    } finally {
      setReconnectingInst(null);
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

  // Manejador del Tester API Multi-Tipo (Playground)
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

  const menuItems = [
    { id: 'overview', label: 'Dashboard API', icon: LayoutGrid },
    { id: 'developer', label: 'Developer Portal', icon: Terminal },
    { id: 'instances', label: 'Instancias / QR', icon: Smartphone },
    { id: 'playground', label: 'Tester de API', icon: Play },
    { id: 'docs', label: 'Documentación API', icon: Code },
    { id: 'subscription', label: 'Planes y Suscripción', icon: Key },
  ];

  const currentBackendUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : 'https://api.zazaclick.sbs';

  const activeInstancesCount = instances.filter(i => i.status === 'connected').length;
  const maxInstances = subscription?.max_instances || 1;

  // Generador de código para documentación API completa
  const getDocCode = () => {
    const selectedInst = instances[0] || { instance_name: 'mi_linea_whatsapp', api_key: 'tu_api_key_aqui' };

    let endpointPath = '/api/webhooks/send-text';
    let payloadObj: any = {
      instanceName: selectedInst.instance_name,
      number: "51912345678",
      text: "¡Hola! Mensaje enviado desde la API de WhatsApp."
    };

    if (docEndpoint === 'send-media') {
      endpointPath = '/api/webhooks/send-media';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        number: "51912345678",
        mediatype: "image",
        mimetype: "image/jpeg",
        media: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef",
        caption: "Catálogo de Productos 2026",
        fileName: "catalogo.jpg"
      };
    } else if (docEndpoint === 'send-audio') {
      endpointPath = '/api/webhooks/send-audio';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        number: "51912345678",
        audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      };
    } else if (docEndpoint === 'send-location') {
      endpointPath = '/api/webhooks/send-location';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        number: "51912345678",
        name: "Sede Principal Zaza Click",
        address: "Av. República de Panamá 3545, San Isidro, Lima",
        latitude: -12.098412,
        longitude: -77.028941
      };
    } else if (docEndpoint === 'send-contact') {
      endpointPath = '/api/webhooks/send-contact';
      payloadObj = {
        instanceName: selectedInst.instance_name,
        number: "51912345678",
        contact: [
          {
            fullName: "Soporte Zaza Click",
            phoneNumber: "+51912345678"
          }
        ]
      };
    }

    const payloadJson = JSON.stringify(payloadObj, null, 2);

    if (docLang === 'curl') {
      return `curl -X POST "${currentBackendUrl}${endpointPath}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${selectedInst.api_key}" \\
  -d '${JSON.stringify(payloadObj)}'`;
    }

    if (docLang === 'js') {
      return `const response = await fetch("${currentBackendUrl}${endpointPath}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${selectedInst.api_key}"
  },
  body: JSON.stringify(${payloadJson})
});

const data = await response.json();
console.log(data);`;
    }

    if (docLang === 'python') {
      return `import requests

url = "${currentBackendUrl}${endpointPath}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${selectedInst.api_key}"
}
payload = ${JSON.stringify(payloadObj, null, 4)}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    }

    if (docLang === 'php') {
      return `<?php
$ch = curl_init("${currentBackendUrl}${endpointPath}");
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'x-api-key: ${selectedInst.api_key}'
));
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${JSON.stringify(payloadObj)}));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
    }
    return '';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-250 font-sans overflow-hidden relative">
      
      {/* Living API Network Infrastructure Canvas (Client Connectivity Engine) */}
      <InteractiveGravityMesh 
        variant="client"
        isDark={isDark}
        className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-60"
      />

      {/* Toast Notification */}
      <ToastNotification notification={notification} onClose={() => setNotification(null)} />

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Institutional (Atmospheric Translucent Surface) */}
      <aside 
        className={`surface-panel flex flex-col transition-all duration-250 z-50 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <ZazaLogo size={36} />
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza.click <span className="text-emerald-500">2.0</span>
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">WhatsApp API</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Alternar barra lateral"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-4 py-2.5 justify-start' : 'p-3 justify-center'
                } rounded-xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-2.5 flex-shrink-0" />
                )}
                <Icon 
                  size={18} 
                  className={`flex-shrink-0 transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {sidebarOpen ? (
                  <span className="ml-3 text-xs tracking-tight">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 surface-elevated text-slate-900 dark:text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-500/15 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen ? (
              <span className="ml-3 text-xs font-medium">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-full ml-3 px-3 py-1.5 surface-elevated text-slate-900 dark:text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-250 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Top Header */}
        <header className="h-16 surface-panel px-4 sm:px-8 lg:px-12 flex items-center justify-between z-30 transition-colors duration-250 sticky top-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.label || 'Consola de WhatsApp API'}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                  v2.4.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal leading-none mt-0.5 hidden sm:block">
                Gateway REST, enrutamiento multi-inquilino y webhooks en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'admin' && (
              <a
                href="https://admin.zazaclick.sbs"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Shield size={13} />
                <span>Panel SuperAdmin ➔</span>
              </a>
            )}

            {/* Live Gateway Telemetry Pill */}
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Gateway Online · 18ms</span>
            </div>

            <button
              onClick={toggleDark}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-emerald-600" />}
            </button>

            <button
              onClick={fetchInstances}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Sincronizar datos"
            >
              <RefreshCw size={17} className={loadingInstances ? 'animate-spin text-emerald-500' : ''} />
            </button>

            <div className="flex items-center gap-2 pl-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs uppercase">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[130px]">{user?.email}</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{user?.role || 'Cliente'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body Canvas */}
        <main className="flex-1 bg-grid-tech relative overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8 max-w-[1920px] mx-auto">
            
            {/* DASHBOARD API OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Hero Atmosphere Section */}
                <div className="surface-panel p-7 sm:p-9 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="space-y-2.5 text-left relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Motor Evolution API 2.4.0-rc2 · Redis Queue Engine</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Infraestructura de WhatsApp API SaaS
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed font-normal">
                      Envía mensajes de texto, imágenes, audios PTT, videos, PDFs y contactos mediante tu <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono px-1.5 py-0.5 bg-emerald-500/10 rounded">x-api-key</code> de alta velocidad.
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap relative z-10">
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Crear Línea</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('playground')}
                      className="px-5 py-2.5 surface-interactive text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Play size={15} />
                      <span>Probar Envíos API</span>
                    </button>
                  </div>
                </div>

                {/* Alerta de Estado de Licencia si está vencido */}
                {subscription?.is_expired && (
                  <div className="p-4 surface-accent-rose rounded-2xl flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={17} className="text-rose-600" />
                      <span>Tu suscripción ha vencido. Las llamadas a la API de WhatsApp están bloqueadas. Contacta al administrador para renovar.</span>
                    </div>
                    <button onClick={() => setActiveTab('subscription')} className="underline font-bold hover:text-rose-900 dark:hover:text-white">Renovar Licencia</button>
                  </div>
                )}

                {/* KPI Metrics — Composición Editorial por Tono & Tipografía */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Consumo de Cuota</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-amber flex items-center justify-center"><Activity size={15} className="text-amber-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {subscription?.messages_used || 0} <span className="text-xs font-normal text-slate-400 font-sans">/ {subscription?.messages_limit || 1000}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${Number(subscription?.consumption_percentage || 0) > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Number(subscription?.consumption_percentage || 0))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {subscription?.consumption_percentage || 0}% consumido ({subscription?.available_messages || 0} libres)
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Líneas Conectadas</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-emerald flex items-center justify-center"><Smartphone size={15} className="text-emerald-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {activeInstancesCount} <span className="text-xs font-normal text-slate-400 font-sans">/ {maxInstances === 99 ? '∞' : maxInstances}</span>
                    </div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{activeInstancesCount > 0 ? 'Conexión activa con WhatsApp' : 'Sin líneas vinculadas'}</span>
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">URL Endpoint</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-cyan flex items-center justify-center"><Globe size={15} className="text-cyan-500" /></div>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate px-2.5 py-1.5 surface-interactive rounded-xl" title={currentBackendUrl}>
                      {currentBackendUrl}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(currentBackendUrl, 'base-url')} 
                      className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer pt-1"
                    >
                      {copiedId === 'base-url' ? (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">¡Copiado!</span>
                        </>
                      ) : (
                        <span>Copiar URL Base ➔</span>
                      )}
                    </button>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plan y Vencimiento</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-teal flex items-center justify-center"><CreditCard size={15} className="text-teal-500" /></div>
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-white uppercase truncate">
                      {subscription?.plan_name || 'Plan Developer'}
                    </div>
                    <div className="pt-1">
                      {subscription?.is_expired ? (
                        <span className="px-2.5 py-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-full uppercase">
                          🔴 VENCIDO
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase">
                          ● {subscription?.days_remaining || 0} DÍAS RESTANTES
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* DEVELOPER PORTAL & API MANAGEMENT */}
            {activeTab === 'developer' && (
              <div className="animate-fadeIn text-left">
                <DeveloperPortal
                  instances={instances}
                  currentApiKey={instances[0]?.api_key || user?.id || 'zc_live_sec_demo'}
                  onRefreshInstances={fetchInstances}
                />
              </div>
            )}

            {/* INSTANCIAS / LÍNEAS WHATSAPP */}
            {activeTab === 'instances' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Smartphone size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Instancias y Conexiones WhatsApp</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Crea nuevas conexiones de API o escanea el código QR para vincular tus líneas.</p>
                  </div>
                </div>

                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Crear Nueva Instancia API</h3>
                    
                    {/* Selector de Motor */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedEngine('evolution_api')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          selectedEngine === 'evolution_api'
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                        }`}
                      >
                        ● Evolution API
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedEngine('evolution_go')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedEngine === 'evolution_go'
                            ? 'bg-indigo-600 text-white font-bold shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <Zap size={13} className={selectedEngine === 'evolution_go' ? 'text-amber-300' : 'text-slate-400'} />
                        <span>Evolution Go</span>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleCreateInstance} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="nombre_de_instancia (ej: ventas_lima)"
                      className="flex-1 px-4 py-2.5 surface-interactive rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={loadingInstances}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span>Crear Instancia</span>
                    </button>
                  </form>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus Instancias ({instances.length})</h3>

                  {instances.length === 0 ? (
                    <div className="surface-panel p-10 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <Smartphone size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">No tienes instancias creadas</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Ingresa un nombre arriba para crear tu primera línea de API y comenzar a enviar mensajes.</p>
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
                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase flex items-center gap-1 ${
                                  inst.engine_type === 'evolution_go'
                                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}>
                                  {inst.engine_type === 'evolution_go' ? <Zap size={10} className="text-indigo-600 dark:text-indigo-400" /> : null}
                                  <span>{inst.engine_type === 'evolution_go' ? 'Go Engine' : 'API v2'}</span>
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{inst.phone || 'Sin número vinculado'}</span>
                            </div>

                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase flex items-center gap-1.5 ${
                              inst.status === 'connected' 
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                                : inst.status === 'reconnecting'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}>
                              {inst.status === 'connected' ? (
                                '● CONECTADO'
                              ) : inst.status === 'reconnecting' ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin text-amber-500" />
                                  <span>RECONECTANDO</span>
                                </>
                              ) : (
                                '○ DESCONECTADO'
                              )}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase block">API Key de Instancia</span>
                            <div className="flex items-center justify-between surface-interactive px-3 py-2 rounded-xl">
                              <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate mr-2">{inst.api_key}</code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inst.api_key, `inst-${inst.instance_name}`)}
                                className="p-1 hover:bg-slate-300/50 dark:hover:bg-slate-700/50 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer flex items-center gap-1"
                                title="Copiar API Key"
                              >
                                {copiedId === `inst-${inst.instance_name}` ? (
                                  <CheckCircle2 size={13} className="text-emerald-500" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 pt-1">
                            {inst.status === 'connected' ? (
                              <button
                                type="button"
                                onClick={() => handleDisconnectInstance(inst.instance_name)}
                                className="flex-1 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                              >
                                Desconectar Línea
                              </button>
                            ) : (
                              <div className="flex-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={reconnectingInst === inst.instance_name}
                                  onClick={() => handleReconnectInstance(inst.instance_name)}
                                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  title="Intentar revivir la sesión con las llaves de WhatsApp sin nuevo QR"
                                >
                                  <Zap size={13} className={reconnectingInst === inst.instance_name ? "animate-spin text-amber-300" : "text-amber-300"} />
                                  <span>{reconnectingInst === inst.instance_name ? 'Reconectando...' : 'Reconectar'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGetQrCode(inst.instance_name)}
                                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  title="Vincular con un nuevo teléfono o escanear QR"
                                >
                                  <Smartphone size={13} />
                                  <span>Nuevo QR</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
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

            {/* TESTER DE API MULTI-TIPO (PLAYGROUND) */}
            {activeTab === 'playground' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-teal text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Terminal size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Tester Interactivo de API</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Prueba el envío de Texto, Multimedia, Notas de Voz PTT, Ubicación y Contactos.</p>
                  </div>
                </div>

                {/* Selector de Tipo de Envío */}
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
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white font-bold'
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
                    
                    {/* Campos Base (Instancia y Teléfono) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Instancia WhatsApp</label>
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
                          className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Formulario Dinámico según playgroundType */}
                    {playgroundType === 'text' && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Mensaje de Texto</label>
                        <textarea
                          rows={3}
                          value={playgroundMessage}
                          onChange={(e) => setPlaygroundMessage(e.target.value)}
                          className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                          ● Se enviará codificado como Nota de Voz real de WhatsApp (PTT).
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
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send size={14} />
                      <span>{playgroundLoading ? 'Enviando petición a WhatsApp...' : `Ejecutar Envío de ${playgroundType.toUpperCase()}`}</span>
                    </button>
                  </form>

                  {/* Respuesta HTTP en consola digital */}
                  {playgroundResponse && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase block font-mono">Respuesta HTTP:</span>
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
                      <pre className="p-4 bg-[#070B10] text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto">
                        {JSON.stringify(playgroundResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DEVELOPER PLATFORM DOCS & SUITE */}
            {activeTab === 'docs' && (
              <div className="animate-fadeIn text-left">
                <DeveloperPlatformDocs instances={instances} userApiKey={user?.id} />
              </div>
            )}

            {/* PLANES Y SUSCRIPCIÓN */}
            {activeTab === 'subscription' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-amber text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <CreditCard size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Planes y Licencia Activa</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta los detalles de tu plan contratado, límites de cuota y fechas de vigencia.</p>
                  </div>
                </div>

                <div className="surface-panel p-7 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan Contratado</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{subscription?.plan_name || 'Plan Developer'}</span>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cuota de Mensajes Mensual</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {subscription?.messages_used || 0} / {subscription?.messages_limit || 1000} ({subscription?.consumption_percentage || 0}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Capacidad de Instancias</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeInstancesCount} / {maxInstances === 99 ? 'ILIMITADO' : maxInstances} Líneas</span>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Fecha de Inicio</span>
                    <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Fecha de Vencimiento</span>
                    <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 surface-interactive rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estado de la Licencia</span>
                    {subscription?.is_expired ? (
                      <span className="px-2.5 py-0.5 bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-full uppercase">
                        🔴 LICENCIA VENCIDA
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase">
                        ● {subscription?.days_remaining || 0} DÍAS RESTANTES
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUPERADMIN VIEWS */}
            {user?.role === 'admin' && activeTab === 'admin_overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    <Shield size={11} />
                    <span>Panel de Control Global SaaS</span>
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Resumen Global de la Plataforma
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                    Monitoreo en tiempo real de infraestructura, clientes corporativos y líneas de WhatsApp activas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="surface-panel p-6 rounded-2xl space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Clientes</span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{adminUsers.length}</div>
                    <p className="text-xs text-slate-400 font-medium">Usuarios corporativos</p>
                  </div>
                  
                  <div className="surface-panel p-6 rounded-2xl space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Líneas Registradas</span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{adminInstances.length}</div>
                    <p className="text-xs text-slate-400 font-medium">Instancias en sistema</p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {adminInstances.filter(i => i.status === 'connected').length}
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Gateway en línea</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal QR Code */}
      {qrCodeModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-black/40 dark:shadow-black/70 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Escanear Código QR</h3>
              <button onClick={() => setQrCodeModal({ open: false, instanceName: '', qrCode: null })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl text-slate-400 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 bg-white rounded-2xl flex items-center justify-center min-h-[220px]">
              {qrCodeModal.qrCode ? (
                <img src={qrCodeModal.qrCode} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
              ) : (
                <div className="space-y-2 text-slate-400 text-xs">
                  <RefreshCw size={22} className="animate-spin mx-auto text-emerald-500" />
                  <p>Generando código QR...</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Abre WhatsApp ➔ Dispositivos vinculados ➔ Vincular un dispositivo.</p>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación Premium */}
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
