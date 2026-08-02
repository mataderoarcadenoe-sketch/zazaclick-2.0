import { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { ShieldAlert } from 'lucide-react';
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
            theme: 'filled_dark', 
            size: 'large', 
            width: '340',
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
      setError(err.response?.data?.error || 'Acceso denegado o fallo de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] flex items-center justify-center p-4">
      {/* Red glow backgrounds for Admin warning vibe */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#151D30]/85 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Zaza.click <span className="text-emerald-500">2.0</span>
            </h2>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
              Acceso Exclusivo de Administrador
            </p>
          </div>
          
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            Este portal requiere autenticación de Google de una cuenta autorizada de superadministrador.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Google Authentication container */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4 border-t border-b border-white/5">
          {loading ? (
            <div className="flex flex-col items-center space-y-2">
              <span className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spinSlow" />
              <span className="text-[10px] text-gray-400 font-medium">Validando credenciales...</span>
            </div>
          ) : (
            <div id="google-admin-btn" className="w-full max-w-[340px]" />
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-500">
          Zaza.click SaaS Platform Owner Operations.
        </div>

      </div>
    </div>
  );
}
