import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { ShieldCheck, Zap, Cpu, Moon, Sun, Smartphone } from 'lucide-react';
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
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Dynamically load Google SDK on mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com',
          callback: handleGoogleLoginResponse,
          auto_select: false
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-btn'),
          { 
            theme: isDark ? 'filled_dark' : 'outline', 
            size: 'large', 
            width: '380',
            text: 'signin',
            logo_alignment: 'left'
          }
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [isDark]); // Re-render button theme when isDark changes

  const handleGoogleLoginResponse = async (response: any) => {
    setError(null);
    try {
      const res = await api.post('/auth/google-login', { credential: response.credential });
      if (res.data?.success && res.data?.token) {
        localStorage.setItem('saas_auth_token', res.data.token);
        await refreshUser();
      } else {
        setError(res.data?.error || 'Error al conectar con Google');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fallo de autenticación con Google');
    }
  };


  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8 mesh-gradient overflow-hidden transition-colors duration-300">
      {/* Light Nodes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 dark:bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleDark}
          className="p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover-lift shadow-sm text-slate-600 dark:text-slate-300 cursor-pointer"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
        </button>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Marketing Info Panel */}
        <div className="md:col-span-6 space-y-6 text-left hidden md:block animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl text-white shadow-md shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">SaaS Platform</span>
              <span className="block text-xl font-bold text-slate-800 dark:text-white tracking-tight">Zaza.click <span className="text-emerald-500">2.0</span></span>
            </div>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-slate-800 dark:text-white leading-tight tracking-tight">
            API de WhatsApp <br />
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 bg-clip-text text-transparent">Multi-Inquilino</span> <br />
            para tu negocio.
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-md">
            Conecta instancias ilimitadas, gestiona credenciales de forma aislada, escanear códigos QR instantáneos y empieza a enviar mensajes masivos y notificaciones mediante API en segundos.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/30 dark:border-slate-800/30 hover:border-emerald-500/30 transition-colors">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 mt-0.5">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-slate-800 dark:text-white text-xs font-semibold tracking-tight">Velocidad Instantánea</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Envíos inmediatos integrados con Evolution API v2 y caché Redis optimizada.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/30 dark:border-slate-800/30 hover:border-emerald-500/30 transition-colors">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 mt-0.5">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-slate-800 dark:text-white text-xs font-semibold tracking-tight">Seguridad y Aislamiento</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Bases de datos aisladas con autenticación segura e instancias encapsuladas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Box */}
        <div className="md:col-span-6 flex justify-center w-full animate-fadeIn stagger-2">
          <div className="w-full max-w-md bg-white/70 dark:bg-slate-900/75 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 sm:p-8 rounded-3xl shadow-premium relative">
            
            {/* Header */}
            <div className="space-y-1.5 text-center pb-6">
              <div className="md:hidden flex items-center justify-center gap-2 pb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold">
                  <Smartphone size={16} />
                </div>
                <span className="font-semibold text-sm text-slate-800 dark:text-white">Zaza.click 2.0</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                ¡Bienvenido a Zaza.click!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inicia sesión o regístrate con tu cuenta de Google.
              </p>
            </div>

            {error && (
              <div className="p-3.5 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl text-center font-bold animate-fadeIn">
                ⚠️ {error}
              </div>
            )}

            {/* Google Sign-in Button */}
            <div className="flex flex-col items-center pb-5 mb-5">
              <div id="google-btn" className="w-full flex justify-center" />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
