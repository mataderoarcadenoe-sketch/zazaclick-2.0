import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  ShieldCheck, Moon, Sun, Lock, Loader2, 
  ShieldAlert, Server, Cpu, KeyRound, CheckCircle2
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

  // Manejo de respuesta de Google OAuth SSO
  const handleGoogleLoginResponse = useCallback(async (response: any) => {
    setError(null);
    setAuthenticating(true);
    try {
      const res = await api.post('/auth/google-login', { credential: response.credential });
      if (res.data?.success && res.data?.token) {
        if (res.data?.user?.role !== 'admin') {
          setError('Acceso Denegado: Esta cuenta de Google no tiene privilegios de SuperAdmin.');
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
        client_id: '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com',
        callback: handleGoogleLoginResponse,
        auto_select: false
      });

      googleBtnRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(
        googleBtnRef.current,
        { 
          type: 'standard',
          theme: isDark ? 'filled_black' : 'outline', 
          size: 'large', 
          width: '340',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left'
        }
      );
      setLoadingGoogle(false);
    } catch (err) {
      console.warn('Error al inicializar Google OAuth SDK:', err);
    }
  }, [isDark, handleGoogleLoginResponse]);

  useEffect(() => {
    if (window.google) {
      renderGoogleButton();
      return;
    }

    const SCRIPT_ID = 'google-gsi-client-admin';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => renderGoogleButton();
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', renderGoogleButton);
      return () => script.removeEventListener('load', renderGoogleButton);
    }
  }, [renderGoogleButton]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#F8FAFC] dark:bg-[#070B12] text-slate-900 dark:text-white overflow-hidden transition-colors duration-250 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Background Ambient Aura */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-teal-500/10 dark:bg-teal-500/15 blur-[160px] pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-3 bg-white dark:bg-[#0D131F] rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer shadow-sm"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10 py-6 animate-fadeIn">
        <div className="w-full bg-white dark:bg-[#0D131F] p-8 sm:p-10 rounded-[32px] relative overflow-hidden transition-all shadow-xl dark:shadow-2xl dark:shadow-black/50 border border-slate-100/80 dark:border-slate-800/40 text-center space-y-6">
          
          {/* Brand Logo & Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 dark:from-emerald-600 dark:to-teal-800 flex items-center justify-center text-white shadow-md transform hover:scale-105 transition-transform">
                <ShieldCheck size={32} className="text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <KeyRound size={12} className="text-emerald-500" />
                <span>SuperAdmin Gateway · Zaza 2.0</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                Consola de Control
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                Acceso exclusivo para la gestión de infraestructura, inquilinos, licencias y métricas globales.
              </p>
            </div>
          </div>

          {/* Telemetría Rápida */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#141D2E] flex items-center justify-center gap-2">
              <Server size={14} className="text-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Cluster Core v2.0</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#141D2E] flex items-center justify-center gap-2">
              <Cpu size={14} className="text-teal-500 flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Evolution 2.4.0-rc2</span>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium flex items-start gap-3 animate-fadeIn">
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-200">Acceso Restringido</p>
                <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Tarjeta de Cuenta Autorizada */}
          <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Cuenta de SuperAdmin Vinculada
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                syscomecosistemadigital@gmail.com
              </span>
            </div>
          </div>

          {/* Google SSO Login Container */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center justify-center min-h-[50px] relative w-full">
              {loadingGoogle && !authenticating && (
                <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium animate-pulse">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span>Cargando Single Sign-On...</span>
                </div>
              )}

              {authenticating && (
                <div className="flex items-center gap-2.5 py-3.5 px-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold animate-pulse">
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
            <div className="pt-4 text-center space-y-1.5 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <Lock size={12} className="text-emerald-500" />
                <span>SuperAdmin Shield · Autenticación Criptográfica Google SSO</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                IP y registros de auditoría monitoreados en tiempo real.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
