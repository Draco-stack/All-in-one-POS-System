import React from 'react';
import { Logo } from '../common/Logo';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#features" },
        { name: "Solutions", href: "#solutions" },
        { name: "Pricing", href: "#pricing" },
        { name: "Demo", href: "#demo" }
      ]
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "/about" },
        { name: "Blog", href: "/blog" },
        { name: "Guides", href: "/guides" },
        { name: "Careers", href: "/careers" }
      ]
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy", href: "/privacy" },
        { name: "Terms", href: "/terms" },
        { name: "Security", href: "/security" },
        { name: "Compliance", href: "/compliance" }
      ]
    }
  ];

  return (
    <footer className="bg-stone-950 border-t border-white/5 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-20">
          <div className="lg:col-span-2">
            <Logo className="mb-8" />
            <p className="text-stone-400 font-medium leading-relaxed max-w-sm mb-8">
              The ultimate commercial operating system for modern hospitality businesses. Scalable, secure, and lightning-fast.
            </p>
            <div className="flex items-center gap-5">
              {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-xl bg-stone-900 border border-white/5 flex items-center justify-center text-stone-500 hover:text-amber-500 hover:border-amber-500/30 transition-all">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {sections.map((section, index) => (
            <div key={index}>
              <h4 className="text-sm font-black text-stone-100 uppercase tracking-widest mb-6">{section.title}</h4>
              <ul className="space-y-4">
                {section.links.map((link, lIndex) => (
                  <li key={lIndex}>
                    <a href={link.href} className="text-stone-400 hover:text-stone-100 text-sm font-semibold transition-colors tracking-tight">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">
            © {currentYear} Tillora Technologies Inc. All Rights Reserved.
          </p>
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Systems Operational
            </span>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
              Version 2.4.12
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
