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
  const uniqueId = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${animated ? 'hover:scale-105 transition-transform duration-300' : ''} ${className}`}
    >
      <defs>
        {/* Gradientes Principales */}
        <linearGradient id={`zaza-emerald-${uniqueId}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        <linearGradient id={`zaza-cyan-glow-${uniqueId}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        <linearGradient id={`zaza-bg-squircle-${uniqueId}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="60%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>

        {/* Filtros de Resplandor Neón */}
        <filter id={`zaza-glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#10B981" floodOpacity="0.4" />
        </filter>

        <filter id={`zaza-spark-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Fondo Squircle con Relieve Glassmorphism */}
      {hasBackground && (
        <g>
          <rect 
            x="4" 
            y="4" 
            width="92" 
            height="92" 
            rx="24" 
            fill={`url(#zaza-bg-squircle-${uniqueId})`}
            filter={`url(#zaza-glow-${uniqueId})`}
          />
          {/* Borde sutil superior de cristal */}
          <rect 
            x="4" 
            y="4" 
            width="92" 
            height="92" 
            rx="24" 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.28)" 
            strokeWidth="1.5" 
          />
          {/* Reflejo Glassmorphism */}
          <path
            d="M 5 28 C 5 15.3 15.3 5 28 5 L 72 5 C 45 15 15 45 5 72 Z"
            fill="white"
            fillOpacity="0.09"
          />
        </g>
      )}

      {/* 2. Variantes de Isotipo */}
      {variant === 'cyber' && (
        /* Opción A: Cyber Z Angular con Rayo Instant Click */
        <g filter={`url(#zaza-spark-${uniqueId})`}>
          {/* Barra Superior */}
          <path
            d="M 28 28 L 72 28 L 56 46 L 68 46"
            stroke={hasBackground ? '#FFFFFF' : `url(#zaza-cyan-glow-${uniqueId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Diagonal Central - Relámpago Click */}
          <path
            d="M 68 28 L 32 72"
            stroke={hasBackground ? `url(#zaza-cyan-glow-${uniqueId})` : '#10B981'}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Barra Inferior */}
          <path
            d="M 32 54 L 44 54 L 28 72 L 72 72"
            stroke={hasBackground ? '#FFFFFF' : `url(#zaza-cyan-glow-${uniqueId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Puntos de Conexión */}
          <circle cx="70" cy="28" r="4" fill="#38BDF8" />
          <circle cx="30" cy="72" r="4" fill="#34D399" />
          <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
        </g>
      )}

      {variant === 'geometric' && (
        /* Opción B: Geométrico 3D Facetado - Prismas Entrelazados */
        <g filter={`url(#zaza-spark-${uniqueId})`}>
          {/* Barra Superior Prisma */}
          <polygon
            points="28,26 72,26 62,38 28,38"
            fill={hasBackground ? '#FFFFFF' : '#10B981'}
          />
          {/* Diagonal Central */}
          <polygon
            points="62,38 72,26 38,74 28,62"
            fill={hasBackground ? '#67E8F9' : '#06B6D4'}
          />
          {/* Barra Inferior Prisma */}
          <polygon
            points="38,62 72,62 72,74 28,74"
            fill={hasBackground ? '#FFFFFF' : '#10B981'}
          />
          {/* Núcleo de Energía */}
          <circle cx="50" cy="50" r="4.5" fill="#34D399" stroke="#FFFFFF" strokeWidth="1.5" />
        </g>
      )}

      {variant === 'pulse' && (
        /* Opción C: Gateway Pulse - Ondas de Señal WhatsApp & Click */
        <g filter={`url(#zaza-spark-${uniqueId})`}>
          {/* Arco Superior */}
          <path
            d="M 28 32 C 38 24 62 24 72 32"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Trayectoria Z */}
          <path
            d="M 70 34 L 30 66"
            stroke={hasBackground ? '#67E8F9' : '#06B6D4'}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Arco Inferior */}
          <path
            d="M 28 68 C 38 76 62 76 72 68"
            stroke={hasBackground ? '#FFFFFF' : '#10B981'}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Nodos de Ondas */}
          <circle cx="50" cy="27" r="3.5" fill="#34D399" />
          <circle cx="50" cy="73" r="3.5" fill="#38BDF8" />
          <circle cx="50" cy="50" r="5" fill="#FFFFFF" />
        </g>
      )}

      {variant === 'minimal' && (
        /* Opción D: Minimalista de Alta Precisión */
        <g filter={`url(#zaza-spark-${uniqueId})`}>
          <path
            d="M 30 30 L 70 30 L 30 70 L 70 70"
            stroke={hasBackground ? '#FFFFFF' : `url(#zaza-cyan-glow-${uniqueId})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Click Spark */}
          <circle cx="50" cy="50" r="4" fill="#34D399" />
          <circle cx="70" cy="30" r="3" fill="#38BDF8" />
          <circle cx="30" cy="70" r="3" fill="#34D399" />
        </g>
      )}
    </svg>
  );
};
