import React from 'react';
import { motion } from 'motion/react';
import { Shield, Cpu, Zap, HeartHandshake, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AboutPage: React.FC = () => {
  const values = [
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: 'Zero Rush-Hour Downtime',
      desc: 'Restaurants cannot afford a frozen screen during a 100-cover dinner rush. We build software that responds in under 50 milliseconds and never drops orders during network blips.'
    },
    {
      icon: <Cpu className="w-6 h-6 text-amber-500" />,
      title: 'Open Hardware Architecture',
      desc: 'We reject vendor hardware lock-in. Tillora works on standard tablets, POS terminals, and commodity ESC/POS thermal printers so restaurant owners remain in control.'
    },
    {
      icon: <Shield className="w-6 h-6 text-amber-500" />,
      title: 'Transparent Multi-Tenant Security',
      desc: 'Every organization is strictly isolated with role-based access control, cryptographic JWT tokens, and encrypted audit trails for shift cash reconciliations.'
    },
    {
      icon: <HeartHandshake className="w-6 h-6 text-amber-500" />,
      title: 'Built by Hospitality Technologists',
      desc: 'We design every workflow from the perspective of real line cooks, floor managers, and cashiers who need speed, clarity, and zero cognitive overhead.'
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Our Mission</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tightest leading-tight mb-6">
            RETHINKING RESTAURANT <br />
            <span className="text-amber-500">OPERATING SYSTEMS.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-400 font-medium max-w-3xl mx-auto leading-relaxed">
            Tillora was built on a simple premise: restaurant software should be as fast as a kitchen knife, utterly resilient to internet outages, and free of proprietary hardware monopolies.
          </p>
        </div>
      </section>

      {/* Core Principles */}
      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((val, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 md:p-10 rounded-3xl bg-stone-900/40 border border-white/5 hover:border-amber-500/30 transition-all"
              >
                <div className="p-3.5 bg-stone-800/80 rounded-2xl w-fit border border-white/5 mb-6">
                  {val.icon}
                </div>
                <h3 className="text-2xl font-black text-stone-100 mb-3 tracking-tight">
                  {val.title}
                </h3>
                <p className="text-stone-400 text-sm font-medium leading-relaxed">
                  {val.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="py-20 bg-stone-900/30 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-100 mb-6 tracking-tightest">
            Web-Native & Offline-First Engineering
          </h2>
          <p className="text-stone-400 text-sm leading-relaxed max-w-2xl mx-auto mb-10 font-medium">
            Combining the rapid iteration speed of web technologies with local SQLite and IndexedDB edge performance, Tillora provides the responsiveness of native desktop POS software with cloud fleet management.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/get-started"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-8 py-3.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/10 flex items-center gap-2"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/features"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold px-8 py-3.5 rounded-xl text-sm border border-white/5"
            >
              Explore Capabilities
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
