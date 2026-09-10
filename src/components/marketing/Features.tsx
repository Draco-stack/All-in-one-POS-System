import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Zap, ShieldCheck, BarChart3, Users, Globe, Smartphone, Clock } from 'lucide-react';

export const Features: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant Synchronization",
      description: "Real-time updates across all branch workstations and delivery rider apps. No lag, no missed orders."
    },
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      title: "Omnichannel POS",
      description: "Manage dine-in, takeaway, and delivery orders through a single, intuitive touch-interface."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Growth Intelligence",
      description: "Deep analytics that track inventory, staff performance, and customer lifetime value automatically."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Enterprise Security",
      description: "Military-grade encryption and role-based access control to keep your financial data strictly private."
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Multi-Branch Control",
      description: "Scale from one food truck to a global franchise with unified menu and inventory management."
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Rider Ecosystem",
      description: "Native driver apps for precise GPS tracking, delivery proof, and automated route optimization."
    }
  ];

  return (
    <section id="features" className="py-24 bg-stone-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Core Capabilities</span>
          </motion.div>
          <h2 className="text-5xl md:text-6xl font-black text-stone-100 tracking-tightest leading-none mb-6">
            BUILT FOR <span className="text-amber-500">PERFORMANCE.</span>
          </h2>
          <p className="text-lg text-stone-400 font-medium leading-relaxed">
            Every millisecond counts in a busy kitchen. Tillora is engineered for raw speed and zero downtime, even during peak rush hours.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-8 rounded-3xl bg-stone-900/40 border border-white/5 hover:bg-stone-900/60 hover:border-amber-500/30 transition-all duration-500"
            >
              <div className="w-14 h-14 bg-stone-800 rounded-2xl flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform duration-500 shadow-xl group-hover:shadow-amber-500/10 group-hover:bg-amber-500 group-hover:text-stone-950">
                {feature.icon}
              </div>
              <h3 className="text-xl font-black text-stone-100 mb-3 tracking-tight group-hover:text-amber-500 transition-colors">
                {feature.title}
              </h3>
              <p className="text-stone-400 font-medium text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
