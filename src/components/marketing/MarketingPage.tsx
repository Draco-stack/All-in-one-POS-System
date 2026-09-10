import React from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { Features } from './Features';
import { Pricing } from './Pricing';
import { Footer } from './Footer';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { analytics } from '../../lib/analytics';

export const MarketingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />
      <main>
        <Hero />
        <Features />
        
        {/* Social Proof Section */}
        <section className="py-24 border-y border-white/5 bg-stone-900/20">
          <div className="max-w-7xl mx-auto px-6 overflow-hidden">
            <p className="text-center text-xs font-black text-stone-500 uppercase tracking-widest mb-12">Powering industry leaders worldwide</p>
            <div className="flex flex-wrap items-center justify-center gap-x-20 gap-y-12 opacity-30 grayscale contrast-125">
              <span className="text-3xl font-black italic tracking-tighter">GRUBHUB</span>
              <span className="text-3xl font-black tracking-tighter">DOORDASH</span>
              <span className="text-3xl font-black italic tracking-tighter">UBER<span className="not-italic">EATS</span></span>
              <span className="text-3xl font-black tracking-tighter">POSTMATES</span>
              <span className="text-3xl font-black italic tracking-tighter">DELIVEROO</span>
            </div>
          </div>
        </section>

        <Pricing />

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-500/10 blur-[120px] rounded-full -z-10" />
          <div className="max-w-5xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-stone-900 border border-amber-500/30 p-16 md:p-24 rounded-[48px] shadow-2xl relative"
            >
              <h2 className="text-5xl md:text-7xl font-black text-stone-100 leading-none tracking-tightest mb-8">
                READY TO <br />
                <span className="text-amber-500">DOMINATE?</span>
              </h2>
              <p className="text-xl text-stone-400 font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
                Join 500+ restaurants that have doubled their operating efficiency with Tillora. Start your 14-day free trial today.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                <Link 
                  to="/get-started"
                  onClick={() => analytics.trackConversion('signup')}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-10 py-6 rounded-2xl font-black text-xl transition-all transform hover:scale-[1.02] shadow-2xl shadow-amber-500/20"
                >
                  Get Started Free
                </Link>
                <Link 
                  to="/demo"
                  onClick={() => analytics.trackConversion('demo')}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-100 px-10 py-6 rounded-2xl font-black text-xl transition-all border border-white/5"
                >
                  Talk to Sales
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
