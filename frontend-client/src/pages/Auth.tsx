import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  ShieldCheck, Zap, Moon, Sun, Smartphone, 
  Activity, CheckCircle2, Lock, Loader2, Sparkles
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';

declare global {
  interface Window {
    google: any;
  }
}

export default function AuthPage() {
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleLoginResponse = useCallback(async (response: any) => {
    setError(null);
    setAuthenticating(true);
    try {
      const res = await api.post('/auth/google-login', { credential: response.credential });
      if (res.data?.success && res.data?.token) {
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'No se pudo iniciar sesión con Google.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error en la autenticación con Google. Inténtalo nuevamente.');
    } finally {
      setAuthenticating(false);
    }
  }, [refreshUser]);

  const renderGoogleButton = useCallback(() => {
    if (!window.google || !googleBtnRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com',
        callback: handleGoogleLoginResponse,
        auto_select: false
      });

      // Limpiar render previo
      googleBtnRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(
        googleBtnRef.current,
        { 
          theme: isDark ? 'filled_dark' : 'outline', 
          size: 'large', 
          width: '320',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left'
        }
      );
      setLoadingGoogle(false);
    } catch (err) {
      console.warn('Error al renderizar botón de Google:', err);
    }
  }, [isDark, handleGoogleLoginResponse]);

  // Cargar Google SDK una sola vez de forma controlada
  useEffect(() => {
    if (window.google) {
      renderGoogleButton();
      return;
    }

    const SCRIPT_ID = 'google-gsi-client';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderGoogleButton();
      };
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', renderGoogleButton);
      return () => {
        script.removeEventListener('load', renderGoogleButton);
      };
    }
  }, [renderGoogleButton]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 md:p-10 bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-white overflow-hidden transition-colors duration-300 font-sans">
      
      {/* Ambient Lighting & Glow Nodes (Emerald & Teal Brand Identity) */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-teal-500/10 dark:bg-teal-500/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/5 blur-[160px] pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-3 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center relative z-10 py-6">
        
        {/* Left Column: Product Showcase & Brand Value */}
        <div className="lg:col-span-7 space-y-7 text-left hidden lg:block animate-fadeIn">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>WHATSAPP API SAAS GATEWAY · v2.0</span>
          </div>

          {/* Main Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-black text-slate-900 dark:text-white leading-[1.15] tracking-tight">
              Infraestructura SaaS de <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                WhatsApp API Multi-Inquilino
              </span> <br />
              para tu Empresa.
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-xl font-normal">
              Conecta líneas ilimitadas, gestiona credenciales con seguridad granular, envía mensajes masivos y recibe webhooks en tiempo real con latencia sub-segundo.
            </p>
          </div>

          {/* Feature Highlight Cards */}
          <div className="grid grid-cols-1 gap-3.5 pt-2 max-w-xl">
            
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Zap size={20} />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white text-xs font-bold tracking-tight">Motor Evolution API v2 + Redis</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">Enrutamiento ultra-rápido de mensajes masivos con cola de procesamiento asíncrono.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white text-xs font-bold tracking-tight">Aislamiento & Claves API</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">Bases de datos aisladas por inquilino con llaves <code className="text-emerald-600 dark:text-emerald-400">x-api-key</code> de alta seguridad.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Activity size={20} />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white text-xs font-bold tracking-tight">Webhooks & Monitoreo en Vivo</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">Escaneo QR con auto-detección y recepción instantánea de eventos de mensajes.</p>
              </div>
            </div>

          </div>

          {/* Metric Badges */}
          <div className="flex items-center gap-6 pt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>99.99% Uptime SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-500" />
              <span>Latencia Sub-segundo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-cyan-500" />
              <span>REST API v2</span>
            </div>
          </div>

        </div>

        {/* Right Column: Premium Auth Card */}
        <div className="lg:col-span-5 flex justify-center w-full animate-fadeIn">
          <div className="w-full max-w-md bg-white/85 dark:bg-[#111827]/85 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden transition-all hover:border-emerald-500/30">
            
            {/* Subtle Top Glow Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            {/* Brand Logo & Header */}
            <div className="space-y-4 text-center pb-6">
              
              <div className="flex items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 transform hover:scale-105 transition-transform">
                  <Smartphone size={28} />
                </div>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles size={12} className="text-emerald-500" />
                  <span>Zaza.click 2.0</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Consola de WhatsApp API
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1 leading-relaxed">
                  Inicia sesión para gestionar tus líneas de WhatsApp, llaves API y Webhooks.
                </p>
              </div>

            </div>

            {/* Error Message Card */}
            {error && (
              <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium leading-relaxed flex items-start gap-3 animate-fadeIn">
                <span className="text-base">⚠️</span>
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-200">Error de Autenticación</p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              </div>
            )}

            {/* Google Authentication Button Container (Permanente en DOM para evitar null en SDK) */}
            <div className="space-y-4 pt-2">
              
              <div className="flex flex-col items-center justify-center min-h-[50px] relative">
                {loadingGoogle && !authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium animate-pulse">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Cargando autenticación segura...</span>
                  </div>
                )}

                {authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/60">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Autenticando con Google...</span>
                  </div>
                )}

                <div 
                  ref={googleBtnRef} 
                  className={`w-full flex justify-center transform active:scale-[0.99] transition-transform ${
                    loadingGoogle || authenticating ? 'hidden' : 'block'
                  }`} 
                />
              </div>

              {/* Security Footnote */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Lock size={12} className="text-emerald-500" />
                  <span>Cifrado TLS 1.3 de 256 bits · Acceso Seguro Multi-Inquilino</span>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
