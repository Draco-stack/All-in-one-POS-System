import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '../common/Logo';
import { Link } from 'react-router-dom';
import { analytics } from '../../lib/analytics';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Solutions', href: '#solutions' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Guides', href: '#guides' },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isScrolled ? 'bg-stone-950/80 backdrop-blur-xl border-b border-white/5 py-3' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <Logo />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              className="text-sm font-semibold text-stone-400 hover:text-stone-100 transition-colors tracking-tight"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link 
            to="/login" 
            onClick={() => analytics.track('nav_signin')}
            className="text-sm font-bold text-stone-400 hover:text-stone-100 transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link 
            to="/get-started" 
            onClick={() => analytics.trackConversion('signup')}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-black px-6 py-2.5 rounded-full transition-all flex items-center gap-2 group shadow-lg shadow-amber-500/10"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-stone-100 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-stone-950 border-b border-white/5 p-6 md:hidden flex flex-col gap-6"
          >
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-bold text-stone-300 hover:text-amber-500 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <hr className="border-white/5" />
            <div className="flex flex-col gap-4">
              <Link 
                to="/login" 
                onClick={() => {
                  analytics.track('nav_signin_mobile');
                  setIsMobileMenuOpen(false);
                }}
                className="text-center text-lg font-bold text-stone-400 py-2"
              >
                Sign In
              </Link>
              <Link 
                to="/get-started" 
                onClick={() => {
                  analytics.trackConversion('signup');
                  setIsMobileMenuOpen(false);
                }}
                className="bg-amber-500 text-stone-950 text-center py-4 rounded-2xl font-black text-lg"
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
