import React from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import AuthPage from './pages/Auth';
import DashboardPage from './pages/Dashboard';
import { Smartphone } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        {/* Glowing loader */}
        <div className="w-16 h-16 bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 rounded-3xl flex items-center justify-center shadow-xl animate-pulseGlow">
          <Smartphone className="w-8 h-8 animate-spinSlow" />
        </div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest animate-pulse">Cargando Zaza.click 2.0...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <DashboardPage />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
