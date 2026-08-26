import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { 
  ShieldCheck, Moon, Sun, Lock, Loader2, 
  Mail, Eye, EyeOff, ArrowRight, ShieldAlert,
  Server, Cpu, KeyRound
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // 1. Manejo de Login con Email y Contraseña
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setError(null);
    setLoadingEmail(true);

    try {
      const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      if (res.data?.success && res.data?.token) {
        // Validar si es rol admin
        if (res.data?.user?.role !== 'admin') {
          setError('Acceso denegado: Esta cuenta no cuenta con privilegios de SuperAdmin.');
          return;
        }
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'Credenciales incorrectas.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLoadingEmail(false);
    }
  };

  // 2. Manejo de Google Login Response
  const handleGoogleLoginResponse = useCallback(async (response: any) => {
    setError(null);
    setAuthenticating(true);
    try {
      const res = await api.post('/auth/google-login', { credential: response.credential });
      if (res.data?.success && res.data?.token) {
        if (res.data?.user?.role !== 'admin') {
          setError('Acceso denegado: Solo el SuperAdmin puede acceder a este panel.');
          return;
        }
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'No se pudo iniciar sesión con Google.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Acceso denegado o fallo de autenticación.');
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
      
      {/* Background Ambient Lights */}
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
        <div className="w-full bg-white dark:bg-[#0D131F] p-8 sm:p-10 rounded-[32px] relative overflow-hidden transition-all shadow-xl dark:shadow-2xl dark:shadow-black/50 border border-slate-100/80 dark:border-slate-800/40">
          
          {/* Header */}
          <div className="space-y-4 text-center pb-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 dark:from-emerald-600 dark:to-teal-800 flex items-center justify-center text-white shadow-md">
                <ShieldCheck size={32} className="text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <KeyRound size={12} className="text-emerald-500" />
                <span>SuperAdmin Gateway · Zaza 2.0</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                Consola de Control
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                Acceso exclusivo para administración de licenciamiento, planes y cuotas globales.
              </p>
            </div>
          </div>

          {/* Telemetría Rápida */}
          <div className="grid grid-cols-2 gap-2.5 pb-6">
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#141D2E] flex items-center gap-2">
              <Server size={14} className="text-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Cluster Core v2.0</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#141D2E] flex items-center gap-2">
              <Cpu size={14} className="text-teal-500 flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Evolution 2.4.0-rc2</span>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-2xl text-left font-medium flex items-start gap-3 animate-fadeIn">
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-200">Acceso Restringido</p>
                <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Formulario de Inicio de Sesión por Email/Contraseña */}
          <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                <span>Correo de Administrador</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="syscomecosistemadigital@gmail.com"
                className="w-full px-4 py-3 bg-slate-100 dark:bg-[#141D2E] rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:bg-slate-200 dark:focus:bg-[#1B273D] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Lock size={13} className="text-slate-400" />
                <span>Contraseña Maestra</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-4 pr-11 py-3 bg-slate-100 dark:bg-[#141D2E] rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:bg-slate-200 dark:focus:bg-[#1B273D] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingEmail || authenticating}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-2xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loadingEmail ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Verificando Credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Panel de Control</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white dark:bg-[#0D131F] px-3 text-slate-400 font-bold">
                O inicia sesión con Google
              </span>
            </div>
          </div>

          {/* Google Button */}
          <div className="flex flex-col items-center justify-center min-h-[44px]">
            {loadingGoogle && !authenticating && (
              <div className="flex items-center gap-2 py-2 text-slate-400 text-xs font-medium animate-pulse">
                <Loader2 size={14} className="animate-spin text-emerald-500" />
                <span>Cargando Google OAuth...</span>
              </div>
            )}

            {authenticating && (
              <div className="flex items-center gap-2.5 py-3 px-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold animate-pulse">
                <Loader2 size={16} className="animate-spin text-emerald-500" />
                <span>Verificando firma con Google...</span>
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
          <div className="pt-6 text-center space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-6">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <Lock size={12} className="text-emerald-500" />
              <span>SuperAdmin Shield · Autenticación Criptográfica</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              IP y eventos de acceso registrados en bitácora de auditoría.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
