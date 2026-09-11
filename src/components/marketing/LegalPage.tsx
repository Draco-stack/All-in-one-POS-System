import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface LegalPageProps {
  initialTab?: 'privacy' | 'terms' | 'security';
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialTab = 'privacy' }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'security'>(initialTab);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Legal & Security Governance</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tightest leading-tight mb-6">
            LEGAL, PRIVACY & <span className="text-amber-500">SECURITY.</span>
          </h1>

          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'privacy'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'terms'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
              }`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'security'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
              }`}
            >
              Security Architecture
            </button>
          </div>
        </div>
      </section>

      <section className="pb-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="p-8 md:p-12 rounded-3xl bg-stone-900/40 border border-white/5 prose prose-invert prose-stone max-w-none text-stone-300 text-sm leading-relaxed space-y-8">
            
            {activeTab === 'privacy' && (
              <div>
                <h2 className="text-2xl font-black text-stone-100 mb-4">Privacy Policy</h2>
                <p className="text-xs text-stone-500 font-mono mb-6">Last Updated: January 2026</p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">1. Overview and Scope</h3>
                <p>
                  Tillora Technologies Inc. ("Tillora", "we", "us") values the confidentiality of your restaurant and customer business data. This Privacy Policy describes how we collect, use, process, and protect information when you access the Tillora SaaS and POS platforms.
                </p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">2. Data We Collect</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-stone-300">
                  <li><strong>Account Credentials:</strong> Organization details, store locations, staff names, encrypted passwords, and managerial PINs.</li>
                  <li><strong>Operational Transaction Records:</strong> Order line items, payment settlement types (cash/card/digital), timestamped kitchen receipts, and audit logs.</li>
                  <li><strong>Customer Information:</strong> Customer contact phone numbers and delivery delivery addresses stored strictly on behalf of the merchant.</li>
                </ul>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">3. Tenant Isolation and Data Ownership</h3>
                <p>
                  You retain complete, exclusive ownership of your restaurant catalog, order records, and customer database. Tillora does not sell, rent, or monetize your restaurant's transaction data to third parties.
                </p>
              </div>
            )}

            {activeTab === 'terms' && (
              <div>
                <h2 className="text-2xl font-black text-stone-100 mb-4">Terms of Service</h2>
                <p className="text-xs text-stone-500 font-mono mb-6">Last Updated: January 2026</p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">1. Software Subscription License</h3>
                <p>
                  Tillora grants you a non-exclusive, non-transferable subscription license to operate the Tillora POS, Kitchen Display System, and cloud administrative dashboard across your licensed branch locations.
                </p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">2. Uptime and Service Level Expectations</h3>
                <p>
                  While Tillora cloud backend services target 99.9% uptime, the client application is specifically architected with client-side offline autonomy (via IndexedDB and local storage) to ensure continuous operation regardless of cloud network conditions.
                </p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">3. Acceptable Use</h3>
                <p>
                  You agree to use Tillora in compliance with applicable commercial, tax, and labor laws, including accurate recording of cash shift reconciliations and local sales tax obligations.
                </p>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 className="text-2xl font-black text-stone-100 mb-4">Security Architecture & Compliance</h2>
                <p className="text-xs text-stone-500 font-mono mb-6">Enterprise Security Statement</p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">1. Data Encryption in Transit & Rest</h3>
                <p>
                  All network communication between Tillora POS terminals, KDS displays, and cloud APIs is encrypted using TLS 1.3 with modern cipher suites. Local client-side caches and sensitive session tokens are securely partitioned per origin.
                </p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">2. Zero Payment Cardholder Data Storage (PCI DSS)</h3>
                <p>
                  Tillora does not store or process raw credit card primary account numbers (PAN) or CVV codes on our servers. Payment transactions are processed directly via certified third-party merchant terminals or tokenized payment gateway bridges.
                </p>

                <h3 className="text-lg font-bold text-stone-200 mt-6 mb-2">3. Role-Based Access Control (RBAC)</h3>
                <p>
                  Tillora enforces strict role separation. Cashiers and riders have restricted terminal access, while managerial actions (bill discounts, order voids, shift reconciliations, blocklist adjustments) require authorized PIN credentials and are logged to tamper-evident audit trails.
                </p>
              </div>
            )}

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
