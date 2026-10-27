import React from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import AuthPage from './pages/Auth';
import AdminDashboardPage from './pages/AdminDashboard';
import { ZazaLogo } from './components/ZazaLogo';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col items-center justify-center space-y-4">
        <ZazaLogo size={64} />
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando Consola SuperAdmin...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthPage />;
  }

  if (user.role !== 'admin') {
    logout();
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
