import React from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Pricing: React.FC = () => {
  const tiers = [
    {
      name: "Starter",
      plan: "starter",
      price: "$0",
      description: "Perfect for single food trucks or small cafes starting their journey.",
      features: [
        "Single Workstation",
        "Up to 500 Orders/mo",
        "Basic Inventory",
        "Standard Analytics",
        "Email Support"
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Professional",
      plan: "business",
      price: "$49",
      period: "/mo",
      description: "Scale your restaurant with unlimited orders and advanced automation.",
      features: [
        "Unlimited Workstations",
        "Unlimited Orders",
        "Advanced Inventory + AI Alerts",
        "Full Growth Intelligence",
        "24/7 Priority Support",
        "Rider App Integration"
      ],
      cta: "Start 14-Day Trial",
      popular: true
    },
    {
      name: "Enterprise",
      plan: "enterprise",
      price: "Custom",
      description: "Tailored solutions for franchises and high-volume commercial chains.",
      features: [
        "Multi-Branch Central Ops",
        "White-label Branding",
        "Custom API Access",
        "Dedicated Success Manager",
        "On-site Installation",
        "Hardware Discounts"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-stone-950 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[160px] -z-10" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-5xl md:text-6xl font-black text-stone-100 tracking-tightest leading-none mb-6">
            CHOOSE YOUR <span className="text-amber-500">SCALE.</span>
          </h2>
          <p className="text-lg text-stone-400 font-medium leading-relaxed">
            Simple, transparent pricing that grows with your business. No hidden fees, no long-term contracts.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {tiers.map((tier, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-10 rounded-[32px] border transition-all duration-500 flex flex-col h-full ${
                tier.popular 
                  ? 'bg-stone-900 border-amber-500/50 shadow-2xl shadow-amber-500/10 scale-105 z-10' 
                  : 'bg-stone-900/40 border-white/5 hover:border-white/20'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-black text-stone-100 mb-2">{tier.name}</h3>
                <p className="text-stone-400 text-sm font-medium leading-relaxed">{tier.description}</p>
              </div>

              <div className="mb-10 flex items-baseline gap-2">
                <span className="text-5xl font-black text-stone-100 tracking-tight">{tier.price}</span>
                {tier.period && <span className="text-stone-500 font-bold">{tier.period}</span>}
              </div>

              <div className="flex-1 space-y-5 mb-12">
                {tier.features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-amber-500" />
                    </div>
                    <span className="text-stone-300 text-sm font-semibold tracking-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                to={`/get-started?plan=${tier.plan}`}
                className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all group ${
                  tier.popular 
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-xl shadow-amber-500/20' 
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-100 border border-white/5'
                }`}
              >
                {tier.cta}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
