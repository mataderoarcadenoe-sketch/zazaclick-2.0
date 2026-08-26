import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotificationProps {
  notification: {
    text: string;
    title?: string;
    type?: ToastType;
  } | null;
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  notification,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [notification, duration, onClose]);

  if (!notification) return null;

  const type = notification.type || 'success';

  const typeConfig = {
    success: {
      border: 'border-emerald-500/30',
      bg: 'bg-white/95 dark:bg-[#0C1420]/95',
      badgeBg: 'bg-emerald-500/15 text-emerald-500',
      icon: <CheckCircle2 size={18} className="text-emerald-500" />,
      title: notification.title || 'Operación Exitosa',
      barColor: 'bg-emerald-500',
    },
    error: {
      border: 'border-rose-500/30',
      bg: 'bg-white/95 dark:bg-[#180D14]/95',
      badgeBg: 'bg-rose-500/15 text-rose-500',
      icon: <AlertCircle size={18} className="text-rose-500" />,
      title: notification.title || 'Error en la Operación',
      barColor: 'bg-rose-500',
    },
    warning: {
      border: 'border-amber-500/30',
      bg: 'bg-white/95 dark:bg-[#18140D]/95',
      badgeBg: 'bg-amber-500/15 text-amber-500',
      icon: <AlertTriangle size={18} className="text-amber-500" />,
      title: notification.title || 'Atención',
      barColor: 'bg-amber-500',
    },
    info: {
      border: 'border-cyan-500/30',
      bg: 'bg-white/95 dark:bg-[#0D1520]/95',
      badgeBg: 'bg-cyan-500/15 text-cyan-500',
      icon: <Info size={18} className="text-cyan-500" />,
      title: notification.title || 'Información',
      barColor: 'bg-cyan-500',
    },
  };

  const config = typeConfig[type];

  return (
    <aside 
      aria-label="Notificación del sistema"
      className="fixed top-5 right-5 z-[9999] max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-200"
    >
      <div className={`relative overflow-hidden rounded-2xl border ${config.border} ${config.bg} backdrop-blur-xl shadow-2xl shadow-black/30 p-4 transition-all`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config.badgeBg}`}>
            {config.icon}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              {config.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words font-medium">
              {notification.text}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>

        {/* Barra de progreso de temporizador */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200/40 dark:bg-slate-800/40 overflow-hidden">
          <div 
            className={`h-full ${config.barColor} animate-shrink`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </aside>
  );
};
