import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Building,
  Store,
  User,
  CreditCard,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    branchName: 'Main Branch',
    plan: 'STARTER',
  });

  // Verification State
  const [verificationCode, setVerificationCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [activatedData, setActivatedData] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');
    if (planParam) {
      let p = planParam.toUpperCase();
      if (p === 'PRO' || p === 'PROFESSIONAL') p = 'BUSINESS';
      if (['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'].includes(p)) {
        setFormData((prev) => ({ ...prev, plan: p }));
      }
    }
  }, [location]);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const updateForm = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
        setError('Please fill in all account fields.');
        return;
      }
      if (!formData.email.includes('@') || !formData.email.includes('.')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    } else if (step === 2) {
      if (!formData.restaurantName.trim()) {
        setError('Restaurant / Organization name is required.');
        return;
      }
    } else if (step === 3) {
      if (!formData.branchName.trim()) {
        setError('Branch name is required.');
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  /**
   * Step 4 -> Step 5: Send Verification Code
   */
  const handleInitiateRegistration = async () => {
    setIsLoading(true);
    setError('');
    setPreviewCode(null);
    try {
      const response = await fetch('/api/auth/register-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate registration');
      }

      setMaskedEmail(data.emailMasked || formData.email);
      setPendingId(data.pendingId || '');
      if (data.previewCode) {
        setPreviewCode(data.previewCode);
      }
      setResendCooldown(30); // 30 second cooldown
      setStep(5); // Move to Email Verification Step
    } catch (err: any) {
      setError(err.message || 'An error occurred while preparing your account');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend Verification Code
   */
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setSuccessMessage('A fresh 6-digit code has been sent to your email.');
      if (data.previewCode) {
        setPreviewCode(data.previewCode);
      }
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Could not resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 5: Verify Code & Activate Restaurant
   */
  const handleVerifyAndActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode.trim(),
          pendingId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        throw new Error(data.error || 'Invalid verification code');
      }

      // Store authenticated credentials
      localStorage.setItem('pos_jwt_token_v5', JSON.stringify(data.token));
      localStorage.setItem('pos_current_user_v5', JSON.stringify(data.user));
      localStorage.setItem('pos_is_logged_in_v5', JSON.stringify(true));

      setActivatedData({
        ...data,
        email: formData.email,
        password: formData.password || data.temporaryPassword,
        restaurantName: formData.restaurantName || data.organization?.name || 'Tillora Restaurant',
        plan: formData.plan || 'STARTER',
      });
      setStep(6);
    } catch (err: any) {
      setError(err.message || 'Email verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToApp = async () => {
    if (!activatedData) return;
    setIsLoading(true);

    // Handle checkout for non-starter or proceed directly to application
    if (formData.plan !== 'FREE' && formData.plan !== 'STARTER') {
      try {
        const checkoutRes = await fetch('/api/billing/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activatedData.token}`,
          },
          body: JSON.stringify({ plan: formData.plan }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
      } catch (checkoutErr) {
        console.warn('Checkout redirection skipped:', checkoutErr);
      }
    }

    window.location.href = '/app';
  };

  const handleCopyCredentials = () => {
    const creds = `Tillora POS Credentials:\nRestaurant: ${formData.restaurantName}\nUsername / Email: ${formData.email}\nPassword: ${formData.password || activatedData?.temporaryPassword}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(creds);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-xl w-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        {/* Brand Header */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-8 py-6 text-white text-center border-b border-slate-800">
          <div className="flex items-center justify-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-wider text-xl">TILLORA</span>
          </div>
          <p className="text-slate-400 text-sm">The Operating System for Your Restaurant.</p>
        </div>

        {/* Progress Stepper */}
        <div className="flex px-6 pt-6 pb-2 items-center justify-between relative bg-slate-900/50">
          <div className="absolute left-10 right-10 top-9 h-0.5 bg-slate-800 -z-0" />
          {[
            { id: 1, icon: User, label: 'Account' },
            { id: 2, icon: Building, label: 'Restaurant' },
            { id: 3, icon: Store, label: 'Branch' },
            { id: 4, icon: CreditCard, label: 'Plan' },
            { id: 5, icon: Mail, label: 'Verify' },
          ].map((s) => {
            const isActive = step === s.id;
            const isPast = step > s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1.5 bg-slate-900 px-2 z-10">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/20'
                      : isPast
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 bg-slate-800 text-slate-500'
                  }`}
                >
                  {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[11px] font-medium tracking-wide ${
                    isActive ? 'text-amber-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-950/60 text-red-300 text-sm rounded-xl border border-red-800/80 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    {attemptsRemaining} verification {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining before
                    lockout.
                  </p>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-950/60 text-emerald-300 text-sm rounded-xl border border-emerald-800/80 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* STEP 1: OWNER ACCOUNT */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Create Verified Owner Account</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  As the creator, you will be designated the authoritative Organization Owner.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="e.g. Marcus Vance"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Owner Email Address (Requires Verification)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="owner@restaurant.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateForm('confirmPassword', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Repeat password"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: RESTAURANT ORGANIZATION */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Name Your Restaurant Organization</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  This establishes your multi-tenant organization boundary and billing identity.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Restaurant / Company Name
                </label>
                <input
                  type="text"
                  value={formData.restaurantName}
                  onChange={(e) => updateForm('restaurantName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-base"
                  placeholder="e.g. Bistro Lumina"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* STEP 3: INITIAL LOCATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Primary Branch / Outlet</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every order, register terminal, and staff assignment is anchored to a branch.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Branch / Location Name
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => updateForm('branchName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="e.g. Downtown Flagship"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* STEP 4: SUBSCRIPTION PLAN */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Select Your Subscription Tier</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Includes a full 14-day trial with all premium operational capabilities.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'STARTER',
                    name: 'Starter Plan',
                    price: '$29/mo',
                    desc: 'For single or dual location restaurants (up to 2 branches, 10 staff).',
                  },
                  {
                    id: 'BUSINESS',
                    name: 'Business Plan',
                    price: '$79/mo',
                    desc: 'Multi-branch operations with full analytics & staff management (10 branches, 50 staff).',
                  },
                  {
                    id: 'ENTERPRISE',
                    name: 'Enterprise Plan',
                    price: '$199/mo',
                    desc: 'High-volume restaurant chains with unlimited capacity & dedicated support.',
                  },
                ].map((tier) => (
                  <label
                    key={tier.id}
                    className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      formData.plan === tier.id
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                        : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="plan"
                        value={tier.id}
                        checked={formData.plan === tier.id}
                        onChange={() => updateForm('plan', tier.id)}
                        className="mt-1 text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{tier.name}</span>
                          <span className="text-xs text-amber-400 font-mono font-medium">{tier.price}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{tier.desc}</p>
                      </div>
                    </div>
                    {formData.plan === tier.id && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: EMAIL VERIFICATION */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center py-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-white">Verify Your Email Address</h2>
                <p className="text-xs text-slate-300 mt-1.5 max-w-sm mx-auto">
                  We have dispatched a secure 6-digit verification code to <br />
                  <span className="font-mono font-bold text-amber-400 text-sm">{maskedEmail}</span>
                </p>
              </div>

              <div>
                <label className="block text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value.replace(/[^0-9]/g, ''));
                    setError('');
                  }}
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3.5 bg-slate-800/90 rounded-xl border border-slate-700 text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="••••••"
                  autoFocus
                />
              </div>

              {previewCode && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center space-y-1.5 animate-in fade-in duration-150">
                  <div className="text-[11px] font-semibold text-amber-300">
                    💡 Code: <span className="font-mono font-bold text-amber-400 text-xs tracking-wider">{previewCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationCode(previewCode);
                      setError('');
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Click to auto-fill code
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Code valid for 10 minutes</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isLoading}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 disabled:text-slate-600 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Verification Code'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: ACCOUNT ACTIVATED & CREDENTIALS SUMMARY */}
          {step === 6 && activatedData && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center py-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                  <span>Organization Activated!</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Your restaurant and owner account are ready. Confirmation email with your login details has also been dispatched to your email.
                </p>
              </div>

              {/* Account Credentials Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Credentials</span>
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Credentials</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Restaurant:</span>
                    <span className="font-semibold text-white">{activatedData.restaurantName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Plan:</span>
                    <span className="font-semibold text-emerald-400 uppercase">{activatedData.plan}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Username / Login Email:</span>
                    <span className="font-mono font-bold text-white select-all">{activatedData.email}</span>
                  </div>
                  {activatedData.password && (
                    <div className="col-span-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[11px] block font-semibold mb-1">Your Password:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm select-all tracking-wide">
                        {activatedData.password}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProceedToApp}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading Portal...
                  </>
                ) : (
                  <>
                    <span>Enter Tillora POS & Management Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          {step < 6 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
              {step > 1 && step < 5 ? (
                <button
                  onClick={prevStep}
                  type="button"
                  disabled={isLoading}
                  className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  onClick={nextStep}
                  type="button"
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-7 py-2.5 rounded-xl font-medium transition-colors shadow-sm cursor-pointer"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : step === 4 ? (
                <button
                  onClick={handleInitiateRegistration}
                  type="button"
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-7 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending Code...
                    </>
                  ) : (
                    <>
                      Send Verification Code <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleVerifyAndActivate}
                  type="button"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Activating Restaurant...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" /> Verify Email & Activate Restaurant
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-amber-400 hover:underline font-medium">
                Sign in to POS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
