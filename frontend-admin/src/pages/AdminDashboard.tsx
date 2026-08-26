// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  Users, Smartphone, Settings, LogOut, 
  Search, Shield, CheckCircle2, Moon, Sun, 
  X, Menu, Key, Activity, 
  Building, RefreshCw, AlertCircle, ArrowRight
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'instances' | 'plans' | 'settings'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  // SuperAdmin Data States
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [instancesList, setInstancesList] = useState<any[]>([]);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit User / Plan Modal State
  const [editUserModal, setEditUserModal] = useState<{ open: boolean; user: any | null }>({
    open: false,
    user: null
  });
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAdminStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, instRes, plansRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/instances'),
        api.get('/admin/plans')
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (usersRes.data?.success) setUsersList(usersRes.data.data || []);
      if (instRes.data?.success) setInstancesList(instRes.data.data || []);
      if (plansRes.data?.success) setPlansList(plansRes.data.data || []);
    } catch (err: any) {
      console.error('Error cargando datos de administración:', err);
      showNotification('Error al sincronizar datos del panel SuperAdmin', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  const handleUpdateUserPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal.user || !selectedPlanId) return;

    try {
      const res = await api.put(`/admin/users/${editUserModal.user.id}/plan`, {
        planId: selectedPlanId
      });

      if (res.data?.success) {
        showNotification('Plan del cliente actualizado exitosamente');
        setEditUserModal({ open: false, user: null });
        fetchAdminStats();
      } else {
        showNotification(res.data?.error || 'No se pudo actualizar el plan', 'error');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar plan', 'error');
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInstances = instancesList.filter(i =>
    i.instance_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.phone?.includes(searchTerm)
  );

  const menuItems = [
    { id: 'overview', label: 'Resumen Global', icon: Activity },
    { id: 'users', label: 'Empresas / Clientes', icon: Users },
    { id: 'instances', label: 'Líneas WhatsApp Totales', icon: Smartphone },
    { id: 'plans', label: 'Planes y Cuotas', icon: Key },
    { id: 'settings', label: 'Configuración Global', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-250 font-sans overflow-hidden">
      
      {/* Toast Notification (Flat Pill) */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300' 
            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/90 dark:text-rose-300'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-rose-500" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Sidebar (Clean Flat Surface) */}
      <aside 
        className={`bg-white dark:bg-[#0B0F19] flex flex-col transition-all duration-250 z-40 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 dark:from-emerald-600 dark:to-teal-800 flex items-center justify-center text-white">
                <Shield size={18} className="text-emerald-400" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza Admin <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">2.0</span>
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">SuperAdmin Core</span>
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
                  setActiveTab(item.id as any);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full group flex items-center ${
                  sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
                } rounded-2xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold'
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
        <div className="p-3 bg-white dark:bg-[#0B0F19]">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer`}
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
        <header className="h-16 bg-white dark:bg-[#0B0F19] px-4 sm:px-8 flex items-center justify-between z-30 transition-colors duration-250">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                {menuItems.find(i => i.id === activeTab)?.label || 'Consola SuperAdmin'}
              </h2>
              <p className="text-[11px] text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">
                Gestión centralizada de infraestructura, planes y clientes corporativos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Status Tag */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider">SUPERADMIN ACCESS</span>
            </div>

            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDark}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
            </button>

            {/* Profile badge */}
            <div className="flex items-center gap-2.5 pl-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-xs font-bold uppercase">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">SuperAdmin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body Canvas */}
        <main className="flex-1 bg-[#F8FAFC] dark:bg-[#070B12] bg-grid-tech relative overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                {/* Hero Greeting Banner */}
                <div className="p-6 sm:p-8 bg-white dark:bg-[#0D131F] rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="space-y-2 text-left relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Cluster Core Operativo · Redis Telemetry</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Centro de Control de Zaza.click
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-normal">
                      Monitorea las empresas registradas, el estado de las conexiones WhatsApp y administra las cuotas de cada cliente en tiempo real.
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap relative z-10">
                    <button
                      type="button"
                      onClick={() => setActiveTab('users')}
                      className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Users size={16} />
                      <span>Ver Clientes</span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchAdminStats}
                      disabled={loading}
                      className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      <span>Actualizar Métricas</span>
                    </button>
                  </div>

                  <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/8 rounded-full blur-[90px] pointer-events-none" />
                </div>

                {/* Telemetry KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  
                  <div className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Empresas Activas</span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.total_users || usersList.length}</div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">Inquilinos registrados</p>
                  </div>

                  <div className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Registradas</span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.total_instances || instancesList.length}</div>
                    <p className="text-xs font-medium text-slate-400 pt-1">Total de instancias creadas</p>
                  </div>

                  <div className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas Conectadas</span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {instancesList.filter(i => i.status === 'connected').length}
                    </div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">Gateway activo</p>
                  </div>

                  <div className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disponibilidad del SaaS</span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">99.99%</div>
                    <p className="text-xs font-medium text-slate-400 pt-1">SLA garantizado</p>
                  </div>

                </div>

                {/* Resumen Rápido de Últimos Clientes */}
                <div className="p-6 sm:p-8 bg-white dark:bg-[#0D131F] rounded-3xl text-left space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimas Empresas Registradas</h3>
                      <p className="text-xs text-slate-400">Clientes que han creado cuenta recientemente en Zaza.click.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveTab('users')}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Ver todas</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {usersList.slice(0, 5).map(u => (
                      <div key={u.id} className="py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                            {(u.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{u.email}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{u.id}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full uppercase">
                          {u.plan_name || 'Developer'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* USERS / EMPRESAS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Empresas y Clientes SaaS</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta el listado de usuarios corporativos y asigna sus planes de WhatsApp API.</p>
                  </div>

                  {/* Buscador (Flat Input) */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por correo o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:bg-slate-200 dark:focus:bg-[#1A253A] font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Tabla de Usuarios (Flat Surface Minimalist) */}
                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#141D2E] text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                        <tr>
                          <th className="px-6 py-4">Usuario / Empresa</th>
                          <th className="px-6 py-4">Rol</th>
                          <th className="px-6 py-4">Plan Actual</th>
                          <th className="px-6 py-4">Instancias Máx.</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                              No se encontraron usuarios que coincidan con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-[#141D2E]/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                                    {(u.email || 'U')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">{u.email}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  u.role === 'admin' 
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' 
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                                  {u.plan_name || 'Plan Developer'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {u.max_instances === 99 ? 'ILIMITADO' : `${u.max_instances || 1} Líneas`}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditUserModal({ open: true, user: u });
                                    setSelectedPlanId(u.plan_id || 'plan_basic');
                                  }}
                                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <Key size={13} />
                                  <span>Cambiar Plan</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* INSTANCES / LÍNEAS TOTALES TAB */}
            {activeTab === 'instances' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Todas las Líneas de WhatsApp</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Supervisión en tiempo real de todas las conexiones activas en el clúster de Evolution API.</p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por instancia o teléfono..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:bg-slate-200 dark:focus:bg-[#1A253A] font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#141D2E] text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                        <tr>
                          <th className="px-6 py-4">Nombre de Instancia</th>
                          <th className="px-6 py-4">Empresa / Propietario</th>
                          <th className="px-6 py-4">Teléfono Vinculado</th>
                          <th className="px-6 py-4">Estado</th>
                          <th className="px-6 py-4">API Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {filteredInstances.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                              No hay instancias registradas que coincidan.
                            </td>
                          </tr>
                        ) : (
                          filteredInstances.map(inst => (
                            <tr key={inst.id || inst.instance_name} className="hover:bg-slate-50/70 dark:hover:bg-[#141D2E]/50 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                                {inst.instance_name}
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                {inst.user_email || 'Sin asignar'}
                              </td>
                              <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                {inst.phone || 'Sin número'}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  inst.status === 'connected'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}>
                                  {inst.status === 'connected' ? '● Conectado' : '○ Desconectado'}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-400 truncate max-w-[160px]">
                                {inst.api_key}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* PLANS / CUOTAS TAB */}
            {activeTab === 'plans' && (
              <div className="space-y-8 animate-fadeIn text-left">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planes de Suscripción WhatsApp API</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Niveles de servicio y límites de líneas configurados en la plataforma.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plansList.map(plan => (
                    <div key={plan.id} className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-4 text-left">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{plan.id}</span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                      </div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white">
                        ${plan.price} <span className="text-xs font-normal text-slate-400">/ mes</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <p><strong>Líneas Permitidas:</strong> {plan.max_instances === 99 ? 'ILIMITADAS' : plan.max_instances}</p>
                        <p><strong>Duración:</strong> {plan.duration_months} mes(es)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-8 animate-fadeIn text-left">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Configuración del Clúster SaaS</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Parámetros globales y estado de salud de los motores de infraestructura.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Evolution API Gateway</span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">● Conectado (v2.0)</p>
                    <p className="text-xs text-slate-500 font-mono pt-1">evolution-api-production.up.railway.app</p>
                  </div>

                  <div className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Motor de Colas Redis</span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">● Conectado (BullMQ)</p>
                    <p className="text-xs text-slate-500 font-mono pt-1">redis-volume activo</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal Editar Plan del Usuario */}
      {editUserModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cambiar Plan de Suscripción</h3>
              <button onClick={() => setEditUserModal({ open: false, user: null })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Usuario seleccionado:</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{editUserModal.user?.email}</p>
            </div>

            <form onSubmit={handleUpdateUserPlan} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Seleccionar Plan</label>
                <CustomSelect
                  value={selectedPlanId}
                  onChange={(val) => setSelectedPlanId(val)}
                  placeholder="Seleccionar plan..."
                  options={plansList.map(p => ({
                    value: p.id,
                    label: p.name,
                    sublabel: `${p.max_instances === 99 ? 'Ilimitado' : `${p.max_instances} líneas`} · $${p.price}/mes`,
                    badge: `$${p.price}/m`
                  }))}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModal({ open: false, user: null })}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
                >
                  Guardar Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
