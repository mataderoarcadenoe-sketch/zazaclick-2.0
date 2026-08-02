import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import { LogOut, RefreshCw, Plus, Key, Trash2, Smartphone, CheckCircle2, AlertCircle, Copy, Send } from 'lucide-react';

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
  const [testInstance, setTestInstance] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');
  const [testText, setTestText] = useState('¡Hola! Este es un mensaje de prueba enviado desde mi API de Zaza.click 2.0 🚀');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Notification Banner State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
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
    // Auto-poll instance states silently every 10 seconds to update connection state
    const interval = setInterval(() => {
      fetchInstances(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
    if (!confirm(`🚨 ¿Estás seguro de ELIMINAR por completo la instancia ${instanceName}? Esto borrará la sesión y sus credenciales.`)) return;

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

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header NavBar */}
      <header className="bg-[#0E1321]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
            <Smartphone className="w-5 h-5 animate-pulse" />
          </div>
          <span className="font-extrabold text-base tracking-wide text-white">Zaza.click <span className="text-emerald-500">2.0</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{user?.email}</p>
            <p className="text-[10px] text-gray-400">Rol: {user?.role === 'admin' ? 'Administrador' : 'Cliente'}</p>
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
        
        {/* Banner de Suscripción */}
        <div className="bg-gradient-to-r from-emerald-950/40 to-blue-950/30 border border-emerald-500/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/10">Plan Activo</span>
            <h2 className="text-lg font-bold text-white pt-1">{subscription?.plan_name || 'Básico'}</h2>
            <p className="text-[11px] text-gray-400 font-medium">
              Vence el: {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'} | Capacidad: <strong className="text-emerald-400">{instances.length} / {subscription?.max_instances || 1}</strong> números vinculados.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            disabled={instances.length >= (subscription?.max_instances || 1)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Instancia</span>
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* List of Instances (Left Col - 8/12) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Smartphone className="w-4.5 h-4.5 text-emerald-500" />
                <span>Mis Instancias de WhatsApp</span>
              </h3>
              <button
                onClick={() => fetchInstances()}
                disabled={loading}
                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Actualizar estados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spinSlow' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center text-xs text-gray-500">Cargando tus instancias...</div>
            ) : instances.length === 0 ? (
              <div className="bg-[#151D30]/40 border border-white/5 rounded-2xl py-16 px-4 text-center space-y-3">
                <Smartphone className="w-12 h-12 text-gray-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">No tienes instancias activas</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Crea tu primera instancia de WhatsApp para obtener tus credenciales de envío y escanear el QR.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/20 cursor-pointer"
                >
                  Crear Instancia
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {instances.map((inst) => (
                  <div key={inst.id} className="bg-[#151D30] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all space-y-4">
                    
                    {/* Top Row: Name & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{inst.instance_name}</span>
                        {inst.status === 'connected' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 rounded-md">CONECTADO</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-500/10 border border-white/10 text-[9px] font-black text-gray-400 rounded-md">DESCONECTADO</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {inst.status === 'disconnected' ? (
                          <button
                            onClick={() => handleGetQr(inst.instance_name)}
                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                          >
                            Vincular QR
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLogoutInstance(inst.instance_name)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold rounded-lg border border-white/5 transition-colors cursor-pointer"
                          >
                            Cerrar Sesión
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setTestInstance(inst.instance_name);
                            setTestResult(null);
                          }}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-emerald-500 rounded-lg border border-white/5"
                          title="Probar Envío"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteInstance(inst.instance_name)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-red-500 rounded-lg border border-white/5"
                          title="Eliminar Instancia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle: API Credentials */}
                    <div className="bg-[#0B0F19] border border-white/5 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Instance Name</span>
                        <div className="flex items-center gap-1.5">
                          <code className="text-white font-mono text-[10.5px]">{inst.instance_name}</code>
                          <button onClick={() => copyToClipboard(inst.instance_name)} className="text-gray-400 hover:text-white">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">API Key (Token)</span>
                        <div className="flex items-center gap-1.5">
                          <code className="text-white font-mono text-[10.5px]">{inst.api_key}</code>
                          <button onClick={() => copyToClipboard(inst.api_key)} className="text-gray-400 hover:text-white">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Info & Developer Docs (Right Col - 4/12) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* QR Scanner Display Box */}
            {activeQrInstance && (
              <div className="bg-[#151D30] border border-white/10 p-5 rounded-2xl space-y-3 animate-fadeIn text-center relative">
                <button
                  onClick={() => {
                    setActiveQrInstance(null);
                    setQrBase64(null);
                  }}
                  className="absolute top-3 right-3 text-gray-500 hover:text-white"
                >
                  ✕
                </button>

                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Escanear WhatsApp QR</h4>
                <p className="text-[10px] text-gray-400">Instancia: <strong>{activeQrInstance}</strong></p>

                <div className="w-48 h-48 bg-white rounded-xl mx-auto flex items-center justify-center border border-white/5 shadow-inner overflow-hidden">
                  {qrLoading ? (
                    <div className="text-xs text-gray-400">Generando QR...</div>
                  ) : qrBase64 ? (
                    <img src={qrBase64} alt="WhatsApp QR Code" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-xs text-red-400">Error al cargar QR</div>
                  )}
                </div>

                <p className="text-[9px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                  Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo. Escanea este código.
                </p>
              </div>
            )}

            {/* Test Send Panel */}
            {testInstance && (
              <div className="bg-[#151D30] border border-white/10 p-5 rounded-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Probar Envío de Mensaje</h4>
                  <button onClick={() => setTestInstance(null)} className="text-gray-500 hover:text-white text-xs">Cerrar</button>
                </div>
                <p className="text-[10px] text-gray-400">Prueba el envío en vivo usando la instancia: <strong>{testInstance}</strong></p>

                {testResult && (
                  <div className={`p-2.5 text-[11px] rounded-lg border text-center font-medium ${
                    testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {testResult.message}
                  </div>
                )}

                <form onSubmit={handleSendTestMessage} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Número Destino</label>
                    <input
                      type="text"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="Ej: 51987654321"
                      required
                      className="w-full px-3 py-2 bg-[#1D263B] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Mensaje de Texto</label>
                    <textarea
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      rows={3}
                      required
                      className="w-full px-3 py-2 bg-[#1D263B] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={testLoading}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {testLoading ? 'Enviando...' : 'Enviar Mensaje'}
                  </button>
                </form>
              </div>
            )}

            {/* Quick Developer Documentation */}
            <div className="bg-[#151D30]/65 border border-white/5 p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <Key className="w-4 h-4 text-emerald-500" />
                <span>Integración Rápida</span>
              </h4>
              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                Envía mensajes desde tus propios desarrollos web de forma simple usando un POST request:
              </p>

              <div className="bg-[#0B0F19] border border-white/5 rounded-xl p-3 text-[10px] font-mono overflow-x-auto text-emerald-400 space-y-1.5">
                <p className="text-white">// Endpoint</p>
                <p>POST http://zazaclick-api-saas/api/instances/send</p>
                <p className="text-white">// Body JSON</p>
                <p className="text-gray-300">
                  {`{
  "instanceName": "tu_instancia",
  "apiKey": "tu_api_key",
  "number": "51987654321",
  "text": "Tu mensaje aquí"
}`}
                </p>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Modal para Crear Nueva Instancia */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#151D30] border border-white/10 w-full max-w-md p-6 rounded-3xl space-y-4 shadow-2xl relative animate-fadeIn">
            
            <button
              onClick={() => {
                setShowCreateModal(false);
                setNewInstanceName('');
                setCreateError(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-bold text-white">Nueva Instancia de WhatsApp</h3>
              <p className="text-[11px] text-gray-400">Las instancias representan las cuentas de WhatsApp vinculadas.</p>
            </div>

            {createError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center font-medium">
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre de la Instancia</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="Ej: ventas_lima"
                  required
                  className="w-full px-4 py-3 bg-[#1D263B] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <span className="text-[9px] text-gray-500">Solo letras, números, guiones y guiones bajos.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewInstanceName('');
                    setCreateError(null);
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-gray-300 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createLoading || !newInstanceName.trim()}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-xs text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {createLoading ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
