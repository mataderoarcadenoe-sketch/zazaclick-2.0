import React from 'react';

export type LogoVariant = 'cyber' | 'pulse' | 'geometric' | 'minimal';

interface ZazaLogoProps {
  size?: number | string;
  className?: string;
  hasBackground?: boolean;
  animated?: boolean;
  variant?: LogoVariant;
}

export const ZazaLogo: React.FC<ZazaLogoProps> = ({
  size = 48,
  className = '',
  hasBackground = true,
  animated = false,
  variant = 'cyber',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${animated ? 'hover:scale-105 transition-transform duration-200' : ''} ${className}`}
    >
      {/* 1. Fondo Plano Squircle */}
      {hasBackground && (
        <rect 
          x="6" 
          y="6" 
          width="88" 
          height="88" 
          rx="22" 
          fill="#10B981"
        />
      )}

      {/* 2. Isotipo Vectorial Plano (Flat Minimal Tech) */}
      {variant === 'cyber' && (
        <g>
          {/* Z Trazo Superior */}
          <path
            d="M 28 28 L 72 28 L 56 46 L 68 46"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Diagonal Central */}
          <path
            d="M 68 28 L 32 72"
            stroke={hasBackground ? '#064E3B' : '#059669'}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Z Trazo Inferior */}
          <path
            d="M 32 54 L 44 54 L 28 72 L 72 72"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Nodos Planos */}
          <circle cx="70" cy="28" r="3.5" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
          <circle cx="30" cy="72" r="3.5" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
          <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
        </g>
      )}

      {variant === 'geometric' && (
        <g>
          {/* Barra Superior Plana */}
          <polygon
            points="28,26 72,26 62,38 28,38"
            fill={hasBackground ? '#FFFFFF' : '#10B981'}
          />
          {/* Diagonal Central Plana */}
          <polygon
            points="62,38 72,26 38,74 28,62"
            fill={hasBackground ? '#064E3B' : '#059669'}
          />
          {/* Barra Inferior Plana */}
          <polygon
            points="38,62 72,62 72,74 28,74"
            fill={hasBackground ? '#FFFFFF' : '#10B981'}
          />
          {/* Nodo Central Plano */}
          <circle cx="50" cy="50" r="4" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
        </g>
      )}

      {variant === 'pulse' && (
        <g>
          {/* Arco Superior Plano */}
          <path
            d="M 28 32 C 38 24 62 24 72 32"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Trayectoria Z */}
          <path
            d="M 70 34 L 30 66"
            stroke={hasBackground ? '#064E3B' : '#059669'}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Arco Inferior Plano */}
          <path
            d="M 28 68 C 38 76 62 76 72 68"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Nodos Planos */}
          <circle cx="50" cy="27" r="3.5" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
          <circle cx="50" cy="73" r="3.5" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
          <circle cx="50" cy="50" r="4.5" fill="#FFFFFF" />
        </g>
      )}

      {variant === 'minimal' && (
        <g>
          {/* Z Minimalista Plana */}
          <path
            d="M 30 30 L 70 30 L 30 70 L 70 70"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Puntos Planos de Vértice */}
          <circle cx="50" cy="50" r="4" fill={hasBackground ? '#A7F3D0' : '#10B981'} />
          <circle cx="70" cy="30" r="3" fill="#FFFFFF" />
          <circle cx="30" cy="70" r="3" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
};
