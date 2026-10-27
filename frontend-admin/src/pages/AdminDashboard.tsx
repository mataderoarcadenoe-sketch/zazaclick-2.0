// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../services/authContext';
import { 
  Users, Smartphone, LogOut, 
  Search, Moon, Sun, 
  X, Menu, Key, Activity, 
  RefreshCw, Plus, DollarSign, Clock, AlertTriangle,
  RotateCcw, CreditCard, FileText, Trash2,
  Cpu, Zap, Building2, Code2, Copy, Layers
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ToastNotification } from '../components/ToastNotification';
import { ZazaLogo } from '../components/ZazaLogo';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  // 6 Apartados Únicos en Orden Ejecutivo
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'instances' | 'b2b' | 'billing' | 'audit'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isDark, toggle: toggleDark } = useDarkMode();

  // SuperAdmin Data States
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [instancesList, setInstancesList] = useState<any[]>([]);
  const [enginesHealth, setEnginesHealth] = useState<any[]>([]);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [b2bSnippetTab, setB2bSnippetTab] = useState<'provision' | 'status' | 'qr' | 'renew'>('provision');
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [docPartnerTarget, setDocPartnerTarget] = useState<'generic' | 'krono' | 'vivesfit'>('generic');
  const [createPartnerModal, setCreatePartnerModal] = useState(false);
  const [newPartnerData, setNewPartnerData] = useState({ name: '', slug: '', category: 'general', contactEmail: '', webhookUrl: '' });
  const [createdPartnerSecret, setCreatedPartnerSecret] = useState<{ name: string; secretKey: string } | null>(null);
  const [notification, setNotification] = useState<{ text: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Modal de Confirmación
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

  // Modales Administrativos
  const [createUserModal, setCreateUserModal] = useState(false);
  const [editSubscriptionModal, setEditSubscriptionModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [recordPaymentModal, setRecordPaymentModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [planModal, setPlanModal] = useState<{ open: boolean; plan: any | null }>({ open: false, plan: null });

  // Form States para Modales
  const [newUserData, setNewUserData] = useState({ email: '', password: '', companyName: '', phone: '', planId: 'plan_basic', durationMonths: 1 });
  const [subFormData, setSubFormData] = useState({ planId: '', status: 'active', durationDays: 30, resetQuota: false });
  const [paymentFormData, setPaymentFormData] = useState({ amount: 15, currency: 'USD', paymentMethod: 'Transferencia', reference: '', renewMonths: 1, planId: '' });
  const [planFormData, setPlanFormData] = useState({ id: '', name: '', maxInstances: 1, price: 15, durationMonths: 1, maxMessages: 1000, isTrial: false, trialDays: 7, trialMessages: 100, description: '' });

  const showNotification = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', title?: string) => {
    setNotification({ text, type, title });
  };

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, instRes, plansRes, payRes, auditRes, enginesRes, partnersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/instances'),
        api.get('/admin/plans'),
        api.get('/admin/payments'),
        api.get('/admin/audit-logs'),
        api.get('/admin/engines/health').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/admin/partners').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (usersRes.data?.success) setUsersList(usersRes.data.data || []);
      if (instRes.data?.success) setInstancesList(usersRes.data.data ? instRes.data.data || [] : []);
      if (plansRes.data?.success) setPlansList(plansRes.data.data || []);
      if (payRes.data?.success) setPaymentsList(payRes.data.data || []);
      if (auditRes.data?.success) setAuditLogs(auditRes.data.data || []);
      if (enginesRes.data?.success) setEnginesHealth(enginesRes.data.data || []);
      if (partnersRes.data?.success) setPartnersList(partnersRes.data.data || []);
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

  // Handlers de Partners B2B
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/partners', newPartnerData);
      if (res.data?.success) {
        showNotification('Partner B2B registrado exitosamente', 'success');
        setCreatedPartnerSecret({
          name: res.data.data.name,
          secretKey: res.data.secretKey
        });
        setCreatePartnerModal(false);
        setNewPartnerData({ name: '', slug: '', category: 'general', contactEmail: '', webhookUrl: '' });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al registrar partner B2B', 'error');
    }
  };

  const handleTogglePartnerStatus = async (partner: any) => {
    const newStatus = !partner.isActive;
    try {
      const res = await api.put(`/admin/partners/${partner.id}/status`, { isActive: newStatus });
      if (res.data?.success) {
        showNotification(`Partner "${partner.name}" ${newStatus ? 'activado' : 'pausado'} exitosamente`, 'success');
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar estado del partner', 'error');
    }
  };

  const handleRotatePartnerKey = (partner: any) => {
    setConfirmModal({
      open: true,
      title: `Rotar Master Key de ${partner.name}`,
      message: (
        <span>
          ¿Estás seguro de rotar la Master Key de <strong>{partner.name}</strong>? La clave anterior quedará invalidada de inmediato y las solicitudes de ese software se rechazarán hasta actualizar su credencial.
        </span>
      ),
      warningNote: 'Esta acción requiere actualizar la variable de entorno en el backend del software partner.',
      type: 'warning',
      confirmText: 'Sí, rotar clave',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.post(`/admin/partners/${partner.id}/rotate-key`);
          if (res.data?.success) {
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            setCreatedPartnerSecret({
              name: partner.name,
              secretKey: res.data.newSecretKey
            });
            showNotification('Master Key rotada exitosamente', 'success');
            fetchAdminData();
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al rotar clave', 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

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

  const handleUpdateUserStatus = (userId: string, status: 'active' | 'suspended' | 'blocked', email?: string) => {
    if (status === 'blocked' || status === 'suspended') {
      setConfirmModal({
        open: true,
        title: status === 'blocked' ? 'Bloquear Acceso del Cliente' : 'Suspender Servicio',
        message: (
          <span>
            ¿Deseas cambiar el estado de acceso de {email ? <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{email}</strong> : 'este cliente'} a <strong className="uppercase text-amber-500">{status}</strong>? Sus llamadas a la API e instancias quedarán deshabilitadas.
          </span>
        ),
        warningNote: 'El cliente no podrá autenticarse ni emitir llamadas a través de la API Gateway mientras esté suspendido/bloqueado.',
        type: 'warning',
        confirmText: status === 'blocked' ? 'Bloquear Cliente' : 'Suspender Servicio',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            const res = await api.put(`/admin/users/${userId}/status`, { status });
            if (res.data?.success) {
              showNotification(`Estado de cliente actualizado a ${status.toUpperCase()}`, 'success');
              setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
              fetchAdminData();
            }
          } catch (err: any) {
            showNotification(err.response?.data?.error || 'Error al actualizar estado', 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        }
      });
      return;
    }

    (async () => {
      try {
        const res = await api.put(`/admin/users/${userId}/status`, { status });
        if (res.data?.success) {
          showNotification(`Estado de cliente activado exitosamente`, 'success');
          fetchAdminData();
        }
      } catch (err: any) {
        showNotification(err.response?.data?.error || 'Error al actualizar estado', 'error');
      }
    })();
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubscriptionModal.user) return;

    try {
      const res = await api.put(`/admin/users/${editSubscriptionModal.user.id}/subscription`, subFormData);
      if (res.data?.success) {
        showNotification('Suscripción y cuotas del cliente actualizadas exitosamente', 'success');
        setEditSubscriptionModal({ open: false, user: null });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar suscripción', 'error');
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
        showNotification('Pago registrado exitosamente y servicio renovado', 'success');
        setRecordPaymentModal({ open: false, user: null });
        fetchAdminData();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al registrar pago', 'error');
    }
  };

  const handleToggleInstance = (instId: string, currentEnabled: boolean, instanceName?: string) => {
    if (currentEnabled) {
      setConfirmModal({
        open: true,
        title: 'Deshabilitar Instancia WhatsApp',
        message: (
          <span>
            ¿Deseas deshabilitar la instancia {instanceName ? <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{instanceName}</strong> : ''}? El cliente no podrá enviar ni recibir mensajes a través de ella hasta que sea reactivada.
          </span>
        ),
        type: 'warning',
        confirmText: 'Deshabilitar Instancia',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            const res = await api.put(`/admin/instances/${instId}/toggle`, { isEnabled: false });
            if (res.data?.success) {
              showNotification('Instancia deshabilitada', 'warning');
              setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
              fetchAdminData();
            }
          } catch (err: any) {
            showNotification(err.response?.data?.error || 'Error al modificar instancia', 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        }
      });
      return;
    }

    (async () => {
      try {
        const res = await api.put(`/admin/instances/${instId}/toggle`, { isEnabled: true });
        if (res.data?.success) {
          showNotification('Instancia habilitada exitosamente', 'success');
          fetchAdminData();
        }
      } catch (err: any) {
        showNotification(err.response?.data?.error || 'Error al modificar instancia', 'error');
      }
    })();
  };

  const handleDeleteUser = (userId: string, email: string) => {
    setConfirmModal({
      open: true,
      title: 'Eliminar Cliente Permanentemente',
      message: (
        <span>
          ¿Estás seguro de eliminar permanentemente al cliente <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{email}</strong> y todas sus instancias?
        </span>
      ),
      warningNote: 'Esta acción no se puede deshacer. Se eliminarán permanentemente todas las sesiones, tokens e instancias conectadas.',
      type: 'danger',
      confirmText: 'Eliminar Cliente',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/admin/users/${userId}`);
          if (res.data?.success) {
            showNotification('Cliente eliminado exitosamente', 'success');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            fetchAdminData();
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al eliminar cliente', 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
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

  // Filtrado unificado para el Directorio Maestro de Clientes y Empresas
  const filteredUsers = usersList.filter(u => {
    const matchesSearch =
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.external_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (partnerFilter === 'all') return true;
    if (partnerFilter === 'direct') return !u.partner_id;
    return u.partner_id === partnerFilter || u.partner_slug === partnerFilter;
  });

  // 6 Apartados Únicos — Cero Repeticiones
  const menuItems = [
    { id: 'overview', label: 'Resumen Global', icon: Activity },
    { id: 'users', label: 'Clientes y Empresas', icon: Users },
    { id: 'instances', label: 'Líneas WhatsApp', icon: Smartphone },
    { id: 'b2b', label: 'Partners B2B', icon: Building2 },
    { id: 'billing', label: 'Planes y Pagos', icon: DollarSign },
    { id: 'audit', label: 'Auditoría', icon: FileText },
  ];

  const goHealth = enginesHealth.find(e => e.engine === 'evolution_go');
  const isGoOnline = goHealth?.status === 'ONLINE' || !goHealth;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-white font-sans overflow-hidden relative">

      {/* Toast Notification */}
      <ToastNotification notification={notification} onClose={() => setNotification(null)} />

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Barra Lateral Limpia y Sólida */}
      <aside 
        className={`surface-panel flex flex-col z-40 fixed top-0 left-0 h-full border-r border-slate-200 dark:border-slate-800 ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`h-16 flex items-center border-b border-slate-100 dark:border-slate-800/80 ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <ZazaLogo size={34} />
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza Admin <span className="text-emerald-600 dark:text-emerald-400">2.0</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SuperAdmin Core</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
                } rounded-xl relative cursor-pointer ${
                  active 
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon size={18} className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                {sidebarOpen ? (
                  <span className="ml-3 text-xs tracking-tight">{item.label}</span>
                ) : (
                  <span className="absolute left-full ml-3 px-3 py-1.5 surface-elevated text-slate-900 dark:text-white text-xs font-semibold rounded-xl whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-3.5 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="ml-3 text-xs font-semibold">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Header */}
        <header className="h-16 surface-panel px-4 sm:px-8 lg:px-10 flex items-center justify-between z-30 border-b border-slate-200 dark:border-slate-800 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 lg:hidden cursor-pointer">
              <Menu size={20} />
            </button>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.label || 'Panel de Control'}
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                  SUPERADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">
                Gobierno maestro de clientes, Partners B2B, licencias y motor Evolution Go.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg surface-accent-emerald text-emerald-700 dark:text-emerald-300">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Control Core · Activo</span>
            </div>

            <button
              onClick={toggleDark}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
            </button>
            <button
              onClick={fetchAdminData}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                {(user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">SuperAdmin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body — Fondo Limpio Sólido */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-10 py-7 space-y-6 max-w-[1600px] mx-auto">
            
            {/* ============================================================================
                APARTADO 1: RESUMEN GLOBAL (KPIS, ALERTAS Y SALUD DEL MOTOR)
               ============================================================================ */}
            {activeTab === 'overview' && (
              <div className="space-y-6 text-left">
                
                {/* Alertas Operativas y Financieras */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="surface-panel p-5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      <Clock size={15} />
                      <span>Próximos a Vencer (3d)</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.subscriptions?.expiring_soon || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                      <AlertTriangle size={15} />
                      <span>Suscripciones Vencidas</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.subscriptions?.expired_subscriptions || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                      <CreditCard size={15} />
                      <span>Pagos Pendientes</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.financial?.pending_payments || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <DollarSign size={15} />
                      <span>Ingresos Totales</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      ${Number(stats?.financial?.total_revenue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Métricas Principales de Infraestructura */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clientes y Empresas</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-emerald flex items-center justify-center"><Users size={16} className="text-emerald-600 dark:text-emerald-400" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.users?.total_users || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      ● {stats?.users?.active_users || 0} activos · {stats?.users?.suspended_users || 0} suspendidos
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Líneas WhatsApp</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-emerald flex items-center justify-center"><Smartphone size={16} className="text-emerald-600 dark:text-emerald-400" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.instances?.connected_instances || 0} <span className="text-sm font-normal text-slate-400 font-sans">/ {stats?.instances?.total_instances || 0}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {stats?.instances?.disabled_instances || 0} deshabilitadas por administración
                    </p>
                  </div>

                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mensajes Procesados</span>
                      <div className="w-8 h-8 rounded-lg surface-accent-indigo flex items-center justify-center"><Activity size={16} className="text-indigo-600 dark:text-indigo-400" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.traffic?.total_messages || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      ✓ {stats?.traffic?.successful_messages || 0} entregados exitosamente
                    </p>
                  </div>
                </div>

                {/* Salud del Motor Oficial Unificado (Integrado en Resumen Global) */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl surface-accent-indigo text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Cpu size={19} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Estado del Motor Oficial: Evolution Go (Golang / Whatsmeow)</div>
                        <div className="text-xs text-slate-500">Motor unificado de WhatsApp en ejecución continua 24/7.</div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase ${
                      isGoOnline
                        ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                        : 'surface-accent-amber text-amber-700 dark:text-amber-300'
                    }`}>
                      ● {goHealth?.status || 'ONLINE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-3.5 rounded-xl surface-interactive">
                      <div className="text-[11px] text-slate-500 uppercase font-mono">Latencia Interna</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {goHealth?.latencyMs || 14} ms
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl surface-interactive">
                      <div className="text-[11px] text-slate-500 uppercase font-mono">Líneas Registradas</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                        {instancesList.length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl surface-interactive">
                      <div className="text-[11px] text-slate-500 uppercase font-mono">Software Partners Activos</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        {partnersList.filter(p => p.isActive).length} / {partnersList.length}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================================
                APARTADO 2: CLIENTES Y EMPRESAS (DIRECTORIO MAESTRO ÚNICO, DIRECTOS + B2B)
               ============================================================================ */}
            {activeTab === 'users' && (
              <div className="space-y-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Users size={19} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Directorio Maestro de Clientes y Empresas</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Administra clientes directos y sedes aprovisionadas vía Partners B2B desde una sola tabla unificada.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreateUserModal(true)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Crear Nuevo Cliente</span>
                  </button>
                </div>

                {/* Barra de Búsqueda + Filtro por Origen / Partner B2B */}
                <div className="surface-panel p-4 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por correo, empresa, ID externo o ID de cliente..."
                      className="w-full pl-10 pr-4 py-2 surface-interactive rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {/* Filtro de Origen */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      onClick={() => setPartnerFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                        partnerFilter === 'all'
                          ? 'bg-slate-900 text-white dark:bg-emerald-600'
                          : 'surface-interactive text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Todos ({usersList.length})
                    </button>

                    <button
                      onClick={() => setPartnerFilter('direct')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                        partnerFilter === 'direct'
                          ? 'bg-slate-900 text-white dark:bg-emerald-600'
                          : 'surface-interactive text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Directos ({usersList.filter(u => !u.partner_id).length})
                    </button>

                    {partnersList.map(p => {
                      const count = usersList.filter(u => u.partner_id === p.id || u.partner_slug === p.slug).length;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPartnerFilter(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                            partnerFilter === p.id
                              ? 'bg-slate-900 text-white dark:bg-emerald-600'
                              : 'surface-interactive text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {p.name.split(' ')[0]} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tabla Única de Clientes y Empresas */}
                <div className="surface-panel rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase font-bold text-[10px] tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                          <th className="px-5 py-3.5">Cliente / Empresa</th>
                          <th className="px-5 py-3.5">Origen / Partner</th>
                          <th className="px-5 py-3.5">Plan Actual</th>
                          <th className="px-5 py-3.5">Estado</th>
                          <th className="px-5 py-3.5">Vigencia</th>
                          <th className="px-5 py-3.5">Consumo de Cuota</th>
                          <th className="px-5 py-3.5">Líneas</th>
                          <th className="px-5 py-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {filteredUsers.map((u) => {
                          const matchedPartner = partnersList.find(p => p.id === u.partner_id || p.slug === u.partner_slug);
                          return (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-5 py-4">
                                <div className="font-bold text-slate-900 dark:text-white">{u.company_name || u.email}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{u.email} {u.phone ? `· ${u.phone}` : ''}</div>
                              </td>

                              <td className="px-5 py-4">
                                {matchedPartner ? (
                                  <div className="space-y-0.5">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono surface-accent-indigo text-indigo-700 dark:text-indigo-300 inline-block">
                                      {matchedPartner.name}
                                    </span>
                                    {u.external_id && (
                                      <div className="text-[10px] font-mono text-slate-400">ID: {u.external_id}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 surface-interactive">
                                    Directo
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                                {u.plan_name || 'Sin Plan'}
                              </td>

                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${
                                  u.user_status === 'active' 
                                    ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300' 
                                    : u.user_status === 'suspended'
                                    ? 'surface-accent-amber text-amber-700 dark:text-amber-300'
                                    : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                                }`}>
                                  {u.user_status}
                                </span>
                              </td>

                              <td className="px-5 py-4 font-bold">
                                {u.is_expired ? (
                                  <span className="text-rose-600 dark:text-rose-400">Vencido</span>
                                ) : u.days_remaining <= 3 ? (
                                  <span className="text-amber-600 dark:text-amber-400">{u.days_remaining} días</span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400">{u.days_remaining} días</span>
                                )}
                              </td>

                              <td className="px-5 py-4 space-y-1">
                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                                  {u.messages_used || 0} / {u.messages_limit || 1000}
                                </div>
                                <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${u.consumption_percentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, u.consumption_percentage || 0)}%` }}
                                  />
                                </div>
                              </td>

                              <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {u.connected_instances_count || 0} / {u.max_instances || 1}
                              </td>

                              <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSubFormData({
                                      planId: u.plan_id || 'plan_basic',
                                      status: u.subscription_status || u.user_status || 'active',
                                      durationDays: '0',
                                      resetQuota: false
                                    });
                                    setEditSubscriptionModal({ open: true, user: u });
                                  }}
                                  className="px-2.5 py-1 surface-interactive text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-[11px] cursor-pointer"
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
                                  className="px-2.5 py-1 surface-accent-emerald text-emerald-700 dark:text-emerald-300 rounded-lg font-semibold text-[11px] cursor-pointer"
                                >
                                  + Pago
                                </button>

                                <button
                                  onClick={() => handleUpdateUserStatus(u.id, u.user_status === 'active' ? 'suspended' : 'active', u.email)}
                                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] cursor-pointer ${
                                    u.user_status === 'active'
                                      ? 'surface-accent-amber text-amber-700 dark:text-amber-300'
                                      : 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  {u.user_status === 'active' ? 'Suspender' : 'Activar'}
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                  title="Eliminar cliente"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================================
                APARTADO 3: LÍNEAS WHATSAPP (MONITOR GLOBAL DE INSTANCIAS)
               ============================================================================ */}
            {activeTab === 'instances' && (
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Smartphone size={19} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Monitor Global de Líneas WhatsApp</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Supervisa todas las instancias registradas en Evolution Go y controla su autorización operativa.</p>
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase font-bold text-[10px] tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-3.5">Instancia</th>
                          <th className="px-6 py-3.5">Motor</th>
                          <th className="px-6 py-3.5">Propietario</th>
                          <th className="px-6 py-3.5">Conexión WhatsApp</th>
                          <th className="px-6 py-3.5">Autorización</th>
                          <th className="px-6 py-3.5">Mensajes Enviados</th>
                          <th className="px-6 py-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {instancesList.map(inst => (
                          <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                              {inst.instance_name}
                              <div className="text-[10px] font-normal text-slate-400 font-sans">{inst.phone || 'Sin número'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 text-[10px] font-bold rounded-md uppercase inline-flex items-center gap-1 surface-accent-indigo text-indigo-700 dark:text-indigo-300">
                                <Zap size={10} />
                                <span>Evolution Go</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                              {inst.owner_email}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${
                                inst.connection_status === 'connected' 
                                  ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300' 
                                  : inst.connection_status === 'reconnecting'
                                  ? 'surface-accent-amber text-amber-700 dark:text-amber-300'
                                  : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                              }`}>
                                {inst.connection_status === 'connected' ? '● Conectado' : inst.connection_status === 'reconnecting' ? 'Reconectando' : '○ Desconectado'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${
                                inst.is_enabled !== false ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300' : 'surface-accent-amber text-amber-700 dark:text-amber-300'
                              }`}>
                                {inst.is_enabled !== false ? 'Habilitada' : 'Deshabilitada'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {inst.messages_sent || 0} msgs
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleToggleInstance(inst.id, inst.is_enabled !== false, inst.instance_name)}
                                className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] cursor-pointer ${
                                  inst.is_enabled !== false ? 'surface-accent-rose text-rose-700 dark:text-rose-300' : 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
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
              </div>
            )}

            {/* ============================================================================
                APARTADO 4: PARTNERS B2B (EXCLUSIVO PARA SOFTWARE PARTNERS Y GUÍA API B2B)
               ============================================================================ */}
            {activeTab === 'b2b' && (
              <div className="space-y-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl surface-accent-indigo text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Software Partners B2B &amp; Master Keys</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Administra las plataformas integradoras (ERPs, CRMs, SaaS) autorizadas para aprovisionar clientes vía API.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreatePartnerModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Registrar Nuevo Partner B2B</span>
                  </button>
                </div>

                {/* Tarjetas de Partners B2B */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Layers size={14} className="text-emerald-600" />
                      <span>Software Partners Registrados ({partnersList.length})</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partnersList.map(p => (
                      <div key={p.id} className="surface-panel p-6 rounded-2xl space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold surface-accent-indigo text-indigo-700 dark:text-indigo-300">
                                slug: {p.slug}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">{p.contactEmail || p.contact_email}</p>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                            p.isActive 
                              ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300' 
                              : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                          }`}>
                            {p.isActive ? '● Activo' : '○ Pausado'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center surface-interactive rounded-xl p-3">
                          <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{p.tenantsCount ?? p.tenants_count ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">Empresas</div>
                          </div>
                          <div>
                            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{p.connectedInstancesCount ?? p.connected_instances_count ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">Líneas Activas</div>
                          </div>
                          <div>
                            <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{p.messagesSent ?? p.messages_sent ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">Msgs Enviados</div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold flex items-center gap-1">
                              <Key size={12} className="text-emerald-600" />
                              <span>Master Partner API Key:</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{p.category || 'general'}</span>
                          </div>

                          <div className="p-2.5 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono flex items-center justify-between gap-2">
                            <span className="truncate">{p.masterKey || p.maskedKey || p.masked_key}</span>
                            <button
                              onClick={() => {
                                const keyToCopy = p.masterKey || p.maskedKey || p.masked_key;
                                navigator.clipboard.writeText(keyToCopy);
                                showNotification(`Master Key de ${p.name} copiada`, 'success');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-sans font-bold cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Copy size={11} />
                              <span>Copiar</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => {
                              setPartnerFilter(p.id);
                              setActiveTab('users');
                            }}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Ver empresas de {p.name.split(' ')[0]} ➔
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRotatePartnerKey(p)}
                              className="px-2.5 py-1 text-[11px] font-semibold surface-interactive text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw size={12} />
                              <span>Rotar Clave</span>
                            </button>
                            <button
                              onClick={() => handleTogglePartnerStatus(p)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                                p.isActive 
                                  ? 'surface-accent-rose text-rose-700 dark:text-rose-300' 
                                  : 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {p.isActive ? 'Pausar' : 'Reactivar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documentación B2B Multi-Software */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Code2 size={16} className="text-emerald-600" />
                        <span>Referencia de Integración B2B para Software Partners</span>
                      </h4>
                      <p className="text-xs text-slate-500">Endpoints exclusivos autenticados con <code className="font-mono font-bold">Authorization: Bearer zc_partner_...</code></p>
                    </div>

                    <div className="flex items-center gap-1 p-1 surface-interactive rounded-xl">
                      <button
                        onClick={() => setDocPartnerTarget('generic')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          docPartnerTarget === 'generic'
                            ? 'bg-slate-900 text-white dark:bg-emerald-600'
                            : 'text-slate-500'
                        }`}
                      >
                        Genérico
                      </button>
                      <button
                        onClick={() => setDocPartnerTarget('krono')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          docPartnerTarget === 'krono'
                            ? 'bg-slate-900 text-white dark:bg-emerald-600'
                            : 'text-slate-500'
                        }`}
                      >
                        Krono
                      </button>
                      <button
                        onClick={() => setDocPartnerTarget('vivesfit')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          docPartnerTarget === 'vivesfit'
                            ? 'bg-slate-900 text-white dark:bg-emerald-600'
                            : 'text-slate-500'
                        }`}
                      >
                        VivesFit
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: 'provision', label: '1. Aprovisionar Empresa (POST /v1/b2b/tenants)' },
                      { id: 'status', label: '2. Estado en Vivo (GET /instances/:name/status)' },
                      { id: 'qr', label: '3. Obtener QR (GET /instances/:name/qr)' },
                      { id: 'renew', label: '4. Renovar Licencia (POST /v1/b2b/tenants/:id/renew)' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setB2bSnippetTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                          b2bSnippetTab === tab.id
                            ? 'bg-slate-900 text-white dark:bg-emerald-600'
                            : 'surface-interactive text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {b2bSnippetTab === 'provision' && (
                    <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`// POST https://api.zazaclick.sbs/v1/b2b/tenants
const response = await fetch('https://api.zazaclick.sbs/v1/b2b/tenants', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${docPartnerTarget === 'krono' ? 'zc_partner_krono_live_2026' : docPartnerTarget === 'vivesfit' ? 'zc_partner_master_vivesfit_2026' : 'zc_partner_tu_clave_maestra'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    companyName: '${docPartnerTarget === 'krono' ? 'Acme Logistics SAC' : docPartnerTarget === 'vivesfit' ? 'Power Fitness Miraflores' : 'Empresa Cliente SAC'}',
    externalId: '${docPartnerTarget === 'krono' ? 'krono_empresa_001' : docPartnerTarget === 'vivesfit' ? 'gym_001' : 'erp_cliente_123'}',
    email: 'admin@cliente.com',
    planId: 'plan_basic',
    durationMonths: 1,
    instanceName: '${docPartnerTarget === 'krono' ? 'krono_acme_wsp' : docPartnerTarget === 'vivesfit' ? 'powerfit_wsp' : 'cliente_whatsapp'}',
    engineType: 'evolution_go'
  })
});`}
                    </pre>
                  )}

                  {b2bSnippetTab === 'status' && (
                    <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`// GET https://api.zazaclick.sbs/v1/instances/:instanceName/status
const response = await fetch('https://api.zazaclick.sbs/v1/instances/cliente_whatsapp/status', {
  headers: { 'Authorization': 'Bearer zc_partner_tu_clave_maestra' }
});
const { isConnected, state } = await response.json();`}
                    </pre>
                  )}

                  {b2bSnippetTab === 'qr' && (
                    <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`// GET https://api.zazaclick.sbs/v1/instances/:instanceName/qr
const response = await fetch('https://api.zazaclick.sbs/v1/instances/cliente_whatsapp/qr', {
  headers: { 'Authorization': 'Bearer zc_partner_tu_clave_maestra' }
});
const { base64 } = await response.json();`}
                    </pre>
                  )}

                  {b2bSnippetTab === 'renew' && (
                    <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`// POST https://api.zazaclick.sbs/v1/b2b/tenants/:idOrExternalId/renew
const response = await fetch('https://api.zazaclick.sbs/v1/b2b/tenants/erp_cliente_123/renew', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer zc_partner_tu_clave_maestra',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ durationMonths: 1, resetQuota: true })
});`}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================================
                APARTADO 5: PLANES Y PAGOS (CATÁLOGO COMERCIAL + HISTORIAL FINANCIERO)
               ============================================================================ */}
            {activeTab === 'billing' && (
              <div className="space-y-8 text-left">
                
                {/* Sub-bloque 1: Catálogo de Planes y Cuotas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl surface-accent-amber text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <CreditCard size={19} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Planes Comerciales y Facturación</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Configura los planes del SaaS y audita todos los pagos registrados.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPlanFormData({ id: '', name: '', maxInstances: 1, price: 15, durationMonths: 1, maxMessages: 1000, isTrial: false, trialDays: 7, trialMessages: 100, description: '' });
                        setPlanModal({ open: true, plan: null });
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Crear Nuevo Plan</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plansList.map(plan => (
                      <div key={plan.id} className="surface-panel p-6 rounded-2xl space-y-4 text-left">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                            plan.is_trial ? 'surface-accent-amber text-amber-700 dark:text-amber-300' : 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {plan.is_trial ? 'Plan Trial' : 'Plan Comercial'}
                          </span>
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">${plan.price}<span className="text-xs text-slate-400 font-normal font-sans">/mes</span></span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-slate-900 dark:text-white">{plan.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{plan.description || 'Sin descripción'}</p>
                        </div>

                        <div className="space-y-1.5 pt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                          className="w-full py-2 surface-interactive text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs cursor-pointer"
                        >
                          Editar Plan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-bloque 2: Historial de Pagos */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" />
                    <span>Historial de Pagos y Renovaciones ({paymentsList.length})</span>
                  </h3>

                  <div className="surface-panel rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 uppercase font-bold text-[10px] tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-3.5">Fecha</th>
                            <th className="px-6 py-3.5">Cliente</th>
                            <th className="px-6 py-3.5">Monto</th>
                            <th className="px-6 py-3.5">Método / Referencia</th>
                            <th className="px-6 py-3.5">Estado</th>
                            <th className="px-6 py-3.5">Notas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {paymentsList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                No hay pagos registrados todavía.
                              </td>
                            </tr>
                          ) : (
                            paymentsList.map(pay => (
                              <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-6 py-4 text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{pay.user_email}</td>
                                <td className="px-6 py-4 font-black text-emerald-600 font-mono">${Number(pay.amount).toFixed(2)} {pay.currency}</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{pay.payment_method} {pay.reference ? `(${pay.reference})` : ''}</td>
                                <td className="px-6 py-4">
                                  <span className="px-2.5 py-1 surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md uppercase">
                                    ● {pay.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-slate-400">{pay.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================================
                APARTADO 6: AUDITORÍA ADMINISTRATIVA
               ============================================================================ */}
            {activeTab === 'audit' && (
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-rose text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText size={19} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bitácora de Auditoría Administrativa</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Trazabilidad inmutable de cambios de planes, suspensiones, extensiones y pagos.</p>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase font-bold text-[10px] tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-3.5">Fecha / Hora</th>
                          <th className="px-6 py-3.5">Administrador</th>
                          <th className="px-6 py-3.5">Acción</th>
                          <th className="px-6 py-3.5">Entidad Afectada</th>
                          <th className="px-6 py-3.5">Detalles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium font-mono text-[11px]">
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
              </div>
            )}

          </div>
        </main>
      </div>

      {/* MODAL CREAR CLIENTE */}
      {createUserModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Crear Nuevo Cliente</h3>
              <button onClick={() => setCreateUserModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  value={newUserData.password}
                  onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresa (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.companyName}
                    onChange={e => setNewUserData({ ...newUserData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer mt-2"
              >
                Crear Cliente y Activar Cuenta
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EDITAR SUSCRIPCIÓN / LICENCIA */}
      {editSubscriptionModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Modificar Licencia y Cuota</h3>
              <button onClick={() => setEditSubscriptionModal({ open: false, user: null })} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X size={16} /></button>
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
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vigencia / Extensión</label>
                  <CustomSelect
                    value={String(subFormData.durationDays)}
                    onChange={val => setSubFormData({ ...subFormData, durationDays: val })}
                    options={[
                      { value: '0', label: 'Mantener días actuales' },
                      { value: 'reset_30', label: 'Fijar a 30 días exactos' },
                      { value: '7', label: '+7 Días adicionales' },
                      { value: '15', label: '+15 Días adicionales' },
                      { value: '30', label: '+30 Días (1 Mes extra)' },
                      { value: '90', label: '+90 Días (3 Meses extra)' },
                      { value: '365', label: '+365 Días (1 Año extra)' }
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
                  className="rounded text-emerald-600"
                />
                <span>Resetear cuota de mensajes consumidos a 0</span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer mt-2"
              >
                Aplicar Cambios de Suscripción
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL REGISTRAR PAGO */}
      {recordPaymentModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Registrar Pago y Renovar</h3>
              <button onClick={() => setRecordPaymentModal({ open: false, user: null })} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X size={16} /></button>
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Referencia / Nro Operación</label>
                <input
                  type="text"
                  value={paymentFormData.reference}
                  onChange={e => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  placeholder="ej: OP-84920482"
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer mt-2"
              >
                Confirmar Pago y Reactivar Servicio
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PLANES (CREAR / EDITAR) */}
      {planModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {planModal.plan?.id ? 'Editar Plan' : 'Crear Plan'}
              </h3>
              <button onClick={() => setPlanModal({ open: false, plan: null })} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X size={16} /></button>
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Máx. Instancias</label>
                  <input
                    type="number"
                    required
                    value={planFormData.maxInstances}
                    onChange={e => setPlanFormData({ ...planFormData, maxInstances: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer mt-2"
              >
                Guardar Configuración de Plan
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL REGISTRAR PARTNER B2B */}
      {createPartnerModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-lg w-full text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Building2 size={18} className="text-emerald-600" />
                  <span>Registrar Nuevo Software Partner B2B</span>
                </h3>
                <p className="text-xs text-slate-400">Genera una Master API Key aislada para un software integrador.</p>
              </div>
              <button 
                onClick={() => setCreatePartnerModal(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nombre del Software / Plataforma</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Krono - RRHH & Asistencias"
                  value={newPartnerData.name}
                  onChange={e => {
                    const name = e.target.value;
                    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
                    setNewPartnerData(prev => ({
                      ...prev,
                      name,
                      slug: prev.slug ? prev.slug : autoSlug
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Identificador Único (Slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: krono"
                    value={newPartnerData.slug}
                    onChange={e => setNewPartnerData({ ...newPartnerData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Categoría / Vertical</label>
                  <CustomSelect
                    value={newPartnerData.category}
                    onChange={val => setNewPartnerData({ ...newPartnerData, category: val })}
                    options={[
                      { value: 'general', label: 'General / Multi-propósito' },
                      { value: 'rrhh_asistencia', label: 'RRHH, Control y Personal' },
                      { value: 'erp', label: 'ERP / Gestión Empresarial' },
                      { value: 'crm', label: 'CRM / Ventas' },
                      { value: 'fitness', label: 'Fitness y Gimnasios' },
                      { value: 'logistica', label: 'Logística y Envíos' },
                      { value: 'ecommerce', label: 'E-commerce y Retail' }
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Correo Electrónico de Contacto Técnico</label>
                <input
                  type="email"
                  required
                  placeholder="desarrollo@partner.com"
                  value={newPartnerData.contactEmail}
                  onChange={e => setNewPartnerData({ ...newPartnerData, contactEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">URL Webhook Global (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://api.partner.com/webhooks/zaza"
                  value={newPartnerData.webhookUrl}
                  onChange={e => setNewPartnerData({ ...newPartnerData, webhookUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer mt-2"
              >
                Generar Master Key y Registrar Partner
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL MOSTRAR CREDENCIAL MAESTRA GENERADA / ROTADA */}
      {createdPartnerSecret && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70">
          <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-lg w-full text-left space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Key size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Master Partner API Key Generada
                </h3>
                <p className="text-xs text-slate-400">Credencial asignada para: <strong className="text-slate-900 dark:text-white">{createdPartnerSecret.name}</strong></p>
              </div>
            </div>

            <div className="p-4 surface-accent-amber rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>Copia y guarda esta clave de inmediato</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Por seguridad criptográfica, esta es la única vez que se mostrará completa.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Clave Secreta:</label>
              <div className="p-3.5 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono break-all flex items-center justify-between gap-3">
                <span>{createdPartnerSecret.secretKey}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdPartnerSecret.secretKey);
                    showNotification('Master Key copiada al portapapeles', 'success');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-sans font-bold cursor-pointer flex items-center gap-1 flex-shrink-0"
                >
                  <Copy size={13} />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setCreatedPartnerSecret(null)}
              className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Entendido, ya guardé la clave
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación */}
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

    </div>
  );
}
