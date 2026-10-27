import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, X } from 'lucide-react';

export interface AsyncStep {
  id: string;
  label: string;
  detail?: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export type AsyncStatus = 'idle' | 'submitting' | 'processing' | 'success' | 'error' | 'timeout';

interface AsyncOperationModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  status: AsyncStatus;
  steps: AsyncStep[];
  errorMessage?: string | null;
  successMessage?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

export const AsyncOperationModal: React.FC<AsyncOperationModalProps> = ({
  open,
  title,
  subtitle,
  status,
  steps,
  errorMessage,
  successMessage,
  onClose,
  onRetry
}) => {
  if (!open) return null;

  const isDone = status === 'success' || status === 'error' || status === 'timeout';

  return createPortal(
    <div 
      aria-live="polite"
      aria-busy={!isDone}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75"
    >
      <div className="surface-elevated rounded-2xl p-6 sm:p-7 max-w-md w-full text-left space-y-5">
        
        {/* Encabezado con Icono de Estado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900'
                : status === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900'
                : status === 'timeout'
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900'
                : 'bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700'
            }`}>
              {status === 'success' ? (
                <CheckCircle2 size={20} />
              ) : status === 'error' ? (
                <AlertCircle size={20} />
              ) : (
                <Clock size={20} />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {isDone && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Desglose de Hitos/Pasos Reales */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#0D131F] border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          {steps.map((step, idx) => (
            <div key={step.id || idx} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === 'completed' ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </div>
                ) : step.status === 'active' ? (
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                    <Clock size={12} />
                  </div>
                ) : step.status === 'failed' ? (
                  <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center">
                    <X size={13} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${
                  step.status === 'completed'
                    ? 'text-slate-700 dark:text-slate-300 line-through opacity-80'
                    : step.status === 'active'
                    ? 'text-slate-900 dark:text-white font-bold'
                    : step.status === 'failed'
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {step.label}
                </p>
                {step.detail && step.status === 'active' && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mensajes de Resultado */}
        {status === 'success' && successMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium">
            {successMessage}
          </div>
        )}

        {(status === 'error' || status === 'timeout') && errorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Botones de Acción */}
        {isDone && (
          <div className="flex items-center gap-3 pt-1">
            {status === 'error' && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer min-h-[42px] flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Reintentar
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer min-h-[42px] ${
                status === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {status === 'success' ? 'Entendido' : 'Cerrar'}
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
