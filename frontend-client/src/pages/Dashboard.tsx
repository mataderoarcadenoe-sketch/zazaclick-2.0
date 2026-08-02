import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, 
  AlertCircle, Copy, Send, LayoutDashboard, Terminal, 
  Moon, Sun, Menu, X, Check, Play, ExternalLink, Sparkles, BookOpen, Clock
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'playground' | 'docs' | 'subscription'>('overview');

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

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

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
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar instancias');
    } finally {
      setLoading(false);
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

  // Sync testInstance default value
  useEffect(() => {
    if (instances.length > 0 && !testInstance) {
      setTestInstance(instances[0].instance_name);
    }
  }, [instances]);

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

  const handleLogoutInstance = async (instanceName: string) => {
    if (!confirm(`¿Estás seguro de cerrar sesión en la instancia ${instanceName}?`)) return;

    try {
      const res = await api.post(`/instances/logout/${instanceName}`);
      if (res.data?.success) {
        showNotification('Sesión cerrada correctamente.');
        fetchInstances(true);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al cerrar sesión', 'error');
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm(`🚨 ¿Estás seguro de ELIMINAR la instancia ${instanceName}? Esto borrará la sesión de WhatsApp.`)) return;

    try {
      const res = await api.delete(`/instances/delete/${instanceName}`);
      if (res.data?.success) {
        showNotification('Instancia eliminada correctamente.');
        fetchInstances(true);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al eliminar instancia', 'error');
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInstance || !testNumber.trim() || !testText.trim()) return;

    const inst = instances.find(i => i.instance_name === testInstance);
    if (!inst) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await api.post('/instances/send', {
        instanceName: testInstance,
        apiKey: inst.api_key,
        number: testNumber.trim(),
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
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
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

      {/* Sidebar */}
      <aside 
        className={`bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col transition-all duration-300 shadow-premium z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${sidebarOpen ? 'fixed lg:relative h-full' : 'hidden lg:flex'}`}
      >
        {/* Brand header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'} border-b border-slate-200/60 dark:border-slate-800/60`}>
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
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-6 flex items-center justify-between z-30 transition-colors duration-300">
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
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/50 dark:border-emerald-800/20">
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
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-950/40 relative">
          
          {/* Active Section Renderer */}
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Upgrade/Welcome Card Banner */}
                <div className="p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 rounded-3xl border border-emerald-500/20 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
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
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Líneas Vinculadas</span>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                      {instances.length} / <span className="text-slate-400">{maxInstances}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500">Capacidad disponible para crear instancias.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-emerald-500">Instancias Online</span>
                    <h3 className="text-2xl font-bold text-emerald-500">
                      {activeInstancesCount} / <span className="text-slate-400">{instances.length || 0}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500">Números con WhatsApp en línea.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
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
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-4">
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
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl py-20 text-center space-y-4 shadow-sm">
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
                        className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 sm:p-6 shadow-sm hover-lift flex flex-col justify-between gap-5 relative overflow-hidden"
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
                        <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4.5 space-y-2.5 text-xs text-left relative z-10">
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

            {/* PLAYGROUND SECTION */}
            {activeTab === 'playground' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Probar Envío de Mensaje</h3>
                  <p className="text-xs text-slate-400">Verifica el funcionamiento de tus instancias enviándote un mensaje de prueba.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Test Form */}
                  <form onSubmit={handleSendTestMessage} className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seleccionar Instancia</label>
                      <select
                        value={testInstance}
                        onChange={(e) => {
                          setTestInstance(e.target.value);
                          setTestResult(null);
                        }}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                      >
                        <option value="" disabled>Elegir instancia...</option>
                        {instances.map(inst => (
                          <option key={inst.id} value={inst.instance_name}>
                            {inst.instance_name} ({inst.status === 'connected' ? 'Conectada' : 'Desconectada'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Número Destino (con código de país)</label>
                      <input
                        type="text"
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Ej: 51987654321"
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mensaje de Texto</label>
                      <textarea
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        rows={4}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium resize-none"
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm text-left space-y-3">
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

                    <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 rounded-2xl text-left space-y-2">
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

                <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Enviar Mensaje de Texto</span>
                    
                    {/* Language Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 text-[10px] font-bold">
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
                      <pre className="bg-slate-950 text-emerald-400 dark:text-emerald-300 font-mono text-[10.5px] p-4.5 rounded-2xl overflow-x-auto leading-relaxed border border-slate-850 shadow-inner">
                        {getDocCode()}
                      </pre>
                      
                      <button
                        onClick={() => copyToClipboard(getDocCode())}
                        className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg border border-slate-800/40 hover-lift shadow transition-all cursor-pointer opacity-100 group-hover:opacity-100"
                        title="Copiar código"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  {/* API response specifications */}
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/40">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Respuesta Esperada (JSON)</h5>
                    <pre className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-xl font-mono text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto">
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
                  <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm flex flex-col justify-between gap-6">
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

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Para solicitar la ampliación de tu límite de líneas de WhatsApp, modificaciones de plan o cancelación, contacta con tu administrador.
                    </div>
                  </div>

                  {/* Reseller Banner Info */}
                  <div className="md:col-span-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 p-6 rounded-3xl shadow-sm flex flex-col justify-between gap-6 relative overflow-hidden">
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

            <div className="w-52 h-52 bg-white rounded-2xl mx-auto flex items-center justify-center border border-slate-250/20 shadow-inner overflow-hidden relative">
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
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-250 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all cursor-pointer border border-slate-200/20"
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

    </div>
  );
}
