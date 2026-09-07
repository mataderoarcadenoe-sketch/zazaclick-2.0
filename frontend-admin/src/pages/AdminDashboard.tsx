// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../services/authContext';
import { 
  Users, Smartphone, Settings, LogOut, 
  Search, Shield, CheckCircle2, Moon, Sun, 
  X, Menu, Key, Activity, 
  Building, RefreshCw, AlertCircle, ArrowRight,
  Plus, DollarSign, Clock, Check, AlertTriangle,
  Lock, RotateCcw, CreditCard, FileText, ToggleLeft, ToggleRight, Trash2, Eye,
  Server, Cpu, Zap, Building2, QrCode, Code2, Copy, Filter, Layers, ExternalLink
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';
import { InteractiveGravityMesh } from '../components/InteractiveGravityMesh';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ToastNotification } from '../components/ToastNotification';
import { ZazaLogo } from '../components/ZazaLogo';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'instances' | 'plans' | 'payments' | 'audit' | 'b2b' | 'settings'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [b2bSnippetTab, setB2bSnippetTab] = useState<'provision' | 'status' | 'qr' | 'renew'>('provision');
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [b2bPartnerFilter, setB2bPartnerFilter] = useState<string>('all');
  const [docPartnerTarget, setDocPartnerTarget] = useState<'generic' | 'krono' | 'vivesfit'>('generic');
  const [createPartnerModal, setCreatePartnerModal] = useState(false);
  const [newPartnerData, setNewPartnerData] = useState({ name: '', slug: '', category: 'general', contactEmail: '', webhookUrl: '' });
  const [createdPartnerSecret, setCreatedPartnerSecret] = useState<{ name: string; secretKey: string } | null>(null);
  const [notification, setNotification] = useState<{ text: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Modal de Confirmación Personalizado
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

    // Activar directamente
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

  const handleResetQuota = (userId: string, email?: string) => {
    setConfirmModal({
      open: true,
      title: 'Resetear Cuota de Mensajes',
      message: (
        <span>
          ¿Estás seguro de restablecer a <strong>0</strong> el conteo de mensajes usados de {email ? <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{email}</strong> : 'este cliente'}?
        </span>
      ),
      type: 'info',
      confirmText: 'Resetear Cuota a 0',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.post(`/admin/users/${userId}/reset-quota`);
          if (res.data?.success) {
            showNotification('Cuota de mensajes reseteada a 0 exitosamente', 'success');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            fetchAdminData();
          }
        } catch (err: any) {
          showNotification(err.response?.data?.error || 'Error al resetear cuota', 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.user || !newPassword) return;

    try {
      const res = await api.post(`/admin/users/${resetPasswordModal.user.id}/reset-password`, { newPassword });
      if (res.data?.success) {
        showNotification('Contraseña actualizada exitosamente', 'success');
        setResetPasswordModal({ open: false, user: null });
        setNewPassword('');
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Error al actualizar contraseña', 'error');
    }
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
    { id: 'b2b', label: 'Ecosistema B2B & Partners', icon: Building2 },
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
      <ToastNotification notification={notification} onClose={() => setNotification(null)} />

      {/* Sidebar (Atmospheric Translucent Surface) */}
      <aside 
        className={`surface-panel flex flex-col transition-all duration-250 z-40 fixed top-0 left-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <ZazaLogo size={36} />
              <div className="flex flex-col text-left">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  Zaza Admin <span className="text-emerald-500">2.0</span>
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SuperAdmin Core</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-xl transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
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
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-2.5 flex-shrink-0" />
                )}
                <Icon size={18} className={`flex-shrink-0 transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                {sidebarOpen && <span className="ml-3 text-xs tracking-tight">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3">
          <button
            onClick={logout}
            className={`w-full group flex items-center ${
              sidebarOpen ? 'px-4 py-2.5 justify-start' : 'p-3 justify-center'
            } rounded-xl hover:bg-rose-500/15 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="ml-3 text-xs font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-250 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        
        {/* Header */}
        <header className="h-16 surface-panel px-4 sm:px-8 lg:px-12 flex items-center justify-between z-30 transition-colors duration-250 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl text-slate-600 dark:text-slate-300 lg:hidden cursor-pointer">
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
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal leading-none mt-0.5 hidden sm:block">Control maestro de licenciamiento, cuotas atómicas y facturación.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Gateway Telemetry Pill */}
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Control Core · Activo</span>
            </div>

            <button
              onClick={toggleDark}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Cambiar Tema"
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-emerald-600" />}
            </button>
            <button
              onClick={fetchAdminData}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-emerald-500' : ''} />
            </button>

            <div className="flex items-center gap-2 pl-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs uppercase">
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
        <main className="flex-1 bg-grid-tech relative overflow-y-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8 max-w-[1920px] mx-auto">
            
            {/* OVERVIEW GLOBAL DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Alertas Operativas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="surface-panel p-5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                      <Clock size={15} />
                      <span>Próximos a Vencer (3d)</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.subscriptions?.expiring_soon || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      <AlertTriangle size={15} />
                      <span>Suscripciones Vencidas</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.subscriptions?.expired_subscriptions || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-semibold">
                      <CreditCard size={15} />
                      <span>Pagos Pendientes</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.financial?.pending_payments || 0}
                    </div>
                  </div>

                  <div className="surface-panel p-5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      <DollarSign size={15} />
                      <span>Ingresos Totales</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      ${Number(stats?.financial?.total_revenue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Métricas Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="surface-panel p-6 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Clientes Totales</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-teal flex items-center justify-center"><Users size={16} className="text-teal-500" /></div>
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
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Líneas WhatsApp</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-emerald flex items-center justify-center"><Smartphone size={16} className="text-emerald-500" /></div>
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
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mensajes Procesados</span>
                      <div className="w-8 h-8 rounded-xl surface-accent-cyan flex items-center justify-center"><Activity size={16} className="text-cyan-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {stats?.traffic?.total_messages || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                    <div className="w-10 h-10 rounded-xl surface-accent-teal text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <Users size={19} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Directorio de Clientes y Licenciamiento</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Supervisa vencimientos, consumo de cuotas y autorizaciones de API.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreateUserModal(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
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
                    className="w-full pl-11 pr-4 py-2.5 surface-interactive rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition-colors"
                  />
                </div>

                {/* Tabla de Clientes */}
                <div className="surface-panel rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px] tracking-wider font-mono">
                          <th className="px-6 py-3.5">Cliente / Empresa</th>
                          <th className="px-6 py-3.5">Plan Actual</th>
                          <th className="px-6 py-3.5">Estado Cuenta</th>
                          <th className="px-6 py-3.5">Días Restantes</th>
                          <th className="px-6 py-3.5">Consumo de Cuota</th>
                          <th className="px-6 py-3.5">Líneas</th>
                          <th className="px-6 py-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="font-medium">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
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
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                                  : u.user_status === 'suspended'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              }`}>
                                ● {u.user_status}
                              </span>
                            </td>

                            <td className="px-6 py-4 font-bold">
                              {u.is_expired ? (
                                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  VENCIDO
                                </span>
                              ) : u.days_remaining <= 3 ? (
                                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  {u.days_remaining} días
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {u.days_remaining} días
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 space-y-1">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                                {u.messages_used || 0} / {u.messages_limit || 1000} msgs
                              </div>
                              <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
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
                                    status: u.subscription_status || u.user_status || 'active',
                                    durationDays: '0',
                                    resetQuota: false
                                  });
                                  setEditSubscriptionModal({ open: true, user: u });
                                }}
                                className="px-2.5 py-1 surface-interactive text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
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
                                className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Registrar Pago"
                              >
                                + Pago
                              </button>

                              <button
                                onClick={() => handleUpdateUserStatus(u.id, u.user_status === 'active' ? 'suspended' : 'active')}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                                  u.user_status === 'active'
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
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

            {/* INSTANCIAS TOTALES & ENGINE CONTROL */}
            {activeTab === 'instances' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Smartphone size={19} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Control Multi-Engine & Líneas WhatsApp</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Supervisión en tiempo real de motores Evolution API y Evolution Go.</p>
                    </div>
                  </div>
                </div>

                {/* ENGINE CONTROL CENTER CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Evolution API */}
                  <div className="surface-panel p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                          <Server size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">Evolution API (Node/Baileys)</div>
                          <div className="text-[11px] text-slate-400">Motor Primario de Producción · v2.4.0-rc2</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        ● ONLINE
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-center">
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Latencia</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {enginesHealth.find(e => e.engine === 'evolution_api')?.latencyMs || 28} ms
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Instancias</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {instancesList.filter(i => !i.engine_type || i.engine_type === 'evolution_api').length}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Capacidades</div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          100% Full
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Evolution Go */}
                  <div className="surface-panel p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                          <Cpu size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">Evolution Go (whatsmeow)</div>
                          <div className="text-[11px] text-slate-400">Motor Secundario de Alto Rendimiento</div>
                        </div>
                      </div>
                      {(() => {
                        const goHealth = enginesHealth.find(e => e.engine === 'evolution_go');
                        const isGoOnline = goHealth?.status === 'ONLINE';
                        const isGoDisabled = goHealth?.status === 'DISABLED' || !goHealth;
                        return (
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                            isGoOnline
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : isGoDisabled
                              ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}>
                            ● {goHealth?.status || 'OPCIONAL'}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-center">
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Latencia</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {enginesHealth.find(e => e.engine === 'evolution_go')?.latencyMs || 0} ms
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Instancias</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {instancesList.filter(i => i.engine_type === 'evolution_go').length}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Eficiencia</div>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Ultra Low-RAM
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Instancias */}
                <div className="surface-panel rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Instancia</th>
                        <th className="px-6 py-3.5">Motor Asignado</th>
                        <th className="px-6 py-3.5">Propietario</th>
                        <th className="px-6 py-3.5">Conexión WhatsApp</th>
                        <th className="px-6 py-3.5">Licencia Zaza</th>
                        <th className="px-6 py-3.5">Mensajes Enviados</th>
                        <th className="px-6 py-3.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {instancesList.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                            {inst.instance_name}
                            <div className="text-[10px] font-normal text-slate-400 font-sans">{inst.phone || 'Sin número'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase flex items-center gap-1 w-fit ${
                              inst.engine_type === 'evolution_go'
                                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            }`}>
                              {inst.engine_type === 'evolution_go' ? <Zap size={10} className="text-indigo-600 dark:text-indigo-400" /> : null}
                              <span>{inst.engine_type === 'evolution_go' ? 'Evolution Go' : 'Evolution API'}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                            {inst.owner_email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                              inst.connection_status === 'connected' 
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                                : inst.connection_status === 'reconnecting'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 animate-pulse'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}>
                              {inst.connection_status === 'connected' ? '● CONECTADO' : inst.connection_status === 'reconnecting' ? '⟳ AUTO-RECUPERANDO' : '○ DESCONECTADO'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                              inst.is_enabled !== false ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
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
                                inst.is_enabled !== false ? 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300' : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
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
                    <div className="w-10 h-10 rounded-xl surface-accent-amber text-amber-600 dark:text-amber-400 flex items-center justify-center">
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
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Crear Plan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {plansList.map(plan => (
                    <div key={plan.id} className="surface-panel p-6 rounded-2xl space-y-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                          plan.is_trial ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {plan.is_trial ? 'PLAN TRIAL' : 'PLAN COMERCIAL'}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono">${plan.price}<span className="text-xs text-slate-400 font-normal font-sans">/mes</span></span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 dark:text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{plan.description || 'Sin descripción'}</p>
                      </div>

                      <div className="space-y-1.5 pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                        className="w-full py-2 surface-interactive text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
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
                  <div className="w-10 h-10 rounded-xl surface-accent-cyan text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <DollarSign size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Registro de Pagos y Facturación</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Historial de renovaciones y pagos registrados en el sistema.</p>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Fecha</th>
                        <th className="px-6 py-3.5">Cliente</th>
                        <th className="px-6 py-3.5">Monto</th>
                        <th className="px-6 py-3.5">Método / Ref</th>
                        <th className="px-6 py-3.5">Estado</th>
                        <th className="px-6 py-3.5">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {paymentsList.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{pay.user_email}</td>
                          <td className="px-6 py-4 font-black text-emerald-600 font-mono">${Number(pay.amount).toFixed(2)} {pay.currency}</td>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{pay.payment_method} {pay.reference ? `(${pay.reference})` : ''}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full uppercase">
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

            {/* ECOSISTEMA B2B & PARTNERS API */}
            {activeTab === 'b2b' && (
              <div className="space-y-6 animate-fadeIn text-left">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <Building2 size={20} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Ecosistema B2B &amp; Partners API</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Aprovisionamiento multi-software y control de ciclo de vida de empresas clientes para ERPs, CRMs, RRHH y SaaS integradores.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreatePartnerModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Registrar Nuevo Partner B2B</span>
                  </button>
                </div>

                {/* 1. SECCIÓN: GESTOR DE PARTNERS OFICIALES (CARDS) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers size={16} className="text-cyan-500" />
                        <span>Software Partners Registrados</span>
                      </h3>
                      <p className="text-xs text-slate-400">Cada Partner cuenta con una Master Key criptográfica aislada. Un Partner solo tiene visibilidad de sus propios clientes.</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      Total: {partnersList.length} partner(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partnersList.map(p => (
                      <div key={p.id} className="surface-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 hover:border-cyan-500/40 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                slug: {p.slug}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">{p.contactEmail || p.contact_email}</p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono ${
                              p.isActive 
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              {p.isActive ? '● ACTIVO' : '○ PAUSADO'}
                            </span>
                          </div>
                        </div>

                        {/* Métricas del Partner */}
                        <div className="grid grid-cols-3 gap-2 py-1 text-center bg-slate-100/50 dark:bg-slate-900/60 rounded-xl p-2.5">
                          <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{p.tenantsCount ?? p.tenants_count ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-medium">Empresas</div>
                          </div>
                          <div>
                            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{p.connectedInstancesCount ?? p.connected_instances_count ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-medium">Líneas Activas</div>
                          </div>
                          <div>
                            <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">{p.messagesSent ?? p.messages_sent ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-medium">Msgs Enviados</div>
                          </div>
                        </div>

                        {/* Master Key Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-medium flex items-center gap-1">
                              <Key size={12} className="text-amber-500" />
                              <span>Master Partner API Key:</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{p.category || 'general'}</span>
                          </div>

                          <div className="p-2.5 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono flex items-center justify-between gap-2 border border-slate-800">
                            <span className="truncate">{p.masterKey || p.maskedKey || p.masked_key}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => {
                                  const keyToCopy = p.masterKey || p.maskedKey || p.masked_key;
                                  navigator.clipboard.writeText(keyToCopy);
                                  showNotification(`Master Key de ${p.name} copiada al portapapeles`, 'success');
                                }}
                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-sans font-bold cursor-pointer transition-colors flex items-center gap-1"
                                title="Copiar Clave Maestra"
                              >
                                <Copy size={11} />
                                <span>Copiar</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Botones de Gestión */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            onClick={() => handleRotatePartnerKey(p)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw size={12} />
                            <span>Rotar Clave</span>
                          </button>
                          <button
                            onClick={() => handleTogglePartnerStatus(p)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                              p.isActive 
                                ? 'text-rose-600 hover:bg-rose-500/10' 
                                : 'text-emerald-600 hover:bg-emerald-500/10'
                            }`}
                          >
                            {p.isActive ? 'Pausar Partner' : 'Reactivar Partner'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. SECCIÓN: EMPRESAS Y SEDES APROVISIONADAS (MULTI-TENANT TABLE) */}
                <div className="surface-panel rounded-2xl overflow-hidden space-y-4 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Empresas y Sedes Aprovisionadas</h3>
                      <p className="text-xs text-slate-400">Directorio de inquilinos y sus líneas de WhatsApp asignadas en los motores Go Engine y API v2.</p>
                    </div>

                    {/* Filtro por Partner */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto">
                      <button
                        onClick={() => setB2bPartnerFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          b2bPartnerFilter === 'all'
                            ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Todos ({usersList.length})
                      </button>

                      {partnersList.map(p => {
                        const count = usersList.filter(u => u.partner_id === p.id || u.partner_slug === p.slug).length;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setB2bPartnerFilter(p.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                              b2bPartnerFilter === p.id
                                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            {p.name.split(' ')[0]} ({count})
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setB2bPartnerFilter('direct')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          b2bPartnerFilter === 'direct'
                            ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Directo ({usersList.filter(u => !u.partner_id).length})
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px] tracking-wider font-mono border-b border-slate-100 dark:border-slate-800">
                          <th className="py-3">Empresa / Razón Social</th>
                          <th className="py-3">Partner Origen</th>
                          <th className="py-3">ID Externo (ERP / Software)</th>
                          <th className="py-3">Línea WhatsApp / Motor</th>
                          <th className="py-3">Plan / Cuota</th>
                          <th className="py-3">Estado Licencia</th>
                          <th className="py-3 text-right">Acción Rápida</th>
                        </tr>
                      </thead>
                      <tbody className="font-medium divide-y divide-slate-100 dark:divide-slate-800/60">
                        {usersList
                          .filter(u => {
                            if (b2bPartnerFilter === 'all') return true;
                            if (b2bPartnerFilter === 'direct') return !u.partner_id;
                            return u.partner_id === b2bPartnerFilter || u.partner_slug === b2bPartnerFilter;
                          })
                          .map(u => {
                            const inst = instancesList.find(i => i.user_id === u.id || i.owner_email === u.email);
                            const matchedPartner = partnersList.find(p => p.id === u.partner_id || p.slug === u.partner_slug);

                            return (
                              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                                  {u.company_name || 'Sin Razón Social'}
                                  <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                                </td>
                                <td className="py-3.5">
                                  {matchedPartner ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 ${
                                      matchedPartner.slug === 'krono' 
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20' 
                                        : matchedPartner.slug === 'vivesfit'
                                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
                                        : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                    }`}>
                                      {matchedPartner.name}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      Manual Admin
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                  {u.external_id || 'manual_admin'}
                                </td>
                                <td className="py-3.5">
                                  {inst ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{inst.instance_name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono inline-flex items-center gap-0.5 ${
                                          inst.engine_type === 'evolution_go'
                                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                        }`}>
                                          {inst.engine_type === 'evolution_go' ? <Zap size={9} /> : null}
                                          {inst.engine_type === 'evolution_go' ? 'Go Engine' : 'API v2'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className={`inline-flex items-center gap-1 font-semibold ${
                                          inst.connection_status === 'connected'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : inst.connection_status === 'reconnecting'
                                            ? 'text-amber-600 dark:text-amber-400 animate-pulse'
                                            : 'text-slate-400'
                                        }`}>
                                          {inst.connection_status === 'connected' ? '● Conectado' : inst.connection_status === 'reconnecting' ? '⟳ Auto-recuperando...' : '○ Desconectado'}
                                        </span>
                                        {inst.phone && <span className="text-slate-400 font-mono">({inst.phone})</span>}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Sin línea aprovisionada</span>
                                  )}
                                </td>
                                <td className="py-3.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{u.plan_name || 'Plan Basic'}</span>
                                  <div className="text-[10px] text-slate-400 font-mono">{u.messages_used || 0} / {u.messages_limit || 1000} msgs</div>
                                </td>
                                <td className="py-3.5">
                                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase inline-flex items-center gap-1.5 ${
                                    (u.user_status || u.status) === 'active' 
                                      ? (u.is_expired ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')
                                      : (u.user_status || u.status) === 'suspended'
                                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                      : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      (u.user_status || u.status) === 'active'
                                        ? (u.is_expired ? 'bg-amber-500' : 'bg-emerald-500')
                                        : (u.user_status || u.status) === 'suspended'
                                        ? 'bg-rose-500'
                                        : 'bg-slate-500'
                                    }`}></span>
                                    <span>
                                      {(u.user_status || u.status) === 'active' 
                                        ? (u.is_expired ? 'Vencido' : 'Activo')
                                        : (u.user_status || u.status) === 'suspended'
                                        ? 'Suspendido'
                                        : (u.user_status || u.status || 'Activo')}
                                    </span>
                                  </span>
                                </td>
                                <td className="py-3.5 text-right space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setEditSubscriptionModal({ open: true, user: u });
                                      setSubFormData({ planId: u.plan_id || 'plan_basic', status: u.user_status || u.status || 'active', durationDays: '0', resetQuota: false });
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                                  >
                                    Gestionar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. SECCIÓN: DOCUMENTACIÓN UNIVERSAL B2B CON SELECTOR DE PARTNER */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Code2 size={16} className="text-cyan-500" />
                        <span>Documentación de Endpoints B2B Multi-Software (Agnóstica)</span>
                      </h4>
                      <p className="text-xs text-slate-400">Guía y ejemplos listos para producción para integrar cualquier ERP, CRM, RRHH o SaaS.</p>
                    </div>

                    {/* Selector de Contexto de Documentación */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-400">Ejemplo para:</span>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                        <button
                          onClick={() => setDocPartnerTarget('generic')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            docPartnerTarget === 'generic'
                              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Building2 size={12} />
                          <span>Genérico (Cualquier ERP)</span>
                        </button>
                        <button
                          onClick={() => setDocPartnerTarget('krono')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            docPartnerTarget === 'krono'
                              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Clock size={12} />
                          <span>Krono (RRHH &amp; Asistencias)</span>
                        </button>
                        <button
                          onClick={() => setDocPartnerTarget('vivesfit')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            docPartnerTarget === 'vivesfit'
                              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Activity size={12} />
                          <span>VivesFit (Gimnasios)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabs de Endpoints */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto">
                    <button
                      onClick={() => setB2bSnippetTab('provision')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        b2bSnippetTab === 'provision'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      1. Aprovisionar Inquilino (POST /v1/b2b/tenants)
                    </button>
                    <button
                      onClick={() => setB2bSnippetTab('status')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        b2bSnippetTab === 'status'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      2. Estado en Vivo (GET /instances/:name/status)
                    </button>
                    <button
                      onClick={() => setB2bSnippetTab('qr')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        b2bSnippetTab === 'qr'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      3. Obtener QR en Base64 (GET /instances/:name/qr)
                    </button>
                    <button
                      onClick={() => setB2bSnippetTab('renew')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        b2bSnippetTab === 'renew'
                          ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      4. Renovar Licencia (POST /v1/b2b/tenants/:id/renew)
                    </button>
                  </div>

                  {b2bSnippetTab === 'provision' && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {docPartnerTarget === 'krono' && 'Aprovisiona una empresa, sucursal o sede de Krono en un solo paso, creando su línea WhatsApp dedicada:'}
                        {docPartnerTarget === 'vivesfit' && 'Aprovisiona un gimnasio o centro fitness, asignando su cuota y motor WhatsApp:'}
                        {docPartnerTarget === 'generic' && 'Aprovisiona una empresa cliente desde cualquier ERP o software SaaS de manera completamente agnóstica:'}
                      </div>
                      <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// POST https://api.zazaclick.sbs/v1/b2b/tenants
const response = await fetch('https://api.zazaclick.sbs/v1/b2b/tenants', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${
      docPartnerTarget === 'krono' 
        ? 'zc_partner_krono_live_2026' 
        : docPartnerTarget === 'vivesfit' 
        ? 'zc_partner_master_vivesfit_2026' 
        : 'zc_partner_tu_clave_maestra'
    }',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    companyName: '${
      docPartnerTarget === 'krono' 
        ? 'Acme Logistics SAC - Sede Central' 
        : docPartnerTarget === 'vivesfit' 
        ? 'Power Fitness Miraflores' 
        : 'Empresa Cliente SAC'
    }',
    externalId: '${
      docPartnerTarget === 'krono' 
        ? 'krono_empresa_001' 
        : docPartnerTarget === 'vivesfit' 
        ? 'gym_001' 
        : 'erp_cliente_123'
    }',
    email: '${
      docPartnerTarget === 'krono' 
        ? 'admin@acmelogistics.com' 
        : docPartnerTarget === 'vivesfit' 
        ? 'contacto@powerfitness.com' 
        : 'contacto@cliente.com'
    }',
    planId: 'plan_basic',
    durationMonths: 1,
    instanceName: '${
      docPartnerTarget === 'krono' 
        ? 'krono_acme_wsp' 
        : docPartnerTarget === 'vivesfit' 
        ? 'powerfit_wsp' 
        : 'cliente_whatsapp'
    }',
    engineType: 'evolution_go',                 // 'evolution_go' (whatsmeow ultra-rápido) o 'evolution_api' (Baileys)
    webhookUrl: '${
      docPartnerTarget === 'krono' 
        ? 'https://app.krono.click/api/webhooks/whatsapp' 
        : docPartnerTarget === 'vivesfit' 
        ? 'https://api.vivesfit.com/webhooks/zaza' 
        : 'https://mi-software.com/api/webhooks/whatsapp'
    }'
  })
});

const { data } = await response.json();
console.log('Empresa Creada:', data.zazaTenantId, 'API Key:', data.apiKey);`}
                      </pre>
                    </div>
                  )}

                  {b2bSnippetTab === 'status' && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Consulta el estado de conexión de la línea en tiempo real para mostrar un indicador en el panel de tu software. <span className="text-emerald-500 font-semibold">Si la conexión cae, el Watchdog inteligente auto-recupera la sesión sin pedir nuevo QR ni requerir intervención.</span>
                      </div>
                      <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// GET https://api.zazaclick.sbs/v1/instances/:instanceName/status
const response = await fetch('https://api.zazaclick.sbs/v1/instances/${
  docPartnerTarget === 'krono' 
    ? 'krono_acme_wsp' 
    : docPartnerTarget === 'vivesfit' 
    ? 'powerfit_wsp' 
    : 'cliente_whatsapp'
}/status', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${
      docPartnerTarget === 'krono' 
        ? 'zc_partner_krono_live_2026' 
        : docPartnerTarget === 'vivesfit' 
        ? 'zc_partner_master_vivesfit_2026' 
        : 'zc_partner_tu_clave_maestra'
    }'
  }
});

const { isConnected, state } = await response.json();
// isConnected: true | false
// state: 'connected' | 'connecting' | 'disconnected'
console.log('Línea WhatsApp Activa:', isConnected);`}
                      </pre>
                    </div>
                  )}

                  {b2bSnippetTab === 'qr' && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Obtiene el código QR en base64 para que el usuario o administrador de la empresa lo escanee directamente desde tu propia aplicación:
                      </div>
                      <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// GET https://api.zazaclick.sbs/v1/instances/:instanceName/qr
const response = await fetch('https://api.zazaclick.sbs/v1/instances/${
  docPartnerTarget === 'krono' 
    ? 'krono_acme_wsp' 
    : docPartnerTarget === 'vivesfit' 
    ? 'powerfit_wsp' 
    : 'cliente_whatsapp'
}/qr', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${
      docPartnerTarget === 'krono' 
        ? 'zc_partner_krono_live_2026' 
        : docPartnerTarget === 'vivesfit' 
        ? 'zc_partner_master_vivesfit_2026' 
        : 'zc_partner_tu_clave_maestra'
    }'
  }
});

const { base64 } = await response.json();
// Renderizado directo en tu interfaz React/Vue/HTML:
// <img src={base64} alt="Escanear WhatsApp QR" />`}
                      </pre>
                    </div>
                  )}

                  {b2bSnippetTab === 'renew' && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Renueva automáticamente el periodo de servicio y la cuota de mensajes de una empresa mediante su ID externo:
                      </div>
                      <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// POST https://api.zazaclick.sbs/v1/b2b/tenants/:idOrExternalId/renew
const response = await fetch('https://api.zazaclick.sbs/v1/b2b/tenants/${
  docPartnerTarget === 'krono' 
    ? 'krono_empresa_001' 
    : docPartnerTarget === 'vivesfit' 
    ? 'gym_001' 
    : 'erp_cliente_123'
}/renew', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${
      docPartnerTarget === 'krono' 
        ? 'zc_partner_krono_live_2026' 
        : docPartnerTarget === 'vivesfit' 
        ? 'zc_partner_master_vivesfit_2026' 
        : 'zc_partner_tu_clave_maestra'
    }',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    durationMonths: 1,      // Meses a adicionar a la vigencia actual
    resetQuota: true        // Reiniciar contador mensual de mensajes a 0
  })
});

const result = await response.json();
console.log('Nueva Fecha de Vencimiento:', result.data.endDate);`}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BITÁCORA DE AUDITORÍA */}
            {activeTab === 'audit' && (
              <div className="space-y-6 animate-fadeIn text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-rose text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText size={19} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bitácora de Auditoría Administrativa</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Trazabilidad de cambios de planes, suspensiones, extensiones y pagos.</p>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px] tracking-wider font-mono">
                        <th className="px-6 py-3.5">Fecha / Hora</th>
                        <th className="px-6 py-3.5">Administrador</th>
                        <th className="px-6 py-3.5">Acción</th>
                        <th className="px-6 py-3.5">Entidad Afectada</th>
                        <th className="px-6 py-3.5">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium font-mono text-[11px]">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
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
      {createUserModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-8 max-w-md w-full text-left space-y-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  value={newUserData.password}
                  onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresa (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.companyName}
                    onChange={e => setNewUserData({ ...newUserData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-8 max-w-md w-full text-left space-y-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-8 max-w-md w-full text-left space-y-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Referencia / Nro Operación</label>
                <input
                  type="text"
                  value={paymentFormData.reference}
                  onChange={e => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  placeholder="ej: OP-84920482"
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-8 max-w-md w-full text-left space-y-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Máx. Instancias</label>
                  <input
                    type="number"
                    required
                    value={planFormData.maxInstances}
                    onChange={e => setPlanFormData({ ...planFormData, maxInstances: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-8 max-w-lg w-full text-left space-y-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Building2 size={18} className="text-cyan-500" />
                  <span>Registrar Nuevo Software Partner B2B</span>
                </h3>
                <p className="text-xs text-slate-400">Genera una Master API Key aislada para un software, ERP, CRM o plataforma integradora.</p>
              </div>
              <button 
                onClick={() => setCreatePartnerModal(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
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
                    className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-cyan-600 dark:text-cyan-400 focus:outline-none transition-colors"
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
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">URL Webhook Global (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://api.partner.com/webhooks/zaza"
                  value={newPartnerData.webhookUrl}
                  onChange={e => setNewPartnerData({ ...newPartnerData, webhookUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 surface-interactive rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer mt-2 shadow-lg shadow-cyan-900/30"
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white dark:bg-[#0E1524] border border-cyan-500/30 rounded-3xl p-7 sm:p-8 max-w-lg w-full text-left space-y-5 shadow-2xl shadow-cyan-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Key size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Master Partner API Key Generada
                </h3>
                <p className="text-xs text-slate-400">Credencial asignada para: <strong className="text-slate-200">{createdPartnerSecret.name}</strong></p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>Copia y guarda esta clave de inmediato</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                Por seguridad criptográfica, esta es la única vez que se exhibirá la clave maestra sin enmascarar. Cópiala y agrégala a las variables de entorno de tu software partner.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Clave Secreta:</label>
              <div className="p-3.5 bg-slate-950 text-cyan-400 border border-slate-800 rounded-xl text-xs font-mono break-all flex items-center justify-between gap-3">
                <span>{createdPartnerSecret.secretKey}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdPartnerSecret.secretKey);
                    showNotification('Master Key copiada al portapapeles', 'success');
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-sans font-bold cursor-pointer transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Copy size={13} />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setCreatedPartnerSecret(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Entendido, ya guardé la clave
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación Premium */}
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
