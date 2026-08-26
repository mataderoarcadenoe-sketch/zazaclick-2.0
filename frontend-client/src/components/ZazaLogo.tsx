import React from 'react';
import logoPng from '../assets/logo.png';

interface ZazaLogoProps {
  size?: number | string;
  className?: string;
  hasBackground?: boolean;
  animated?: boolean;
}

export const ZazaLogo: React.FC<ZazaLogoProps> = ({
  size = 40,
  className = '',
  hasBackground = false,
  animated = false,
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`inline-flex items-center justify-center relative select-none shrink-0 ${
        hasBackground
          ? 'p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm'
          : ''
      } ${animated ? 'hover:scale-105 transition-transform duration-200 cursor-pointer' : ''} ${className}`}
    >
      <img
        src={logoPng}
        alt="Zaza Click 2.0 Logo"
        style={{ width: '100%', height: '100%' }}
        className="object-contain block drop-shadow-sm select-none"
        loading="eager"
        decoding="async"
      />
    </div>
  );
};
