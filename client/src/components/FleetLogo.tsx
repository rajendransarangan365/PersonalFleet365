import React from 'react';
import { Crown, Briefcase, Navigation, Car, Headphones, ShieldCheck } from 'lucide-react';

interface FleetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  role?: string;
  className?: string;
}

export default function FleetLogo({
  size = 'md',
  showText = true,
  subtitle,
  role,
  className = '',
}: FleetLogoProps) {
  const sizeMap = {
    xs: { badge: 'w-7 h-7 rounded-lg', iconSize: 'w-3.5 h-3.5', title: 'text-xs', sub: 'text-[9px]' },
    sm: { badge: 'w-8 h-8 rounded-xl', iconSize: 'w-4 h-4', title: 'text-sm', sub: 'text-[10px]' },
    md: { badge: 'w-10 h-10 rounded-xl', iconSize: 'w-5 h-5', title: 'text-base', sub: 'text-[11px]' },
    lg: { badge: 'w-12 h-12 rounded-2xl', iconSize: 'w-6 h-6', title: 'text-xl', sub: 'text-xs' },
    xl: { badge: 'w-16 h-16 rounded-3xl', iconSize: 'w-8 h-8', title: 'text-2xl', sub: 'text-sm' },
  };

  const current = sizeMap[size];

  // Distinct branding & visual marks per role
  const getRoleConfig = () => {
    switch (role) {
      case 'driver':
        return {
          icon: Navigation,
          gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
          titleColor: 'text-emerald-400',
          defaultSub: 'Duty Driver Console',
          glow: 'shadow-emerald-500/20',
        };
      case 'customer':
        return {
          icon: Car,
          gradient: 'from-amber-500 via-orange-500 to-yellow-400',
          titleColor: 'text-amber-400',
          defaultSub: 'Passenger Ride Portal',
          glow: 'shadow-amber-500/20',
        };
      case 'telecaller':
      case 'support':
        return {
          icon: Headphones,
          gradient: 'from-cyan-500 via-sky-500 to-blue-600',
          titleColor: 'text-cyan-400',
          defaultSub: '24x7 Helpline Support',
          glow: 'shadow-cyan-500/20',
        };
      case 'fleet_manager':
      case 'operations_manager':
        return {
          icon: Briefcase,
          gradient: 'from-purple-600 via-indigo-600 to-brand-500',
          titleColor: 'text-purple-400',
          defaultSub: 'Operations Suite',
          glow: 'shadow-purple-500/20',
        };
      case 'fleet_owner':
      case 'business_owner':
      default:
        return {
          icon: Crown,
          gradient: 'from-brand-600 via-indigo-600 to-cyan-500',
          titleColor: 'text-emerald-400',
          defaultSub: 'Enterprise Fleet OS',
          glow: 'shadow-brand-500/20',
        };
    }
  };

  const config = getRoleConfig();
  const IconComponent = config.icon;
  const displaySubtitle = subtitle ?? config.defaultSub;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Dynamic Role-Based App Icon */}
      <div
        className={`${current.badge} bg-gradient-to-tr ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-lg ${config.glow} text-white border border-white/20 relative overflow-hidden group transition-transform hover:scale-105`}
      >
        <IconComponent className={`${current.iconSize} drop-shadow-sm`} />
      </div>

      {/* Typography: Bold White "Fleet" + Tinted Role Mark */}
      {showText && (
        <div className="overflow-hidden">
          <div className="flex items-center gap-0.5 leading-tight tracking-tight">
            <span className={`font-black text-white tracking-tight ${current.title}`}>
              Fleet
            </span>
            <span
              className={`font-black ${config.titleColor} tracking-tight ${current.title}`}
            >
              365
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${config.titleColor.replace('text-', 'bg-')} animate-pulse ml-1`} />
          </div>
          {displaySubtitle && (
            <p className={`text-slate-400 font-medium tracking-wide ${current.sub} leading-tight mt-0.5 truncate`}>
              {displaySubtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
