import React from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import AuthPage from './pages/Auth';
import AdminDashboardPage from './pages/AdminDashboard';
import { Smartphone } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B12] flex flex-col items-center justify-center space-y-4">
        {/* Flat Minimalist Loader */}
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center animate-pulseGlow">
          <Smartphone className="w-8 h-8 animate-spinSlow" />
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">Cargando Admin Zaza.click 2.0...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
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
