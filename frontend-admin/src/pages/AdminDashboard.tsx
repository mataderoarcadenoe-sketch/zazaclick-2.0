import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { 
  LogOut, RefreshCw, Users, ShieldAlert, Check, X, 
  Moon, Sun, Menu, LayoutDashboard, Settings, Globe, Server, Database, Search
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

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    // Basic fallback alert since admin doesn't use the notification banner state in the original design
    alert(`${type === 'success' ? '✅' : '❌'} ${text}`);
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

  const checkSystemHealth = async () => {
    setHealthBackend('checking');
    setHealthEvolution('checking');
    try {
      // Backend check
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
      // Evolution check via backend proxy or direct status response
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
    { id: 'overview', label: 'Estadísticas', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes y Licencias', icon: Users },
    { id: 'status', label: 'Salud del Sistema', icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <ShieldAlert size={18} />
              </div>
              <span className="font-extrabold text-slate-800 dark:text-white tracking-wide">
                Zaza.click <span className="text-blue-500">Admin</span>
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
                    setSidebarOpen(false);
                  }
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                } rounded-2xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/10 font-bold'
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
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white capitalize">
              {menuItems.find(i => i.id === activeTab)?.label || 'Panel de Administración'}
            </h2>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Admin Badge Tag */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/20">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Super Administrador</span>
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-md shadow-blue-500/20 uppercase">
                {user?.email?.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-white">{user?.email}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Owner Portal</span>
              </div>
            </div>
          </div>
        </header>

        {/* Interactive Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950/40 relative">
          
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Admin Welcome Card */}
                <div className="p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 rounded-3xl border border-blue-500/20 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left relative z-10">
                    <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      Admin Controller
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                      Zaza.click 2.0 Control Center
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                      Gestión centralizada del SaaS. Administra las licencias de tus clientes y verifica la conectividad del API de WhatsApp y Redis.
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap relative z-10">
                    <button
                      onClick={() => setActiveTab('clients')}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/15 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Users size={16} />
                      <span>Ver Clientes</span>
                    </button>
                    <button
                      onClick={() => {
                        checkSystemHealth();
                        fetchAdminData();
                      }}
                      className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover-lift shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw size={16} />
                      <span>Sincronizar</span>
                    </button>
                  </div>

                  {/* Backdrop lights */}
                  <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
                </div>

                {/* System Metrics Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Clientes</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      {stats?.total_users ?? 0}
                    </h3>
                    <p className="text-[9px] text-slate-500">Usuarios en la plataforma.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-emerald-500">Planes Activos</span>
                    <h3 className="text-2xl font-black text-emerald-500">
                      {stats?.active_subscriptions ?? 0}
                    </h3>
                    <p className="text-[9px] text-slate-500">Licencias habilitadas.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-mono">Líneas Creadas</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      {stats?.total_instances ?? 0}
                    </h3>
                    <p className="text-[9px] text-slate-500">Instancias registradas.</p>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-emerald-500">WhatsApp Online</span>
                    <h3 className="text-2xl font-black text-emerald-500">
                      {stats?.connected_instances ?? 0}
                    </h3>
                    <p className="text-[9px] text-slate-500">Sesiones conectadas en vivo.</p>
                  </div>
                </div>

                {/* Access Quick Helper Box */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm text-left space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Operaciones Rápidas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
                    <button 
                      onClick={() => setActiveTab('clients')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
                    >
                      <span className="block font-bold text-slate-800 dark:text-white">🔑 Modificar Licencias</span>
                      <span className="block text-[11px] text-slate-400">Modifica el plan contratado, estado y prorroga meses de vencimiento.</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('status')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
                    >
                      <span className="block font-bold text-slate-800 dark:text-white">🚀 Monitoreo de API</span>
                      <span className="block text-[11px] text-slate-400">Revisa la latencia y comunicación activa del Backend y Evolution API.</span>
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
                    <h3 className="text-base font-black text-slate-800 dark:text-white">Gestión de Clientes</h3>
                    <p className="text-xs text-slate-400">Visualiza y amplía licencias del SaaS de WhatsApp.</p>
                  </div>

                  {/* Search filter input */}
                  <div className="relative w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <Search size={14} />
                    </span>
                    <input 
                      type="text" 
                      placeholder="Buscar por email o ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl text-center font-bold">
                    ⚠️ {error}
                  </div>
                )}

                {loading ? (
                  <div className="py-20 text-center text-xs text-slate-400">Cargando base de datos...</div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs table-container-responsive">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 font-black uppercase tracking-wider">
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
                            <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                              <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                <div className="text-[12px]">{client.email}</div>
                                <div className="text-[9px] text-slate-400 font-normal">ID: {client.id}</div>
                              </td>
                              
                              {/* Inline Editing Plan Selector */}
                              <td className="p-4">
                                {editingUserId === client.id ? (
                                  <select
                                    value={newPlanId}
                                    onChange={(e) => setNewPlanId(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                  >
                                    <option value="plan_basic">Plan Básico (1 nº)</option>
                                    <option value="plan_medium">Plan Estándar (3 nº)</option>
                                    <option value="plan_premium">Plan Pro (Ilimitado)</option>
                                  </select>
                                ) : (
                                  <span className="font-bold text-slate-600 dark:text-slate-300">
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
                                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                  >
                                    <option value="active">Activo</option>
                                    <option value="expired">Vencido</option>
                                    <option value="cancelled">Cancelado</option>
                                  </select>
                                ) : client.subscription_status === 'active' ? (
                                  <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md font-black text-[9px]">
                                    ACTIVO
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-md font-black text-[9px]">
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
                                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
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

                              <td className="p-4 text-center font-black text-slate-800 dark:text-white">
                                {client.instances_count}
                              </td>

                              <td className="p-4 text-right">
                                {editingUserId === client.id ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleUpdateSubscription(client.id)}
                                      disabled={submittingSub}
                                      className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white cursor-pointer hover-lift shadow-sm shadow-emerald-500/10"
                                      title="Guardar"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
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
                                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl border border-slate-200/50 dark:border-slate-800/60 transition-colors cursor-pointer"
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
                    <h3 className="text-base font-black text-slate-800 dark:text-white">Salud e Infraestructura</h3>
                    <p className="text-xs text-slate-400">Verifica la latencia de las conexiones del backend del SaaS y el motor Evolution API.</p>
                  </div>
                  <button
                    onClick={checkSystemHealth}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 hover-lift shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    <span>Verificar Ahora</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Backend Server Status Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500">
                        <Server size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SaaS REST API</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Servidor Backend Principal</h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs py-2 border-t border-b border-slate-100 dark:border-slate-800/60 font-medium">
                      <span className="text-slate-500">Estado</span>
                      {healthBackend === 'checking' && <span className="text-slate-400 animate-pulse">Comprobando...</span>}
                      {healthBackend === 'ok' && <span className="text-emerald-500 font-bold uppercase flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado</span>}
                      {healthBackend === 'error' && <span className="text-rose-500 font-bold uppercase flex items-center gap-1">⚠️ Error</span>}
                    </div>

                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-medium">
                      Controla las conexiones con PostgreSQL, la autenticación JWT y las peticiones enviadas por los clientes desde el panel web.
                    </p>
                  </div>

                  {/* Evolution API Status Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <Globe size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">WhatsApp Engine</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Evolution API v2.4.0</h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs py-2 border-t border-b border-slate-100 dark:border-slate-800/60 font-medium">
                      <span className="text-slate-500">Estado</span>
                      {healthEvolution === 'checking' && <span className="text-slate-400 animate-pulse">Comprobando...</span>}
                      {healthEvolution === 'ok' && <span className="text-emerald-500 font-bold uppercase flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Operativo</span>}
                      {healthEvolution === 'error' && <span className="text-rose-500 font-bold uppercase flex items-center gap-1">⚠️ Error</span>}
                    </div>

                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-medium">
                      Servicio de mensajería en vivo. Se comunica directamente con los teléfonos de los clientes para emparejar sesiones e interactuar vía Webhooks.
                    </p>
                  </div>

                  {/* Cache & DB connectivity */}
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-sm space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">Servicios Conectados</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium pt-2">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                          <Database size={16} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-850 dark:text-white">PostgreSQL DB</span>
                          <span className="block text-[10px] text-slate-400">Esquema zaza_click & evolution aislados.</span>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                          <Server size={16} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-850 dark:text-white">Redis Caching</span>
                          <span className="block text-[10px] text-slate-400">Almacenamiento en caché de sesiones de WhatsApp.</span>
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
