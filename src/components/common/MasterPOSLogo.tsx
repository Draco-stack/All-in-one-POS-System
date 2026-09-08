import React from 'react';

interface MasterPOSLogoProps {
  className?: string;
  size?: number;
  useColor?: boolean;
}

export const MasterPOSLogo: React.FC<MasterPOSLogoProps> = ({
  className = 'w-5 h-5',
  size = 20,
  useColor = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Master POS Logomark"
    >
      <defs>
        <linearGradient id="mp-emerald-grad" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Outer Hexagonal Precision Shield Badge */}
      <path
        d="M16 3.2L27.2 9.5V22.5L16 28.8L4.8 22.5V9.5L16 3.2Z"
        stroke={useColor ? 'url(#mp-emerald-grad)' : 'currentColor'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Stylized 'M' Architecture for Master */}
      <path
        d="M9.2 21.5V11.2L16 17L22.8 11.2V21.5"
        stroke={useColor ? 'url(#mp-emerald-grad)' : 'currentColor'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* POS Zenith Crown Chevron / Register Pulse */}
      <path
        d="M12.5 7.8L16 4.8L19.5 7.8"
        stroke={useColor ? 'url(#mp-emerald-grad)' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* High-Precision Core Center Node */}
      <polygon
        points="16,11.6 18.4,14 16,16.4 13.6,14"
        fill={useColor ? '#34d399' : 'currentColor'}
      />
    </svg>
  );
};

