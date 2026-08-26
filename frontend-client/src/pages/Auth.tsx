import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  ShieldCheck, Zap, Moon, Sun, Smartphone, 
  CheckCircle2, Lock, Loader2, Sparkles, Server, Terminal, ArrowRight, ShieldAlert, Cpu
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
          type: 'standard',
          theme: isDark ? 'filled_black' : 'outline', 
          size: 'large', 
          width: '320',
          text: 'signin_with',
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
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white overflow-hidden transition-colors duration-300 font-sans bg-grid-tech selection:bg-emerald-500 selection:text-white">
      
      {/* Layer 2: Multi-point Radial Glow Lighting Nodes */}
      <div className="absolute -top-48 -left-48 w-[650px] h-[650px] rounded-full bg-emerald-500/12 dark:bg-emerald-500/18 blur-[160px] pointer-events-none animate-pulse-glow" />
      <div className="absolute -bottom-48 -right-48 w-[650px] h-[650px] rounded-full bg-teal-500/12 dark:bg-teal-500/18 blur-[160px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/8 blur-[180px] pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-3 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95 flex items-center gap-2"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
        </button>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center relative z-10 py-6">
        
        {/* Layer 3 & 4: Left Hero Showcase, Visual Architecture & Live Badges */}
        <div className="lg:col-span-7 space-y-8 text-left hidden lg:block animate-fadeIn">
          
          {/* Header Status Badge */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>WHATSAPP API ENTERPRISE SAAS GATEWAY · v2.0</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <Sparkles size={13} className="text-emerald-500" />
              <span>Multi-Inquilino</span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-black text-slate-900 dark:text-white leading-[1.12] tracking-tight">
              Automatiza, Conecta y Escala tu <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                WhatsApp API Multi-Tenant
              </span> <br />
              a Nivel Empresarial.
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl font-normal">
              La plataforma SaaS especializada para conectar instancias de WhatsApp ilimitadas, emitir credenciales seguras <code className="text-emerald-600 dark:text-emerald-400 font-bold">x-api-key</code> y procesar millones de mensajes con latencia sub-segundo.
            </p>
          </div>

          {/* Hero Visual: WhatsApp API Architecture Gateway Canvas */}
          <div className="p-5 rounded-3xl bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative overflow-hidden space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Flujo de Arquitectura en Tiempo Real</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>ONLINE · 99.99% SLA</span>
              </div>
            </div>

            {/* Architecture Node Diagram */}
            <div className="grid grid-cols-3 gap-3 text-center">
              
              {/* Node 1: Client App */}
              <div className="p-3 bg-slate-50 dark:bg-[#1a2333] rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <div className="w-8 h-8 mx-auto rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-xs">
                  <Server size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Tus Sistemas</h5>
                <p className="text-[10px] text-slate-400">CRM / ERP / Apps</p>
              </div>

              {/* Node 2: Zaza Core Gateway */}
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-1 relative">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                  <ArrowRight size={14} />
                </div>
                <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20">
                  <Cpu size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Zaza API Gateway</h5>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">x-api-key</p>
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Node 3: WhatsApp Multi-Tenant Instances */}
              <div className="p-3 bg-slate-50 dark:bg-[#1a2333] rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                  <Smartphone size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Líneas WhatsApp</h5>
                <p className="text-[10px] text-slate-400">Instancias Aisladas</p>
              </div>

            </div>

            {/* Architecture Metrics Live Bar */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Redis Queue Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-teal-500" />
                <span>Latencia: &lt; 85ms</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-cyan-500" />
                <span>Webhooks en Vivo</span>
              </div>
            </div>

          </div>

          {/* Feature Highlights Strip */}
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <Zap size={16} className="text-emerald-500" />
                <span>Alta Disponibilidad & Escala</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Enrutamiento concurrente de mensajes masivos con balanceo de carga en clúster.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <ShieldCheck size={16} className="text-teal-500" />
                <span>Aislamiento Criptográfico</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Cada empresa cuenta con su propia bóveda de credenciales e instancias blindadas.
              </p>
            </div>

          </div>

        </div>

        {/* Layer 5 & 6: Right Column — Master Authentication Card */}
        <div className="lg:col-span-5 flex justify-center w-full animate-fadeIn">
          <div className="w-full max-w-md bg-white/90 dark:bg-[#111827]/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 p-8 sm:p-10 rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] relative overflow-hidden transition-all hover:border-emerald-500/40">
            
            {/* Brand Logo & Header */}
            <div className="space-y-4 text-center pb-6">
              
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-500/25 transform hover:scale-105 transition-transform">
                  <Smartphone size={32} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} className="text-emerald-500" />
                  <span>Zaza.click 2.0</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                  Consola de API
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                  Inicia sesión para gestionar tus líneas de WhatsApp, credenciales API y Webhooks en tiempo real.
                </p>
              </div>

            </div>

            {/* Error Message Card */}
            {error && (
              <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium leading-relaxed flex items-start gap-3 animate-fadeIn shadow-sm">
                <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-200">Error de Autenticación</p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Google Authentication Button Container (Permanente en DOM para evitar null en SDK) */}
            <div className="space-y-5 pt-2">
              
              <div className="flex flex-col items-center justify-center min-h-[50px] relative">
                {loadingGoogle && !authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium animate-pulse">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Cargando autenticación segura...</span>
                  </div>
                )}

                {authenticating && (
                  <div className="flex items-center gap-2.5 py-3 px-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/60 shadow-sm animate-pulse">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Autenticando de forma segura...</span>
                  </div>
                )}

                <div 
                  ref={googleBtnRef} 
                  className={`w-full flex justify-center transform active:scale-[0.99] transition-all ${
                    loadingGoogle || authenticating ? 'hidden' : 'block'
                  }`} 
                />
              </div>

              {/* Security Footnote */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <Lock size={13} className="text-emerald-500" />
                  <span>Cifrado TLS 1.3 de 256 bits · Acceso Multi-Tenant Aislado</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Infraestructura protegida con monitoreo de seguridad 24/7.
                </p>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
