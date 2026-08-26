import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Users, ShieldAlert, Check, X, 
  Moon, Sun, Menu, LayoutDashboard, Settings, Globe, Server, Database, Search,
  Key, Rocket, CheckCircle2, AlertCircle, Smartphone, Cpu
} from 'lucide-react';

interface ClientUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  subscription_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  instances_count: string;
}

interface SystemStats {
  total_users: number;
  total_instances: number;
  connected_instances: number;
  active_subscriptions: number;
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Active Tab/Section State
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'status'>('overview');

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar');
    return saved !== null ? saved === 'true' : true;
  });

  // Dark/Light Theme state
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Subscription Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPlanId, setNewPlanId] = useState('plan_basic');
  const [newStatus, setNewStatus] = useState('active');
  const [newDuration, setNewDuration] = useState('1');
  const [submittingSub, setSubmittingSub] = useState(false);

  // System Health status indicators
  const [healthBackend, setHealthBackend] = useState<'checking' | 'ok' | 'error'>('checking');
  const [healthEvolution, setHealthEvolution] = useState<'checking' | 'ok' | 'error'>('checking');
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [licenseLoading, setLicenseLoading] = useState<boolean>(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);

  // Notification Banner State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar', String(next));
      return next;
    });
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.stats);
      if (usersRes.data?.success) setClients(usersRes.data.users);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al conectar con la API de administración');
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenseStatus = async () => {
    setLicenseLoading(true);
    setLicenseError(null);
    try {
      const res = await api.get('/admin/license/status');
      if (res.data?.success) {
        setLicenseStatus(res.data.data);
      } else {
        setLicenseError(res.data?.error || 'Error al obtener estado de la licencia');
      }
    } catch (e: any) {
      setLicenseError(e.response?.data?.error || 'Error al conectar con el servidor de licencias');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleRegisterLicense = async () => {
    setRegisterLoading(true);
    try {
      const redirectUri = window.location.origin + '/admin';
      const res = await api.post('/admin/license/register', { redirectUri });
      if (res.data?.success && res.data?.registerUrl) {
        window.open(res.data.registerUrl, '_blank');
        showNotification('Se abrió la página de activación. Completa el registro y luego sincroniza.', 'success');
      } else {
        showNotification(res.data?.error || 'No se pudo generar el enlace de registro', 'error');
      }
    } catch (e: any) {
      showNotification(e.response?.data?.error || 'Error de red al registrar licencia', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    setHealthBackend('checking');
    setHealthEvolution('checking');
    try {
      const backendRes = await api.get('/admin/stats');
      if (backendRes.status === 200) {
        setHealthBackend('ok');
      } else {
        setHealthBackend('error');
      }
    } catch (e) {
      setHealthBackend('error');
    }

    try {
      const res = await api.get('/instances/list');
      if (res.status === 200) {
        setHealthEvolution('ok');
      } else {
        setHealthEvolution('error');
      }
    } catch (e) {
      setHealthEvolution('error');
    }
  };

  useEffect(() => {
    fetchAdminData();
    checkSystemHealth();
    fetchLicenseStatus();

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);

      const activateLicenseCode = async () => {
        setLicenseLoading(true);
        try {
          const res = await api.post('/admin/license/activate', { code });
          if (res.data?.success) {
            showNotification('¡Licencia de Evolution API activada con éxito!', 'success');
            fetchLicenseStatus();
          } else {
            showNotification(res.data?.error || 'Error al completar la activación de licencia', 'error');
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error de red al completar activación', 'error');
        } finally {
          setLicenseLoading(false);
        }
      };

      activateLicenseCode();
    }
  }, []);

  const handleUpdateSubscription = async (clientId: string) => {
    setSubmittingSub(true);
    try {
      const res = await api.put(`/admin/users/${clientId}/subscription`, {
        planId: newPlanId,
        status: newStatus,
        durationMonths: newDuration,
      });

      if (res.data?.success) {
        setEditingUserId(null);
        showNotification('Suscripción actualizada con éxito.', 'success');
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar suscripción', 'error');
    } finally {
      setSubmittingSub(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const menuItems = [
    { id: 'overview', label: 'Estadísticas Globales', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes y Licencias', icon: Users },
    { id: 'status', label: 'Salud e Infraestructura', icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-300 font-sans overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn backdrop-blur-xl ${
          notification.type === 'success'
            ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
          <span>{notification.text}</span>
        </div>
      )}
      
      {/* Sidebar */}
      <aside 
        className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 shadow-xl z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${sidebarOpen ? 'fixed lg:relative h-full' : 'hidden lg:flex'}`}
      >
        {/* Brand header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'} border-b border-slate-100 dark:border-slate-800/80`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 dark:from-emerald-600 dark:to-teal-800 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Smartphone size={18} className="text-emerald-400" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white tracking-tight text-sm">
                  Zaza.click <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">2.0</span>
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">SuperAdmin Core</span>
              </div>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Alternar barra lateral"
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
                    setSidebarOpen(false);
                  }
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                } rounded-2xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium'
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
        <header className="h-16 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-6 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white capitalize tracking-tight">
              {menuItems.find(i => i.id === activeTab)?.label || 'Panel de Administración'}
            </h2>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Admin Badge Tag */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-full border border-emerald-200/80 dark:border-emerald-800/50">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Super Administrador</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
            </button>

            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-500/20 uppercase">
                {user?.email?.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{user?.email}</span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Control Maestro</span>
              </div>
            </div>
          </div>
        </header>

        {/* Interactive Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-[#070B12] bg-grid-tech relative">
          
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Global Warning Banner for Inactive License */}
            {licenseStatus && !(licenseStatus.status === 'active' || licenseStatus.active) && (
              <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left animate-fadeIn shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 rounded-2xl text-rose-600 flex-shrink-0">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200">Motor de WhatsApp Desactivado</h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed mt-0.5">
                      La licencia de Evolution API no está activa. Tus clientes experimentarán errores al intentar crear o conectar líneas. Por favor, realiza la activación.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('status');
                    fetchLicenseStatus();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
                >
                  Gestionar Licencia
                </button>
              </div>
            )}
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Admin Welcome Card */}
                <div className="p-6 sm:p-8 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="space-y-2 text-left relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Admin Controller · v2.0</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Zaza.click 2.0 Control Center
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed font-normal">
                      Gestión centralizada del SaaS. Administra las licencias de tus clientes y verifica la conectividad del API de WhatsApp y Redis.
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap relative z-10">
                    <button
                      onClick={() => setActiveTab('clients')}
                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Users size={16} />
                      <span>Ver Clientes</span>
                    </button>
                    <button
                      onClick={() => {
                        checkSystemHealth();
                        fetchAdminData();
                        fetchLicenseStatus();
                      }}
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw size={16} />
                      <span>Sincronizar</span>
                    </button>
                  </div>

                  {/* Backdrop lights */}
                  <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
                </div>

                {/* System Metrics Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  <div className="p-5 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md space-y-2 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clientes Totales</span>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {stats?.total_users ?? 0}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Cuentas registradas.</p>
                  </div>

                  <div className="p-5 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md space-y-2 text-left">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Planes Activos</span>
                    <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {stats?.active_subscriptions ?? 0}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Suscripciones habilitadas.</p>
                  </div>

                  <div className="p-5 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md space-y-2 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Líneas Creadas</span>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {stats?.total_instances ?? 0}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Instancias WhatsApp en DB.</p>
                  </div>

                  <div className="p-5 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md space-y-2 text-left">
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">WhatsApp Online</span>
                    <h3 className="text-3xl font-black text-teal-600 dark:text-teal-400 tracking-tight">
                      {stats?.connected_instances ?? 0}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Sesiones en vivo vinculadas.</p>
                  </div>

                </div>

                {/* Access Quick Helper Box */}
                <div className="p-6 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md text-left space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Operaciones Rápidas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
                    <button 
                      onClick={() => setActiveTab('clients')}
                      className="p-5 bg-slate-50 hover:bg-emerald-50/50 dark:bg-slate-900 dark:hover:bg-slate-800/90 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl text-left space-y-1.5 transition-all cursor-pointer group"
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        <Key size={16} className="text-emerald-500" />
                        <span>Modificar Licencias</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                        Modifica el plan contratado, estado y prorroga meses de vencimiento por cliente.
                      </span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('status')}
                      className="p-5 bg-slate-50 hover:bg-teal-50/50 dark:bg-slate-900 dark:hover:bg-slate-800/90 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl text-left space-y-1.5 transition-all cursor-pointer group"
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        <Rocket size={16} className="text-teal-500" />
                        <span>Monitoreo de Infraestructura</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                        Revisa la latencia y comunicación activa del Backend y Evolution API.
                      </span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* CLIENTS & LICENSES SECTION */}
            {activeTab === 'clients' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Gestión de Clientes</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Visualiza y amplía licencias del SaaS de WhatsApp.</p>
                  </div>

                  {/* Search filter input */}
                  <div className="relative w-full sm:w-72">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                      <Search size={14} />
                    </span>
                    <input 
                      type="text" 
                      placeholder="Buscar por email o ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium placeholder-slate-400 shadow-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-center font-bold">
                    ⚠️ {error}
                  </div>
                )}

                {loading ? (
                  <div className="py-20 text-center text-xs text-slate-400 font-medium">Cargando base de datos...</div>
                ) : (
                  <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-4">Cliente / ID</th>
                            <th className="p-4">Plan Actual</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4">Vencimiento</th>
                            <th className="p-4 text-center">Instancias</th>
                            <th className="p-4 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {filteredClients.map(client => (
                            <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="p-4 font-bold text-slate-900 dark:text-slate-100">
                                <div className="text-[12px]">{client.email}</div>
                                <div className="text-[9px] text-slate-400 font-mono font-normal">ID: {client.id}</div>
                              </td>
                              
                              {/* Inline Editing Plan Selector */}
                              <td className="p-4">
                                {editingUserId === client.id ? (
                                  <select
                                    value={newPlanId}
                                    onChange={(e) => setNewPlanId(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                  >
                                    <option value="plan_basic">Plan Básico (1 nº)</option>
                                    <option value="plan_medium">Plan Estándar (3 nº)</option>
                                    <option value="plan_premium">Plan Pro (Ilimitado)</option>
                                  </select>
                                ) : (
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {client.plan_name || 'Sin plan'}
                                  </span>
                                )}
                              </td>

                              {/* Inline Editing Status Selector */}
                              <td className="p-4">
                                {editingUserId === client.id ? (
                                  <select
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                  >
                                    <option value="active">Activo</option>
                                    <option value="expired">Vencido</option>
                                    <option value="cancelled">Cancelado</option>
                                  </select>
                                ) : client.subscription_status === 'active' ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-full font-bold text-[9px] uppercase tracking-wider">
                                    ACTIVO
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-slate-400 rounded-full font-bold text-[9px] uppercase tracking-wider">
                                    INACTIVO
                                  </span>
                                )}
                              </td>

                              {/* Inline Editing Duration Selector */}
                              <td className="p-4 text-slate-600 dark:text-slate-400 font-bold">
                                {editingUserId === client.id ? (
                                  <select
                                    value={newDuration}
                                    onChange={(e) => setNewDuration(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                  >
                                    <option value="1">+1 Mes</option>
                                    <option value="3">+3 Meses</option>
                                    <option value="6">+6 Meses</option>
                                    <option value="12">+12 Meses</option>
                                  </select>
                                ) : client.subscription_end_date ? (
                                  new Date(client.subscription_end_date).toLocaleDateString()
                                ) : (
                                  'N/A'
                                )}
                              </td>

                              <td className="p-4 text-center font-black text-slate-900 dark:text-white">
                                {client.instances_count}
                              </td>

                              <td className="p-4 text-right">
                                {editingUserId === client.id ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleUpdateSubscription(client.id)}
                                      disabled={submittingSub}
                                      className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white cursor-pointer shadow-sm shadow-emerald-600/20"
                                      title="Guardar"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                                      title="Cancelar"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingUserId(client.id);
                                      setNewPlanId(client.plan_id || 'plan_basic');
                                      setNewStatus(client.subscription_status || 'active');
                                      setNewDuration('1');
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                                  >
                                    Modificar Plan
                                  </button>
                                )}
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

            {/* SYSTEM STATUS SECTION */}
            {activeTab === 'status' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Salud e Infraestructura</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Verifica la latencia de las conexiones del backend del SaaS y el motor Evolution API.</p>
                  </div>
                  <button
                    onClick={checkSystemHealth}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    <span>Verificar Ahora</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Backend Server Status Card */}
                  <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-3xl shadow-md space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl text-emerald-600">
                        <Server size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SaaS REST API</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Servidor Backend Principal</h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs py-2 border-t border-b border-slate-100 dark:border-slate-800/60 font-medium">
                      <span className="text-slate-500">Estado</span>
                      {healthBackend === 'checking' && <span className="text-slate-400 animate-pulse">Comprobando...</span>}
                      {healthBackend === 'ok' && <span className="text-emerald-600 font-bold uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Conectado</span>}
                      {healthBackend === 'error' && <span className="text-rose-500 font-bold uppercase flex items-center gap-1">⚠️ Error</span>}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                      Controla las conexiones con PostgreSQL, la autenticación JWT y las peticiones enviadas por los clientes desde el panel web.
                    </p>
                  </div>

                  {/* Evolution API Status Card */}
                  <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-3xl shadow-md space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 rounded-2xl text-teal-600">
                        <Globe size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">WhatsApp Engine</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Evolution API v2</h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs py-2 border-t border-b border-slate-100 dark:border-slate-800/60 font-medium">
                      <span className="text-slate-500">Estado</span>
                      {healthEvolution === 'checking' && <span className="text-slate-400 animate-pulse">Comprobando...</span>}
                      {healthEvolution === 'ok' && <span className="text-teal-600 font-bold uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" /> Operativo</span>}
                      {healthEvolution === 'error' && <span className="text-rose-500 font-bold uppercase flex items-center gap-1">⚠️ Error</span>}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                      Servicio de mensajería en vivo. Se comunica directamente con los teléfonos de los clientes para emparejar sesiones e interactuar vía Webhooks.
                    </p>
                  </div>

                  {/* Evolution API License Status Card */}
                  <div className="md:col-span-2 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-3xl shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl text-emerald-600">
                          <Key size={20} />
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Licencia del Motor</span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Estado de Licencia Evolution API</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {licenseLoading ? (
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-bold">
                            <RefreshCw size={12} className="animate-spin" />
                            Consultando...
                          </span>
                        ) : (
                          <button
                            onClick={fetchLicenseStatus}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            title="Actualizar licencia"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {licenseError ? (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-semibold">
                        {licenseError}
                      </div>
                    ) : licenseStatus ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-left text-xs">
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Estado General</span>
                          <span className={`block font-bold mt-1 ${
                            licenseStatus.status === 'active' || licenseStatus.active
                              ? 'text-emerald-600'
                              : 'text-rose-500'
                          }`}>
                            {licenseStatus.status === 'active' || licenseStatus.active ? 'ACTIVO / VÁLIDO' : 'ACTIVACIÓN REQUERIDA'}
                          </span>
                        </div>
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Tipo de Licencia</span>
                          <span className="block font-bold text-slate-700 dark:text-slate-300 mt-1 uppercase">
                            {licenseStatus.type || 'Community / Free'}
                          </span>
                        </div>
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Expiración de Clave</span>
                          <span className="block font-bold text-slate-700 dark:text-slate-300 mt-1 font-mono">
                            {licenseStatus.expires_at || licenseStatus.expiresAt
                              ? new Date(licenseStatus.expires_at || licenseStatus.expiresAt).toLocaleDateString()
                              : 'Sin expiración / Permanente'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-xs py-4 text-slate-400 font-medium">
                        Cargando información de licencia...
                      </div>
                    )}

                    {/* Action button if registration is needed */}
                    {licenseStatus && !(licenseStatus.status === 'active' || licenseStatus.active) && (
                      <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Activación Gratuita de Evolution API</h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                            Esta instalación requiere asociar un correo administrador para habilitar el motor. Haz clic abajo para generar tu link e introducir tu email.
                          </p>
                        </div>
                        <button
                          onClick={handleRegisterLicense}
                          disabled={registerLoading}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-2xl shadow-md transition-colors cursor-pointer whitespace-nowrap self-start sm:self-center"
                        >
                          {registerLoading ? 'Generando...' : 'Obtener Link de Activación'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cache & DB connectivity */}
                  <div className="md:col-span-2 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-3xl shadow-md space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Servicios Conectados</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium pt-2">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600">
                          <Database size={18} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">PostgreSQL DB</span>
                          <span className="block text-[10.5px] text-slate-400">Esquema zaza_click & evolution aislados.</span>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3">
                        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 rounded-xl text-teal-600">
                          <Cpu size={18} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">Redis Queue Engine</span>
                          <span className="block text-[10.5px] text-slate-400">Almacenamiento en caché y cola de mensajes masivos.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </main>
      </div>

    </div>
  );
}
