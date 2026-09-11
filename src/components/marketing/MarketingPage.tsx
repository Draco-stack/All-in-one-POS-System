import React from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { Features } from './Features';
import { Pricing } from './Pricing';
import { Footer } from './Footer';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { analytics } from '../../lib/analytics';
import { ShieldCheck, WifiOff, Printer, ChefHat, Globe, Smartphone, ArrowRight } from 'lucide-react';

export const MarketingPage: React.FC = () => {
  const pillars = [
    {
      icon: <WifiOff className="w-5 h-5 text-amber-500" />,
      title: "100% Offline Resilience",
      desc: "Local IndexedDB caching guarantees uninterrupted order punching and receipt printing during network drops."
    },
    {
      icon: <Printer className="w-5 h-5 text-amber-500" />,
      title: "Zero Hardware Lock-In",
      desc: "Connect directly to any standard 80mm/58mm ESC/POS network thermal printer, cash drawer, and barcode scanner."
    },
    {
      icon: <ChefHat className="w-5 h-5 text-amber-500" />,
      title: "Integrated Kitchen KDS",
      desc: "Real-time kitchen order tickets with color-coded preparation timers and acoustic station alerts."
    },
    {
      icon: <Globe className="w-5 h-5 text-amber-500" />,
      title: "Multi-Location Cockpit",
      desc: "Centrally manage menus, prices, and staff permissions across all branches from a single unified account."
    }
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />
      <main>
        <Hero />

        {/* Real Architectural Trust Pillars */}
        <section className="py-20 border-y border-white/5 bg-stone-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20">
                Hospitality Architecture
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-stone-100 mt-4 tracking-tight">
                Engineered for Rush-Hour Restaurant Reliability
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((p, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-stone-950/60 border border-white/5 hover:border-amber-500/30 transition-all">
                  <div className="p-3 bg-stone-900 rounded-xl w-fit border border-white/5 mb-4">
                    {p.icon}
                  </div>
                  <h3 className="text-base font-bold text-stone-100 mb-2">{p.title}</h3>
                  <p className="text-xs text-stone-400 font-medium leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Features />
        <Pricing />

        {/* CTA / Guides Section */}
        <section className="py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-500/10 blur-[120px] rounded-full -z-10" />
          <div className="max-w-5xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-stone-900 border border-amber-500/30 p-12 md:p-20 rounded-[40px] shadow-2xl relative"
            >
              <h2 className="text-4xl md:text-6xl font-black text-stone-100 leading-none tracking-tightest mb-6">
                ELEVATE YOUR <br />
                <span className="text-amber-500">RESTAURANT OPS.</span>
              </h2>
              <p className="text-base md:text-lg text-stone-400 font-medium max-w-xl mx-auto mb-10 leading-relaxed">
                Experience the speed of a modern, offline-resilient commercial POS. Start your 14-day free trial today.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link 
                  to="/get-started"
                  onClick={() => analytics.trackConversion('signup')}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-8 py-4 rounded-xl font-black text-base transition-all transform hover:scale-[1.02] shadow-xl shadow-amber-500/20 flex items-center gap-2"
                >
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link 
                  to="/contact"
                  className="bg-stone-800 hover:bg-stone-700 text-stone-100 px-8 py-4 rounded-xl font-bold text-base transition-all border border-white/5"
                >
                  Book Live Demo
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};
