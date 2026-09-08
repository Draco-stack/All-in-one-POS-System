import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MasterPOSLogo } from '../common/MasterPOSLogo';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { OfflineIndicator } from '../pwa/OfflineIndicator';

export type LoginTheme = 'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue';

export const LoginScreen: React.FC = () => {
  const { loginUser, loginTheme, setLoginTheme, showToast } = useRestaurant();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = loginUser(email.trim(), password.trim());
    if (result.success && result.user) {
      showToast(`✓ Welcome back, ${result.user.name} (${result.user.role.toUpperCase()})`);
    } else {
      setErrorMsg(result.error || 'Invalid Email or Password. Please try again.');
    }
    setIsSubmitting(false);
  };

  // Background Theme Gradient Classes
  const getThemeBackground = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-gradient-to-br from-[#541c15] via-[#330f0a] to-[#1a0604]';
      case 'pink':
        return 'bg-gradient-to-br from-[#5c133a] via-[#3a0a23] to-[#1c0310]';
      case 'midnight':
        return 'bg-gradient-to-br from-[#0c223c] via-[#081628] to-[#030912]';
      case 'light':
        return 'bg-gradient-to-br from-[#0c6b58] via-[#084c3e] to-[#043329]';
      case 'blue':
        return 'bg-gradient-to-br from-[#103d75] via-[#09274c] to-[#031124]';
      case 'dark':
      default:
        return 'bg-gradient-to-br from-[#005a38] via-[#023f27] to-[#042617]';
    }
  };

  // Card Background Color matching theme
  const getCardBackground = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-[#2a0e0a]/90 border-red-900/40';
      case 'pink':
        return 'bg-[#2f081c]/90 border-pink-900/40';
      case 'midnight':
        return 'bg-[#081525]/90 border-indigo-900/40';
      case 'light':
        return 'bg-[#063b2f]/90 border-teal-700/40';
      case 'blue':
        return 'bg-[#061f3d]/90 border-blue-900/40';
      case 'dark':
      default:
        return 'bg-[#084028]/90 border-emerald-600/30';
    }
  };

  // Input Box styling matching theme
  const getInputStyle = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-[#1b0806] border-red-800/50 focus:border-red-500 focus:ring-red-500';
      case 'pink':
        return 'bg-[#1c0411] border-pink-800/50 focus:border-pink-500 focus:ring-pink-500';
      case 'midnight':
        return 'bg-[#040b16] border-indigo-800/50 focus:border-indigo-400 focus:ring-indigo-400';
      case 'light':
        return 'bg-[#03261e] border-teal-600/50 focus:border-teal-400 focus:ring-teal-400';
      case 'blue':
        return 'bg-[#031226] border-blue-700/50 focus:border-blue-400 focus:ring-blue-400';
      case 'dark':
      default:
        return 'bg-[#062b1b] border-emerald-600/50 focus:border-emerald-400 focus:ring-emerald-400';
    }
  };

  // Button styling matching theme
  const getButtonStyle = (t: LoginTheme) => {
    switch (t) {
      case 'wood':
        return 'bg-[#c23624] hover:bg-[#a62b1b] active:bg-[#862013]';
      case 'pink':
        return 'bg-[#d62883] hover:bg-[#b81d6f] active:bg-[#97145a]';
      case 'midnight':
        return 'bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8]';
      case 'light':
        return 'bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59]';
      case 'blue':
        return 'bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]';
      case 'dark':
      default:
        return 'bg-[#00a859] hover:bg-[#00924d] active:bg-[#007b40]';
    }
  };

  const themePills: { id: LoginTheme; label: string; colorClass: string }[] = [
    { id: 'dark', label: 'dark', colorClass: 'bg-[#006038] text-white' },
    { id: 'wood', label: 'wood', colorClass: 'bg-[#b82a1c] text-white' },
    { id: 'pink', label: 'pink', colorClass: 'bg-[#c92a83] text-white' },
    { id: 'midnight', label: 'midnight', colorClass: 'bg-[#eab308] text-stone-950 font-bold' },
    { id: 'light', label: 'light', colorClass: 'bg-[#0d9488] text-white' },
    { id: 'blue', label: 'blue', colorClass: 'bg-[#1d4ed8] text-white' },
  ];

  return (
    <div
      className={`w-screen h-screen flex flex-col items-center justify-center select-none font-sans overflow-hidden transition-colors duration-500 relative px-4 ${getThemeBackground(
        loginTheme
      )}`}
    >
      {/* Centered Login Card */}
      <div
        className={`w-full sm:w-[410px] max-w-[94vw] border shadow-2xl rounded-3xl p-6 sm:p-8 text-white backdrop-blur-xl transition-all duration-300 ${getCardBackground(
          loginTheme
        )}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-[#1c1e28] via-[#12131b] to-[#0a0b10] flex items-center justify-center mb-3 shadow-xl shadow-black/60 border border-emerald-500/40">
            <div className="absolute inset-0 rounded-2xl bg-radial from-emerald-500/30 to-transparent opacity-70" />
            <MasterPOSLogo className="w-8 h-8 text-emerald-400 relative z-10" size={32} useColor={true} accent="emerald" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#12131b] shadow-xs" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans flex items-center gap-1.5">
            MASTER <span className="text-emerald-400">POS</span>
            <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRO
            </span>
          </h2>
          <p className="text-xs text-stone-300/80 mt-1 font-medium">Commercial Restaurant Operating System</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                Email
              </label>
            </div>
            <input
              type="text"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="email"
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm text-white font-medium placeholder-stone-400/60 focus:outline-none focus:ring-1 transition ${getInputStyle(
                loginTheme
              )}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-200 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-stone-400" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="password"
                className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-sm text-white font-mono tracking-wider font-medium placeholder-stone-400/60 focus:outline-none focus:ring-1 transition ${getInputStyle(
                  loginTheme
                )}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer transition p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold text-center animate-in fade-in">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full mt-2 py-3 px-4 rounded-xl text-white font-black text-sm shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${getButtonStyle(
              loginTheme
            )}`}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Terminal'}
          </button>
        </form>
      </div>

      {/* Theme Selection Buttons below Login Box */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <div className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="text-[11px] font-mono text-stone-400 mr-1 hidden sm:inline">Theme:</span>
          {themePills.map((pill) => {
            const isActive = loginTheme === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setLoginTheme(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition cursor-pointer ${
                  pill.colorClass
                } ${isActive ? 'ring-2 ring-white scale-105 shadow-md' : 'opacity-70 hover:opacity-100'}`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <PWAInstallButton />
      </div>

      <OfflineIndicator />
    </div>
  );
};
