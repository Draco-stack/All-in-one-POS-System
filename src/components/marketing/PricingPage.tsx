import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight, HelpCircle, Shield, Zap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const PricingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      targetPlan: 'starter',
      price: '$0',
      period: 'Forever free',
      description: 'Essential point of sale for small food trucks, pop-up stalls, and single-register kiosks.',
      badge: 'Quick Launch',
      popular: false,
      features: [
        '1 Primary Workstation',
        'Up to 500 Monthly Orders',
        'Full Offline Operation Mode',
        'Customer Directory & CRM',
        'Standard Sales Reporting',
        'Receipt & Bill Thermal Printing',
        'Email Support'
      ],
      limits: {
        branches: '1 Branch',
        staff: 'Up to 3 Staff Accounts',
        devices: '2 Connected Devices',
        kds: 'Standard KOT'
      },
      ctaText: 'Get Started Free',
      ctaUrl: '/get-started?plan=starter'
    },
    {
      id: 'business',
      name: 'Business',
      targetPlan: 'business',
      price: billingCycle === 'annual' ? '$39' : '$49',
      period: '/ month',
      description: 'Complete commercial restaurant operating system with live kitchen routing and delivery fleet.',
      badge: 'Most Popular',
      popular: true,
      features: [
        'Multi-Workstation Support',
        'Unlimited Monthly Orders',
        'Kitchen Display System (KDS)',
        'Delivery & Driver Fleet Dispatch',
        'Automated Low-Stock Inventory Alerts',
        'Daily Shift Closeout & Z-Reports',
        'Multi-Branch Consolidated Dashboard',
        'Managerial PIN Overrides & Audit Logs',
        '24/7 Priority Support'
      ],
      limits: {
        branches: 'Up to 10 Branches',
        staff: 'Up to 50 Staff Accounts',
        devices: '20 POS & KDS Devices',
        kds: 'Multi-Station KDS Included'
      },
      ctaText: 'Start 14-Day Free Trial',
      ctaUrl: '/get-started?plan=business'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      targetPlan: 'enterprise',
      price: 'Custom',
      period: 'Volume pricing',
      description: 'Customized infrastructure and dedicated integrations for high-volume franchises and hotel chains.',
      badge: 'Franchise Scale',
      popular: false,
      features: [
        'Unlimited Branches & Outlets',
        'Unlimited Staff & Terminals',
        'Advanced Central Menu Distribution',
        'Custom ERP & Accounting API Webhooks',
        'Dedicated Technical Account Manager',
        'Custom Hardware Provisioning & Staging',
        '99.99% Uptime Service Level Agreement (SLA)'
      ],
      limits: {
        branches: '100+ Branches',
        staff: 'Unlimited Staff',
        devices: 'Unlimited Devices',
        kds: 'Enterprise KDS Matrix'
      },
      ctaText: 'Contact Enterprise Sales',
      ctaUrl: '/get-started?plan=enterprise'
    }
  ];

  const comparisonRows = [
    { feature: 'Core Touch POS Terminal', starter: '✓', business: '✓', enterprise: '✓' },
    { feature: 'Offline Resilience & IndexedDB Caching', starter: '✓', business: '✓', enterprise: '✓' },
    { feature: 'ESC/POS Thermal Receipt Printing', starter: '✓', business: '✓', enterprise: '✓' },
    { feature: 'Customer History & Loyalty Tracking', starter: '✓', business: '✓', enterprise: '✓' },
    { feature: 'Kitchen Display System (KDS)', starter: '—', business: '✓', enterprise: '✓' },
    { feature: 'Delivery Fleet & Driver Dispatching', starter: '—', business: '✓', enterprise: '✓' },
    { feature: 'Stock Alerts & Inventory Tracking', starter: '—', business: '✓', enterprise: '✓' },
    { feature: 'Multi-Branch Central Management', starter: '—', business: '✓ (Up to 10)', enterprise: '✓ (Unlimited)' },
    { feature: 'Shift Audits & X/Z-Report Closeouts', starter: 'Basic', business: 'Advanced', enterprise: 'Enterprise' },
    { feature: 'Custom REST API & Webhook Access', starter: '—', business: '—', enterprise: '✓' },
    { feature: 'Dedicated Support SLA', starter: 'Community', business: '24/7 Priority', enterprise: 'Dedicated Manager' },
  ];

  const faqs = [
    {
      q: 'Do I need proprietary hardware to use Tillora?',
      a: 'No. Tillora runs in any modern browser on iPads, Android tablets, Windows POS terminals, Mac, or PCs. It connects directly to standard network and USB ESC/POS thermal receipt printers.'
    },
    {
      q: 'What happens if my restaurant loses internet connection?',
      a: 'Tillora operates seamlessly offline. You can continue punching orders, calculating bills, and printing receipts. All transactions are queued locally in IndexedDB and automatically sync to the cloud once connection is restored.'
    },
    {
      q: 'Can I change my plan later?',
      a: 'Yes, you can upgrade, downgrade, or update your subscription at any time from your Admin Settings with prorated billing.'
    },
    {
      q: 'Are there any hidden transaction fees or payment processing surcharges?',
      a: 'Zero. Tillora never charges per-transaction penalties. You retain 100% of your payment processing agreement.'
    }
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Transparent Pricing</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tightest leading-tight mb-6">
            PREDICTABLE PLANS. <br />
            <span className="text-amber-500">NO HIDDEN FEES.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-400 font-medium max-w-2xl mx-auto leading-relaxed mb-8">
            Choose the right tier for your restaurant. Upgrade seamlessly as you open new branches.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-3 bg-stone-900 border border-white/10 p-1.5 rounded-full">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                billingCycle === 'monthly' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'annual' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Annual Billing
              <span className="text-[10px] bg-stone-950 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative p-8 md:p-10 rounded-[32px] border transition-all flex flex-col justify-between ${
                  plan.popular
                    ? 'bg-stone-900 border-amber-500 shadow-2xl shadow-amber-500/10 scale-105 z-10'
                    : 'bg-stone-900/40 border-white/5 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-stone-100">{plan.name}</h3>
                    {!plan.popular && (
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest bg-stone-800/80 px-2.5 py-1 rounded-lg">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-stone-400 text-sm font-medium mb-6 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="flex items-baseline gap-2 mb-8">
                    <span className="text-5xl font-black text-stone-100 tracking-tight">{plan.price}</span>
                    <span className="text-stone-500 font-bold text-sm">{plan.period}</span>
                  </div>

                  {/* Included Resource Quota */}
                  <div className="bg-stone-950/60 rounded-2xl p-4 border border-white/5 mb-8 space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-2">Included Resources</div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="text-stone-500">Locations:</span>
                      <span className="font-semibold">{plan.limits.branches}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="text-stone-500">Staff Accounts:</span>
                      <span className="font-semibold">{plan.limits.staff}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="text-stone-500">Hardware Devices:</span>
                      <span className="font-semibold">{plan.limits.devices}</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3.5 mb-8">
                    <div className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-2">Features Included</div>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-amber-500" />
                        </div>
                        <span className="text-stone-300 text-xs font-semibold">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={plan.ctaUrl}
                  className={`w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all ${
                    plan.popular
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/20'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-100 border border-white/5'
                  }`}
                >
                  {plan.ctaText} <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="py-20 border-t border-white/5 bg-stone-900/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-stone-100 tracking-tightest mb-4">
              Detailed Feature Comparison
            </h2>
            <p className="text-stone-400 text-sm max-w-xl mx-auto">
              Compare feature availability across Tillora tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-stone-400 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6">Capability</th>
                  <th className="py-4 px-6 text-center">Starter</th>
                  <th className="py-4 px-6 text-center text-amber-400">Business</th>
                  <th className="py-4 px-6 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-semibold text-stone-300">{row.feature}</td>
                    <td className="py-4 px-6 text-center text-stone-400 font-medium">{row.starter}</td>
                    <td className="py-4 px-6 text-center text-amber-400 font-bold">{row.business}</td>
                    <td className="py-4 px-6 text-center text-stone-200 font-medium">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-stone-100 tracking-tightest mb-4">
              Frequently Asked Pricing Questions
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-stone-900/40 border border-white/5">
                <h3 className="text-base font-bold text-stone-100 mb-2.5 flex items-start gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  {faq.q}
                </h3>
                <p className="text-stone-400 text-xs font-medium leading-relaxed pl-7">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
