import React from 'react';
import {
  Layers,
  Pizza,
  Sparkles,
  Flame,
  UtensilsCrossed,
  Utensils,
  CookingPot,
  IceCream,
  Cake,
  Cookie,
  Soup,
  Coffee,
  CupSoda,
  Wine,
  GlassWater,
  PlusCircle,
  PackagePlus,
  Trophy,
  Tag,
  Package,
  LucideIcon,
} from 'lucide-react';

export const getCategoryIcon = (categoryIdOrName: string): LucideIcon => {
  const norm = (categoryIdOrName || '').toLowerCase().trim();

  if (norm === 'all' || norm === 'everything') return Layers;
  if (norm.includes('deal') || norm.includes('offer') || norm.includes('promo')) return Sparkles;
  if (norm.includes('fifa') || norm.includes('combo') || norm.includes('feast')) return Trophy;
  if (norm.includes('square') || norm.includes('pizza') || norm.includes('crust')) return Pizza;
  if (norm.includes('fried') || norm.includes('burger') || norm.includes('crispy')) return Flame;
  if (norm.includes('appetizer') || norm.includes('starter') || norm.includes('wing') || norm.includes('snack')) return CookingPot;
  if (norm.includes('pasta') || norm.includes('noodle') || norm.includes('spaghetti') || norm.includes('lasagna')) return Soup;
  if (norm.includes('desert') || norm.includes('dessert') || norm.includes('ice cream') || norm.includes('gelato')) return IceCream;
  if (norm.includes('cake') || norm.includes('fudge') || norm.includes('sweet') || norm.includes('brownie')) return Cake;
  if (norm.includes('cookie') || norm.includes('bakery')) return Cookie;
  if (norm.includes('beverage') || norm.includes('drink') || norm.includes('soda') || norm.includes('juice') || norm.includes('shake')) return CupSoda;
  if (norm.includes('coffee') || norm.includes('tea') || norm.includes('espresso') || norm.includes('latte')) return Coffee;
  if (norm.includes('extra') || norm.includes('dip') || norm.includes('sauce') || norm.includes('addon') || norm.includes('side')) return PlusCircle;
  if (norm.includes('special')) return Sparkles;

  return UtensilsCrossed;
};

export const CategoryIcon: React.FC<{
  categoryIdOrName: string;
  className?: string;
}> = ({ categoryIdOrName, className = 'w-4 h-4' }) => {
  const IconComponent = getCategoryIcon(categoryIdOrName);
  return <IconComponent className={className} />;
};
