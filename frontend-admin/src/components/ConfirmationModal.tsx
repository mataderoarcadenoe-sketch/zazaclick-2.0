import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, ShieldAlert, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export type ConfirmationType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  warningNote?: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  message,
  warningNote,
  type = 'danger',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const typeConfig = {
    danger: {
      badgeBg: 'surface-accent-rose text-rose-600 dark:text-rose-400',
      icon: <Trash2 size={20} />,
      btnBg: 'bg-rose-600 hover:bg-rose-500 text-white',
      warningBg: 'surface-accent-rose text-rose-700 dark:text-rose-300',
    },
    warning: {
      badgeBg: 'surface-accent-amber text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle size={20} />,
      btnBg: 'bg-amber-600 hover:bg-amber-500 text-white',
      warningBg: 'surface-accent-amber text-amber-800 dark:text-amber-200',
    },
    info: {
      badgeBg: 'surface-accent-indigo text-indigo-600 dark:text-indigo-400',
      icon: <Info size={20} />,
      btnBg: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      warningBg: 'surface-accent-indigo text-indigo-800 dark:text-indigo-200',
    },
    success: {
      badgeBg: 'surface-accent-emerald text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 size={20} />,
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      warningBg: 'surface-accent-emerald text-emerald-800 dark:text-emerald-200',
    },
  };

  const currentConfig = typeConfig[type];

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="surface-elevated rounded-2xl p-6 max-w-md w-full text-left">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${currentConfig.badgeBg}`}>
            {currentConfig.icon}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </div>

          {warningNote && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2.5 ${currentConfig.warningBg}`}>
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span>{warningNote}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold surface-interactive text-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${currentConfig.btnBg}`}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
