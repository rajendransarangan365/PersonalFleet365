import React from 'react';

interface FleetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export default function FleetLogo({
  size = 'md',
  showText = true,
  subtitle = 'Fleet Management',
  className = '',
}: FleetLogoProps) {
  const sizeMap = {
    xs: { badge: 'w-7 h-7 rounded-lg', title: 'text-xs', sub: 'text-[9px]', icon: 16 },
    sm: { badge: 'w-8 h-8 rounded-xl', title: 'text-sm', sub: 'text-[10px]', icon: 20 },
    md: { badge: 'w-10 h-10 rounded-xl', title: 'text-base', sub: 'text-[11px]', icon: 24 },
    lg: { badge: 'w-12 h-12 rounded-2xl', title: 'text-xl', sub: 'text-xs', icon: 30 },
    xl: { badge: 'w-16 h-16 rounded-3xl', title: 'text-2xl', sub: 'text-sm', icon: 40 },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Aerodynamic Badge Icon */}
      <div
        className={`${current.badge} bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950/80 border border-brand-500/40 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20 relative overflow-hidden group`}
      >
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-cyan-400/20 to-purple-500/10 pointer-events-none" />

        {/* Scaled Vector Badge */}
        <svg
          viewBox="0 0 100 100"
          className="w-4/5 h-4/5 drop-shadow-[0_2px_8px_rgba(56,189,248,0.5)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Speed Flares */}
          <path d="M10 52 L32 52 L26 58 L5 58 Z" fill="#38bdf8" opacity="0.7" />
          <path d="M16 42 L38 42 L32 47 L12 47 Z" fill="#06b6d4" opacity="0.9" />

          {/* Aerodynamic Car Profile */}
          <path
            d="M26 48 L38 27 C42 21, 49 17, 58 16 L72 16 C80 16, 86 21, 89 27 L96 40 C98 44, 96 49, 92 50 L26 50 Z"
            fill="url(#logoCyanGrad)"
          />

          {/* Windshield Glass */}
          <path
            d="M42 27 L51 19 C55 18, 59 17, 65 17 L72 17 C76 17, 79 19, 81 22 L86 32 C87 34, 86 35, 84 35 L45 35 C43 35, 41 30, 42 27 Z"
            fill="#020617"
            opacity="0.9"
          />

          {/* Golden 365 Wing Flare */}
          <path
            d="M48 68 L85 68 C88 68, 90 66, 91 63 L93 57 C93 55, 91 54, 88 54 L45 54 Z"
            fill="url(#amberGoldLogo)"
          />

          {/* Wheels */}
          <circle cx="36" cy="52" r="10" fill="#020617" stroke="#334155" strokeWidth="2" />
          <circle cx="36" cy="52" r="5" fill="#38bdf8" />

          <circle cx="78" cy="52" r="10" fill="#020617" stroke="#334155" strokeWidth="2" />
          <circle cx="78" cy="52" r="5" fill="#38bdf8" />

          <defs>
            <linearGradient id="logoCyanGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="amberGoldLogo" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Typography */}
      {showText && (
        <div className="overflow-hidden">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className={`font-black tracking-tight text-white ${current.title}`}>
              Fleet
            </span>
            <span
              className={`font-black tracking-wide bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent ${current.title}`}
            >
              365
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </div>
          {subtitle && (
            <p className={`text-slate-400 font-medium tracking-wide ${current.sub} leading-tight mt-0.5`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
