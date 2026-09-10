import React from 'react';
import { ChefHat } from 'lucide-react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', iconOnly = false }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500 blur-lg opacity-20 animate-pulse" />
        <div className="relative bg-stone-900 border border-stone-800 p-2 rounded-xl shadow-2xl">
          <ChefHat className="w-6 h-6 text-amber-500" />
        </div>
      </div>
      {!iconOnly && (
        <span className="text-2xl font-black tracking-tighter text-stone-100 italic">
          TILL<span className="text-amber-500 not-italic">ORA</span>
        </span>
      )}
    </div>
  );
};
