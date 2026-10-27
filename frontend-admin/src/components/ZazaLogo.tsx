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
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`inline-flex items-center justify-center relative select-none shrink-0 bg-transparent ${className}`}
    >
      <img
        src={logoPng}
        alt="Zaza Click 2.0 SuperAdmin"
        style={{ width: '100%', height: '100%' }}
        className="w-full h-full object-contain block select-none bg-transparent"
        loading="eager"
        decoding="async"
      />
    </div>
  );
};
