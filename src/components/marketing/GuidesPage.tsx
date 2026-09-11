import React from 'react';
import { motion } from 'motion/react';
import { 
  Printer, 
  ChefHat, 
  DollarSign, 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const GuidesPage: React.FC = () => {
  const guides = [
    {
      id: 'thermal-printers',
      icon: <Printer className="w-6 h-6 text-amber-500" />,
      title: 'Configuring 80mm & 58mm ESC/POS Thermal Printers',
      tag: 'Hardware Setup',
      readTime: '3 min read',
      summary: 'Learn how to connect Ethernet/LAN and USB thermal receipt printers directly to your Tillora terminal.',
      steps: [
        'Connect your thermal printer to your local LAN router via an Ethernet cable, or via USB to the terminal.',
        'Obtain the printer IP address by holding the Feed button while turning on the printer power switch.',
        'In Tillora, navigate to Settings > Hardware & Printers and enter the static IP (e.g., 192.168.1.150:9100).',
        'Click "Send Test Thermal Print" to verify raw ESC/POS cut, character encoding, and cash drawer kick pulse.'
      ]
    },
    {
      id: 'kds-routing',
      icon: <ChefHat className="w-6 h-6 text-amber-500" />,
      title: 'Setting up Kitchen Display (KDS) & Station Routing',
      tag: 'Kitchen Operations',
      readTime: '4 min read',
      summary: 'Route burgers to the grill station, cocktails to the bar, and desserts to the pastry station in real time.',
      steps: [
        'Mount any tablet or touchscreen monitor in the kitchen and open the Tillora KDS screen (F3 / Kitchen Tab).',
        'In Menu Management, assign category tags to appropriate kitchen preparation stations.',
        'When cashier punches an order, tickets appear on the KDS instantaneously with color-coded preparation timers.',
        'Line cooks tap items or the header to mark tickets as "In Prep" and "Ready for Dispatch".'
      ]
    },
    {
      id: 'z-reports',
      icon: <DollarSign className="w-6 h-6 text-amber-500" />,
      title: 'Shift Closeout & End-of-Day Z-Report Generation',
      tag: 'Financial Audits',
      readTime: '3 min read',
      summary: 'Perform error-free cash drawer reconciliations and print official financial daily closure audit slips.',
      steps: [
        'At the end of the shift, cashier navigates to the Shift Management tab.',
        'Enter the physical cash count counted from the cash drawer register.',
        'Review the automatically calculated cash difference, card settlements, discounts, and tips.',
        'Click "Close Shift & Print Z-Report" to lock the shift and generate the thermal audit slip.'
      ]
    },
    {
      id: 'multi-branch',
      icon: <Globe className="w-6 h-6 text-amber-500" />,
      title: 'Scaling to Multiple Outlets & Central Menu Sync',
      tag: 'Multi-Location',
      readTime: '5 min read',
      summary: 'Expand your business across multiple physical locations while retaining unified analytics and menu catalogs.',
      steps: [
        'In Admin Dashboard, open the Branch Manager tab and click "Add Location".',
        'Assign a local branch manager and configure branch-specific tax and currency parameters.',
        'Publish your master menu across all locations with the option to set local price overrides.',
        'Monitor consolidated real-time gross revenue and branch performance from the executive dashboard.'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Operational Best Practices</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tightest leading-tight mb-4">
            STEP-BY-STEP <span className="text-amber-500">OPERATOR GUIDES.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-3xl font-medium">
            Clear, practical guides to configure your restaurant hardware, organize kitchen stations, and run smooth daily shifts.
          </p>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          {guides.map((guide, idx) => (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 md:p-10 rounded-3xl bg-stone-900/50 border border-white/5 hover:border-white/20 transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-stone-800 rounded-xl border border-white/5">
                    {guide.icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 mr-3">
                      {guide.tag}
                    </span>
                    <span className="text-xs text-stone-500 font-semibold">{guide.readTime}</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-stone-100 mb-3 tracking-tight">
                {guide.title}
              </h2>
              <p className="text-stone-400 text-sm font-medium leading-relaxed mb-8 max-w-4xl">
                {guide.summary}
              </p>

              {/* Steps List */}
              <div className="bg-stone-950/60 rounded-2xl p-6 border border-white/5 space-y-4 mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-stone-400">Implementation Steps:</div>
                <div className="grid md:grid-cols-2 gap-4">
                  {guide.steps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-3 bg-stone-900/40 p-4 rounded-xl border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <p className="text-xs text-stone-300 font-medium leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 bg-stone-900/30 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-stone-100 mb-4">Ready to Launch Your Kitchen?</h2>
          <p className="text-stone-400 text-sm mb-8 font-medium">
            Start free in minutes or book an onboarding consultation with our restaurant tech specialists.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/get-started"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-8 py-3.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
            >
              Get Started Free
            </Link>
            <Link
              to="/contact"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold px-8 py-3.5 rounded-xl text-sm border border-white/5"
            >
              Request Onboarding Help
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
