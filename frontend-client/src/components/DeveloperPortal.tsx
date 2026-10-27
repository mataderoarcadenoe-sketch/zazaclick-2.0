import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import {
  Key, Activity, Radio, RefreshCw,
  Copy, CheckCircle2,
  Send, X, Plus
} from 'lucide-react';

interface DeveloperPortalProps {
  section: 'apikeys' | 'webhooks';
  currentApiKey?: string;
  instances?: any[];
  onRefreshInstances?: () => void;
}

export const DeveloperPortal: React.FC<DeveloperPortalProps> = ({
  section,
  instances = []
}) => {
  // API Keys State
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Integración ERP Principal');
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // API Logs State
  const [logsData, setLogsData] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsFilterStatus, setLogsFilterStatus] = useState<'all' | '2xx' | '4xx' | '5xx'>('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Webhook Deliveries State
  const [webhookDeliveries, setWebhookDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [testWebhookModal, setTestWebhookModal] = useState(false);
  const [testInstance, setTestInstance] = useState(instances[0]?.instance_name || '');
  const [testEventType, setTestEventType] = useState('MESSAGE_RECEIVED');
  const [testResult, setTestResult] = useState<any>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (instances.length > 0 && !testInstance) {
      setTestInstance(instances[0].instance_name);
    }
  }, [instances, testInstance]);

  // Fetch API Keys
  const fetchApiKeys = useCallback(async () => {
    try {
      setLoadingKeys(true);
      const res = await api.get('/developer/api-keys');
      if (res.data?.success) setApiKeys(res.data.data || []);
    } catch (err) {
      console.error('Error cargando API Keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const statusParam = logsFilterStatus !== 'all' ? `&status=${logsFilterStatus}` : '';
      const res = await api.get(`/developer/logs?limit=50${statusParam}`);
      if (res.data?.success) setLogsData(res.data.data?.logs || []);
    } catch (err) {
      console.error('Error cargando logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logsFilterStatus]);

  // Fetch Webhook Deliveries
  const fetchDeliveries = useCallback(async () => {
    try {
      setLoadingDeliveries(true);
      const res = await api.get('/developer/webhooks/deliveries?limit=50');
      if (res.data?.success) setWebhookDeliveries(res.data.data?.deliveries || []);
    } catch (err) {
      console.error('Error cargando entregas webhook:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'apikeys') {
      fetchApiKeys();
    } else if (section === 'webhooks') {
      fetchDeliveries();
      fetchLogs();
    }
  }, [section, fetchApiKeys, fetchDeliveries, fetchLogs]);

  // API Key Actions
  const handleCreateKey = async () => {
    try {
      const res = await api.post('/developer/api-keys', {
        name: newKeyName,
        environment: newKeyEnv,
        scopes: ['instances:read', 'instances:write', 'messages:send', 'webhooks:read', 'webhooks:write', 'usage:read', 'logs:read']
      });
      if (res.data?.success) {
        setCreatedSecret(res.data.data.secretKey);
        fetchApiKeys();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('¿Estás seguro de revocar esta API Key? Las integraciones que dependan de ella dejarán de funcionar de inmediato.')) return;
    try {
      await api.post(`/developer/api-keys/${id}/revoke`);
      fetchApiKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRotateKey = async (id: string) => {
    if (!confirm('¿Deseas rotar esta API Key? Se emitirá una nueva clave y la anterior quedará revocada.')) return;
    try {
      const res = await api.post(`/developer/api-keys/${id}/rotate`);
      if (res.data?.success) {
        setCreatedSecret(res.data.data.secretKey);
        setNewKeyModal(true);
        fetchApiKeys();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // Webhook Actions
  const handleReplayWebhook = async (id: string) => {
    try {
      setReplayingId(id);
      const res = await api.post(`/developer/webhooks/deliveries/${id}/replay`);
      alert(res.data?.message || 'Webhook reenviado correctamente.');
      fetchDeliveries();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setReplayingId(null);
    }
  };

  const handleTestWebhook = async () => {
    try {
      setTestingWebhook(true);
      const res = await api.post('/developer/webhooks/test', {
        instanceName: testInstance,
        eventType: testEventType
      });
      setTestResult(res.data);
      fetchDeliveries();
    } catch (err: any) {
      setTestResult({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  // ============================================================================
  // APARTADO 3: API KEYS (CREDENCIALES X-API-KEY)
  // ============================================================================
  if (section === 'apikeys') {
    return (
      <div className="space-y-6 text-left">
        {/* Cabecera de Sección */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Key size={19} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bóveda de Credenciales (API Keys)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Administra las llaves criptográficas <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">x-api-key</code> para autenticar tus sistemas.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchApiKeys}
              className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Actualizar credenciales"
            >
              <RefreshCw size={15} className={loadingKeys ? 'animate-spin text-emerald-600' : ''} />
            </button>
            <button
              onClick={() => {
                setCreatedSecret(null);
                setNewKeyName('Integración ERP');
                setNewKeyModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>Generar Nueva API Key</span>
            </button>
          </div>
        </div>

        {/* Bloque 1: Credenciales Directas por Línea WhatsApp */}
        <div className="surface-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Credenciales Nativas por Línea WhatsApp</h3>
              <p className="text-xs text-slate-500">Cada instancia de WhatsApp cuenta con su propia llave directa lista para enviar mensajes.</p>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md surface-interactive text-slate-600 dark:text-slate-300">
              Header: x-api-key
            </span>
          </div>

          {instances.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 surface-interactive rounded-xl">
              Aún no tienes líneas de WhatsApp creadas. Crea una línea en el apartado <strong>Líneas WhatsApp</strong> para obtener su credencial directa.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {instances.map((inst) => (
                <div key={inst.id || inst.instance_name} className="p-4 rounded-xl surface-interactive flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">{inst.instance_name}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        inst.status === 'connected'
                          ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {inst.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-300 block truncate">{inst.api_key}</code>
                  </div>

                  <button
                    onClick={() => copyText(inst.api_key, `inst-key-${inst.instance_name}`)}
                    className="px-3 py-2 rounded-lg surface-panel text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedKey === `inst-key-${inst.instance_name}` ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-emerald-600">Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bloque 2: Llaves de Entorno y Rotación Criptográfica */}
        <div className="surface-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Llaves de Entorno (Producción / Sandbox)</h3>
              <p className="text-xs text-slate-500">Llaves adicionales almacenadas con hash SHA-256 para rotación segura o entornos de prueba.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Clave Enmascarada</th>
                  <th className="py-3 px-4">Entorno</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Último Uso</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No se han emitido llaves secundarias. Haz clic en "Generar Nueva API Key" si necesitas credenciales adicionales.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((k: any) => (
                    <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{k.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800">{k.maskedKey}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          k.environment === 'live'
                            ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                            : 'surface-accent-amber text-amber-700 dark:text-amber-300'
                        }`}>
                          {k.environment === 'live' ? 'PRODUCCIÓN' : 'SANDBOX'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {k.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-500 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Revocada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Sin uso aún'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {k.isActive && (
                          <>
                            <button
                              onClick={() => handleRotateKey(k.id)}
                              className="px-2.5 py-1 rounded-lg surface-interactive text-slate-700 dark:text-slate-300 font-semibold hover:text-emerald-600 cursor-pointer"
                            >
                              Rotar
                            </button>
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="px-2.5 py-1 rounded-lg surface-accent-rose text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                            >
                              Revocar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Crear / Rotar API Key */}
        {newKeyModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
            <div className="surface-elevated p-6 rounded-2xl max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key size={18} className="text-emerald-600" />
                  <span>{createdSecret ? 'Credencial Generada' : 'Generar Nueva API Key'}</span>
                </h3>
                <button onClick={() => setNewKeyModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {createdSecret ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl surface-accent-amber text-amber-900 dark:text-amber-200 text-xs">
                    <strong>Copia esta llave ahora:</strong> Por razones de seguridad criptográfica, no volverá a mostrarse completa.
                  </div>
                  <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl break-all flex items-center justify-between gap-2">
                    <span>{createdSecret}</span>
                    <button
                      onClick={() => copyText(createdSecret, 'new-secret')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-sans font-bold shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'new-secret' ? '¡Copiada!' : 'Copiar'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setCreatedSecret(null);
                      setNewKeyModal(false);
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white cursor-pointer"
                  >
                    Entendido, ya la guardé
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Nombre Identificador:</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Ej. ERP Facturación"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl surface-interactive text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Entorno:</label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as 'live' | 'test')}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl surface-interactive text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="live">Producción (zc_live_...)</option>
                      <option value="test">Pruebas / Sandbox (zc_test_...)</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setNewKeyModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold surface-interactive text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateKey}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      Emitir API Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ============================================================================
  // APARTADO 4: WEBHOOKS Y LOGS (ENTREGAS HMAC + BITÁCORA HTTP)
  // ============================================================================
  return (
    <div className="space-y-6 text-left">
      {/* Cabecera de Sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl surface-accent-indigo text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Radio size={19} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Webhooks y Bitácora HTTP</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Supervisa entregas de eventos entrantes firmados con HMAC-SHA256 y audita el tráfico REST.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchDeliveries();
              fetchLogs();
            }}
            className="p-2.5 surface-interactive rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Actualizar registros"
          >
            <RefreshCw size={15} className={loadingDeliveries || loadingLogs ? 'animate-spin text-emerald-600' : ''} />
          </button>
          <button
            onClick={() => {
              setTestResult(null);
              setTestWebhookModal(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2 cursor-pointer"
          >
            <Send size={14} />
            <span>Simular Evento Webhook</span>
          </button>
        </div>
      </div>

      {/* Bloque 1: Historial de Entregas Webhook (HMAC-SHA256) */}
      <div className="surface-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de Entregas Webhook</h3>
            <p className="text-xs text-slate-500">Eventos enviados hacia tu servidor con cabecera <code className="font-mono font-bold">X-Zaza-Signature</code> y opción de reenvío manual (Replay).</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Instancia</th>
                <th className="py-3 px-4">URL Destino</th>
                <th className="py-3 px-4">Latencia</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {webhookDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-400">
                    No se registran entregas de webhooks recientes.
                  </td>
                </tr>
              ) : (
                webhookDeliveries.map((del: any) => (
                  <tr key={del.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        del.status === 'DELIVERED'
                          ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                          : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                      }`}>
                        {del.status} {del.httpStatus ? `(${del.httpStatus})` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{del.eventType}</td>
                    <td className="py-3 px-4 text-slate-500">{del.instanceName}</td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[220px]" title={del.targetUrl}>{del.targetUrl}</td>
                    <td className="py-3 px-4 text-slate-500">{del.latencyMs ? `${del.latencyMs}ms` : '-'}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">{new Date(del.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleReplayWebhook(del.id)}
                        disabled={replayingId === del.id}
                        className="px-2.5 py-1 rounded-lg surface-interactive font-sans font-semibold text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer disabled:opacity-50"
                      >
                        {replayingId === del.id ? 'Reenviando...' : 'Reenviar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bloque 2: Bitácora de Peticiones HTTP (API Logs) */}
      <div className="surface-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Activity size={17} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bitácora de Peticiones HTTP (API Logs)</h3>
              <p className="text-xs text-slate-500">Historial en tiempo real de llamadas recibidas por el Gateway.</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(['all', '2xx', '4xx', '5xx'] as const).map(st => (
              <button
                key={st}
                onClick={() => setLogsFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                  logsFilterStatus === st
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'surface-interactive text-slate-600 dark:text-slate-400'
                }`}
              >
                {st === 'all' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Método & Endpoint</th>
                <th className="py-3 px-4">Instancia</th>
                <th className="py-3 px-4">Latencia</th>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {logsData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-400">
                    No se encontraron peticiones HTTP para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                logsData.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        log.statusCode < 300
                          ? 'surface-accent-emerald text-emerald-700 dark:text-emerald-300'
                          : log.statusCode < 500
                          ? 'surface-accent-amber text-amber-700 dark:text-amber-300'
                          : 'surface-accent-rose text-rose-700 dark:text-rose-300'
                      }`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <span className="text-emerald-600 dark:text-emerald-400 mr-2">{log.method}</span>
                      {log.endpoint}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.instanceName || '-'}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{log.latencyMs}ms</td>
                    <td className="py-3 px-4 text-slate-400">{log.requestId}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">{new Date(log.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg surface-interactive font-sans font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        Inspeccionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Inspector de Petición HTTP */}
      {selectedLog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated p-6 rounded-2xl max-w-2xl w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600">{selectedLog.method} {selectedLog.endpoint}</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Request ID: {selectedLog.requestId}</h4>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1.5">Request Body:</div>
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.requestBody || {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1.5">Response Body (HTTP {selectedLog.statusCode}):</div>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.responseBody || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Simular Evento Webhook */}
      {testWebhookModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60">
          <div className="surface-elevated p-6 rounded-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Simular Evento Webhook</h3>
              <button onClick={() => setTestWebhookModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Instancia Origen:</label>
                <input
                  type="text"
                  value={testInstance}
                  onChange={(e) => setTestInstance(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl surface-interactive text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Tipo de Evento Canónico:</label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl surface-interactive text-slate-900 dark:text-white"
                >
                  <option value="MESSAGE_RECEIVED">MESSAGE_RECEIVED</option>
                  <option value="MESSAGE_STATUS_UPDATE">MESSAGE_STATUS_UPDATE</option>
                  <option value="CONNECTION_UPDATE">CONNECTION_UPDATE</option>
                </select>
              </div>

              {testResult && (
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setTestWebhookModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold surface-interactive text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer disabled:opacity-50"
                >
                  {testingWebhook ? 'Disparando...' : 'Disparar Evento'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default DeveloperPortal;
