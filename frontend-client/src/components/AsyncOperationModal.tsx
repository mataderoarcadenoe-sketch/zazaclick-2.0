import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw, X } from 'lucide-react';

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

  return (
    <div 
      aria-live="polite"
      aria-busy={!isDone}
      className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-md w-full text-left space-y-6 shadow-2xl transition-all">
        
        {/* Encabezado con Icono de Estado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold transition-all ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                : status === 'error'
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                : status === 'timeout'
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
            }`}>
              {status === 'success' ? (
                <CheckCircle2 size={24} className="animate-scaleIn" />
              ) : status === 'error' ? (
                <AlertCircle size={24} />
              ) : status === 'timeout' ? (
                <Clock size={24} />
              ) : (
                <Loader2 size={24} className="animate-spin" />
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
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Desglose de Hitos/Pasos Reales */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#1a2333] p-4 rounded-2xl">
          {steps.map((step, idx) => (
            <div key={step.id || idx} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === 'completed' ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <CheckCircle2 size={14} />
                  </div>
                ) : step.status === 'active' ? (
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                    <Loader2 size={12} className="animate-spin" />
                  </div>
                ) : step.status === 'failed' ? (
                  <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center">
                    <X size={14} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                  </div>
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
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium">
            {successMessage}
          </div>
        )}

        {(status === 'error' || status === 'timeout') && errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Botones de Acción */}
        {isDone && (
          <div className="flex items-center gap-3 pt-2">
            {status === 'error' && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Reintentar
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer min-h-[44px] ${
                status === 'success'
                  ? 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {status === 'success' ? 'Entendido' : 'Cerrar'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
