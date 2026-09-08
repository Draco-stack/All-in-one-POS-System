import React, { useState } from 'react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { LucideIcon } from 'lucide-react';

interface MenuItemThumbnailProps {
  image?: string;
  name: string;
  category: string;
  className?: string;
  iconClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'full';
  showCategoryBadge?: boolean;
}

export const MenuItemThumbnail: React.FC<MenuItemThumbnailProps> = ({
  image,
  name,
  category,
  className = '',
  iconClassName = '',
  size = 'md',
  showCategoryBadge = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const IconComponent: LucideIcon = getCategoryIcon(category || name);

  const sizeClasses = {
    xs: 'w-7 h-7 rounded-lg text-xs',
    sm: 'w-9 h-9 rounded-xl text-sm',
    md: 'w-11 h-11 rounded-xl text-base',
    lg: 'w-16 h-16 rounded-2xl text-xl',
    full: 'w-full h-full',
  };

  const getCategoryGradient = (cat: string) => {
    const norm = (cat || '').toLowerCase();
    if (norm.includes('pizza') || norm.includes('crust')) {
      return 'from-amber-950/80 via-red-950/60 to-stone-900 text-amber-400 border-amber-500/20';
    }
    if (norm.includes('burger') || norm.includes('fried') || norm.includes('flame')) {
      return 'from-orange-950/80 via-red-950/60 to-stone-900 text-orange-400 border-orange-500/20';
    }
    if (norm.includes('desert') || norm.includes('dessert') || norm.includes('cake') || norm.includes('sweet')) {
      return 'from-pink-950/80 via-purple-950/60 to-stone-900 text-pink-400 border-pink-500/20';
    }
    if (norm.includes('beverage') || norm.includes('drink') || norm.includes('coffee')) {
      return 'from-cyan-950/80 via-blue-950/60 to-stone-900 text-cyan-400 border-cyan-500/20';
    }
    if (norm.includes('pasta')) {
      return 'from-yellow-950/80 via-amber-950/60 to-stone-900 text-yellow-400 border-yellow-500/20';
    }
    if (norm.includes('deal') || norm.includes('fifa') || norm.includes('special')) {
      return 'from-emerald-950/80 via-teal-950/60 to-stone-900 text-emerald-400 border-emerald-500/20';
    }
    return 'from-stone-850 via-stone-900 to-stone-950 text-stone-300 border-white/10';
  };

  const gradientClass = getCategoryGradient(category);

  if (image && !imgError) {
    return (
      <div className={`relative overflow-hidden shrink-0 border border-white/10 ${sizeClasses[size]} ${className}`}>
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        {showCategoryBadge && (
          <div className="absolute bottom-1 right-1 p-1 rounded-md bg-black/60 backdrop-blur-xs border border-white/10 text-white shadow-xs">
            <IconComponent className="w-3 h-3" />
          </div>
        )}
      </div>
    );
  }

  // Pure SVG vector icon illustration fallback
  return (
    <div
      className={`relative overflow-hidden shrink-0 border bg-gradient-to-br flex items-center justify-center ${gradientClass} ${sizeClasses[size]} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />
      <IconComponent
        className={`${
          size === 'xs'
            ? 'w-3.5 h-3.5'
            : size === 'sm'
            ? 'w-4 h-4'
            : size === 'md'
            ? 'w-5 h-5'
            : size === 'lg'
            ? 'w-7 h-7'
            : 'w-10 h-10'
        } drop-shadow-sm ${iconClassName}`}
      />
    </div>
  );
};
