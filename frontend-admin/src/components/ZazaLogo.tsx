import React from 'react';

interface ZazaLogoProps {
  size?: number | string;
  className?: string;
  hasBackground?: boolean;
  animated?: boolean;
}

export const ZazaLogo: React.FC<ZazaLogoProps> = ({
  size = 48,
  className = '',
  hasBackground = true,
  animated = false,
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
        {/* Gradiente Principal del Isotipo Z */}
        <linearGradient id={`zaza-grad-primary-${uniqueId}`} x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />   {/* Emerald 400 */}
          <stop offset="45%" stopColor="#10B981" />  {/* Emerald 500 */}
          <stop offset="80%" stopColor="#06B6D4" />  {/* Cyan 500 */}
          <stop offset="100%" stopColor="#3B82F6" /> {/* Blue 500 */}
        </linearGradient>

        {/* Gradiente de Resplandor / Relámpago Central */}
        <linearGradient id={`zaza-grad-spark-${uniqueId}`} x1="30" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A7F3D0" stopOpacity="1" />
          <stop offset="50%" stopColor="#6EE7B7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="1" />
        </linearGradient>

        {/* Gradiente de Fondo del Squircle */}
        <linearGradient id={`zaza-bg-grad-${uniqueId}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />   {/* Emerald 600 */}
          <stop offset="50%" stopColor="#047857" />  {/* Emerald 700 */}
          <stop offset="100%" stopColor="#0F766E" /> {/* Teal 700 */}
        </linearGradient>

        {/* Filtro de Glow / Brillo Neón */}
        <filter id={`zaza-glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#10B981" floodOpacity="0.45" />
        </filter>

        {/* Filtro de Glow Suave */}
        <filter id={`zaza-spark-glow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Fondo Squircle con Relieve Moderno */}
      {hasBackground && (
        <g>
          {/* Sombra base */}
          <rect 
            x="4" 
            y="4" 
            width="92" 
            height="92" 
            rx="26" 
            fill={`url(#zaza-bg-grad-${uniqueId})`}
            filter={`url(#zaza-glow-${uniqueId})`}
          />
          {/* Borde sutil brillante superior */}
          <rect 
            x="4" 
            y="4" 
            width="92" 
            height="92" 
            rx="26" 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.25)" 
            strokeWidth="1.5" 
          />
          {/* Brillo glassmorphism en esquina superior */}
          <path
            d="M 6 30 C 6 16.7 16.7 6 30 6 L 70 6 C 50 16 20 36 6 70 Z"
            fill="white"
            fillOpacity="0.08"
          />
        </g>
      )}

      {/* 2. Símbolo Isotipo ZAZA "Z" + Relámpago Instant Click + Conexión Gateway */}
      <g filter={`url(#zaza-spark-glow-${uniqueId})`}>
        {/* Barra Superior del 'Z' con Terminal Angular */}
        <path
          d="M 28 29 C 28 26.8 29.8 25 32 25 L 68 25 C 70.8 25 72.4 28.2 70.6 30.4 L 56 47 L 66 47 C 69.3 47 72 49.7 72 53 C 72 56.3 69.3 59 66 59 L 58 59"
          fill="none"
          stroke={hasBackground ? '#FFFFFF' : `url(#zaza-grad-primary-${uniqueId})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Diagonal Principal Dinámica: El 'Click' Instantáneo y Puente de Mensajes */}
        <path
          d="M 69 28 L 31 72"
          stroke={hasBackground ? `url(#zaza-grad-spark-${uniqueId})` : `url(#zaza-grad-primary-${uniqueId})`}
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Barra Inferior del 'Z' */}
        <path
          d="M 42 41 L 34 41 C 30.7 41 28 43.7 28 47 C 28 50.3 30.7 53 34 53 L 44 53 L 29.4 69.6 C 27.6 71.8 29.2 75 32 75 L 68 75 C 70.2 75 72 73.2 72 71"
          fill="none"
          stroke={hasBackground ? '#FFFFFF' : `url(#zaza-grad-primary-${uniqueId})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Nodos de Conexión de Alta Velocidad (WhatsApp Gateway Signals) */}
        {/* Nodo Superior Derecho */}
        <circle 
          cx="71" 
          cy="28" 
          r="4.5" 
          fill="#38BDF8" 
          stroke={hasBackground ? '#047857' : '#FFFFFF'} 
          strokeWidth="1.5" 
        />
        {/* Nodo Inferior Izquierdo */}
        <circle 
          cx="29" 
          cy="72" 
          r="4.5" 
          fill="#34D399" 
          stroke={hasBackground ? '#047857' : '#FFFFFF'} 
          strokeWidth="1.5" 
        />

        {/* Pulso de Energía Central (El punto del 'Click') */}
        <circle 
          cx="50" 
          cy="50" 
          r="3" 
          fill="#FFFFFF" 
          filter={`url(#zaza-spark-glow-${uniqueId})`}
        />
      </g>
    </svg>
  );
};
