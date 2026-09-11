import React from 'react';
import { Logo } from '../common/Logo';
import { Github, Twitter, Linkedin, Mail, Shield, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appConfig } from '../../config/appConfig';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: "Product",
      links: [
        { name: "All Features", href: "/features" },
        { name: "Pricing & Plans", href: "/pricing" },
        { name: "POS Workstation", href: "/login" },
        { name: "Kitchen Display (KDS)", href: "/features" },
        { name: "Delivery Dispatch", href: "/features" }
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Operator Guides", href: "/guides" },
        { name: "Documentation & API", href: "/docs" },
        { name: "Compare vs Toast & Square", href: "/compare" },
        { name: "FAQ", href: "/faq" }
      ]
    },
    {
      title: "Company",
      links: [
        { name: "About Tillora", href: "/about" },
        { name: "Contact & Sales", href: "/contact" },
        { name: "Start Free Trial", href: "/get-started" },
        { name: "Terminal Login", href: "/login" },
        { name: "Platform Admin", href: "/platform-admin" }
      ]
    },
    {
      title: "Legal & Trust",
      links: [
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" },
        { name: "Security Architecture", href: "/security" },
        { name: "PCI DSS Statement", href: "/security" }
      ]
    }
  ];

  return (
    <footer className="bg-stone-950 border-t border-white/5 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10 mb-16">
          
          <div className="lg:col-span-2">
            <Logo className="mb-6" />
            <p className="text-stone-400 font-medium text-xs leading-relaxed max-w-sm mb-6">
              Commercial hospitality operating system engineered for sub-50ms touchscreen speed, true autonomous offline fault tolerance, and zero hardware monopolies.
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational Systems Active
              </span>
            </div>
          </div>

          {sections.map((section, index) => (
            <div key={index}>
              <h4 className="text-xs font-black text-stone-100 uppercase tracking-widest mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link, lIndex) => (
                  <li key={lIndex}>
                    <Link
                      to={link.href}
                      className="text-stone-400 hover:text-amber-400 text-xs font-semibold transition-colors tracking-tight"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-stone-500 text-[11px] font-bold uppercase tracking-widest">
            © {currentYear} {appConfig.appName} Technologies Inc. All Rights Reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-stone-500 hover:text-stone-300 text-[11px] font-medium transition">
              Privacy
            </Link>
            <Link to="/terms" className="text-stone-500 hover:text-stone-300 text-[11px] font-medium transition">
              Terms
            </Link>
            <Link to="/security" className="text-stone-500 hover:text-stone-300 text-[11px] font-medium transition">
              Security
            </Link>
            <span className="text-stone-600 text-[11px] font-mono">v2.5.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
