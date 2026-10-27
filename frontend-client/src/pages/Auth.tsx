import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { ZazaLogo } from '../components/ZazaLogo';
import api from '../services/api';
import { 
  Smartphone, ShieldAlert, Loader2, Moon, Sun, Lock, 
  Terminal, Server, Cpu, ArrowRight, Zap, ShieldCheck, CheckCircle2
} from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Auth() {
  const { refreshUser } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [error, setError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const isGoogleInitializedRef = useRef(false);

  const GOOGLE_CLIENT_ID = '782722800100-4j8107m9nn2r0ngt6b4e17r2s2166l19.apps.googleusercontent.com';

  const handleGoogleCallback = useCallback(async (response: any) => {
    try {
      if (!response.credential) {
        setError('No se recibió la credencial de Google.');
        return;
      }
      setAuthenticating(true);
      setError(null);
      const res = await api.post('/auth/google-login', { credential: response.credential });
      if (res.data?.success && res.data?.token) {
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'No se pudo iniciar sesión con Google.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión con Google.');
    } finally {
      setAuthenticating(false);
    }
  }, [refreshUser]);

  const renderGoogleButton = useCallback(() => {
    if (!window.google?.accounts?.id || !googleBtnRef.current) return;
    
    try {
      if (!isGoogleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        isGoogleInitializedRef.current = true;
      }

      googleBtnRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 320,
        locale: 'es',
      });

      setLoadingGoogle(false);
    } catch (err) {
      console.warn('Error inicializando Google Button:', err);
    }
  }, [isDark, handleGoogleCallback]);

  useEffect(() => {
    const existingScript = document.getElementById('google-gsi-client');
    
    if (window.google) {
      renderGoogleButton();
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderGoogleButton();
      };
      script.onerror = () => {
        setLoadingGoogle(false);
        setError('No se pudo cargar el SDK de Google Sign-In.');
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => {
        renderGoogleButton();
      });
    }
  }, [renderGoogleButton]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-2.5 surface-panel rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10 py-6">
        
        {/* Left Hero Showcase */}
        <div className="md:col-span-6 lg:col-span-7 space-y-7 text-left hidden md:block">
          
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              <span>WHATSAPP API ENTERPRISE GATEWAY · v2.0</span>
            </div>
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg surface-panel text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <span>Multi-Inquilino</span>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-black text-slate-900 dark:text-white leading-[1.14] tracking-tight">
              Automatiza, Conecta y Escala tu{' '}
              <span className="text-emerald-600 dark:text-emerald-400">
                WhatsApp API Multi-Tenant
              </span>{' '}
              a Nivel Empresarial.
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl font-normal">
              Plataforma SaaS diseñada para conectar líneas de WhatsApp dedicadas, emitir credenciales seguras <code className="text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded surface-accent-emerald">x-api-key</code> y despachar mensajes con latencia sub-segundo.
            </p>
          </div>

          {/* Architecture Card */}
          <div className="p-6 rounded-2xl surface-panel space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Flujo de Arquitectura Directa</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 surface-accent-emerald px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>ONLINE · 99.99% SLA</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-4 surface-interactive rounded-xl space-y-1">
                <div className="w-8 h-8 mx-auto rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 flex items-center justify-center font-bold text-xs">
                  <Server size={16} />
                </div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Tus Sistemas</h5>
                <p className="text-[11px] text-slate-500">CRM / ERP / Apps</p>
              </div>

              <div className="p-4 surface-accent-emerald rounded-xl space-y-1 relative">
                <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <ArrowRight size={14} />
                </div>
                <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  <Cpu size={16} />
                </div>
                <h5 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Zaza API Gateway</h5>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">x-api-key</p>
                <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <ArrowRight size={14} />
                </div>
              </div>

              <div className="p-4 surface-interactive rounded-xl space-y-1">
                <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  <Smartphone size={16} />
                </div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Líneas WhatsApp</h5>
                <p className="text-[11px] text-slate-500">Evolution Go</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Webhooks HMAC-SHA256</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Sub-segundo SLA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Autenticación API Key</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <div className="p-5 rounded-xl surface-panel space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <Zap size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>API REST Unificada</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Envía mensajes de texto, documentos, notas de voz PTT, ubicaciones y contactos mediante llamadas JSON HTTP.
              </p>
            </div>

            <div className="p-5 rounded-xl surface-panel space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>Aislamiento Multi-Tenant</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cada organización administra sus propias líneas de WhatsApp, llaves de acceso y registros de entrega.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column — Authentication Card */}
        <div className="md:col-span-6 lg:col-span-5 flex justify-center w-full">
          <div className="w-full max-w-md surface-elevated p-8 sm:p-10 rounded-2xl relative overflow-hidden">
            
            <div className="space-y-4 text-center pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-center">
                <ZazaLogo size={60} />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center px-3 py-1 rounded-md surface-interactive text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                  <span>Zaza Click 2.0</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                  Portal de Clientes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Inicia sesión con tu cuenta de Google para gestionar tus líneas de WhatsApp, credenciales API y Webhooks.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 mt-6 surface-accent-rose text-rose-700 dark:text-rose-300 text-xs rounded-xl text-left font-medium flex items-start gap-3">
                <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-200">Error de Autenticación</p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6 pt-6">
              <div className="flex flex-col items-center justify-center min-h-[50px] relative w-full">
                {loadingGoogle && !authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-5 rounded-xl surface-interactive text-slate-500 text-xs font-medium">
                    <Loader2 size={15} className="animate-spin text-emerald-600" />
                    <span>Cargando acceso con Google...</span>
                  </div>
                )}

                {authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-5 rounded-xl surface-accent-emerald text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    <Loader2 size={15} className="animate-spin text-emerald-600" />
                    <span>Verificando sesión...</span>
                  </div>
                )}

                <div 
                  ref={googleBtnRef} 
                  className={`w-full flex justify-center ${
                    loadingGoogle || authenticating ? 'hidden' : 'block'
                  }`} 
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  <Lock size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Conexión Cifrada TLS 1.3 · Entorno Aislado</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Infraestructura empresarial operativa 24/7.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
