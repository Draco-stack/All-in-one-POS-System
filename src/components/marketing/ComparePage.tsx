import React from 'react';
import { motion } from 'motion/react';
import { Check, X, Shield, ArrowRight, Zap, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const ComparePage: React.FC = () => {
  const comparisonData = [
    {
      feature: 'True Autonomous Offline Mode',
      tillora: { val: '✓ Full Local IndexedDB Cache & Sync', highlight: true },
      toast: { val: 'Limited (Requires Cloud)', highlight: false },
      square: { val: 'Basic Offline (24h limit)', highlight: false },
      legacy: { val: 'Local-only (No Cloud Sync)', highlight: false },
    },
    {
      feature: 'Hardware Compatibility',
      tillora: { val: '✓ Zero Lock-in (Any ESC/POS, iPad, PC, Android)', highlight: true },
      toast: { val: 'Proprietary Toast Hardware Only', highlight: false },
      square: { val: 'Proprietary Square Terminals', highlight: false },
      legacy: { val: 'Heavyweight Proprietary Terminals', highlight: false },
    },
    {
      feature: 'Payment Processing Freedom',
      tillora: { val: '✓ 0% Platform Surcharge (Keep Your Gateway)', highlight: true },
      toast: { val: 'Forced Toast Processing', highlight: false },
      square: { val: 'Forced Square Processing', highlight: false },
      legacy: { val: 'Expensive Legacy Merchant Fees', highlight: false },
    },
    {
      feature: 'Kitchen Display System (KDS)',
      tillora: { val: '✓ Included in Standard Plan', highlight: true },
      toast: { val: 'Paid Add-on ($25-$50/screen/mo)', highlight: false },
      square: { val: 'Paid Add-on ($20/screen/mo)', highlight: false },
      legacy: { val: 'High Hardware Cost / Legacy KDS', highlight: false },
    },
    {
      feature: 'In-House Delivery Dispatch Fleet',
      tillora: { val: '✓ Built-in (0% Delivery Commission)', highlight: true },
      toast: { val: 'Requires 3rd party integration', highlight: false },
      square: { val: 'Basic Dispatch', highlight: false },
      legacy: { val: 'Manual / Disconnected', highlight: false },
    },
    {
      feature: 'Multi-Branch in Base Tier',
      tillora: { val: '✓ Included (Up to 10 Branches)', highlight: true },
      toast: { val: 'Requires Enterprise Upgrade', highlight: false },
      square: { val: 'Requires Plus / Premium per location', highlight: false },
      legacy: { val: 'Separate Server License Per Store', highlight: false },
    },
    {
      feature: 'Touch UI Response Latency',
      tillora: { val: '✓ Sub-50ms Local Response Time', highlight: true },
      toast: { val: '150-300ms (Cloud round-trips)', highlight: false },
      square: { val: '100-200ms', highlight: false },
      legacy: { val: 'Slow / Clunky UI', highlight: false },
    },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Commercial Benchmark</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tightest leading-tight mb-6">
            WHY RESTAURANTS <br />
            <span className="text-amber-500">SWITCH TO TILLORA.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-400 font-medium max-w-3xl mx-auto leading-relaxed">
            See how Tillora compares against legacy on-premise systems and modern locked-in POS vendors. Zero hardware lock-in, zero payment penalties, and true offline reliability.
          </p>
        </div>
      </section>

      {/* Comparison Matrix Table */}
      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="rounded-3xl bg-stone-900/40 border border-white/5 overflow-hidden p-6 md:p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-black uppercase tracking-wider">
                    <th className="py-5 px-6 text-stone-400">Capability / Metric</th>
                    <th className="py-5 px-6 text-amber-400 bg-amber-500/10 rounded-t-2xl">Tillora POS</th>
                    <th className="py-5 px-6 text-stone-400">Toast POS</th>
                    <th className="py-5 px-6 text-stone-400">Square for Rest.</th>
                    <th className="py-5 px-6 text-stone-400">Legacy Systems</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {comparisonData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-5 px-6 font-bold text-stone-200 max-w-xs">{row.feature}</td>
                      <td className="py-5 px-6 bg-amber-500/5 font-black text-amber-400 border-x border-amber-500/10">
                        {row.tillora.val}
                      </td>
                      <td className="py-5 px-6 text-stone-400 font-medium">{row.toast.val}</td>
                      <td className="py-5 px-6 text-stone-400 font-medium">{row.square.val}</td>
                      <td className="py-5 px-6 text-stone-500 font-medium">{row.legacy.val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Switch CTA Banner */}
      <section className="py-20 bg-stone-900/30 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-100 mb-4 tracking-tightest">
            Ready to Cut Hardware Lock-In & Unnecessary Fees?
          </h2>
          <p className="text-stone-400 text-sm mb-8 max-w-xl mx-auto font-medium">
            Migrate your menu and customer records in under 24 hours with our automated onboarding tools.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/get-started"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-8 py-3.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/10 flex items-center gap-2"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold px-8 py-3.5 rounded-xl text-sm border border-white/5"
            >
              Explore Pricing Plans
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
