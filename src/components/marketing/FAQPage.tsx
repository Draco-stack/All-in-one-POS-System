import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle, ArrowRight, ShieldCheck, Printer, Wifi, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const FAQPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'hardware' | 'offline' | 'pricing' | 'features'>('all');
  const [expandedIndices, setExpandedIndices] = useState<number[]>([0, 1]);

  const toggleAccordion = (idx: number) => {
    setExpandedIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const faqItems = [
    {
      category: 'hardware',
      q: 'Which thermal printers and cash drawers are supported?',
      a: 'Tillora supports any ESC/POS standard network (Ethernet/LAN/WiFi) or USB thermal printer, including Epson (TM-T88, TM-T20), Star Micronics (TSP100, TSP650), Xprinter, Bixolon, and Munbyn. Standard RJ11/RJ12 cash drawers connected to the printer will automatically kick open on cash settlements.'
    },
    {
      category: 'offline',
      q: 'How does the offline mode work during an internet outage?',
      a: 'The entire Tillora POS client runs locally inside the browser using IndexedDB. Menu pricing, table layouts, and customer directories are cached. When you punch orders or print receipts while offline, transactions are stored in a persistent local queue and automatically synchronize with the server once internet connectivity is restored.'
    },
    {
      category: 'features',
      q: 'Does Tillora include a Kitchen Display System (KDS)?',
      a: 'Yes! Tillora includes a built-in real-time KDS interface accessible via the Kitchen view (or keyboard shortcut F3). Orders punched on any terminal appear instantly on the kitchen display with preparation timers and sound alerts.'
    },
    {
      category: 'pricing',
      q: 'Are there any hidden transaction fees or payment lock-ins?',
      a: 'No. Tillora never charges per-order or per-transaction platform surcharges. You are free to use your own payment card terminals and retain 100% of your merchant processing agreement.'
    },
    {
      category: 'features',
      q: 'Can I manage multiple branch locations under one account?',
      a: 'Yes. Tillora is built natively for multi-branch organizations. You can distribute a master menu across all stores, configure branch-specific prices, and view consolidated revenue reports in the Admin portal.'
    },
    {
      category: 'hardware',
      q: 'Can I run Tillora on iPads, Android tablets, and Windows touchscreens?',
      a: 'Yes. Tillora is a Progressive Web App (PWA) compatible with iOS Safari (iPad), Android Chrome, Windows POS terminals, macOS, and Linux touchscreens. You can install it directly to your home screen or desktop.'
    },
    {
      category: 'pricing',
      q: 'How does the 14-day free trial work?',
      a: 'You can test all Business-tier features completely free for 14 days with zero risk. You can invite your team, connect test printers, and run actual shifts.'
    },
    {
      category: 'offline',
      q: 'Will I lose sales data if the browser tab is accidentally closed?',
      a: 'No. All completed transactions and pending order queues are saved in persistent storage (IndexedDB and encrypted localStorage). Re-opening the POS terminal immediately restores your active session.'
    }
  ];

  const filteredFaqs = activeCategory === 'all' 
    ? faqItems 
    : faqItems.filter(f => f.category === activeCategory);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Knowledge Base</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tightest leading-tight mb-4">
            FREQUENTLY ASKED <span className="text-amber-500">QUESTIONS.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-2xl mx-auto font-medium">
            Everything you need to know about Tillora's hardware compatibility, offline mode, and operational workflows.
          </p>

          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { id: 'all', label: 'All Questions' },
              { id: 'hardware', label: 'Hardware & Printers' },
              { id: 'offline', label: 'Offline Resilience' },
              { id: 'features', label: 'POS & KDS Features' },
              { id: 'pricing', label: 'Pricing & Plans' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeCategory === tab.id
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Accordion List */}
      <section className="pb-28">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          {filteredFaqs.map((faq, idx) => {
            const isExpanded = expandedIndices.includes(idx);
            return (
              <div
                key={idx}
                className="rounded-2xl bg-stone-900/40 border border-white/5 overflow-hidden transition"
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition"
                >
                  <span className="text-base font-bold text-stone-100">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-amber-500 transition-transform duration-200 shrink-0 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-6 text-sm text-stone-400 font-medium leading-relaxed border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-stone-900/30 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-stone-100 mb-4">Still have questions?</h2>
          <p className="text-stone-400 text-sm mb-8">
            Speak directly with a hospitality systems engineer who understands restaurant hardware and workflows.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/contact"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-6 py-3 rounded-xl text-xs transition"
            >
              Contact Support
            </Link>
            <Link
              to="/docs"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold px-6 py-3 rounded-xl text-xs border border-white/5"
            >
              Read Technical Docs
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
