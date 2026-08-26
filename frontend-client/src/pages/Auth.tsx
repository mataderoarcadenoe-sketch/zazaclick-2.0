import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { InteractiveGravityMesh } from '../components/InteractiveGravityMesh';
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

  const GOOGLE_CLIENT_ID = '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com';

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
    if (!window.google || !googleBtnRef.current) return;
    
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleBtnRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 320,
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
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-gradient-to-br from-emerald-50/50 via-slate-50 to-teal-50/40 dark:from-[#050C1A] dark:via-[#071322] dark:to-[#041D1A] text-slate-900 dark:text-white overflow-hidden transition-colors duration-300 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Interactive Gravity Mesh Background (Living API Network Engine) */}
      <InteractiveGravityMesh 
        variant="client"
        isDark={isDark} 
        className="absolute inset-0 pointer-events-none z-0"
      />

      {/* Dynamic Colorful Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/15 blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute -bottom-32 -right-32 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-teal-500/15 to-cyan-500/10 dark:from-teal-500/15 dark:to-cyan-500/15 blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/5 dark:bg-emerald-400/5 blur-[180px] pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-3 bg-white/90 dark:bg-[#0D1829]/90 backdrop-blur-md rounded-2xl hover:bg-white dark:hover:bg-[#132238] transition-all text-slate-700 dark:text-slate-200 cursor-pointer active:scale-95 flex items-center gap-2 shadow-lg shadow-emerald-950/5 dark:shadow-black/40 border border-emerald-500/10 dark:border-emerald-500/20"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
        </button>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center relative z-10 py-6">
        
        {/* Left Hero Showcase, Visual Architecture & Live Badges */}
        <div className="md:col-span-6 lg:col-span-7 space-y-8 text-left hidden md:block animate-fadeIn">
          
          {/* Header Status Badge */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>WHATSAPP API ENTERPRISE SAAS GATEWAY · v2.0</span>
            </div>

            <div className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
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
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D131F] relative overflow-hidden space-y-5">
            
            <div className="flex items-center justify-between pb-3">
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
              <div className="p-4 bg-slate-50 dark:bg-[#141D2E] rounded-2xl space-y-1">
                <div className="w-8 h-8 mx-auto rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-xs">
                  <Server size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Tus Sistemas</h5>
                <p className="text-[10px] text-slate-400">CRM / ERP / Apps</p>
              </div>

              {/* Node 2: Zaza Core Gateway */}
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl space-y-1 relative">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                  <ArrowRight size={14} />
                </div>
                <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs">
                  <Cpu size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Zaza API Gateway</h5>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">x-api-key</p>
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Node 3: WhatsApp Multi-Tenant Instances */}
              <div className="p-4 bg-slate-50 dark:bg-[#141D2E] rounded-2xl space-y-1">
                <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                  <Smartphone size={16} />
                </div>
                <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Líneas WhatsApp</h5>
                <p className="text-[10px] text-slate-400">Instancias Aisladas</p>
              </div>

            </div>

            {/* Architecture Metrics Live Bar */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
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
            
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D131F] space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <Zap size={16} className="text-emerald-500" />
                <span>Alta Disponibilidad & Escala</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Enrutamiento concurrente de mensajes masivos con balanceo de carga en clúster.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D131F] space-y-1.5">
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

        {/* Right Column — Master Authentication Card (Flat Minimalist Surface) */}
        <div className="lg:col-span-5 flex justify-center w-full animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#0D131F] p-8 sm:p-10 rounded-[32px] relative overflow-hidden transition-all">
            
            {/* Brand Logo & Header */}
            <div className="space-y-4 text-center pb-6">
              
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center text-white transform hover:scale-105 transition-transform">
                  <Smartphone size={32} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
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
              <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium leading-relaxed flex items-start gap-3 animate-fadeIn">
                <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-200">Error de Autenticación</p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Google Authentication Button Container */}
            <div className="space-y-5 pt-2">
              
              <div className="flex flex-col items-center justify-center min-h-[50px] relative w-full">
                {loadingGoogle && !authenticating && (
                  <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium animate-pulse">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Cargando autenticación segura...</span>
                  </div>
                )}

                {authenticating && (
                  <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold animate-pulse">
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
              <div className="pt-6 text-center space-y-2">
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
