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
      badgeBg: 'surface-accent-emerald text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 size={17} />,
      title: notification.title || 'Operación Exitosa',
    },
    error: {
      badgeBg: 'surface-accent-rose text-rose-600 dark:text-rose-400',
      icon: <AlertCircle size={17} />,
      title: notification.title || 'Error en la Operación',
    },
    warning: {
      badgeBg: 'surface-accent-amber text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle size={17} />,
      title: notification.title || 'Atención',
    },
    info: {
      badgeBg: 'surface-accent-indigo text-indigo-600 dark:text-indigo-400',
      icon: <Info size={17} />,
      title: notification.title || 'Información',
    },
  };

  const config = typeConfig[type];

  return (
    <aside 
      aria-label="Notificación del sistema"
      className="fixed top-5 right-5 z-[9999] max-w-sm w-full"
    >
      <div className="surface-elevated rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.badgeBg}`}>
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
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};
