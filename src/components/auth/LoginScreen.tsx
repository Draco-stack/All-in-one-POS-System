import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Logo } from '../common/Logo';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, Sparkles, ArrowRight, CheckCircle2, Wifi, Loader2 } from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { OfflineIndicator } from '../pwa/OfflineIndicator';

export type LoginTheme = 'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue';

export const LoginScreen: React.FC = () => {
  const { loginUser, loginTheme, setLoginTheme, showToast, users } = useRestaurant();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setErrorMsg('Please enter your email, username, or staff ID.');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('Please enter your password or staff PIN.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    // Try direct server authentication first
    let serverAuthenticated = false;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanEmail,
          email: cleanEmail,
          pin: cleanPass,
          password: cleanPass,
        }),
      });

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === 'ORGANIZATION_SUSPENDED' || data?.error?.includes('suspended')) {
          setErrorMsg('Your restaurant organization account is currently suspended. Please contact Tillora support.');
          setIsSubmitting(false);
          return;
        }
      }

      if (res.ok) {
        const authData = await res.json();
        if (authData?.user) {
          serverAuthenticated = true;
          const result = loginUser(authData.user.username || authData.user.email || cleanEmail, cleanPass);
          if (result.success && result.user) {
            showToast(`✓ Welcome back, ${result.user.name} (${result.user.role.toUpperCase()})`);
            setIsSubmitting(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Server login fetch failed, trying local store fallback:', err);
    }

    // Local authentication fallback for offline POS usage
    const result = loginUser(cleanEmail, cleanPass);
    if (result.success && result.user) {
      showToast(`✓ Welcome back, ${result.user.name} (${result.user.role.toUpperCase()})`);
    } else {
      if (result.error && result.error.includes('suspended')) {
        setErrorMsg('Your restaurant organization account is currently suspended. Please contact Tillora support.');
      } else {
        // Generic OWASP compliant login error to prevent account enumeration
        setErrorMsg('Invalid username/email or password/PIN. Please verify your credentials and try again.');
      }
    }
    setIsSubmitting(false);
  };

  // Quick staff quick-select handler for touch POS terminals
  const handleSelectStaff = (u: any) => {
    setEmail(u.username || u.email || u.name);
    setPassword(u.pin || u.password || '1234');
    setErrorMsg(null);
  };

  // Background Theme Styling aligned with Tillora marketing palette
  const getThemeBackground = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-[#180a08] text-stone-100';
      case 'pink':
        return 'bg-[#180612] text-stone-100';
      case 'midnight':
        return 'bg-[#080d1a] text-stone-100';
      case 'light':
        return 'bg-[#f1f5f9] text-stone-900';
      case 'blue':
        return 'bg-[#071328] text-stone-100';
      case 'dark':
      default:
        return 'bg-[#0c0c0e] text-stone-100';
    }
  };

  const getThemeOrb = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-amber-700/15';
      case 'pink':
        return 'bg-pink-600/15';
      case 'midnight':
        return 'bg-indigo-600/15';
      case 'light':
        return 'bg-teal-500/10';
      case 'blue':
        return 'bg-blue-600/15';
      case 'dark':
      default:
        return 'bg-amber-500/15';
    }
  };

  const getCardStyle = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-[#281310]/90 border-amber-900/40 shadow-2xl';
      case 'pink':
        return 'bg-[#2b0c20]/90 border-pink-900/40 shadow-2xl';
      case 'midnight':
        return 'bg-[#0f172a]/90 border-indigo-900/40 shadow-2xl';
      case 'light':
        return 'bg-white border-slate-200/80 shadow-xl text-stone-900';
      case 'blue':
        return 'bg-[#0b1d3a]/90 border-blue-900/40 shadow-2xl';
      case 'dark':
      default:
        return 'bg-[#141417]/90 border-stone-800 shadow-2xl';
    }
  };

  const getInputStyle = (t: LoginTheme) => {
    if (t === 'light') {
      return 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
    }
    return 'bg-stone-950/80 border-stone-800 text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
  };

  const getButtonStyle = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-amber-600 hover:bg-amber-500 text-stone-950';
      case 'pink':
        return 'bg-pink-600 hover:bg-pink-500 text-white';
      case 'midnight':
        return 'bg-indigo-600 hover:bg-indigo-500 text-white';
      case 'light':
        return 'bg-amber-500 hover:bg-amber-400 text-stone-950';
      case 'blue':
        return 'bg-blue-600 hover:bg-blue-500 text-white';
      case 'dark':
      default:
        return 'bg-amber-500 hover:bg-amber-400 text-stone-950';
    }
  };

  const themePills: { id: LoginTheme; label: string; bg: string }[] = [
    { id: 'dark', label: 'Dark (Amber)', bg: 'bg-amber-500 text-stone-950' },
    { id: 'light', label: 'Light', bg: 'bg-slate-200 text-slate-900' },
    { id: 'midnight', label: 'Midnight', bg: 'bg-indigo-600 text-white' },
    { id: 'wood', label: 'Warm Wood', bg: 'bg-amber-700 text-white' },
    { id: 'blue', label: 'Ocean Blue', bg: 'bg-blue-600 text-white' },
    { id: 'pink', label: 'Berry', bg: 'bg-pink-600 text-white' },
  ];

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-between select-none font-sans overflow-x-hidden relative p-4 sm:p-6 transition-colors duration-300 ${getThemeBackground(
        loginTheme
      )}`}
    >
      {/* Background Ambient Orbs */}
      <div className={`absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse ${getThemeOrb(loginTheme)}`} />
      <div className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none -z-10 ${getThemeOrb(loginTheme)}`} />

      {/* Top Bar Navigation */}
      <header className="w-full max-w-7xl flex items-center justify-between py-2 px-2 z-10">
        <Logo className="scale-105" />
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/50 border border-white/10 text-xs font-mono text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>COMMERCIAL TERMINAL v2.4</span>
          </div>
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="w-full max-w-md my-auto py-6 z-10">
        <div
          className={`w-full border backdrop-blur-xl rounded-3xl p-6 sm:p-8 transition-all duration-300 ${getCardStyle(
            loginTheme
          )}`}
        >
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-black uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign In to Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
              Tillora <span className="text-amber-500">POS</span>
            </h1>
            <p className={`text-xs mt-1 font-medium ${loginTheme === 'light' ? 'text-slate-500' : 'text-stone-400'}`}>
              Enter staff credentials or PIN to access your register session
            </p>
          </div>

          {/* Quick Staff Preset Selector for Touch Registers */}
          {users && users.length > 0 && (
            <div className="mb-5">
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${loginTheme === 'light' ? 'text-slate-500' : 'text-stone-400'}`}>
                Quick Staff Select (Touch POS):
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {users.slice(0, 6).map((u) => {
                  const isSelected = email.toLowerCase() === (u.username || u.email || '').toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectStaff(u)}
                      className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                          : loginTheme === 'light'
                          ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-stone-300'
                      }`}
                    >
                      <span className="text-xs font-bold truncate">{u.name.split(' ')[0]}</span>
                      <span className="text-[10px] font-mono text-stone-500 uppercase">{u.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${loginTheme === 'light' ? 'text-slate-700' : 'text-stone-300'}`}>
                <Mail className="w-3.5 h-3.5 text-amber-500" />
                Username, Email or Staff ID
              </label>
              <input
                type="text"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="admin or cashier"
                disabled={isSubmitting}
                className={`w-full min-h-[48px] px-4 py-3 rounded-2xl text-sm font-medium focus:outline-none transition ${getInputStyle(
                  loginTheme
                )}`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-bold flex items-center gap-1.5 ${loginTheme === 'light' ? 'text-slate-700' : 'text-stone-300'}`}>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Password or 4-Digit PIN
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="1234"
                  disabled={isSubmitting}
                  className={`w-full min-h-[48px] pl-4 pr-12 py-3 rounded-2xl text-sm font-mono tracking-wider font-medium focus:outline-none transition ${getInputStyle(
                    loginTheme
                  )}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer transition p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full min-h-[50px] mt-2 py-3.5 px-6 rounded-2xl font-black text-sm shadow-xl transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${getButtonStyle(
                loginTheme
              )} ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating Terminal...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Navigation Links */}
            <div className={`flex items-center justify-between text-xs mt-4 pt-3 border-t ${loginTheme === 'light' ? 'border-slate-200 text-slate-500' : 'border-stone-800/80 text-stone-400'}`}>
              <a href="/get-started" className="hover:text-amber-500 font-bold transition">
                New Restaurant? Start Free &rarr;
              </a>
              <a href="/" className="hover:text-stone-200 font-medium transition">
                Marketing Home
              </a>
            </div>
          </form>
        </div>
      </main>

      {/* Footer Controls & Theme Picker */}
      <footer className="w-full max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 py-3 z-10">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-stone-900/60 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="text-[11px] font-mono text-stone-400 mr-1.5 hidden sm:inline">Theme:</span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[85vw] py-0.5">
            {themePills.map((pill) => {
              const isActive = loginTheme === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setLoginTheme(pill.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer shrink-0 ${
                    pill.bg
                  } ${isActive ? 'ring-2 ring-amber-400 scale-105 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        <OfflineIndicator />
      </footer>
    </div>
  );
};

