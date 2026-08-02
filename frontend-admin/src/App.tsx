import React from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import AuthPage from './pages/Auth';
import AdminDashboardPage from './pages/AdminDashboard';
import { Smartphone } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center space-y-4">
        {/* Glowing loader */}
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-3xl flex items-center justify-center shadow-xl animate-pulseGlow">
          <Smartphone className="w-8 h-8 animate-spinSlow" />
        </div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest animate-pulse">Cargando Zaza.click 2.0 Admin...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Reject access to non-admin accounts in the admin subdomain/portal
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center space-y-4 text-center p-4">
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold">
          ⚠️ Acceso Denegado: Esta cuenta no es de administrador.
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-300 transition-all border border-white/5 cursor-pointer"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return <AdminDashboardPage />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
