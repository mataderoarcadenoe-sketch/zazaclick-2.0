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
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white transition-colors duration-250 font-sans overflow-hidden">
      
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
        className={`bg-white dark:bg-[#0B0F19] flex flex-col transition-all duration-250 z-40 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
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
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

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
                <Icon size={19} className="flex-shrink-0" />
                {sidebarOpen && <span className="ml-3.5 text-xs tracking-tight">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 bg-white dark:bg-[#0B0F19]">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-3 justify-start' : 'p-3 justify-center'
            } rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="ml-3 text-xs font-bold">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-250 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Header */}
        <header className="h-16 bg-white dark:bg-[#0B0F19] px-4 sm:px-8 lg:px-12 flex items-center justify-between z-30 transition-colors border-b border-slate-100 dark:border-slate-800/40">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600">
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {menuItems.find(i => i.id === activeTab)?.label || 'Panel de Control'}
              </h2>
              <p className="text-[11px] text-slate-400">Control maestro de licenciamiento, cuotas atómicas y facturación.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDark}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
            </button>
            <button
              onClick={fetchAdminData}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 hover:text-emerald-600 cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 bg-[#F8FAFC] dark:bg-[#070B12] relative overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8 max-w-[1920px] mx-auto">
            
            {/* OVERVIEW GLOBAL DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-fadeIn text-left">
                
                {/* Alertas Operativas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-5 bg-amber-50 dark:bg-amber-950/40 rounded-3xl space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-bold">
                      <Clock size={16} />
                      <span>Próximos a Vencer (3d)</span>
                    </div>
                    <div className="text-2xl font-black text-amber-800 dark:text-amber-200">
                      {stats?.subscriptions?.expiring_soon || 0}
                    </div>
                  </div>

                  <div className="p-5 bg-rose-50 dark:bg-rose-950/40 rounded-3xl space-y-1">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                      <AlertTriangle size={16} />
                      <span>Suscripciones Vencidas</span>
                    </div>
                    <div className="text-2xl font-black text-rose-800 dark:text-rose-200">
                      {stats?.subscriptions?.expired_subscriptions || 0}
                    </div>
                  </div>

                  <div className="p-5 bg-sky-50 dark:bg-sky-950/40 rounded-3xl space-y-1">
                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 text-xs font-bold">
                      <CreditCard size={16} />
                      <span>Pagos Pendientes</span>
                    </div>
                    <div className="text-2xl font-black text-sky-800 dark:text-sky-200">
                      {stats?.financial?.pending_payments || 0}
                    </div>
                  </div>

                  <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 rounded-3xl space-y-1">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <DollarSign size={16} />
                      <span>Ingresos Totales</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                      ${Number(stats?.financial?.total_revenue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Métricas Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clientes Totales</span>
                    <div className="text-4xl font-black text-slate-900 dark:text-white">
                      {stats?.users?.total_users || 0}
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      ● {stats?.users?.active_users || 0} Activos · {stats?.users?.suspended_users || 0} Suspendidos
                    </p>
                  </div>

                  <div className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Líneas WhatsApp</span>
                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                      {stats?.instances?.connected_instances || 0} <span className="text-base text-slate-400">/ {stats?.instances?.total_instances || 0}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {stats?.instances?.disabled_instances || 0} deshabilitadas por administración
                    </p>
                  </div>

                  <div className="p-7 bg-white dark:bg-[#0D131F] rounded-3xl space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensajes Procesados</span>
                    <div className="text-4xl font-black text-teal-600 dark:text-teal-400">
                      {stats?.traffic?.total_messages || 0}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
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
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Directorio de Clientes y Licenciamiento</h2>
                    <p className="text-xs text-slate-500 font-normal">Supervisa vencimientos, consumo de cuotas y autorizaciones de API.</p>
                  </div>

                  <button
                    onClick={() => setCreateUserModal(true)}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Crear Nuevo Cliente</span>
                  </button>
                </div>

                {/* Buscador */}
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por correo, empresa o ID de cliente..."
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0D131F] rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Tabla de Clientes */}
                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                          <th className="px-6 py-4">Cliente / Empresa</th>
                          <th className="px-6 py-4">Plan Actual</th>
                          <th className="px-6 py-4">Estado Cuenta</th>
                          <th className="px-6 py-4">Días Restantes</th>
                          <th className="px-6 py-4">Consumo de Cuota</th>
                          <th className="px-6 py-4">Líneas</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-[#141D2E]/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white">{u.email}</div>
                              <div className="text-[11px] text-slate-400">{u.company_name || 'Sin empresa'} {u.phone ? `· ${u.phone}` : ''}</div>
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
                              <div className="text-[11px] font-bold">
                                {u.messages_used || 0} / {u.messages_limit || 1000} msgs
                              </div>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${u.consumption_percentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${u.consumption_percentage || 0}%` }}
                                />
                              </div>
                            </td>

                            <td className="px-6 py-4 font-bold">
                              {u.connected_instances_count || 0} / {u.max_instances || 1}
                            </td>

                            <td className="px-6 py-4 text-right space-x-2">
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
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
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
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
                                title="Registrar Pago"
                              >
                                + Pago
                              </button>

                              <button
                                onClick={() => handleUpdateUserStatus(u.id, u.user_status === 'active' ? 'suspended' : 'active')}
                                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-colors cursor-pointer ${
                                  u.user_status === 'active'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {u.user_status === 'active' ? 'Suspender' : 'Activar'}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl"
                                title="Eliminar cliente"
                              >
                                <Trash2 size={15} />
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
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Líneas de WhatsApp en la Plataforma</h2>
                  <p className="text-xs text-slate-500 font-normal">Control de activación y supervisión de todas las instancias del clúster.</p>
                </div>

                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                        <th className="px-6 py-4">Instancia</th>
                        <th className="px-6 py-4">Propietario</th>
                        <th className="px-6 py-4">Conexión WhatsApp</th>
                        <th className="px-6 py-4">Licencia Zaza</th>
                        <th className="px-6 py-4">Mensajes Enviados</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                      {instancesList.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-[#141D2E]/40">
                          <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                            {inst.instance_name}
                            <div className="text-[10px] font-normal text-slate-400">{inst.phone || 'Sin número'}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                            {inst.owner_email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              inst.connection_status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {inst.connection_status === 'connected' ? '● CONECTADO' : '○ DESCONECTADO'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              inst.is_enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {inst.is_enabled !== false ? 'HABILITADA' : 'DESHABILITADA'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold">
                            {inst.messages_sent || 0} msgs
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleToggleInstance(inst.id, inst.is_enabled !== false)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer ${
                                inst.is_enabled !== false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
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
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Planes y Precios del SaaS</h2>
                    <p className="text-xs text-slate-500 font-normal">Configura precios, límites de instancias y cuotas de mensajes.</p>
                  </div>
                  <button
                    onClick={() => {
                      setPlanFormData({ id: '', name: '', maxInstances: 1, price: 15, durationMonths: 1, maxMessages: 1000, isTrial: false, trialDays: 7, trialMessages: 100, description: '' });
                      setPlanModal({ open: true, plan: null });
                    }}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Crear Plan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {plansList.map(plan => (
                    <div key={plan.id} className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                          plan.is_trial ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {plan.is_trial ? 'PLAN TRIAL' : 'PLAN COMERCIAL'}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">${plan.price}/m</span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 dark:text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-500">{plan.description || 'Sin descripción'}</p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <div>● {plan.max_instances === 99 ? 'Instancias Ilimitadas' : `${plan.max_instances} Instancia(s)`}</div>
                        <div>● {plan.max_messages?.toLocaleString()} Mensajes / mes</div>
                        {plan.is_trial && <div>● Duración: {plan.trial_days} días</div>}
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
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-xs hover:bg-slate-200 cursor-pointer"
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
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Registro de Pagos y Facturación</h2>
                  <p className="text-xs text-slate-500 font-normal">Historial de renovaciones y pagos registrados en el sistema.</p>
                </div>

                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Cliente</th>
                        <th className="px-6 py-4">Monto</th>
                        <th className="px-6 py-4">Método / Ref</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium">
                      {paymentsList.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-[#141D2E]/40">
                          <td className="px-6 py-4 text-slate-500">{new Date(pay.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{pay.user_email}</td>
                          <td className="px-6 py-4 font-black text-emerald-600">${Number(pay.amount).toFixed(2)} {pay.currency}</td>
                          <td className="px-6 py-4">{pay.payment_method} {pay.reference ? `(${pay.reference})` : ''}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">
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
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Bitácora de Auditoría Administrativa</h2>
                  <p className="text-xs text-slate-500 font-normal">Trazabilidad de cambios de planes, suspensiones, extensiones y pagos.</p>
                </div>

                <div className="bg-white dark:bg-[#0D131F] rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="px-6 py-4">Fecha / Hora</th>
                        <th className="px-6 py-4">Administrador</th>
                        <th className="px-6 py-4">Acción</th>
                        <th className="px-6 py-4">Entidad Afectada</th>
                        <th className="px-6 py-4">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-medium font-mono text-[11px]">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-[#141D2E]/40">
                          <td className="px-6 py-4 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{log.admin_email}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">{log.action}</td>
                          <td className="px-6 py-4 uppercase">{log.entity} ({log.entity_id})</td>
                          <td className="px-6 py-4 text-slate-400">{JSON.stringify(log.details)}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-3xl p-6 sm:p-8 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Crear Nuevo Cliente</h3>
              <button onClick={() => setCreateUserModal(false)} className="p-1.5 text-slate-400"><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  value={newUserData.password}
                  onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Empresa (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.companyName}
                    onChange={e => setNewUserData({ ...newUserData, companyName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Plan Inicial</label>
                <CustomSelect
                  value={newUserData.planId}
                  onChange={val => setNewUserData({ ...newUserData, planId: val })}
                  options={plansList.map(p => ({ value: p.id, label: `${p.name} ($${p.price}/m)` }))}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-2xl cursor-pointer"
              >
                Crear Cliente y Activar Cuenta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR SUSCRIPCIÓN / LICENCIA */}
      {editSubscriptionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-3xl p-6 sm:p-8 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Modificar Licencia y Cuota</h3>
              <button onClick={() => setEditSubscriptionModal({ open: false, user: null })} className="p-1.5 text-slate-400"><X size={16} /></button>
            </div>

            <div className="text-xs text-slate-400">
              Cliente: <span className="font-bold text-slate-900 dark:text-white">{editSubscriptionModal.user?.email}</span>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Plan Asignado</label>
                <CustomSelect
                  value={subFormData.planId}
                  onChange={val => setSubFormData({ ...subFormData, planId: val })}
                  options={plansList.map(p => ({ value: p.id, label: `${p.name} ($${p.price}/m)` }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Extender Días</label>
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
                  <label className="text-xs font-bold text-slate-400">Estado de Licencia</label>
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

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={subFormData.resetQuota}
                  onChange={e => setSubFormData({ ...subFormData, resetQuota: e.target.checked })}
                  className="rounded"
                />
                <span>Resetear cuota de mensajes consumidos a 0</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-2xl cursor-pointer"
              >
                Aplicar Cambios de Suscripción
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO */}
      {recordPaymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-3xl p-6 sm:p-8 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Registrar Pago y Renovar</h3>
              <button onClick={() => setRecordPaymentModal({ open: false, user: null })} className="p-1.5 text-slate-400"><X size={16} /></button>
            </div>

            <div className="text-xs text-slate-400">
              Cliente: <span className="font-bold text-slate-900 dark:text-white">{recordPaymentModal.user?.email}</span>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Monto Pagado</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentFormData.amount}
                    onChange={e => setPaymentFormData({ ...paymentFormData, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Moneda</label>
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
                <label className="text-xs font-bold text-slate-400">Método de Pago</label>
                <input
                  type="text"
                  value={paymentFormData.paymentMethod}
                  onChange={e => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  placeholder="ej: Transferencia BCP, Stripe, Efectivo"
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Referencia / Nro Operación</label>
                <input
                  type="text"
                  value={paymentFormData.reference}
                  onChange={e => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  placeholder="ej: OP-84920482"
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Meses a Renovar</label>
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
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-2xl cursor-pointer"
              >
                Confirmar Pago y Reactivar Servicio
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLANES (CREAR / EDITAR) */}
      {planModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#0D131F] rounded-3xl p-6 sm:p-8 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {planModal.plan?.id ? 'Editar Plan' : 'Crear Plan'}
              </h3>
              <button onClick={() => setPlanModal({ open: false, plan: null })} className="p-1.5 text-slate-400"><X size={16} /></button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              {!planModal.plan?.id && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">ID Único (ej: plan_pro)</label>
                  <input
                    type="text"
                    required
                    value={planFormData.id}
                    onChange={e => setPlanFormData({ ...planFormData, id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Nombre del Plan</label>
                <input
                  type="text"
                  required
                  value={planFormData.name}
                  onChange={e => setPlanFormData({ ...planFormData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Precio Mensual ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planFormData.price}
                    onChange={e => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs font-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Máx. Instancias</label>
                  <input
                    type="number"
                    required
                    value={planFormData.maxInstances}
                    onChange={e => setPlanFormData({ ...planFormData, maxInstances: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Límite de Mensajes / Mes</label>
                <input
                  type="number"
                  required
                  value={planFormData.maxMessages}
                  onChange={e => setPlanFormData({ ...planFormData, maxMessages: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-[#141D2E] rounded-xl text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-2xl cursor-pointer"
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
