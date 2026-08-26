// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutGrid, Terminal, 
  Moon, Sun, Menu, X, Play, Shield, Globe, Activity, ArrowRight, Building
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // State Management - WhatsApp API SaaS Core
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
        showNotification('Línea WhatsApp creada exitosamente');
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

  // Navegación Minimalista - 100% API WhatsApp
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
    <div className="flex h-screen mesh-gradient text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-fadeIn ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
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

      {/* Sidebar Spacer */}
      <div className="hidden lg:block w-20 flex-shrink-0 transition-all duration-300" />

      {/* Sidebar Institutional */}
      <aside 
        className={`bg-[#232b45] dark:bg-[#0B0F19] flex flex-col transition-all duration-300 z-50 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-6' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Smartphone size={18} />
              </div>
              <span className="font-semibold text-white text-sm tracking-wide">
                Zaza.click <span className="text-zinc-400 font-normal">API</span>
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
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto scrollbar-hide">
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
                } rounded-xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-slate-300/80 hover:bg-white/5 hover:text-white font-normal'
                }`}
              >
                <Icon 
                  size={19} 
                  className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {sidebarOpen ? (
                  <span className="ml-3.5 text-xs font-medium tracking-wide">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 bg-[#232b45] dark:bg-[#0B0F19]">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-500/20 text-white/70 hover:text-rose-300 transition-all duration-200 cursor-pointer`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen ? (
              <span className="ml-3 text-xs font-medium">Cerrar Sesión</span>
            ) : (
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Area Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header - Canvas Blanco en Modo Claro / Oscuro en Modo Noche */}
        <header className="h-16 bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-white px-4 sm:px-8 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                {menuItems.find(i => i.id === activeTab)?.label || 'Plataforma WhatsApp API'}
              </h2>
              <p className="text-[11px] text-slate-400 font-normal leading-none mt-1 hidden sm:block">
                Servicio profesional de API de WhatsApp, gateway REST e integración de webhooks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDark}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
            </button>

            {/* Profile badge */}
            <div className="flex items-center gap-3 pl-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 dark:text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body Canvas - Centrado Fluido Responsivo */}
        <main className="flex-1 bg-[#F8FAFC] dark:bg-[#0B0F19] relative overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* DASHBOARD API OVERVIEW EDITORIAL */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                {/* Editorial Greeting Header */}
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-medium rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>● API Operativa</span>
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Dashboard API de WhatsApp
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-normal leading-relaxed">
                    Administra tus conexiones, credenciales REST y webhooks de envío y recepción desde un solo lugar.
                  </p>
                </div>

                {/* KPI Metrics Editorial Blocks (Sin Sombras, Sin Bordes) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  
                  {/* Instancias Conectadas */}
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-2">
                    <span className="text-xs font-medium text-slate-400">Líneas Conectadas</span>
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                      {activeInstancesCount} <span className="text-base font-normal text-slate-400">/ {maxInstances === 99 ? '∞' : maxInstances}</span>
                    </div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">
                      {activeInstancesCount > 0 ? 'Conexión activa con WhatsApp' : 'Sin líneas vinculadas'}
                    </p>
                  </div>

                  {/* Estado del Servicio */}
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-2">
                    <span className="text-xs font-medium text-slate-400">Estado del Gateway</span>
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                      100%
                    </div>
                    <p className="text-xs font-medium text-sky-600 dark:text-sky-400 pt-1">
                      Latencia de red &lt; 45ms
                    </p>
                  </div>

                  {/* Base Endpoint URL */}
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-2 min-w-0">
                    <span className="text-xs font-medium text-slate-400">URL Endpoint</span>
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate pt-1" title={currentBackendUrl}>
                      {currentBackendUrl}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(currentBackendUrl)} 
                      className="text-xs font-medium text-slate-900 dark:text-white hover:underline pt-1 block cursor-pointer"
                    >
                      Copiar URL Base ➔
                    </button>
                  </div>

                  {/* Documentación */}
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-2">
                    <span className="text-xs font-medium text-slate-400">Suscripción Activa</span>
                    <div className="text-lg font-bold text-slate-900 dark:text-white truncate pt-1">
                      {subscription?.plan_name || 'Plan Básico'}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveTab('subscription')} 
                      className="text-xs font-medium text-slate-900 dark:text-white hover:underline pt-1 block cursor-pointer"
                    >
                      Ver Detalle de Licencia ➔
                    </button>
                  </div>

                </div>

                {/* Secciones de Superficies Claras (Soft Accents 30%) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  
                  {/* Instancias */}
                  <div className="p-7 bg-[#F0F9FF] dark:bg-slate-900/60 rounded-3xl space-y-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                      <Smartphone size={20} />
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
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>Gestionar Instancias</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Playground */}
                  <div className="p-7 bg-[#ECFDF5] dark:bg-slate-900/60 rounded-3xl space-y-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Play size={20} />
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
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>Probar Envíos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Documentación */}
                  <div className="p-7 bg-[#FAF5FF] dark:bg-slate-900/60 rounded-3xl space-y-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                      <Terminal size={20} />
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
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5"
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
                
                {/* Header editorial */}
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Instancias y Conexiones WhatsApp</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Crea nuevas conexiones de API o escanea el código QR para vincular tus líneas.</p>
                </div>

                {/* Formulario Plano de Creación */}
                <div className="p-6 sm:p-8 bg-white dark:bg-[#111827] rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crear Nueva Instancia API</h3>
                  <form onSubmit={handleCreateInstance} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="nombre_de_instancia (ej: ventas_lima)"
                      className="flex-1 px-4 py-3 bg-slate-100/70 dark:bg-slate-950 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loadingInstances}
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
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
                    <div className="p-12 bg-white dark:bg-[#111827] rounded-3xl text-center space-y-3">
                      <Smartphone size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">No tienes instancias de WhatsApp creadas</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">Ingresa un nombre arriba para crear tu primera línea de API.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {instances.map((inst) => (
                        <div key={inst.id || inst.instance_name} className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-5 text-left">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-mono font-bold text-slate-900 dark:text-white">{inst.instance_name}</h4>
                              <span className="text-xs text-slate-400 font-normal block">{inst.phone || 'Sin número vinculado'}</span>
                            </div>

                            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                              inst.status === 'connected' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {inst.status === 'connected' ? '● CONECTADO' : '○ DESCONECTADO'}
                            </span>
                          </div>

                          {/* API Key */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">API Key de Instancia</span>
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl">
                              <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate mr-2">{inst.api_key}</code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inst.api_key)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
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
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-rose-50 text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                              >
                                Desconectar Línea
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleGetQrCode(inst.instance_name)}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Smartphone size={15} />
                                <span>Escanear Código QR</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteInstance(inst.instance_name)}
                              className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
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
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Tester Interactivo de API</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Simula el envío de mensajes de WhatsApp mediante peticiones HTTP POST reales.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white dark:bg-[#111827] rounded-3xl space-y-6">
                  <form onSubmit={handleTestSend} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Instancia WhatsApp</label>
                        <select
                          value={playgroundInstance}
                          onChange={(e) => setPlaygroundInstance(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-100/70 dark:bg-slate-950 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
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
                          className="w-full px-4 py-3 bg-slate-100/70 dark:bg-slate-950 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Mensaje de Texto</label>
                      <textarea
                        rows={3}
                        value={playgroundMessage}
                        onChange={(e) => setPlaygroundMessage(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-100/70 dark:bg-slate-950 rounded-xl text-xs font-normal text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={playgroundLoading || instances.length === 0}
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                    >
                      <Send size={15} />
                      <span>{playgroundLoading ? 'Enviando petición...' : 'Ejecutar Envío de Prueba'}</span>
                    </button>
                  </form>

                  {/* Respuesta HTTP */}
                  {playgroundResponse && (
                    <div className="space-y-2 pt-4">
                      <span className="text-xs font-bold text-slate-400 uppercase block">Respuesta HTTP de la API:</span>
                      <pre className="p-5 bg-[#090D16] text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Documentación de la API REST</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Integra el envío y recepción de WhatsApp en tu software propio mediante peticiones HTTP estándar.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white dark:bg-[#111827] rounded-3xl space-y-6">
                  {/* Lenguajes */}
                  <div className="flex items-center gap-2">
                    {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setDocLang(lang)}
                        className={`px-4 py-2 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer ${
                          docLang === lang 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
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
                        className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>Copiar Código</span>
                      </button>
                    </div>
                    <pre className="p-5 bg-[#090D16] text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Planes y Licencia Activa</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta los detalles de tu plan contratado e instancias autorizadas.</p>
                </div>

                <div className="p-6 sm:p-8 bg-white dark:bg-[#111827] rounded-3xl space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Plan Contratado</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{subscription?.plan_name || 'Plan Básico'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Capacidad de Instancias</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{activeInstancesCount} / {maxInstances === 99 ? 'ILIMITADO' : maxInstances} Líneas</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Estado del Servicio</span>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase">● LICENCIA ACTIVA</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUPERADMIN VIEWS */}
            {user?.role === 'admin' && activeTab === 'admin_overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resumen Global SaaS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-1">
                    <span className="text-xs font-medium text-slate-400 uppercase">Total Empresas</span>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{adminUsers.length}</div>
                  </div>
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-1">
                    <span className="text-xs font-medium text-slate-400 uppercase">Líneas Registradas</span>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{adminInstances.length}</div>
                  </div>
                  <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl space-y-1">
                    <span className="text-xs font-medium text-slate-400 uppercase">Líneas Conectadas</span>
                    <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{adminInstances.filter(i => i.status === 'connected').length}</div>
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'admin' && activeTab === 'admin_users' && (
              <div className="space-y-4 animate-fadeIn text-left">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de Clientes SaaS</h2>
                <div className="bg-white dark:bg-[#111827] rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold">
                      <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Rol</th>
                        <th className="p-4">Fecha Registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{u.email}</td>
                          <td className="p-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-[10px] font-bold rounded-md uppercase">{u.role}</span></td>
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Todas las Instancias del Sistema</h2>
                <div className="bg-white dark:bg-[#111827] rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold">
                      <tr>
                        <th className="p-4">Nombre Instancia</th>
                        <th className="p-4">Cliente (User ID)</th>
                        <th className="p-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adminInstances.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="p-4 font-mono font-bold text-slate-900 dark:text-slate-200">{inst.instance_name}</td>
                          <td className="p-4 text-slate-400 font-mono">{inst.user_id}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${inst.status === 'connected' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Escanear Código QR</h3>
              <button onClick={() => setQrCodeModal({ open: false, instanceName: '', qrCode: null })} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 bg-white rounded-2xl flex items-center justify-center min-h-[220px]">
              {qrCodeModal.qrCode ? (
                <img src={qrCodeModal.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <div className="space-y-2 text-slate-400 text-xs">
                  <RefreshCw size={24} className="animate-spin mx-auto text-slate-900 dark:text-white" />
                  <p>Generando código QR...</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-normal">Abre WhatsApp en tu teléfono ➔ Dispositivos vinculados ➔ Vincular un dispositivo.</p>
          </div>
        </div>
      )}

    </div>
  );
}
