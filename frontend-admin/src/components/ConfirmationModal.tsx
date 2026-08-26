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
  // Manejo de tecla Escape
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
      badgeBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
      icon: <Trash2 size={22} className="text-rose-500" />,
      btnBg: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-600/25 border border-rose-500/30',
      warningBg: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    },
    warning: {
      badgeBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      icon: <AlertTriangle size={22} className="text-amber-500" />,
      btnBg: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-600/25 border border-amber-500/30',
      warningBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    },
    info: {
      badgeBg: 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]',
      icon: <Info size={22} className="text-cyan-500" />,
      btnBg: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/25 border border-cyan-500/30',
      warningBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
    },
    success: {
      badgeBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      icon: <CheckCircle2 size={22} className="text-emerald-500" />,
      btnBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-500/30',
      warningBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
  };

  const currentConfig = typeConfig[type];

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div 
        className="relative bg-white dark:bg-[#0E1524] border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 sm:p-7 max-w-md w-full text-left shadow-2xl shadow-black/40 dark:shadow-black/70 overflow-hidden transition-all transform scale-100"
      >
        {/* Glow de fondo */}
        <div className={`absolute -top-14 -right-14 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none ${
          type === 'danger' ? 'bg-rose-500' : type === 'warning' ? 'bg-amber-500' : type === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'
        }`} />

        {/* Encabezado con Icono y Botón Cerrar */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${currentConfig.badgeBg}`}>
            {currentConfig.icon}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="space-y-2 mb-5">
          <h3 
            id="confirm-modal-title" 
            className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug"
          >
            {title}
          </h3>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {message}
          </div>

          {/* Nota de advertencia opcional */}
          {warningNote && (
            <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${currentConfig.warningBg}`}>
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span>{warningNote}</span>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2 ${currentConfig.btnBg}`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
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
