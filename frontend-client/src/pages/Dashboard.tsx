// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutGrid, Terminal, 
  Moon, Sun, Menu, X, Check, Play, ExternalLink, Sparkles, BookOpen, Clock,
  Building, Phone, Shield, Zap, Globe, Activity, Layers, ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // State Management - WhatsApp API & Platform Core
  const [activeTab, setActiveTab] = useState<string>(user?.role === 'admin' ? 'admin_overview' : 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Instancias / Líneas WhatsApp
  const [instances, setInstances] = useState<any[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<{ open: boolean; instanceName: string; qrCode: string | null }>({
    open: false,
    instanceName: '',
    qrCode: null
  });

  // Configuración de Webhooks por instancia
  const [webhookModal, setWebhookModal] = useState<{ open: boolean; instanceName: string; webhookUrl: string; enabled: boolean }>({
    open: false,
    instanceName: '',
    webhookUrl: '',
    enabled: true
  });
  const [webhookSaving, setWebhookSaving] = useState(false);

  // Suscripción & Planes
  const [subscription, setSubscription] = useState<any>(null);

  // SuperAdmin Data
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminInstances, setAdminInstances] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);

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
    showNotification('¡Copiado al portapapeles!');
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
      setAdminLoading(true);
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
    } finally {
      setAdminLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchInstances();
    fetchSubscription();
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [fetchInstances, fetchSubscription, fetchAdminData, user?.role]);

  // Manejadores de Instancias WhatsApp
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) {
      showNotification('Ingresa un nombre para la línea/instancia', 'error');
      return;
    }

    try {
      setLoadingInstances(true);
      const res = await api.post('/instances', { instanceName: newInstanceName.trim() });
      if (res.data?.success) {
        showNotification('¡Línea WhatsApp creada exitosamente!');
        setNewInstanceName('');
        fetchInstances();
      } else {
        showNotification(res.data?.error || 'No se pudo crear la instancia', 'error');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al crear la instancia', 'error');
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la instancia "${instanceName}"?`)) return;

    try {
      setLoadingInstances(true);
      const res = await api.delete(`/instances/${instanceName}`);
      if (res.data?.success) {
        showNotification('Instancia eliminada correctamente');
        fetchInstances();
      } else {
        showNotification(res.data?.error || 'No se pudo eliminar la instancia', 'error');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al eliminar la instancia', 'error');
    } finally {
      setLoadingInstances(false);
    }
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
        showNotification('¡Mensaje enviado exitosamente vía API!');
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

  // Navegación Simplificada - 100% Enfocada en API de WhatsApp
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

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Spacer */}
      <div className="hidden lg:block w-20 flex-shrink-0 transition-all duration-300" />

      {/* Sidebar */}
      <aside 
        className={`bg-[#232b45] dark:bg-[#0b0f19] flex flex-col transition-all duration-300 shadow-premium z-50 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-[#2e3757] dark:border-slate-800/80`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-md shadow-brand-primary/25">
                <Smartphone size={18} />
              </div>
              <span className="font-semibold text-white tracking-wide">
                Zaza.click <span className="text-zinc-400">API</span>
              </span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
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
                } rounded-2xl transition-all duration-300 relative cursor-pointer ${
                  active 
                    ? 'bg-brand-primary text-white font-bold'
                    : 'text-slate-300 dark:text-surface-400 hover:bg-white/5 hover:text-white font-medium'
                }`}
              >
                <Icon 
                  size={20} 
                  className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {sidebarOpen ? (
                  <span className="ml-3.5 text-[13.5px] tracking-wide">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-[#2e3757] dark:border-slate-800/80 bg-[#232b45] dark:bg-[#0b0f19]">
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
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-[#1a2035] text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-[#232b45] dark:bg-[#0b0f19] text-white border-b border-[#2e3757] dark:border-slate-800/80 px-6 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight">
                {menuItems.find(i => i.id === activeTab)?.label || 'Plataforma WhatsApp API'}
              </h2>
              <p className="text-[9px] sm:text-[10px] text-slate-300 font-medium leading-none mt-0.5 hidden sm:block">
                Servicio profesional de API de WhatsApp, conexiones e integración de webhooks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDark}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-300" />}
            </button>

            {/* Profile badge */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30 flex items-center justify-center font-bold text-xs">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 bg-transparent relative p-4 sm:p-6 lg:p-6 overflow-y-auto">
          <div className="w-full space-y-6">
            
            {/* DASHBOARD API OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Active License Banner */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl text-white">
                  <div className="space-y-2 text-left relative z-10">
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-[9px] font-bold text-white uppercase tracking-widest flex items-center gap-1.5 w-fit">
                      <Shield size={12} className="text-emerald-400" />
                      <span>Licencia Activa de API</span>
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {subscription?.plan_name?.toLowerCase().startsWith('plan') ? subscription.plan_name : `Plan ${subscription?.plan_name || 'Básico'}`}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xl font-medium">
                      Conecta tus líneas de WhatsApp, obtén credenciales de API para integración REST y configura tus Webhooks de envío y recepción.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-brand-primary/20 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      <span>Conectar Nueva Línea</span>
                    </button>
                  </div>
                </div>

                {/* KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Instancias Conectadas */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                        {activeInstancesCount} / <span className="text-slate-400">{maxInstances === 99 ? '∞' : maxInstances}</span>
                      </h4>
                      <span className="text-[10px] font-semibold text-emerald-500 mt-0.5 block">
                        {activeInstancesCount > 0 ? '● API Operativa' : '○ Sin líneas activas'}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                      <Smartphone size={22} />
                    </div>
                  </div>

                  {/* Estado del Servicio */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado del Gateway</span>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white mt-1">ONLINE</h4>
                      <span className="text-[10px] font-semibold text-sky-500 mt-0.5 block">Latencia &lt; 45ms</span>
                    </div>
                    <div className="p-3 bg-sky-500/10 text-sky-500 rounded-2xl">
                      <Activity size={22} />
                    </div>
                  </div>

                  {/* Base Endpoint URL */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Endpoint</span>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-white mt-1 truncate" title={currentBackendUrl}>
                        {currentBackendUrl}
                      </p>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(currentBackendUrl)} 
                        className="text-[10px] font-bold text-brand-primary hover:underline mt-0.5 block cursor-pointer"
                      >
                        Copiar URL Base
                      </button>
                    </div>
                    <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl shrink-0">
                      <Globe size={22} />
                    </div>
                  </div>

                  {/* Documentación */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documentación</span>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white mt-1">REST & Webhooks</h4>
                      <button 
                        type="button" 
                        onClick={() => setActiveTab('docs')} 
                        className="text-[10px] font-bold text-brand-primary hover:underline mt-0.5 block cursor-pointer"
                      >
                        Ver Guía Completa ➔
                      </button>
                    </div>
                    <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl">
                      <Terminal size={22} />
                    </div>
                  </div>

                </div>

                {/* Accesos Rápidos de la API */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                      <Smartphone size={20} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">1. Conecta tu Línea</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Escanea el código QR de WhatsApp Web para vincular tu número de teléfono a la API.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('instances')}
                      className="text-xs font-extrabold text-brand-primary flex items-center gap-1 hover:underline cursor-pointer pt-1"
                    >
                      <span>Ir a Instancias</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                      <Play size={20} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">2. Pruebas de Envío</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Utiliza nuestro Tester interactivo para simular el envío de mensajes mediante HTTP POST.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('playground')}
                      className="text-xs font-extrabold text-brand-primary flex items-center gap-1 hover:underline cursor-pointer pt-1"
                    >
                      <span>Abrir Tester API</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                      <Terminal size={20} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">3. Integra Webhooks</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Configura el Webhook URL de tu servidor para recibir los mensajes entrantes en tiempo real.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('docs')}
                      className="text-xs font-extrabold text-brand-primary flex items-center gap-1 hover:underline cursor-pointer pt-1"
                    >
                      <span>Ver Ejemplos de Código</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* INSTANCIAS / LÍNEAS WHATSAPP */}
            {activeTab === 'instances' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Formulario de Creación de Instancia */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">Crear Nueva Instancia API</h3>
                      <p className="text-xs text-slate-400 font-medium">Asigna un nombre a tu nueva línea de WhatsApp (ej: ventas_lima, soporte_tienda).</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateInstance} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="nombre_de_instancia (solo letras minusculas y _)"
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <button
                      type="submit"
                      disabled={loadingInstances}
                      className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-primary/20"
                    >
                      <Plus size={16} />
                      <span>Crear Instancia</span>
                    </button>
                  </form>
                </div>

                {/* Lista de Instancias */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Tus Instancias WhatsApp ({instances.length})</h3>

                  {instances.length === 0 ? (
                    <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl text-center space-y-3">
                      <Smartphone size={40} className="mx-auto text-slate-300 dark:text-slate-700" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No tienes instancias de WhatsApp creadas</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">Ingresa un nombre arriba para crear tu primera conexión de API.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {instances.map((inst) => (
                        <div key={inst.id || inst.instance_name} className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm relative">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                <Smartphone size={16} />
                              </div>
                              <div>
                                <h4 className="text-xs font-mono font-bold text-slate-800 dark:text-white">{inst.instance_name}</h4>
                                <span className="text-[10px] text-slate-400 font-medium">{inst.phone || 'Sin número vinculado'}</span>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border ${
                              inst.status === 'connected' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}>
                              {inst.status === 'connected' ? 'CONECTADO' : 'DESCONECTADO'}
                            </span>
                          </div>

                          {/* API Key & Acciones */}
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div className="min-w-0 mr-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">API Key de Instancia</span>
                                <code className="text-[10.5px] font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">{inst.api_key}</code>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inst.api_key)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                                title="Copiar API Key"
                              >
                                <Copy size={14} />
                              </button>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              {inst.status === 'connected' ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectInstance(inst.instance_name)}
                                  className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                >
                                  Desconectar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleGetQrCode(inst.instance_name)}
                                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Smartphone size={14} />
                                  <span>Escanear QR</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteInstance(inst.instance_name)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors cursor-pointer"
                                title="Eliminar Instancia"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
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
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Play size={18} className="text-brand-primary" />
                      <span>Tester Interactivo de API (Probar Envío)</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Ejecuta peticiones HTTP POST reales enviando mensajes a tu propio WhatsApp a través de la API.</p>
                  </div>

                  <form onSubmit={handleTestSend} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Seleccionar Instancia</label>
                        <select
                          value={playgroundInstance}
                          onChange={(e) => setPlaygroundInstance(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                        >
                          {instances.length === 0 && <option value="">Sin instancias creadas</option>}
                          {instances.map(i => (
                            <option key={i.instance_name} value={i.instance_name}>{i.instance_name} ({i.status})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Número de Destino (con código de país)</label>
                        <input
                          type="text"
                          value={playgroundPhone}
                          onChange={(e) => setPlaygroundPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="51912345678"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mensaje de Texto</label>
                      <textarea
                        rows={3}
                        value={playgroundMessage}
                        onChange={(e) => setPlaygroundMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={playgroundLoading || instances.length === 0}
                      className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-primary/20 disabled:opacity-50"
                    >
                      <Send size={14} />
                      <span>{playgroundLoading ? 'Enviando petición...' : 'Ejecutar Envío de Prueba'}</span>
                    </button>
                  </form>

                  {/* Respuesta de la API */}
                  {playgroundResponse && (
                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Respuesta HTTP de la API:</span>
                      <pre className="p-4 bg-slate-950 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto">
                        {JSON.stringify(playgroundResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DOCUMENTACIÓN API */}
            {activeTab === 'docs' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Terminal size={18} className="text-brand-primary" />
                      <span>Guía de Integración REST & Webhooks</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Integra el servicio de WhatsApp en tu sistema ERP, CRM o software propio mediante peticiones HTTP.</p>
                  </div>

                  {/* Selector de Lenguaje */}
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setDocLang(lang)}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer ${
                          docLang === lang 
                            ? 'bg-brand-primary text-white shadow-sm' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>

                  {/* Bloque de Código */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Endpoint: POST /api/webhooks/send-text</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(getDocCode())}
                        className="text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={12} />
                        <span>Copiar Código</span>
                      </button>
                    </div>
                    <pre className="p-4 bg-slate-950 text-slate-100 rounded-2xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                      {getDocCode()}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* PLANES Y SUSCRIPCIÓN */}
            {activeTab === 'subscription' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Key size={18} className="text-brand-primary" />
                    <span>Tu Plan y Licencia Activa</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Información de tu suscripción actual y capacidad de conexiones WhatsApp API.</p>

                  <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Plan Contratado</span>
                      <span className="text-sm font-black text-brand-primary uppercase">{subscription?.plan_name || 'Plan Básico'}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 pt-2">
                      <span className="text-xs font-bold text-slate-500">Límites de Instancias</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{activeInstancesCount} / {maxInstances === 99 ? 'ILIMITADO' : maxInstances} Líneas</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 pt-2">
                      <span className="text-xs font-bold text-slate-500">Estado</span>
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-md border border-emerald-500/20 uppercase">ACTIVO</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUPERADMIN VIEWS */}
            {user?.role === 'admin' && activeTab === 'admin_overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Resumen Global SaaS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Empresas</span>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{adminUsers.length}</h4>
                  </div>
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Líneas Registradas</span>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{adminInstances.length}</h4>
                  </div>
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Líneas Conectadas</span>
                    <h4 className="text-2xl font-black text-emerald-500 mt-1">{adminInstances.filter(i => i.status === 'connected').length}</h4>
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'admin' && activeTab === 'admin_users' && (
              <div className="space-y-4 animate-fadeIn text-left">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Gestión de Clientes SaaS</h3>
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Rol</th>
                        <th className="p-4">Fecha Registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{u.email}</td>
                          <td className="p-4"><span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded-md uppercase">{u.role}</span></td>
                          <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {user?.role === 'admin' && activeTab === 'admin_instances' && (
              <div className="space-y-4 animate-fadeIn text-left">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Todas las Instancias del Sistema</h3>
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-4">Nombre Instancia</th>
                        <th className="p-4">Cliente (User ID)</th>
                        <th className="p-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adminInstances.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">{inst.instance_name}</td>
                          <td className="p-4 text-slate-400 font-mono">{inst.user_id}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${inst.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {inst.status}
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
        </main>
      </div>

      {/* Modal QR Code */}
      {qrCodeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Escanear Código QR</h3>
              <button onClick={() => setQrCodeModal({ open: false, instanceName: '', qrCode: null })} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-center min-h-[220px]">
              {qrCodeModal.qrCode ? (
                <img src={qrCodeModal.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <div className="space-y-2 text-slate-400 text-xs">
                  <RefreshCw size={24} className="animate-spin mx-auto text-brand-primary" />
                  <p>Generando código QR...</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 font-medium">Abre WhatsApp en tu teléfono ➔ Dispositivos vinculados ➔ Vincular un dispositivo.</p>
          </div>
        </div>
      )}

    </div>
  );
}
