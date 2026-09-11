import React from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  LayoutDashboard, 
  BarChart3, 
  ShieldCheck, 
  Globe, 
  Smartphone, 
  Printer, 
  WifiOff, 
  ChefHat, 
  Layers, 
  FileSpreadsheet, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const FeaturesPage: React.FC = () => {
  const coreModules = [
    {
      icon: <LayoutDashboard className="w-8 h-8 text-amber-500" />,
      title: "Omnichannel Touch POS",
      tag: "Point of Sale",
      description: "Blazing-fast touch interface designed for high-volume rush hours. Supports dine-in table management, takeaway, and call center delivery punching with sub-50ms response times.",
      highlights: [
        "Interactive visual table floor plans & seat tracking",
        "Custom item modifiers, addons, and dietary notes",
        "Split-bill calculations across cash, card, and digital tabs",
        "Instant parked orders & tab resuming"
      ]
    },
    {
      icon: <ChefHat className="w-8 h-8 text-amber-500" />,
      title: "Kitchen Display System (KDS) & KOT",
      tag: "Kitchen Ops",
      description: "Direct real-time communication between floor staff and line cooks. Route orders automatically by preparation station (Grill, Bar, Pastry, Expediter).",
      highlights: [
        "Live ticket status (Pending, In Prep, Ready, Dispatched)",
        "Color-coded urgency timers for delayed tickets",
        "Acoustic chime notifications on new incoming tickets",
        "Automated digital and physical KOT printing"
      ]
    },
    {
      icon: <WifiOff className="w-8 h-8 text-amber-500" />,
      title: "Autonomous Offline Engine",
      tag: "Zero Downtime",
      description: "Never lose a sale during internet outages. Tillora operates 100% autonomously in your browser using IndexedDB local storage, syncing transparently once connection restores.",
      highlights: [
        "Complete local caching of catalog, prices, and tax rules",
        "Zero-drop offline order queue with background replay",
        "Instant conflict resolution and sequence protection",
        "Visual offline status badge and sync progress indicator"
      ]
    },
    {
      icon: <Globe className="w-8 h-8 text-amber-500" />,
      title: "Multi-Branch & Central Control",
      tag: "Enterprise Scale",
      description: "Manage a single food truck or a nationwide franchise chain from one unified cloud cockpit. Centralize menus while allowing branch-level customizations.",
      highlights: [
        "Global menu catalog with branch-specific pricing overrides",
        "Centralized staff permissions and managerial PIN overrides",
        "Consolidated multi-location sales & revenue dashboards",
        "Granular role-based access control (Owner, Manager, Cashier, Rider)"
      ]
    },
    {
      icon: <Printer className="w-8 h-8 text-amber-500" />,
      title: "Hardware Bridge & ESC/POS Printing",
      tag: "Hardware Freedom",
      description: "Zero proprietary hardware lock-in. Connect directly to standard 80mm/58mm thermal receipt printers, network ESC/POS devices, cash drawers, and barcode scanners.",
      highlights: [
        "Direct IP/Network and USB thermal printer support",
        "Customizable thermal receipt layouts with logo and tax details",
        "Automated cash drawer pulse on cash settlements",
        "Customer-facing display and driver delivery slip generation"
      ]
    },
    {
      icon: <Smartphone className="w-8 h-8 text-amber-500" />,
      title: "In-House Delivery & Driver Fleet",
      tag: "Logistics",
      description: "Eliminate hefty third-party delivery commissions. Dispatch orders to your in-house rider fleet with live status tracking and driver delivery run-sheets.",
      highlights: [
        "Dispatcher overview with live driver availability",
        "Customer address lookup with past order history recall",
        "Driver assignment and delivery milestone tracking",
        "Printed driver slips with GPS coordinates and contact notes"
      ]
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-amber-500" />,
      title: "Growth Intelligence & Financial Audits",
      tag: "Analytics",
      description: "Gain deep visibility into your margins, top-selling items, hourly peak rushes, staff performance, and cash drawer reconciliations.",
      highlights: [
        "Daily shift closeouts with automated X-Report & Z-Report generation",
        "Category contribution breakdown and profit margin tracking",
        "Customer lifetime value & loyalty purchase frequency",
        "Instant CSV, Excel, and thermal audit report exports"
      ]
    },
    {
      icon: <Layers className="w-8 h-8 text-amber-500" />,
      title: "Smart Inventory & Stock Control",
      tag: "Stock Management",
      description: "Prevent 86'd menu items during dinner rush. Track ingredient consumption in real time with automated reorder alerts.",
      highlights: [
        "Automatic stock decrement on punched menu items",
        "Low-stock alerts with configurable safety thresholds",
        "Wastage and shrinkage recording with manager authorization",
        "Supplier purchase orders and receiving logs"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Commercial Architecture</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tightest leading-tight mb-6">
            ENGINEERED FOR <br />
            <span className="text-amber-500">HIGH-VOLUME HOSPITALITY.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-400 font-medium max-w-3xl mx-auto leading-relaxed">
            Every feature in Tillora is battle-tested in fast-paced commercial kitchens. From offline fault-tolerance to instant ESC/POS thermal printing, discover why operators trust Tillora.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {coreModules.map((module, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (idx % 2) * 0.1 }}
                className="p-8 md:p-10 rounded-3xl bg-stone-900/50 border border-white/5 hover:border-amber-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 bg-stone-800 rounded-2xl border border-white/5">
                      {module.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                      {module.tag}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-stone-100 mb-3 tracking-tight">
                    {module.title}
                  </h3>
                  <p className="text-stone-400 font-medium text-sm leading-relaxed mb-8">
                    {module.description}
                  </p>

                  <div className="space-y-3 pt-6 border-t border-white/5">
                    {module.highlights.map((highlight, hIdx) => (
                      <div key={hIdx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-stone-300 leading-snug">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Banner */}
      <section className="py-20 bg-stone-900/40 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-stone-100 mb-6 tracking-tightest">
            Experience the Tillora Difference
          </h2>
          <p className="text-stone-400 text-lg mb-8 max-w-2xl mx-auto font-medium">
            Setup takes less than 3 minutes. Test our full feature suite risk-free.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/get-started"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-8 py-4 rounded-xl text-base flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold px-8 py-4 rounded-xl text-base transition-all border border-white/5"
            >
              View Plans & Pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
