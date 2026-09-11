import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowRight, LayoutDashboard } from 'lucide-react';
import { Logo } from '../common/Logo';
import { Link, useLocation } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import { analytics } from '../../lib/analytics';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isLoggedIn, currentUser } = useRestaurant();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Guides', href: '/guides' },
    { name: 'Docs', href: '/docs' },
    { name: 'Compare', href: '/compare' },
    { name: 'FAQ', href: '/faq' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isScrolled ? 'bg-stone-950/90 backdrop-blur-xl border-b border-white/5 py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <Logo />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.href}
              className={`text-sm font-semibold transition-colors tracking-tight ${
                isActive(link.href) 
                  ? 'text-amber-400' 
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              to="/app"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black px-5 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <LayoutDashboard className="w-4 h-4" />
              Launch POS ({currentUser?.name?.split(' ')[0] || 'Terminal'})
            </Link>
          ) : (
            <>
              <Link 
                to="/login" 
                onClick={() => analytics.track('nav_signin')}
                className="text-xs font-bold text-stone-400 hover:text-stone-100 transition-colors px-3 py-2"
              >
                Sign In
              </Link>
              <Link 
                to="/get-started" 
                onClick={() => analytics.trackConversion('signup')}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black px-5 py-2.5 rounded-full transition-all flex items-center gap-1.5 group shadow-lg shadow-amber-500/10"
              >
                Start Free Trial
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-stone-100 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-stone-950/95 backdrop-blur-2xl border-b border-white/5 p-6 md:hidden flex flex-col gap-4 shadow-2xl"
          >
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                to={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-base font-bold transition-colors py-1 ${
                  isActive(link.href) ? 'text-amber-400' : 'text-stone-300 hover:text-amber-400'
                }`}
              >
                {link.name}
              </Link>
            ))}
            
            <hr className="border-white/5 my-2" />
            
            <div className="flex flex-col gap-3">
              {isLoggedIn ? (
                <Link
                  to="/app"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="bg-amber-500 text-stone-950 text-center py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Launch POS Terminal
                </Link>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    onClick={() => {
                      analytics.track('nav_signin_mobile');
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-center text-sm font-bold text-stone-400 py-2"
                  >
                    Sign In to Terminal
                  </Link>
                  <Link 
                    to="/get-started" 
                    onClick={() => {
                      analytics.trackConversion('signup');
                      setIsMobileMenuOpen(false);
                    }}
                    className="bg-amber-500 text-stone-950 text-center py-3.5 rounded-xl font-black text-sm"
                  >
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
