import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { appConfig } from '../../config/appConfig';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    restaurantName: '',
    locations: '1',
    message: '',
    inquiryType: 'sales'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.restaurantName.trim()) {
      setErrorMsg('Please complete all required fields (Name, Email, and Restaurant Name).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Simulate reliable transmission
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950">
      <Navbar />

      {/* Header */}
      <section className="pt-36 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Direct Support & Inquiries</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tightest leading-tight mb-4">
            LET'S TALK <span className="text-amber-500">RESTAURANTS.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-2xl mx-auto font-medium">
            Have questions about custom hardware configurations, enterprise onboarding, or franchise deployment? Our team is ready to help.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-5 gap-12 items-start">
          
          {/* Contact Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="p-8 rounded-3xl bg-stone-900/40 border border-white/5 space-y-6">
              <h3 className="text-xl font-black text-stone-100">Global Restaurant Support</h3>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-800 rounded-xl border border-white/5 text-amber-500 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">Email Us</div>
                  <a href={`mailto:${appConfig.supportEmail}`} className="text-stone-200 text-sm font-semibold hover:text-amber-400 transition">
                    {appConfig.supportEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-800 rounded-xl border border-white/5 text-amber-500 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">Enterprise Hotline</div>
                  <div className="text-stone-200 text-sm font-semibold font-mono">
                    {appConfig.supportPhone}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-800 rounded-xl border border-white/5 text-amber-500 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">Headquarters</div>
                  <div className="text-stone-300 text-xs font-medium leading-relaxed">
                    {appConfig.appName} Technologies Inc.<br />
                    Commercial Hospitality Systems Division
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 text-xs text-stone-400 leading-relaxed">
              <span className="text-amber-400 font-bold block mb-1">Standard Support Hours:</span>
              24/7/365 Emergency Restaurant On-Call support for all Business and Enterprise subscribers.
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-3 p-8 md:p-10 rounded-3xl bg-stone-900/50 border border-white/5">
            {isSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-stone-100">Inquiry Received!</h3>
                <p className="text-stone-400 text-sm max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{formData.name}</strong>. A Tillora restaurant technology specialist will contact you at <strong>{formData.email}</strong> within 1 business hour.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200 transition"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-2xl font-black text-stone-100 mb-6">Send an Inquiry</h3>

                {errorMsg && (
                  <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Chef Gordon"
                      className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="gordon@bistro.com"
                      className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Restaurant Name *
                    </label>
                    <input
                      type="text"
                      value={formData.restaurantName}
                      onChange={(e) => handleChange('restaurantName', e.target.value)}
                      placeholder="Central Bistro"
                      className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Number of Locations
                    </label>
                    <select
                      value={formData.locations}
                      onChange={(e) => handleChange('locations', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                    >
                      <option value="1">1 Location (Single Store)</option>
                      <option value="2-5">2 - 5 Locations</option>
                      <option value="6-20">6 - 20 Locations (Chain)</option>
                      <option value="20+">20+ Locations (Enterprise)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                    How can we help you?
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    rows={4}
                    placeholder="Tell us about your current POS setup, hardware requirements, or questions..."
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Inquiry...
                    </>
                  ) : (
                    <>
                      Submit Inquiry <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
};
