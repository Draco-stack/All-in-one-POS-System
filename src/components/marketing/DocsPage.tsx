import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Terminal, 
  Cpu, 
  WifiOff, 
  Printer, 
  Key, 
  Database, 
  ShieldCheck, 
  Code,
  Check,
  Copy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const DocsPage: React.FC = () => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const keyboardShortcuts = [
    { key: 'F1', action: 'Switch to Main POS Touch Workstation' },
    { key: 'F2', action: 'Switch to In-House Delivery Dispatcher' },
    { key: 'F3', action: 'Switch to Kitchen Display System (KDS)' },
    { key: 'F4', action: 'Switch to Search & All Order History' },
    { key: 'F5 / Space', action: 'Trigger Instant Quick-Pay Settlement' },
    { key: 'Escape', action: 'Cancel / Close Current Active Modal' },
    { key: 'Ctrl + P', action: 'Reprint Last Order Thermal Slip' },
  ];

  const apiEndpoints = [
    {
      method: 'POST',
      path: '/api/auth/register',
      desc: 'Provision tenant organization, primary branch, owner profile, and plan subscription in a single atomic transaction.',
      auth: 'Public'
    },
    {
      method: 'POST',
      path: '/api/auth/login',
      desc: 'Authenticate user by username or email with password/PIN and issue tenant-scoped JWT.',
      auth: 'Public'
    },
    {
      method: 'GET',
      path: '/api/orders',
      desc: 'Retrieve paginated orders for the authenticated organization and active branch.',
      auth: 'Bearer JWT'
    },
    {
      method: 'POST',
      path: '/api/orders',
      desc: 'Create and punch an order into the kitchen display and local print queue.',
      auth: 'Bearer JWT'
    },
    {
      method: 'POST',
      path: '/api/customers/block',
      desc: 'Place a customer with excessive fake orders or delivery refusals on the manager blocklist.',
      auth: 'Manager Role'
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Developer & Operator Manual</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tightest leading-tight mb-4">
            DOCUMENTATION & <span className="text-amber-500">API GUIDE.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-3xl font-medium">
            Explore Tillora's offline-first architecture, workstation terminal shortcuts, hardware bridge protocols, and REST API interfaces.
          </p>
        </div>
      </section>

      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-10">
          
          {/* Main Docs Content */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* System Architecture */}
            <div className="p-8 rounded-3xl bg-stone-900/50 border border-white/5">
              <h2 className="text-2xl font-black text-stone-100 mb-4 flex items-center gap-3">
                <Cpu className="w-6 h-6 text-amber-500" />
                System Architecture
              </h2>
              <p className="text-stone-400 text-sm leading-relaxed mb-6 font-medium">
                Tillora operates on a <strong>Hybrid Edge-Cloud Architecture</strong>. The client-side application runs as a Progressive Web App (PWA) with complete offline autonomy backed by IndexedDB and localStorage caches.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-stone-950/60 border border-white/5">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-500 mb-2">Frontend Client Layer</div>
                  <ul className="text-xs text-stone-300 space-y-1.5 font-mono">
                    <li>• React 18 + TypeScript</li>
                    <li>• IndexedDB Local Store (posDB)</li>
                    <li>• Web Audio Acoustic Alerts</li>
                    <li>• ESC/POS Raw Thermal Renderer</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-stone-950/60 border border-white/5">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-500 mb-2">Backend Server Layer</div>
                  <ul className="text-xs text-stone-300 space-y-1.5 font-mono">
                    <li>• Node.js & Express REST API</li>
                    <li>• Multi-Tenant Prisma ORM</li>
                    <li>• Strict JWT Session Validation</li>
                    <li>• Webhook Idempotency Engine</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Offline Resilience */}
            <div className="p-8 rounded-3xl bg-stone-900/50 border border-white/5">
              <h2 className="text-2xl font-black text-stone-100 mb-4 flex items-center gap-3">
                <WifiOff className="w-6 h-6 text-amber-500" />
                Offline Fault Tolerance
              </h2>
              <p className="text-stone-400 text-sm leading-relaxed mb-4 font-medium">
                When internet connectivity is interrupted, Tillora seamlessly switches to local store mode:
              </p>
              <ol className="list-decimal list-inside text-xs text-stone-300 space-y-2 font-medium bg-stone-950/60 p-5 rounded-2xl border border-white/5">
                <li>Orders punched while offline are validated against local menu prices and assigned local sequential ticket IDs.</li>
                <li>Receipts and KOT orders print immediately over the local network / USB interface without waiting for cloud round-trips.</li>
                <li>Queued orders are preserved persistently inside IndexedDB.</li>
                <li>Upon network restoration, the background sync worker drains the offline queue in FIFO order.</li>
              </ol>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="p-8 rounded-3xl bg-stone-900/50 border border-white/5">
              <h2 className="text-2xl font-black text-stone-100 mb-4 flex items-center gap-3">
                <Terminal className="w-6 h-6 text-amber-500" />
                POS Workstation Keyboard Shortcuts
              </h2>
              <p className="text-stone-400 text-sm leading-relaxed mb-6 font-medium">
                Cashiers can navigate the entire workstation without taking their hands off the keyboard:
              </p>

              <div className="space-y-2.5">
                {keyboardShortcuts.map((sc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-stone-950/60 border border-white/5">
                    <span className="text-xs text-stone-300 font-medium">{sc.action}</span>
                    <kbd className="px-2.5 py-1 bg-stone-800 text-amber-400 text-xs font-mono font-bold rounded-lg border border-white/10 shadow-inner">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* REST API Endpoints */}
            <div className="p-8 rounded-3xl bg-stone-900/50 border border-white/5">
              <h2 className="text-2xl font-black text-stone-100 mb-4 flex items-center gap-3">
                <Code className="w-6 h-6 text-amber-500" />
                Core REST API Reference
              </h2>
              <div className="space-y-4">
                {apiEndpoints.map((ep, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-stone-950/60 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase font-mono ${
                        ep.method === 'GET' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {ep.method}
                      </span>
                      <code className="text-xs font-mono font-bold text-stone-100">{ep.path}</code>
                      <span className="ml-auto text-[10px] font-mono text-stone-500 bg-stone-900 px-2 py-0.5 rounded border border-white/5">
                        {ep.auth}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed">{ep.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Links & Setup Guide */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-stone-900/40 border border-white/5">
              <h3 className="text-lg font-black text-stone-100 mb-4">Quick Navigation</h3>
              <div className="space-y-2 text-xs">
                <a href="#architecture" className="block p-2 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800/40 transition">
                  • System Architecture
                </a>
                <a href="#offline" className="block p-2 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800/40 transition">
                  • Offline Fault Tolerance
                </a>
                <a href="#shortcuts" className="block p-2 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800/40 transition">
                  • Keyboard Shortcuts
                </a>
                <a href="#api" className="block p-2 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800/40 transition">
                  • REST API Reference
                </a>
                <Link to="/guides" className="block p-2 rounded-lg text-amber-500 font-bold hover:underline transition">
                  &rarr; Hardware & Setup Guides
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20">
              <h3 className="text-base font-black text-amber-400 mb-2">Need API Assistance?</h3>
              <p className="text-stone-400 text-xs leading-relaxed mb-4">
                Enterprise plans include dedicated integration engineers for custom ERP, delivery webhook, and accounting software synchronization.
              </p>
              <Link
                to="/contact"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black px-4 py-2.5 rounded-xl transition"
              >
                Contact Integration Team
              </Link>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
};
