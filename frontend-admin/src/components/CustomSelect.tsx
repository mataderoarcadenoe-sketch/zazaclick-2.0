import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar opción...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Cerrar dropdown al hacer click fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full text-left ${className}`}>
      {/* Botón Disparador */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-slate-100 dark:bg-[#141D2E] hover:bg-slate-200/80 dark:hover:bg-[#1A253A] rounded-2xl text-xs font-bold text-slate-900 dark:text-white transition-all cursor-pointer flex items-center justify-between gap-2 min-h-[44px] ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isOpen ? 'bg-slate-200 dark:bg-[#1A253A]' : ''}`}
      >
        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
          {selectedOption?.icon && (
            <span className="text-emerald-500 flex-shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase tracking-wider flex-shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`text-slate-400 dark:text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-500' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable Personalizado */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#0D131F] rounded-2xl p-1.5 z-50 animate-fadeIn max-h-60 overflow-y-auto scrollbar-hide">
          {options.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400">
              No hay opciones disponibles
            </div>
          ) : (
            <div className="space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between gap-2 text-left ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#141D2E] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      {option.icon && (
                        <span className={`flex-shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {option.icon}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="block truncate">{option.label}</span>
                        {option.sublabel && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal block truncate">
                            {option.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
