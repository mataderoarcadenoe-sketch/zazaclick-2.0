import React from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import AuthPage from './pages/Auth';
import DashboardPage from './pages/Dashboard';
import { ZazaLogo } from './components/ZazaLogo';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <ZazaLogo size={64} animated />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">Cargando Zaza.click 2.0...</p>
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
