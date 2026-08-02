import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import { LogOut, RefreshCw, Users, ShieldAlert, Check, X } from 'lucide-react';

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

  // Subscription Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPlanId, setNewPlanId] = useState('plan_basic');
  const [newStatus, setNewStatus] = useState('active');
  const [newDuration, setNewDuration] = useState('1');
  const [submittingSub, setSubmittingSub] = useState(false);

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

  useEffect(() => {
    fetchAdminData();
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
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar suscripción');
    } finally {
      setSubmittingSub(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Header NavBar */}
      <header className="bg-[#0E1321]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <span className="font-extrabold text-base tracking-wide text-white">
            Zaza.click <span className="text-emerald-500">2.0 Admin</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-white">{user?.email}</p>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Super Administrador</p>
          </div>
          <button
            onClick={logout}
            className="p-2.5 bg-white/5 hover:bg-white/10 hover:text-red-400 rounded-xl transition-all border border-white/5 cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-fadeIn">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#151D30] border border-white/5 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Clientes Registrados</span>
            <h3 className="text-2xl font-black text-white">{stats?.total_users ?? 0}</h3>
          </div>
          <div className="bg-[#151D30] border border-white/5 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Suscripciones Activas</span>
            <h3 className="text-2xl font-black text-emerald-400">{stats?.active_subscriptions ?? 0}</h3>
          </div>
          <div className="bg-[#151D30] border border-white/5 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">Números en Evolution</span>
            <h3 className="text-2xl font-black text-white">{stats?.total_instances ?? 0}</h3>
          </div>
          <div className="bg-[#151D30] border border-white/5 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono">WhatsApp Conectados</span>
            <h3 className="text-2xl font-black text-emerald-400">{stats?.connected_instances ?? 0}</h3>
          </div>
        </div>

        {/* Client Management Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Users className="w-4.5 h-4.5 text-emerald-500" />
              <span>Gestión de Clientes y Licencias</span>
            </h3>
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spinSlow' : ''}`} />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center text-xs text-gray-500">Cargando datos de administración...</div>
          ) : (
            <div className="bg-[#151D30] border border-white/5 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#0E1321] text-gray-400 font-bold">
                      <th className="p-4">Cliente / Email</th>
                      <th className="p-4">Plan Actual</th>
                      <th className="p-4">Estado Suscripción</th>
                      <th className="p-4">Vencimiento</th>
                      <th className="p-4 text-center">Números Conectados</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4 font-bold text-white">
                          <div>{client.email}</div>
                          <div className="text-[9px] text-gray-500 font-normal">ID: {client.id}</div>
                        </td>
                        <td className="p-4">
                          {editingUserId === client.id ? (
                            <select
                              value={newPlanId}
                              onChange={(e) => setNewPlanId(e.target.value)}
                              className="bg-[#1D263B] border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                            >
                              <option value="plan_basic">Plan Básico (1 nº)</option>
                              <option value="plan_medium">Plan Estándar (3 nº)</option>
                              <option value="plan_premium">Plan Pro (Ilimitado)</option>
                            </select>
                          ) : (
                            <span className="font-semibold text-gray-300">
                              {client.plan_name || 'Sin plan'}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {editingUserId === client.id ? (
                            <select
                              value={newStatus}
                              onChange={(e) => setNewStatus(e.target.value)}
                              className="bg-[#1D263B] border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                            >
                              <option value="active">Activo</option>
                              <option value="expired">Vencido</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                          ) : client.subscription_status === 'active' ? (
                            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md font-bold text-[10px]">
                              ACTIVO
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-gray-500/10 border border-white/10 text-gray-400 rounded-md font-bold text-[10px]">
                              INACTIVO
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-400">
                          {editingUserId === client.id ? (
                            <select
                              value={newDuration}
                              onChange={(e) => setNewDuration(e.target.value)}
                              className="bg-[#1D263B] border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
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
                        <td className="p-4 text-center font-bold text-white">
                          {client.instances_count}
                        </td>
                        <td className="p-4 text-right">
                          {editingUserId === client.id ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateSubscription(client.id)}
                                disabled={submittingSub}
                                className="p-1 bg-emerald-500 hover:bg-emerald-600 rounded text-white cursor-pointer"
                                title="Guardar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1 bg-white/5 hover:bg-white/10 rounded text-gray-400 cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
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
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
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
      </main>
    </div>
  );
}
