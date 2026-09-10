import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Play, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analytics } from '../../lib/analytics';

export const Hero: React.FC = () => {
  const handleGetStarted = () => {
    analytics.trackConversion('signup');
  };

  const handleWatchDemo = () => {
    analytics.trackConversion('demo');
  };

  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px] -z-10" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 bg-stone-900/50 border border-white/5 rounded-full px-4 py-1.5 mb-8 hover:bg-stone-800/50 transition-colors cursor-pointer group">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-200">New: Version 2.0 Released</span>
            <ChevronRight className="w-3 h-3 text-stone-600 group-hover:translate-x-0.5 transition-transform" />
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black text-stone-100 leading-[0.95] tracking-tightest mb-8">
            RESTAURANTS <br />
            <span className="text-amber-500">REDEFINED.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-stone-400 leading-relaxed max-w-xl mb-12 font-medium">
            The ultimate commercial operating system for modern hospitality. Unified POS, multi-branch delivery, and real-time growth intelligence in one sleek interface.
          </p>

          <div className="flex flex-wrap gap-5">
            <Link 
              to="/get-started"
              onClick={handleGetStarted}
              className="bg-stone-100 hover:bg-white text-stone-950 px-8 py-5 rounded-2xl font-black text-lg flex items-center gap-3 transition-all transform hover:scale-[1.02] shadow-2xl shadow-stone-100/10 group"
            >
              Get Started for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/demo"
              onClick={handleWatchDemo}
              className="bg-stone-900 hover:bg-stone-800 text-stone-100 px-8 py-5 rounded-2xl font-black text-lg flex items-center gap-3 transition-all border border-white/5"
            >
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Play className="w-3 h-3 text-amber-500 fill-amber-500" />
              </div>
              Watch Demo
            </Link>
          </div>

          <div className="mt-16 flex items-center gap-10 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex flex-col gap-1">
              <div className="flex gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
              </div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter">Trusted by 500+ Kitchens</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative lg:block"
        >
          <div className="relative rounded-[32px] overflow-hidden border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] bg-stone-900 aspect-video">
            <div className="absolute inset-0 bg-gradient-to-tr from-stone-950 to-transparent opacity-60" />
            <img 
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=2000" 
              alt="Tillora POS Interface" 
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            {/* Floating UI Elements */}
            <div className="absolute top-8 left-8 bg-stone-950/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-stone-100 uppercase tracking-widest">Live: 24 Orders Prep</span>
              </div>
            </div>
            <div className="absolute bottom-8 right-8 bg-stone-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl">
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Today's Revenue</div>
              <div className="text-2xl font-black text-amber-500">$12,482.90</div>
            </div>
          </div>
          
          {/* Accent decoration */}
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-amber-500/20 blur-3xl -z-10" />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 blur-[80px] -z-10 animate-pulse" />
        </motion.div>
      </div>
    </section>
  );
};
