import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { ShieldCheck, Zap, Cpu } from 'lucide-react';
import api from '../services/api';

declare global {
  interface Window {
    google: any;
  }
}

export default function AuthPage() {
  const { login, register, refreshUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            theme: 'filled_dark', 
            size: 'large', 
            width: '380',
            text: 'signin', // Forces generic "Sign In" text instead of personalized "Sign in as..."
            logo_alignment: 'left'
          }
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
      setError(err.response?.data?.error || 'Fallo de autenticación con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = isLogin
        ? await login(email.trim(), password.trim())
        : await register(email.trim(), password.trim());

      if (!res.success) {
        setError(res.error || 'Operación fallida');
      }
    } catch (err) {
      setError('Error inesperado al conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Marketing Info Panel */}
        <div className="md:col-span-6 space-y-6 text-left pr-4 hidden md:block">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-wide">Zaza.click <span className="text-emerald-500">2.0</span></span>
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight">
            La API de WhatsApp <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Más rápida y confiable</span> <br />
            para tu negocio.
          </h1>

          <p className="text-gray-400 text-sm leading-relaxed">
            Conecta tu WhatsApp en segundos, crea múltiples instancias independientes y envía notificaciones, recordatorios o mensajes automáticos desde tus propios sistemas.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#151D30] border border-white/5 rounded-lg text-emerald-400 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-white text-xs font-bold">Instancias Multi-inquilino</h4>
                <p className="text-gray-400 text-[11px]">Asigna y controla números de WhatsApp de forma totalmente aislada por cliente.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#151D30] border border-white/5 rounded-lg text-emerald-400 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-white text-xs font-bold">Fácil de Integrar</h4>
                <p className="text-gray-400 text-[11px]">Documentación sencilla para integrar con PHP, Node, Python, Bubble y más.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Box */}
        <div className="md:col-span-6 flex justify-center">
          <div className="w-full max-w-md bg-[#151D30]/85 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative">
            
            {/* Header */}
            <div className="space-y-2 text-center pb-6">
              <h2 className="text-2xl font-bold text-white">
                {isLogin ? '¡Bienvenido de vuelta!' : 'Crea tu cuenta'}
              </h2>
              <p className="text-xs text-gray-400">
                {isLogin
                  ? 'Ingresa tus credenciales para administrar tus APIs.'
                  : 'Regístrate hoy y obtén 1 número de WhatsApp gratuito.'}
              </p>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* Google Sign-in Button */}
            <div className="flex justify-center pb-5 mb-5 border-b border-white/5">
              <div id="google-btn" className="w-full max-w-[380px]" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  required
                  className="w-full px-4 py-3 bg-[#1D263B] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-[#1D263B] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] transition-all text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2 mt-6 cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spinSlow" />
                ) : (
                  <span>{isLogin ? 'Iniciar Sesión' : 'Registrar Cuenta'}</span>
                )}
              </button>
            </form>

            {/* Toggle footer */}
            <div className="pt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-[11px] text-gray-400 hover:text-white transition-colors underline cursor-pointer"
              >
                {isLogin
                  ? '¿No tienes cuenta? Regístrate aquí'
                  : '¿Ya tienes una cuenta? Inicia sesión'}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
