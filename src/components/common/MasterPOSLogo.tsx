import React from 'react';

export type LogoAccent = 'emerald' | 'crimson' | 'amber' | 'gold' | 'cyan' | 'monochrome' | 'current';
export type LogoVariant = 'mark' | 'badge' | 'full' | 'receipt';

export interface MasterPOSLogoProps {
  className?: string;
  size?: number;
  useColor?: boolean;
  accent?: LogoAccent;
  variant?: LogoVariant;
  showSubtitle?: boolean;
  subtitle?: string;
  tag?: string;
  themeMode?: 'dark' | 'light' | 'auto';
  idPrefix?: string;
}

/**
 * High-craft, mathematical vector mark for Master POS.
 * Scales with razor-sharp fidelity from 16px to 256px.
 */
export const MasterPOSLogo: React.FC<MasterPOSLogoProps> = ({
  className = 'w-5 h-5',
  size = 24,
  useColor = true,
  accent = 'emerald',
  variant = 'mark',
  showSubtitle = false,
  subtitle = 'Enterprise OS',
  tag = 'PRO',
  themeMode = 'auto',
  idPrefix = 'mpl',
}) => {
  const gradId = `${idPrefix}-grad-${accent}`;
  const glowId = `${idPrefix}-glow`;
  const metalId = `${idPrefix}-metal`;
  const bgGradId = `${idPrefix}-bg-grad`;

  // Colors based on selected accent
  const accentColors: Record<LogoAccent, { start: string; mid: string; end: string; glow: string; text: string }> = {
    emerald: {
      start: '#34d399',
      mid: '#10b981',
      end: '#047857',
      glow: 'rgba(16, 185, 129, 0.4)',
      text: 'text-emerald-500',
    },
    crimson: {
      start: '#fb7185',
      mid: '#f43f5e',
      end: '#be123c',
      glow: 'rgba(244, 63, 94, 0.4)',
      text: 'text-rose-500',
    },
    amber: {
      start: '#fde047',
      mid: '#f59e0b',
      end: '#b45309',
      glow: 'rgba(245, 158, 11, 0.4)',
      text: 'text-amber-500',
    },
    gold: {
      start: '#fef08a',
      mid: '#eab308',
      end: '#a16207',
      glow: 'rgba(234, 179, 8, 0.4)',
      text: 'text-yellow-500',
    },
    cyan: {
      start: '#67e8f9',
      mid: '#06b6d4',
      end: '#0e7490',
      glow: 'rgba(6, 182, 212, 0.4)',
      text: 'text-cyan-500',
    },
    monochrome: {
      start: '#f8fafc',
      mid: '#cbd5e1',
      end: '#64748b',
      glow: 'rgba(255, 255, 255, 0.2)',
      text: 'text-slate-200',
    },
    current: {
      start: 'currentColor',
      mid: 'currentColor',
      end: 'currentColor',
      glow: 'transparent',
      text: 'text-current',
    },
  };

  const palette = accentColors[accent] || accentColors.emerald;
  const strokeColor = useColor ? `url(#${gradId})` : 'currentColor';
  const fillColor = useColor ? `url(#${gradId})` : 'currentColor';

  // Standalone Logomark SVG (Geometric Crown 'M' Monogram with Dimensional Facets)
  const logomarkSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Master POS Brand Emblem"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Dynamic Accent Gradient */}
        <linearGradient id={gradId} x1="6" y1="4" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.start} />
          <stop offset="48%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.end} />
        </linearGradient>

        {/* Metallic Bevel Gradient */}
        <linearGradient id={metalId} x1="8" y1="6" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor={palette.start} stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </linearGradient>

        {/* Squircle Background Radial Gradient */}
        <radialGradient id={bgGradId} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#1e2230" />
          <stop offset="60%" stopColor="#0f1118" />
          <stop offset="100%" stopColor="#08090d" />
        </radialGradient>

        {/* Soft Luxury Glow Filter */}
        {useColor && (
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* 1. OUTER HEXAGONAL SHIELD CONTOUR - Precision Chamfered Geometry */}
      <path
        d="M22 3.8L37.8 12.9C39.2 13.7 40 15.2 40 16.8V31.2C40 32.8 39.2 34.3 37.8 35.1L22 44.2C20.7 45 19.3 45 18 44.2L2.2 35.1C0.8 34.3 0 32.8 0 31.2V16.8C0 15.2 0.8 13.7 2.2 12.9L18 3.8C19.3 3 20.7 3 22 3.8Z"
        transform="scale(0.85) translate(4, 3.5)"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={useColor ? 0.95 : 1}
      />

      {/* 2. INNER REFLECTIVE AMBIENT ACCENTS */}
      {useColor && (
        <path
          d="M22 6L35 13.5V30.5L22 38L9 30.5V13.5L22 6Z"
          transform="scale(0.85) translate(4, 3.5)"
          stroke={`url(#${metalId})`}
          strokeWidth="0.8"
          strokeOpacity="0.4"
          strokeDasharray="2 4"
        />
      )}

      {/* 3. THE ARCHITECTURAL 'M' MONOGRAM - SOLID FACETED PILLARS */}
      {/* Left Wing Pillar */}
      <path
        d="M11.5 30V15.5L16.5 12V30H11.5Z"
        fill={fillColor}
        fillOpacity={useColor ? 0.92 : 1}
      />

      {/* Right Wing Pillar */}
      <path
        d="M27.5 12L32.5 15.5V30H27.5V12Z"
        fill={fillColor}
        fillOpacity={useColor ? 0.92 : 1}
      />

      {/* Central Chevron Bridge 'V' linking into 'M' */}
      <path
        d="M16.5 15.5L22 25.5L27.5 15.5L25 13.5L22 19L19 13.5L16.5 15.5Z"
        fill={fillColor}
        fillOpacity={useColor ? 1 : 0.9}
        filter={useColor ? `url(#${glowId})` : undefined}
      />

      {/* 4. ZENITH CROWN / APEX PULSE (Upper Diamond Chevron) */}
      <polygon
        points="22,7 26.5,12 22,14.5 17.5,12"
        fill={fillColor}
      />

      {/* 5. CENTER RADIANT JEWEL CORE (High-Precision Diamond Node) */}
      <polygon
        points="22,20.5 24.5,23 22,25.5 19.5,23"
        fill={useColor ? '#ffffff' : 'currentColor'}
      />

      {/* Corner Precision Nodes */}
      {useColor && (
        <>
          <circle cx="11" cy="18" r="1.2" fill={palette.start} />
          <circle cx="33" cy="18" r="1.2" fill={palette.start} />
          <circle cx="22" cy="35" r="1.4" fill={palette.mid} />
        </>
      )}
    </svg>
  );

  // Variant 1: Pure Logomark
  if (variant === 'mark') {
    return logomarkSvg;
  }

  // Variant 2: Thermal Receipt (High contrast, optimized for thermal printers)
  if (variant === 'receipt') {
    return (
      <div className="flex flex-col items-center justify-center text-stone-950 font-sans select-none">
        <svg
          width={size || 36}
          height={size || 36}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-stone-950"
        >
          <path
            d="M22 3.8L37.8 12.9C39.2 13.7 40 15.2 40 16.8V31.2C40 32.8 39.2 34.3 37.8 35.1L22 44.2C20.7 45 19.3 45 18 44.2L2.2 35.1C0.8 34.3 0 32.8 0 31.2V16.8C0 15.2 0.8 13.7 2.2 12.9L18 3.8C19.3 3 20.7 3 22 3.8Z"
            transform="scale(0.85) translate(4, 3.5)"
            stroke="black"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M11.5 30V15.5L16.5 12V30H11.5Z" fill="black" />
          <path d="M27.5 12L32.5 15.5V30H27.5V12Z" fill="black" />
          <path d="M16.5 15.5L22 25.5L27.5 15.5L25 13.5L22 19L19 13.5L16.5 15.5Z" fill="black" />
          <polygon points="22,7 26.5,12 22,14.5 17.5,12" fill="black" />
          <polygon points="22,20.5 24.5,23 22,25.5 19.5,23" fill="white" stroke="black" strokeWidth="1" />
        </svg>
        <span className="font-black text-sm tracking-widest uppercase mt-1">MASTER POS</span>
      </div>
    );
  }

  // Variant 3: Luxury Framed Squircle Badge
  if (variant === 'badge') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl p-2 transition-all duration-300 group ${
          themeMode === 'light'
            ? 'bg-gradient-to-b from-slate-900 via-stone-900 to-slate-950 text-white shadow-md shadow-slate-900/10 border border-slate-700/40'
            : 'bg-gradient-to-b from-[#181a24] via-[#10121a] to-[#0a0b10] text-white shadow-xl shadow-black/40 border border-white/10 hover:border-white/20'
        } ${className}`}
        style={{ width: `${size + 16}px`, height: `${size + 16}px` }}
      >
        {/* Subtle Ambient Radial Backlight */}
        <div
          className="absolute inset-0 rounded-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-300 blur-sm pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 30%, ${palette.start}, transparent 70%)` }}
        />
        {/* Top Glare Line */}
        <div className="absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
        <div className="relative z-10">{logomarkSvg}</div>
      </div>
    );
  }

  // Variant 4: Full Brand Lockup (Badge + Typographic Lockup + Status Pill)
  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Brand Badge */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl p-1.5 transition-all duration-300 group shadow-md border border-white/10 bg-gradient-to-b from-[#1c1e2a] via-[#12131c] to-[#0a0b10]"
        style={{ width: `${size + 14}px`, height: `${size + 14}px` }}
      >
        {/* Ambient Backlight */}
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-35 group-hover:opacity-75 transition-opacity duration-300 blur-xs pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 30%, ${palette.start}, transparent 70%)` }}
        />
        <div className="absolute top-0 inset-x-1.5 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
        <div className="relative z-10">{logomarkSvg}</div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-sans flex items-center">
            <span className="tracking-tight">MASTER</span>
            <span className="ml-1 text-white/90">POS</span>
          </span>

          {/* Edition Tag */}
          {tag && (
            <span
              className={`text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded border leading-none shrink-0 ${
                accent === 'crimson'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {tag}
            </span>
          )}

          {/* Active Operational Pulse Indicator */}
          <span className="relative flex h-2 w-2 shrink-0 ml-0.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: palette.start }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: palette.mid }}
            />
          </span>
        </div>

        {/* Subtitle / Department */}
        {showSubtitle && (
          <p className="text-[10px] sm:text-[10.5px] text-stone-400 font-mono leading-tight mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default MasterPOSLogo;
