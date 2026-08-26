import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  ShieldCheck, Moon, Sun, Lock, Loader2, 
  ShieldAlert, Server, KeyRound, CheckCircle2,
  Terminal, ArrowRight, Zap, Database, Sparkles,
  LockKeyhole
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { InteractiveGravityMesh } from '../components/InteractiveGravityMesh';
import api from '../services/api';

declare global {
  interface Window {
    google?: any;
  }
}

export default function AuthPage() {
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();
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
        if (res.data?.user?.role !== 'admin') {
          setError('Acceso Denegado: Esta cuenta de Google no cuenta con privilegios de SuperAdmin.');
          return;
        }
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'No se pudo verificar la identidad con Google.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Acceso denegado o fallo de autenticación de seguridad.');
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
      console.warn('Error inicializando Google Button en Admin:', err);
    }
  }, [isDark, handleGoogleCallback]);

  useEffect(() => {
    const existingScript = document.getElementById('google-gsi-client-admin');

    if (window.google) {
      renderGoogleButton();
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client-admin';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => renderGoogleButton();
      script.onerror = () => {
        setLoadingGoogle(false);
        setError('No se pudo cargar el servicio de autenticación de Google.');
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => renderGoogleButton());
    }
  }, [renderGoogleButton]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-gradient-to-br from-emerald-50/50 via-slate-50 to-teal-50/40 dark:from-[#050C1A] dark:via-[#071322] dark:to-[#041D1A] text-slate-900 dark:text-white overflow-hidden transition-colors duration-300 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Interactive Gravity Mesh Background (Antigravity Signature Physics) */}
      <InteractiveGravityMesh 
        particleCount={70} 
        maxDistance={140} 
        gravityRadius={170} 
        isDark={isDark} 
        className="absolute inset-0 pointer-events-auto z-0"
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
        
        {/* Left Hero Showcase — SuperAdmin Command Center & Architecture Telemetry */}
        <div className="md:col-span-6 lg:col-span-7 space-y-7 text-left hidden md:block animate-fadeIn">
          
          {/* Header Status Badge */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-black tracking-wide border border-emerald-500/30 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>SUPERADMIN SAAS CONTROL CENTER · v2.0</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/20">
              <Sparkles size={13} className="text-teal-500" />
              <span>Control Maestro Total</span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-[1.12] tracking-tight">
              Control Maestro, Licencias <br />
              y Facturación de tu <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm">
                WhatsApp API Gateway.
              </span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm lg:text-base leading-relaxed max-w-2xl font-normal">
              Centro de mando exclusivo para administrar inquilinos, supervisar consumo de cuotas en tiempo real, procesar pagos y controlar el clúster de Evolution API 2.4.0-rc2.
            </p>
          </div>

          {/* SuperAdmin Architecture Canvas */}
          <div className="p-6 rounded-3xl bg-white/90 dark:bg-[#0D1829]/90 backdrop-blur-xl relative overflow-hidden space-y-5 shadow-xl shadow-emerald-950/5 dark:shadow-black/50">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <Terminal size={17} className="text-emerald-500" />
                <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight">Flujo de Arquitectura y Autoridad en Tiempo Real</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/60 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>ONLINE · 99.99% SLA</span>
              </div>
            </div>

            {/* Nodes Diagram with Rich Color Contrast */}
            <div className="grid grid-cols-3 gap-3.5 text-center">
              
              {/* Node 1: SuperAdmin Authority */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-[#132238] dark:to-[#0F1B2D] rounded-2xl space-y-1.5 shadow-sm">
                <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white dark:from-emerald-500 dark:to-teal-600 dark:text-white flex items-center justify-center font-bold text-xs shadow-md">
                  <ShieldCheck size={18} className="text-emerald-400 dark:text-white" />
                </div>
                <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">SuperAdmin</h5>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Control & Auditoría</p>
              </div>

              {/* Node 2: Database & Atomic Quota */}
              <div className="p-4 bg-gradient-to-b from-emerald-50 to-teal-50/80 dark:from-emerald-950/60 dark:to-teal-950/40 rounded-2xl space-y-1.5 relative shadow-sm">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <ArrowRight size={15} />
                </div>
                <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-600/30">
                  <Database size={18} />
                </div>
                <h5 className="text-xs font-black text-emerald-900 dark:text-emerald-200">PostgreSQL Core</h5>
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 font-mono">Cuotas Atómicas</p>
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <ArrowRight size={15} />
                </div>
              </div>

              {/* Node 3: Evolution Cluster */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-[#132238] dark:to-[#0F1B2D] rounded-2xl space-y-1.5 shadow-sm">
                <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                  <Server size={18} />
                </div>
                <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">Evolution 2.4.0</h5>
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400">Baileys Engine</p>
              </div>

            </div>

            {/* Architecture Metrics Live Bar */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span>Control Vencimientos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0" />
                <span>Reserva Atómica</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-cyan-500 flex-shrink-0" />
                <span>Anti-Bypass Blindado</span>
              </div>
            </div>

          </div>

          {/* Feature Highlights Cards with Vibrant Gradients */}
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0D1829]/90 backdrop-blur-md space-y-1.5 shadow-md">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-black">
                <Zap size={16} className="text-emerald-500" />
                <span>Control Total de Clientes</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Suspende, bloquea, activa y cambia planes de cualquier empresa al instante.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0D1829]/90 backdrop-blur-md space-y-1.5 shadow-md">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-black">
                <LockKeyhole size={16} className="text-teal-500" />
                <span>Pagos & Trazabilidad</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Registro de pagos con renovación Rolling y bitácora de auditoría inmutable.
              </p>
            </div>

          </div>

        </div>

        {/* Right Column — Master SuperAdmin Google SSO Card */}
        <div className="md:col-span-6 lg:col-span-5 flex justify-center w-full animate-fadeIn">
          <div className="w-full max-w-md bg-white/95 dark:bg-[#0D1829]/95 backdrop-blur-2xl p-8 sm:p-10 rounded-[36px] relative overflow-hidden transition-all shadow-2xl shadow-emerald-950/10 dark:shadow-black/70 text-center space-y-6">
            
            {/* Brand Logo & Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-slate-900 via-emerald-950 to-emerald-700 dark:from-emerald-600 dark:via-teal-600 dark:to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-600/20 transform hover:scale-105 transition-transform">
                  <ShieldCheck size={36} className="text-emerald-400 dark:text-white drop-shadow-md" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  <KeyRound size={12} className="text-emerald-500" />
                  <span>SuperAdmin Gateway · Zaza 2.0</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                  Consola de Control
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                  Inicia sesión con tu cuenta autorizada para acceder al panel de control global.
                </p>
              </div>
            </div>

            {/* Error Message Card */}
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium flex items-start gap-3 animate-fadeIn">
                <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-200">Acceso Restringido</p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Tarjeta de Cuenta Autorizada */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 rounded-2xl flex items-center gap-3 text-left shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Cuenta SuperAdmin Autorizada
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                  syscomecosistemadigital@gmail.com
                </span>
              </div>
            </div>

            {/* Google Authentication Button Container */}
            <div className="space-y-5 pt-2">
              
              <div className="flex flex-col items-center justify-center min-h-[50px] relative w-full">
                {loadingGoogle && !authenticating && (
                  <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold animate-pulse border border-slate-200 dark:border-slate-700">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Cargando autenticación segura...</span>
                  </div>
                )}

                {authenticating && (
                  <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-xs font-black animate-pulse border border-emerald-500/40">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Verificando credenciales SuperAdmin...</span>
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
              <div className="pt-4 text-center space-y-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  <Lock size={12} className="text-emerald-500" />
                  <span>SuperAdmin Shield · Autenticación Criptográfica Google SSO</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Infraestructura protegida con monitoreo y auditoría en tiempo real.
                </p>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
