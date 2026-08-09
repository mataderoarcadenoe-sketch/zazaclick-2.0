import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { ShieldAlert, Moon, Sun, Lock } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import api from '../services/api';

declare global {
  interface Window {
    google: any;
  }
}

export default function AuthPage() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
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
          document.getElementById('google-admin-btn'),
          { 
            theme: isDark ? 'filled_dark' : 'outline', 
            size: 'large', 
            width: '340',
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
  }, [isDark]);

  const handleGoogleLoginResponse = async (response: any) => {
    setLoading(true);
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
      setError(err.response?.data?.error || 'Acceso denegado o fallo de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8 mesh-gradient overflow-hidden transition-colors duration-300">
      {/* Light Nodes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/10 dark:bg-rose-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-zinc-500/10 dark:bg-zinc-500/5 blur-[120px] pointer-events-none" />

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

      <div className="w-full max-w-md bg-white/70 dark:bg-slate-900/75 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 sm:p-8 rounded-3xl shadow-premium relative z-10 space-y-6 animate-fadeIn">
        
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              Zaza.click <span className="text-zinc-400">2.0 Admin</span>
            </h2>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-widest">
              Acceso Exclusivo de Administrador
            </p>
          </div>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed font-medium">
            Este portal está restringido exclusivamente a las cuentas registradas con privilegios de administrador.
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl text-center font-bold animate-fadeIn">
            ⚠️ {error}
          </div>
        )}

        {/* Google Authentication container */}
        <div className="flex flex-col items-center justify-center py-6 space-y-4 border-t border-b border-slate-200/50 dark:border-slate-800/50">
          {loading ? (
            <div className="flex flex-col items-center space-y-2 py-4">
              <span className="w-6 h-6 border-2 border-zinc-400/30 border-t-zinc-500 rounded-full animate-spin" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Validando cuenta...</span>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              <div id="google-admin-btn" className="w-full flex justify-center" />
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <Lock size={12} className="text-slate-400" />
                <span>Conexión cifrada SSL</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Zaza.click Operations Panel.
        </div>

      </div>
    </div>
  );
}
