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
  subtitle = 'Commercial Fleet OS',
  className = '',
}: FleetLogoProps) {
  const sizeMap = {
    xs: { badge: 'w-7 h-7 rounded-lg', title: 'text-xs', sub: 'text-[9px]' },
    sm: { badge: 'w-8 h-8 rounded-xl', title: 'text-sm', sub: 'text-[10px]' },
    md: { badge: 'w-10 h-10 rounded-xl', title: 'text-base', sub: 'text-[11px]' },
    lg: { badge: 'w-12 h-12 rounded-2xl', title: 'text-xl', sub: 'text-xs' },
    xl: { badge: 'w-16 h-16 rounded-3xl', title: 'text-2xl', sub: 'text-sm' },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Modern Fleet365 Squircle App Icon */}
      <div
        className={`${current.badge} bg-slate-950 border border-slate-700/60 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/10 relative overflow-hidden group`}
      >
        <img
          src="/logo.png"
          alt="Fleet365 Logo"
          className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
        />
      </div>

      {/* Typography: Bold White "Fleet" + Mint Green "365" matching the brand mark */}
      {showText && (
        <div className="overflow-hidden">
          <div className="flex items-center gap-0.5 leading-tight tracking-tight">
            <span className={`font-black text-white tracking-tight ${current.title}`}>
              Fleet
            </span>
            <span
              className={`font-black text-emerald-400 tracking-tight ${current.title}`}
            >
              365
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
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
