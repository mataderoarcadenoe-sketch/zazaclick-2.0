// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutGrid, Terminal, 
  Moon, Sun, Menu, X, Play, Shield, Globe, Activity, ArrowRight, Building, Users, Server, Cpu, Zap
} from 'lucide-react';

import { AsyncOperationModal, type AsyncStep, type AsyncStatus } from '../components/AsyncOperationModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // State Management - WhatsApp API SaaS Core
  const [activeTab, setActiveTab] = useState<string>(user?.role === 'admin' ? 'admin_overview' : 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Máquina de Estados de Operaciones Asíncronas (Senior Full-Stack Architecture)
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
  const [loadingInstances, setLoadingInstances] = useState(false);
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

  // Playground API (Probar Envío)
  const [playgroundInstance, setPlaygroundInstance] = useState('');
  const [playgroundPhone, setPlaygroundPhone] = useState('');
  const [playgroundMessage, setPlaygroundMessage] = useState('Hola! Este es un mensaje de prueba enviado desde la API de WhatsApp Zaza.click.');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);

  // Documentación API
  const [docLang, setDocLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');

  // Notificaciones Toast
  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

    console.log(`🔄 [QR Polling] Iniciando monitoreo de conexión para: ${qrCodeModal.instanceName}`);

    const intervalId = setInterval(async () => {
      try {
        const res = await api.get(`/instances/${qrCodeModal.instanceName}/status`);
        if (res.data?.success && res.data.isConnected) {
          console.log(`✅ [QR Polling] Conexión detectada exitosamente para ${qrCodeModal.instanceName}`);
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

  // Manejadores de Instancias WhatsApp con Máquina de Estados Operacional
  const handleCreateInstance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const instanceName = newInstanceName.trim();
    if (!instanceName) {
      showNotification('Ingresa un nombre para la línea/instancia', 'error');
      return;
    }

    // Prevenir peticiones duplicadas / doble submit
    if (asyncOp.open && asyncOp.status !== 'idle' && asyncOp.status !== 'error' && asyncOp.status !== 'timeout') {
      return;
    }

    const initialSteps: AsyncStep[] = [
      { id: '1', label: 'Enviando solicitud de creación al servidor', status: 'active' },
      { id: '2', label: 'Inicializando motor WhatsApp API (Evolution Engine)', status: 'pending' },
      { id: '3', label: 'Guardando credenciales y generador de API Key en PostgreSQL', status: 'pending' }
    ];

    setAsyncOp({
      open: true,
      title: `Creando Instancia "${instanceName}"`,
      subtitle: 'Por favor espera mientras configuramos tu nueva línea WhatsApp API.',
      status: 'submitting',
      steps: initialSteps,
      errorMessage: null,
      successMessage: null,
      onRetry: () => handleCreateInstance()
    });

    // Timeout preventivo de 25 segundos
    const timeoutId = setTimeout(() => {
      setAsyncOp(prev => {
        if (prev.status === 'success' || prev.status === 'error') return prev;
        return {
          ...prev,
          status: 'timeout',
          errorMessage: 'La operación está tomando más tiempo del habitual. La instancia se está configurando en segundo plano en el servidor.',
          steps: prev.steps.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s)
        };
      });
    }, 25000);

    try {
      setLoadingInstances(true);

      setAsyncOp(prev => ({
        ...prev,
        status: 'processing',
        steps: [
          { ...prev.steps[0], status: 'completed' },
          { ...prev.steps[1], status: 'active', detail: 'Conectando con el clúster de Evolution API...' },
          prev.steps[2]
        ]
      }));

      const res = await api.post('/instances', { instanceName });
      clearTimeout(timeoutId);

      if (res.data?.success) {
        setAsyncOp(prev => ({
          ...prev,
          status: 'success',
          steps: [
            { ...prev.steps[0], status: 'completed' },
            { ...prev.steps[1], status: 'completed' },
            { ...prev.steps[2], status: 'completed' }
          ],
          successMessage: `¡La línea "${instanceName}" ha sido creada exitosamente! Puedes generar su código QR para conectar WhatsApp.`
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
      clearTimeout(timeoutId);
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

  // Modal de Confirmación Personalizado (Sin diálogos nativos de navegador)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: () => {}
  });

  const handleDeleteInstance = (instanceName: string) => {
    setConfirmModal({
      open: true,
      title: 'Eliminar Instancia',
      message: `¿Estás seguro de que deseas eliminar la instancia "${instanceName}"? Esta acción eliminará permanentemente la conexión de WhatsApp y no se podrá deshacer.`,
      type: 'danger',
      confirmText: 'Eliminar Instancia',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          setLoadingInstances(true);
          const res = await api.delete(`/instances/${instanceName}`);
          if (res.data?.success) {
            showNotification('Instancia eliminada correctamente', 'success');
            fetchInstances();
          } else {
            showNotification(res.data?.error || 'No se pudo eliminar la instancia', 'error');
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al eliminar la instancia', 'error');
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

  const handleDisconnectInstance = async (instanceName: string) => {
    try {
      const res = await api.post(`/instances/${instanceName}/logout`);
      if (res.data?.success) {
        showNotification('Línea desconectada de WhatsApp');
        fetchInstances();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al desconectar', 'error');
    }
  };

  // Manejador del Tester API (Playground)
  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInstance || !playgroundPhone || !playgroundMessage) {
      showNotification('Completa la instancia, número de teléfono y mensaje', 'error');
      return;
    }

    try {
      setPlaygroundLoading(true);
      setPlaygroundResponse(null);

      const targetInst = instances.find(i => i.instance_name === playgroundInstance);
      const apiKey = targetInst?.api_key || 'tu_api_key';

      const res = await api.post('/webhooks/send-text', {
        instanceName: playgroundInstance,
        number: playgroundPhone,
        text: playgroundMessage
      }, {
        headers: {
          'x-api-key': apiKey
        }
      });

      setPlaygroundResponse(res.data);
      if (res.data?.success) {
        showNotification('Mensaje enviado exitosamente vía API');
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

  // Navegación Minimalista - 100% API WhatsApp & SuperAdmin
  const menuItems = [
    ...(user?.role === 'admin' ? [
      { id: 'admin_overview', label: 'Resumen Global', icon: LayoutGrid },
      { id: 'admin_users', label: 'Empresas / Clientes', icon: Building },
      { id: 'admin_instances', label: 'Líneas Totales', icon: Smartphone },
    ] : []),

    ...(user?.role !== 'admin' ? [
      { id: 'overview', label: 'Dashboard API', icon: LayoutGrid },
      { id: 'instances', label: 'Instancias / QR', icon: Smartphone },
      { id: 'playground', label: 'Tester de API', icon: Play },
      { id: 'docs', label: 'Documentación API', icon: Terminal },
      { id: 'subscription', label: 'Planes y Suscripción', icon: Key },
    ] : [])
  ];

  const currentBackendUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : 'https://zaza-click-20-production.up.railway.app';

  const activeInstancesCount = instances.filter(i => i.status === 'connected').length;
  const maxInstances = subscription?.max_instances || 1;

  // Código de ejemplo para documentación API
  const getDocCode = () => {
    const selectedInst = instances[0] || { instance_name: 'mi_linea_whatsapp', api_key: 'tu_api_key_aqui' };

    if (docLang === 'curl') {
      return `curl -X POST "${currentBackendUrl}/api/webhooks/send-text" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${selectedInst.api_key}" \\
  -d '{
    "instanceName": "${selectedInst.instance_name}",
    "number": "51912345678",
    "text": "Hola! Mensaje enviado desde la API de WhatsApp."
  }'`;
    }

    if (docLang === 'js') {
      return `const response = await fetch("${currentBackendUrl}/api/webhooks/send-text", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${selectedInst.api_key}"
  },
  body: JSON.stringify({
    instanceName: "${selectedInst.instance_name}",
    number: "51912345678",
    text: "Hola! Mensaje enviado desde la API de WhatsApp."
  })
});

const data = await response.json();
console.log(data);`;
    }

    if (docLang === 'python') {
      return `import requests

url = "${currentBackendUrl}/api/webhooks/send-text"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${selectedInst.api_key}"
}
payload = {
    "instanceName": "${selectedInst.instance_name}",
    "number": "51912345678",
    "text": "Hola! Mensaje enviado desde la API de WhatsApp."
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    }

    if (docLang === 'php') {
      return `<?php
$ch = curl_init("${currentBackendUrl}/api/webhooks/send-text");
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'x-api-key: ${selectedInst.api_key}'
));
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array(
    'instanceName' => '${selectedInst.instance_name}',
    'number' => '51912345678',
    'text' => 'Hola! Mensaje enviado desde la API de WhatsApp.'
)));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
    }
    return '';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-300 font-sans overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn backdrop-blur-xl border shadow-xl ${
          notification.type === 'success'
            ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200 dark:bg-emerald-950/95 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-rose-50/95 text-rose-800 border-rose-200 dark:bg-rose-950/95 dark:text-rose-300 dark:border-rose-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Institutional */}
      <aside 
        className={`bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 z-50 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'} border-b border-slate-100 dark:border-slate-800/80`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Smartphone size={18} />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza.click <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">2.0</span>
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">WhatsApp API</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Alternar barra lateral"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-hide">
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
                  sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                } rounded-2xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon 
                  size={19} 
                  className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {sidebarOpen ? (
                  <span className="ml-3.5 text-xs tracking-tight">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 cursor-pointer`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen ? (
              <span className="ml-3 text-xs font-bold">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Area Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-20">
        
        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                {menuItems.find(i => i.id === activeTab)?.label || 'Consola de WhatsApp API'}
              </h2>
              <p className="text-[11px] text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">
                Gateway REST, enrutamiento multi-inquilino y webhooks en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Status Live Tag */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">GATEWAY OPERATIVO</span>
            </div>

            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDark}
              className="p-2.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
            </button>

            {/* Profile badge */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20 uppercase">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body Canvas */}
        <main className="flex-1 bg-[#F8FAFC] dark:bg-[#070B12] bg-grid-tech relative overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* DASHBOARD API OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                {/* Hero Greeting Header Banner */}
                <div className="p-6 sm:p-8 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="space-y-2 text-left relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Motor Evolution API v2 · Redis Core</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Dashboard de WhatsApp API
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-normal">
                      Conecta tus números de WhatsApp, emite credenciales <code className="text-emerald-600 dark:text-emerald-400 font-bold">x-api-key</code> y monitorea tus webhooks en tiempo real.
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap relative z-10">
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Crear Línea</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('playground')}
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Play size={16} />
                      <span>Probar Envíos</span>
                    </button>
                  </div>

                  {/* Backdrop lights */}
                  <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
                </div>

                {/* KPI Metrics Telemetry Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  
                  {/* Instancias Conectadas */}
                  <div className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                      {activeInstancesCount} <span className="text-base font-normal text-slate-400">/ {maxInstances === 99 ? '∞' : maxInstances}</span>
                    </div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{activeInstancesCount > 0 ? 'Conexión activa con WhatsApp' : 'Sin líneas vinculadas'}</span>
                    </p>
                  </div>

                  {/* Estado del Servicio */}
                  <div className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado del Gateway</span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      99.99%
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
                      Latencia de red &lt; 42ms
                    </p>
                  </div>

                  {/* Base Endpoint URL */}
                  <div className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2 min-w-0">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL Endpoint</span>
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate pt-1" title={currentBackendUrl}>
                      {currentBackendUrl}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(currentBackendUrl)} 
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1 block cursor-pointer"
                    >
                      Copiar URL Base ➔
                    </button>
                  </div>

                  {/* Documentación */}
                  <div className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suscripción Activa</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white uppercase truncate pt-1">
                      {subscription?.plan_name || 'Plan Básico'}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveTab('subscription')} 
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline pt-1 block cursor-pointer"
                    >
                      Ver Detalle de Licencia ➔
                    </button>
                  </div>

                </div>

                {/* Secciones de Acción Rápida */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  
                  {/* Instancias */}
                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-4 text-left hover:border-emerald-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                      <Smartphone size={22} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Conecta tus Líneas</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                        Vincula tu número de teléfono escaneando el código QR oficial de WhatsApp Web.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Gestionar Instancias</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Playground */}
                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-4 text-left hover:border-teal-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                      <Play size={22} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Tester de API</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                        Simula peticiones HTTP POST en tiempo real enviando mensajes a tu propio WhatsApp.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('playground')}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Probar Envíos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Documentación */}
                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-4 text-left hover:border-cyan-500/40 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                      <Terminal size={22} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">3. Código & Webhooks</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                        Consulta ejemplos listos en cURL, Node.js, Python y PHP para integrar en tu software.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('docs')}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Ver Ejemplos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* INSTANCIAS / LÍNEAS WHATSAPP */}
            {activeTab === 'instances' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Instancias y Conexiones WhatsApp</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Crea nuevas conexiones de API o escanea el código QR para vincular tus líneas.</p>
                </div>

                {/* Formulario de Creación */}
                <div className="p-6 sm:p-8 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crear Nueva Instancia API</h3>
                  <form onSubmit={handleCreateInstance} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="nombre_de_instancia (ej: ventas_lima)"
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#070B12] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={loadingInstances}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] shadow-lg shadow-emerald-500/20"
                    >
                      <Plus size={16} />
                      <span>Crear Instancia</span>
                    </button>
                  </form>
                </div>

                {/* Grid de Instancias */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus Instancias ({instances.length})</h3>

                  {instances.length === 0 ? (
                    <div className="p-12 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl text-center space-y-4 shadow-md">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                        <Smartphone size={32} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">No tienes instancias de WhatsApp creadas</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Ingresa un nombre arriba para crear tu primera línea de API y comenzar a enviar mensajes.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {instances.map((inst) => (
                        <div key={inst.id || inst.instance_name} className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-5 text-left hover:border-emerald-500/40 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-mono font-bold text-slate-900 dark:text-white">{inst.instance_name}</h4>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{inst.phone || 'Sin número vinculado'}</span>
                            </div>

                            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                              inst.status === 'connected' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60' 
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                            }`}>
                              {inst.status === 'connected' ? '● CONECTADO' : '○ DESCONECTADO'}
                            </span>
                          </div>

                          {/* API Key */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">API Key de Instancia</span>
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-[#070B12] border border-slate-200/60 dark:border-slate-800/60 px-3.5 py-2.5 rounded-2xl">
                              <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate mr-2">{inst.api_key}</code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inst.api_key)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-emerald-600 transition-colors"
                                title="Copiar API Key"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-3 pt-1">
                            {inst.status === 'connected' ? (
                              <button
                                type="button"
                                onClick={() => handleDisconnectInstance(inst.instance_name)}
                                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold rounded-2xl transition-all cursor-pointer"
                              >
                                Desconectar Línea
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleGetQrCode(inst.instance_name)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                              >
                                <Smartphone size={15} />
                                <span>Escanear Código QR</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Eliminar Instancia"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TESTER DE API (PLAYGROUND) */}
            {activeTab === 'playground' && (
              <div className="space-y-8 animate-fadeIn text-left">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Tester Interactivo de API</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Simula el envío de mensajes de WhatsApp mediante peticiones HTTP POST reales.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-xl space-y-6">
                  <form onSubmit={handleTestSend} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Instancia WhatsApp</label>
                        <select
                          value={playgroundInstance}
                          onChange={(e) => setPlaygroundInstance(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-[#070B12] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          {instances.length === 0 && <option value="">Sin instancias creadas</option>}
                          {instances.map(i => (
                            <option key={i.instance_name} value={i.instance_name}>{i.instance_name} ({i.status})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Número de Destino (con código de país)</label>
                        <input
                          type="text"
                          value={playgroundPhone}
                          onChange={(e) => setPlaygroundPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="ej: 51912345678"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-[#070B12] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Mensaje de Texto</label>
                      <textarea
                        rows={3}
                        value={playgroundMessage}
                        onChange={(e) => setPlaygroundMessage(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-[#070B12] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-normal text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={playgroundLoading || instances.length === 0}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      <Send size={15} />
                      <span>{playgroundLoading ? 'Enviando petición...' : 'Ejecutar Envío de Prueba'}</span>
                    </button>
                  </form>

                  {/* Respuesta HTTP */}
                  {playgroundResponse && (
                    <div className="space-y-2 pt-4">
                      <span className="text-xs font-bold text-slate-400 uppercase block">Respuesta HTTP de la API:</span>
                      <pre className="p-5 bg-[#090D16] text-emerald-400 rounded-3xl text-xs font-mono overflow-x-auto border border-emerald-500/20">
                        {JSON.stringify(playgroundResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DOCUMENTACIÓN API */}
            {activeTab === 'docs' && (
              <div className="space-y-8 animate-fadeIn text-left">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Documentación de la API REST</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Integra el envío y recepción de WhatsApp en tu software propio mediante peticiones HTTP estándar.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-xl space-y-6">
                  {/* Lenguajes */}
                  <div className="flex items-center gap-2">
                    {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setDocLang(lang)}
                        className={`px-4 py-2 text-xs font-bold uppercase rounded-2xl transition-all cursor-pointer ${
                          docLang === lang 
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>

                  {/* Bloque de Código */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Endpoint: POST /api/webhooks/send-text</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(getDocCode())}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>Copiar Código</span>
                      </button>
                    </div>
                    <pre className="p-5 bg-[#090D16] text-slate-100 rounded-3xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                      {getDocCode()}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* PLANES Y SUSCRIPCIÓN */}
            {activeTab === 'subscription' && (
              <div className="space-y-8 animate-fadeIn text-left">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planes y Licencia Activa</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta los detalles de tu plan contratado e instancias autorizadas.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-xl space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500">Plan Contratado</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{subscription?.plan_name || 'Plan Básico'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500">Capacidad de Instancias</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{activeInstancesCount} / {maxInstances === 99 ? 'ILIMITADO' : maxInstances} Líneas</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs font-bold text-slate-500">Estado del Servicio</span>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase border border-emerald-200 dark:border-emerald-800/60">
                        ● LICENCIA ACTIVA
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUPERADMIN VIEWS */}
            {user?.role === 'admin' && activeTab === 'admin_overview' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                {/* Hero Editorial Admin */}
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold rounded-full">
                    <Shield size={12} />
                    <span>Panel de Control Global SaaS</span>
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Resumen Global de la Plataforma
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-normal leading-relaxed">
                    Monitoreo en tiempo real de infraestructura, clientes corporativos y líneas de WhatsApp activas.
                  </p>
                </div>

                {/* Métricas KPI Admin */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Clientes / Empresas</span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{adminUsers.length}</div>
                    <p className="text-xs font-medium text-slate-400 pt-1">Usuarios corporativos activos</p>
                  </div>
                  
                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Registradas</span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{adminInstances.length}</div>
                    <p className="text-xs font-medium text-slate-400 pt-1">Instancias totales en sistema</p>
                  </div>

                  <div className="p-7 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-md space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {adminInstances.filter(i => i.status === 'connected').length}
                    </div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">Gateway en línea</p>
                  </div>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal QR Code */}
      {qrCodeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Escanear Código QR</h3>
              <button onClick={() => setQrCodeModal({ open: false, instanceName: '', qrCode: null })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 bg-white rounded-2xl flex items-center justify-center min-h-[220px] border border-slate-100">
              {qrCodeModal.qrCode ? (
                <img src={qrCodeModal.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <div className="space-y-2 text-slate-400 text-xs">
                  <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500" />
                  <p>Generando código QR...</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Abre WhatsApp en tu teléfono ➔ Dispositivos vinculados ➔ Vincular un dispositivo.</p>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Personalizado (Reemplazo total de window.confirm) */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-left space-y-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                confirmModal.type === 'danger'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : confirmModal.type === 'warning'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400'
              }`}>
                <AlertCircle size={20} />
              </div>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                {confirmModal.message}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl transition-all cursor-pointer min-h-[44px]"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>

              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2.5 text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer min-h-[44px] ${
                  confirmModal.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Operaciones Asíncronas con Máquina de Estados */}
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
