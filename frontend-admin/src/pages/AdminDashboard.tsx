// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  Users, Smartphone, Settings, LogOut, 
  Search, Shield, CheckCircle2, Moon, Sun, 
  X, Menu, Key, Activity, 
  Building, RefreshCw, AlertCircle, ArrowRight,
  Plus, DollarSign, Clock, Check, AlertTriangle,
  Lock, RotateCcw, CreditCard, FileText, ToggleLeft, ToggleRight, Trash2, Eye
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';
import { InteractiveGravityMesh } from '../components/InteractiveGravityMesh';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'instances' | 'plans' | 'payments' | 'audit' | 'settings'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  // SuperAdmin Data States
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [instancesList, setInstancesList] = useState<any[]>([]);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modales Administrativos
  const [clientDetailModal, setClientDetailModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [createUserModal, setCreateUserModal] = useState(false);
  const [editSubscriptionModal, setEditSubscriptionModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [recordPaymentModal, setRecordPaymentModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [planModal, setPlanModal] = useState<{ open: boolean; plan: any | null }>({ open: false, plan: null });

  // Form States para Modales
  const [newUserData, setNewUserData] = useState({ email: '', password: '', companyName: '', phone: '', planId: 'plan_basic', durationMonths: 1 });
  const [subFormData, setSubFormData] = useState({ planId: '', status: 'active', durationDays: 30, resetQuota: false });
  const [paymentFormData, setPaymentFormData] = useState({ amount: 15, currency: 'USD', paymentMethod: 'Transferencia', reference: '', renewMonths: 1, planId: '' });
  const [newPassword, setNewPassword] = useState('');
  const [planFormData, setPlanFormData] = useState({ id: '', name: '', maxInstances: 1, price: 15, durationMonths: 1, maxMessages: 1000, isTrial: false, trialDays: 7, trialMessages: 100, description: '' });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, instRes, plansRes, payRes, auditRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/instances'),
        api.get('/admin/plans'),
        api.get('/admin/payments'),
        api.get('/admin/audit-logs')
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (usersRes.data?.success) setUsersList(usersRes.data.data || []);
      if (instRes.data?.success) setInstancesList(usersRes.data.data ? instRes.data.data || [] : []);
      if (plansRes.data?.success) setPlansList(plansRes.data.data || []);
      if (payRes.data?.success) setPaymentsList(payRes.data.data || []);
      if (auditRes.data?.success) setAuditLogs(auditRes.data.data || []);
    } catch (err: any) {
      console.error('Error cargando datos de administración:', err);
      showNotification('Error al sincronizar datos del panel SuperAdmin', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Handlers de Acciones Administrativas
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/users', newUserData);
      if (res.data?.success) {
        showNotification('Cliente creado exitosamente con suscripción activa');
        setCreateUserModal(false);
        setNewUserData({ email: '', password: '', companyName: '', phone: '', planId: 'plan_basic', durationMonths: 1 });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al crear cliente', 'error');
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'blocked') => {
    try {
      const res = await api.put(`/admin/users/${userId}/status`, { status });
      if (res.data?.success) {
        showNotification(`Estado de cliente actualizado a ${status.toUpperCase()}`);
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar estado', 'error');
    }
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubscriptionModal.user) return;

    try {
      const res = await api.put(`/admin/users/${editSubscriptionModal.user.id}/subscription`, subFormData);
      if (res.data?.success) {
        showNotification('Suscripción y cuotas del cliente actualizadas exitosamente');
        setEditSubscriptionModal({ open: false, user: null });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar suscripción', 'error');
    }
  };

  const handleResetQuota = async (userId: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/reset-quota`);
      if (res.data?.success) {
        showNotification('Cuota de mensajes reseteada a 0 exitosamente');
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al resetear cuota', 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordPaymentModal.user) return;

    try {
      const res = await api.post('/admin/payments', {
        userId: recordPaymentModal.user.id,
        ...paymentFormData
      });
      if (res.data?.success) {
        showNotification('Pago registrado exitosamente y servicio renovado');
        setRecordPaymentModal({ open: false, user: null });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al registrar pago', 'error');
    }
  };

  const handleToggleInstance = async (instId: string, currentEnabled: boolean) => {
    try {
      const res = await api.put(`/admin/instances/${instId}/toggle`, { isEnabled: !currentEnabled });
      if (res.data?.success) {
        showNotification(`Instancia ${!currentEnabled ? 'habilitada' : 'deshabilitada'}`);
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al modificar instancia', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.user || !newPassword) return;

    try {
      const res = await api.post(`/admin/users/${resetPasswordModal.user.id}/reset-password`, { newPassword });
      if (res.data?.success) {
        showNotification('Contraseña actualizada exitosamente');
        setResetPasswordModal({ open: false, user: null });
        setNewPassword('');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar contraseña', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente al cliente "${email}" y todas sus instancias? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await api.delete(`/admin/users/${userId}`);
      if (res.data?.success) {
        showNotification('Cliente eliminado exitosamente');
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al eliminar cliente', 'error');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (planModal.plan?.id) {
        await api.put(`/admin/plans/${planModal.plan.id}`, planFormData);
        showNotification('Plan actualizado');
      } else {
        await api.post('/admin/plans', planFormData);
        showNotification('Plan creado');
      }
      setPlanModal({ open: false, plan: null });
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al guardar plan', 'error');
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const menuItems = [
    { id: 'overview', label: 'Resumen Global', icon: Activity },
    { id: 'users', label: 'Clientes y Licencias', icon: Users },
    { id: 'instances', label: 'Líneas WhatsApp Totales', icon: Smartphone },
    { id: 'plans', label: 'Planes y Cuotas', icon: Key },
    { id: 'payments', label: 'Historial de Pagos', icon: DollarSign },
    { id: 'audit', label: 'Bitácora de Auditoría', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-250 font-sans overflow-hidden relative">
      
      {/* Living API Network Infrastructure Canvas (Admin Supervision Engine) */}
      <InteractiveGravityMesh 
        variant="admin"
        isDark={isDark}
        className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-60"
      />

      {/* Toast Notification */}
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

      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 dark:bg-[#0B0F19] border-r border-slate-800 flex flex-col transition-all duration-250 z-40 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-white text-sm tracking-tight">
                  Zaza Admin <span className="text-emerald-400">2.0</span>
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">SuperAdmin Core</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 cursor-pointer"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
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
                  sidebarOpen ? 'px-4 py-2.5 justify-start' : 'p-3 justify-center'
                } rounded-xl transition-all duration-200 relative cursor-pointer ${
                  active 
                    ? 'bg-slate-800/80 text-white font-semibold border-l-[3px] border-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-medium'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="ml-3.5 text-xs tracking-tight">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="ml-3 text-xs font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-250 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Header */}
        <header className="h-16 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md px-4 sm:px-8 lg:px-12 flex items-center justify-between z-30 transition-colors duration-250 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 lg:hidden cursor-pointer">
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.label || 'Panel de Control'}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                  SUPERADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">Control maestro de licenciamiento, cuotas atómicas y facturación.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Gateway Telemetry Pill */}
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Control Core · Activo</span>
            </div>

            <button
              onClick={toggleDark}
              className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer border border-transparent dark:border-slate-700/50"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-emerald-600" />}
            </button>
            <button
              onClick={fetchAdminData}
              className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer border border-transparent dark:border-slate-700/50"
              title="Actualizar datos"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-emerald-500' : ''} />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[130px]">{user?.email}</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">SuperAdmin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 bg-[#F8FAFC] dark:bg-[#070B12] bg-grid-tech relative overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8 max-w-[1920px] mx-auto">
            
            {/* OVERVIEW GLOBAL DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Alertas Operativas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card-saas card-saas-hover p-4 rounded-2xl border-l-4 border-amber-400">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                      <Clock size={15} />
                      <span>Próximos a Vencer (3d)</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                      {stats?.subscriptions?.expiring_soon || 0}
                    </div>
                  </div>

                  <div className="card-saas card-saas-hover p-4 rounded-2xl border-l-4 border-rose-400">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      <AlertTriangle size={15} />
                      <span>Suscripciones Vencidas</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                      {stats?.subscriptions?.expired_subscriptions || 0}
                    </div>
                  </div>

                  <div className="card-saas card-saas-hover p-4 rounded-2xl border-l-4 border-sky-400">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-semibold">
                      <CreditCard size={15} />
                      <span>Pagos Pendientes</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                      {stats?.financial?.pending_payments || 0}
                    </div>
                  </div>

                  <div className="card-saas card-saas-hover p-4 rounded-2xl border-l-4 border-emerald-400">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      <DollarSign size={15} />
                      <span>Ingresos Totales</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                      ${Number(stats?.financial?.total_revenue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Métricas Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="card-saas card-saas-hover p-6 rounded-2xl border-l-4 border-violet-500">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Clientes Totales</span>
                      <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center"><Users size={16} className="text-violet-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                      {stats?.users?.total_users || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      ● {stats?.users?.active_users || 0} activos · {stats?.users?.suspended_users || 0} suspendidos
                    </p>
                  </div>

                  <div className="card-saas card-saas-hover p-6 rounded-2xl border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Líneas WhatsApp</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><Smartphone size={16} className="text-emerald-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                      {stats?.instances?.connected_instances || 0} <span className="text-sm font-normal text-slate-400 font-sans">/ {stats?.instances?.total_instances || 0}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      {stats?.instances?.disabled_instances || 0} deshabilitadas por administración
                    </p>
                  </div>

                  <div className="card-saas card-saas-hover p-6 rounded-2xl border-l-4 border-cyan-500">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mensajes Procesados</span>
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center"><Activity size={16} className="text-cyan-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                      {stats?.traffic?.total_messages || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      ✓ {stats?.traffic?.successful_messages || 0} entregados exitosamente
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* CLIENTES Y LICENCIAS */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20 flex items-center justify-center">
                      <Users size={19} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Directorio de Clientes y Licenciamiento</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Supervisa vencimientos, consumo de cuotas y autorizaciones de API.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreateUserModal(true)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Crear Nuevo Cliente</span>
                  </button>
                </div>

                {/* Buscador */}
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por correo, empresa o ID de cliente..."
                    className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-[#0D131F] rounded-xl text-xs font-medium text-slate-900 dark:text-white ring-1 ring-slate-200/80 dark:ring-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-sm"
                  />
                </div>

                {/* Tabla de Clientes */}
                <div className="card-saas rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 dark:bg-[#111827]/75 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider font-mono">
                          <th className="px-6 py-3.5">Cliente / Empresa</th>
                          <th className="px-6 py-3.5">Plan Actual</th>
                          <th className="px-6 py-3.5">Estado Cuenta</th>
                          <th className="px-6 py-3.5">Días Restantes</th>
                          <th className="px-6 py-3.5">Consumo de Cuota</th>
                          <th className="px-6 py-3.5">Líneas</th>
                          <th className="px-6 py-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white">{u.email}</div>
                              <div className="text-[11px] text-slate-400 font-normal">{u.company_name || 'Sin empresa'} {u.phone ? `· ${u.phone}` : ''}</div>
                            </td>

                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                              {u.plan_name || 'Sin Plan'}
                            </td>

                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                                u.user_status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                                  : u.user_status === 'suspended'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}>
                                ● {u.user_status}
                              </span>
                            </td>

                            <td className="px-6 py-4 font-bold">
                              {u.is_expired ? (
                                <span className="text-rose-600 dark:text-rose-400">🔴 VENCIDO</span>
                              ) : u.days_remaining <= 3 ? (
                                <span className="text-amber-600 dark:text-amber-400">⚠️ {u.days_remaining} días</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">● {u.days_remaining} días</span>
                              )}
                            </td>

                            <td className="px-6 py-4 space-y-1">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                                {u.messages_used || 0} / {u.messages_limit || 1000} msgs
                              </div>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${u.consumption_percentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${u.consumption_percentage || 0}%` }}
                                />
                              </div>
                            </td>

                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {u.connected_instances_count || 0} / {u.max_instances || 1}
                            </td>

                            <td className="px-6 py-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setSubFormData({
                                    planId: u.plan_id || 'plan_basic',
                                    status: u.subscription_status || 'active',
                                    durationDays: 30,
                                    resetQuota: false
                                  });
                                  setEditSubscriptionModal({ open: true, user: u });
                                }}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-750"
                                title="Cambiar Plan / Extender"
                              >
                                Licencia
                              </button>

                              <button
                                onClick={() => {
                                  setPaymentFormData({
                                    amount: u.plan_price || 15,
                                    currency: 'USD',
                                    paymentMethod: 'Transferencia Bancaria',
                                    reference: '',
                                    renewMonths: 1,
                                    planId: u.plan_id || 'plan_basic'
                                  });
                                  setRecordPaymentModal({ open: true, user: u });
                                }}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer border border-emerald-200/50 dark:border-emerald-900/40"
                                title="Registrar Pago"
                              >
                                + Pago
                              </button>

                              <button
                                onClick={() => handleUpdateUserStatus(u.id, u.user_status === 'active' ? 'suspended' : 'active')}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                                  u.user_status === 'active'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/50'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/50'
                                }`}
                              >
                                {u.user_status === 'active' ? 'Suspender' : 'Activar'}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar cliente"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* INSTANCIAS TOTALES */}
            {activeTab === 'instances' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 flex items-center justify-center">
                    <Smartphone size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Líneas de WhatsApp en la Plataforma</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Control de activación y supervisión de todas las instancias del clúster.</p>
                  </div>
                </div>

                <div className="card-saas rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-[#111827]/75 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Instancia</th>
                        <th className="px-6 py-3.5">Propietario</th>
                        <th className="px-6 py-3.5">Conexión WhatsApp</th>
                        <th className="px-6 py-3.5">Licencia Zaza</th>
                        <th className="px-6 py-3.5">Mensajes Enviados</th>
                        <th className="px-6 py-3.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                      {instancesList.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                            {inst.instance_name}
                            <div className="text-[10px] font-normal text-slate-400 font-sans">{inst.phone || 'Sin número'}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                            {inst.owner_email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                              inst.connection_status === 'connected' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {inst.connection_status === 'connected' ? '● CONECTADO' : '○ DESCONECTADO'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                              inst.is_enabled !== false ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {inst.is_enabled !== false ? 'HABILITADA' : 'DESHABILITADA'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {inst.messages_sent || 0} msgs
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleToggleInstance(inst.id, inst.is_enabled !== false)}
                              className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                                inst.is_enabled !== false ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {inst.is_enabled !== false ? 'Deshabilitar' : 'Habilitar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PLANES Y CUOTAS (CRUD) */}
            {activeTab === 'plans' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 flex items-center justify-center">
                      <CreditCard size={19} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Planes y Precios del SaaS</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Configura precios, límites de instancias y cuotas de mensajes.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPlanFormData({ id: '', name: '', maxInstances: 1, price: 15, durationMonths: 1, maxMessages: 1000, isTrial: false, trialDays: 7, trialMessages: 100, description: '' });
                      setPlanModal({ open: true, plan: null });
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Crear Plan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {plansList.map(plan => (
                    <div key={plan.id} className="card-saas card-saas-hover p-5 rounded-2xl space-y-4 text-left border-l-4 border-amber-500">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                          plan.is_trial ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          {plan.is_trial ? 'PLAN TRIAL' : 'PLAN COMERCIAL'}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono">${plan.price}<span className="text-xs text-slate-400 font-normal font-sans">/mes</span></span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 dark:text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{plan.description || 'Sin descripción'}</p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {plan.max_instances === 99 ? 'Instancias Ilimitadas' : `${plan.max_instances} Instancia(s)`}</div>
                        <div className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {plan.max_messages?.toLocaleString()} Mensajes / mes</div>
                        {plan.is_trial && <div className="flex items-center gap-1.5"><span className="text-amber-500">⏱</span> Duración: {plan.trial_days} días</div>}
                      </div>

                      <button
                        onClick={() => {
                          setPlanFormData({
                            id: plan.id,
                            name: plan.name,
                            maxInstances: plan.max_instances,
                            price: Number(plan.price),
                            durationMonths: plan.duration_months,
                            maxMessages: plan.max_messages,
                            isTrial: plan.is_trial,
                            trialDays: plan.trial_days || 7,
                            trialMessages: plan.trial_messages || 100,
                            description: plan.description || ''
                          });
                          setPlanModal({ open: true, plan });
                        }}
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700"
                      >
                        Editar Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HISTORIAL DE PAGOS */}
            {activeTab === 'payments' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20 flex items-center justify-center">
                    <DollarSign size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Registro de Pagos y Facturación</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Historial de renovaciones y pagos registrados en el sistema.</p>
                  </div>
                </div>

                <div className="card-saas rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-[#111827]/75 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Fecha</th>
                        <th className="px-6 py-3.5">Cliente</th>
                        <th className="px-6 py-3.5">Monto</th>
                        <th className="px-6 py-3.5">Método / Ref</th>
                        <th className="px-6 py-3.5">Estado</th>
                        <th className="px-6 py-3.5">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                      {paymentsList.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{pay.user_email}</td>
                          <td className="px-6 py-4 font-black text-emerald-600 font-mono">${Number(pay.amount).toFixed(2)} {pay.currency}</td>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{pay.payment_method} {pay.reference ? `(${pay.reference})` : ''}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase">
                              ● {pay.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{pay.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BITÁCORA DE AUDITORÍA */}
            {activeTab === 'audit' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 flex items-center justify-center">
                    <FileText size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bitácora de Auditoría Administrativa</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Trazabilidad de cambios de planes, suspensiones, extensiones y pagos.</p>
                  </div>
                </div>

                <div className="card-saas rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-[#111827]/75 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Fecha / Hora</th>
                        <th className="px-6 py-3.5">Administrador</th>
                        <th className="px-6 py-3.5">Acción</th>
                        <th className="px-6 py-3.5">Entidad Afectada</th>
                        <th className="px-6 py-3.5">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium font-mono text-[11px]">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white font-sans">{log.admin_email}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">{log.action}</td>
                          <td className="px-6 py-4 uppercase text-slate-700 dark:text-slate-300">{log.entity} ({log.entity_id})</td>
                          <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">{JSON.stringify(log.details)}</td>
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

      {/* MODAL CREAR CLIENTE */}
      {createUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Crear Nuevo Cliente</h3>
              <button onClick={() => setCreateUserModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  value={newUserData.password}
                  onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresa (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.companyName}
                    onChange={e => setNewUserData({ ...newUserData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan Inicial</label>
                <CustomSelect
                  value={newUserData.planId}
                  onChange={val => setNewUserData({ ...newUserData, planId: val })}
                  options={plansList.map(p => ({ value: p.id, label: `${p.name} ($${p.price}/m)` }))}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer mt-2"
              >
                Crear Cliente y Activar Cuenta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR SUSCRIPCIÓN / LICENCIA */}
      {editSubscriptionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Modificar Licencia y Cuota</h3>
              <button onClick={() => setEditSubscriptionModal({ open: false, user: null })} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"><X size={16} /></button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Cliente: <span className="font-bold text-slate-900 dark:text-white">{editSubscriptionModal.user?.email}</span>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan Asignado</label>
                <CustomSelect
                  value={subFormData.planId}
                  onChange={val => setSubFormData({ ...subFormData, planId: val })}
                  options={plansList.map(p => ({ value: p.id, label: `${p.name} ($${p.price}/m)` }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Extender Días</label>
                  <CustomSelect
                    value={String(subFormData.durationDays)}
                    onChange={val => setSubFormData({ ...subFormData, durationDays: parseInt(val, 10) })}
                    options={[
                      { value: '7', label: '+7 Días' },
                      { value: '15', label: '+15 Días' },
                      { value: '30', label: '+30 Días (1 Mes)' },
                      { value: '90', label: '+90 Días (3 Meses)' },
                      { value: '365', label: '+365 Días (1 Año)' }
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estado de Licencia</label>
                  <CustomSelect
                    value={subFormData.status}
                    onChange={val => setSubFormData({ ...subFormData, status: val })}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'trial', label: 'Trial' },
                      { value: 'suspended', label: 'Suspendido' },
                      { value: 'expired', label: 'Expirado' }
                    ]}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={subFormData.resetQuota}
                  onChange={e => setSubFormData({ ...subFormData, resetQuota: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Resetear cuota de mensajes consumidos a 0</span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer mt-2"
              >
                Aplicar Cambios de Suscripción
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO */}
      {recordPaymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Registrar Pago y Renovar</h3>
              <button onClick={() => setRecordPaymentModal({ open: false, user: null })} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"><X size={16} /></button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Cliente: <span className="font-bold text-slate-900 dark:text-white">{recordPaymentModal.user?.email}</span>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monto Pagado</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentFormData.amount}
                    onChange={e => setPaymentFormData({ ...paymentFormData, amount: parseFloat(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Moneda</label>
                  <CustomSelect
                    value={paymentFormData.currency}
                    onChange={val => setPaymentFormData({ ...paymentFormData, currency: val })}
                    options={[
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'PEN', label: 'PEN (S/)' },
                      { value: 'EUR', label: 'EUR (€)' }
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Método de Pago</label>
                <input
                  type="text"
                  value={paymentFormData.paymentMethod}
                  onChange={e => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  placeholder="ej: Transferencia BCP, Stripe, Efectivo"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Referencia / Nro Operación</label>
                <input
                  type="text"
                  value={paymentFormData.reference}
                  onChange={e => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  placeholder="ej: OP-84920482"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Meses a Renovar</label>
                <CustomSelect
                  value={String(paymentFormData.renewMonths)}
                  onChange={val => setPaymentFormData({ ...paymentFormData, renewMonths: parseInt(val, 10) })}
                  options={[
                    { value: '1', label: '1 Mes' },
                    { value: '3', label: '3 Meses' },
                    { value: '6', label: '6 Meses' },
                    { value: '12', label: '12 Meses (1 Año)' }
                  ]}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer mt-2"
              >
                Confirmar Pago y Reactivar Servicio
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLANES (CREAR / EDITAR) */}
      {planModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {planModal.plan?.id ? 'Editar Plan' : 'Crear Plan'}
              </h3>
              <button onClick={() => setPlanModal({ open: false, plan: null })} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"><X size={16} /></button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              {!planModal.plan?.id && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">ID Único (ej: plan_pro)</label>
                  <input
                    type="text"
                    required
                    value={planFormData.id}
                    onChange={e => setPlanFormData({ ...planFormData, id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nombre del Plan</label>
                <input
                  type="text"
                  required
                  value={planFormData.name}
                  onChange={e => setPlanFormData({ ...planFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Precio Mensual ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planFormData.price}
                    onChange={e => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Máx. Instancias</label>
                  <input
                    type="number"
                    required
                    value={planFormData.maxInstances}
                    onChange={e => setPlanFormData({ ...planFormData, maxInstances: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Límite de Mensajes / Mes</label>
                <input
                  type="number"
                  required
                  value={planFormData.maxMessages}
                  onChange={e => setPlanFormData({ ...planFormData, maxMessages: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#141D2E] rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer mt-2"
              >
                Guardar Configuración de Plan
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
