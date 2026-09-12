import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Store,
  ChefHat,
  Monitor,
  Sparkles,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Logo } from '../common/Logo';

interface LoginSuccessResponse {
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
    organizationId?: string;
    branchId?: string;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  branch?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export const WebsiteLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Form input state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  // Staff role notification state (when non-management role signs in)
  const [staffRoleNotice, setStaffRoleNotice] = useState<{
    name: string;
    role: string;
    token: string;
  } | null>(null);

  // Demo helpers visibility
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Check for expired session query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === '1' || params.get('reason') === 'session_expired') {
      setSessionExpiredNotice(true);
    }
  }, [location.search]);

  // Handle direct sign-in submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameOrEmail.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage('Please enter your business email or username.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter your password or access PIN.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorCode(null);
    setStaffRoleNotice(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          email: cleanUser,
          pin: cleanPass,
          password: cleanPass,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          setErrorCode('ACCOUNT_LOCKED');
          setErrorMessage(data.error || 'Too many failed login attempts. Please wait 5 minutes before trying again.');
        } else if (response.status === 403) {
          setErrorCode('ACCOUNT_BLOCKED');
          setErrorMessage(data.error || 'Your restaurant organization account is suspended or inactive. Please contact support.');
        } else if (response.status === 401) {
          setErrorCode('INVALID_CREDENTIALS');
          setErrorMessage('Invalid username/email or password. Please verify your credentials.');
        } else {
          setErrorCode('SERVER_ERROR');
          setErrorMessage(data.error || 'An unexpected error occurred during authentication. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      const authData = data as LoginSuccessResponse;
      const userRole = (authData.user?.role || '').toUpperCase();
      const token = authData.token;

      // Handle server-authoritative role redirection
      if (userRole === 'PLATFORM_ADMIN' || userRole === 'EXECUTIVE_ADMIN') {
        // Platform executive administrator
        if (rememberMe) {
          localStorage.setItem('tillora_platform_token', token);
          localStorage.setItem('tillora_token', token);
          localStorage.setItem('token', token);
        } else {
          sessionStorage.setItem('tillora_platform_token', token);
          sessionStorage.setItem('tillora_token', token);
          sessionStorage.setItem('token', token);
          localStorage.setItem('tillora_platform_token', token);
          localStorage.setItem('tillora_token', token);
        }
        navigate('/platform-admin');
      } else if (['OWNER', 'ADMIN', 'MANAGER'].includes(userRole)) {
        // Restaurant owner, business administrator, or general manager
        if (rememberMe) {
          localStorage.setItem('tillora_token', token);
          localStorage.setItem('token', token);
        } else {
          sessionStorage.setItem('tillora_token', token);
          sessionStorage.setItem('token', token);
          localStorage.setItem('tillora_token', token);
        }
        navigate('/portal');
      } else {
        // Non-administrative operational roles (Cashier, Server, Rider, Kitchen staff)
        // Store POS tokens so they can directly switch to POS terminal without re-authenticating
        localStorage.setItem('pos_jwt_token_v5', token);
        localStorage.setItem('pos_token', token);
        
        setStaffRoleNotice({
          name: authData.user?.name || cleanUser,
          role: authData.user?.role || 'Operational Staff',
          token,
        });
      }
    } catch (err: any) {
      console.error('[WebsiteLogin] Network or execution error:', err);
      setErrorCode('NETWORK_ERROR');
      setErrorMessage('Unable to connect to the authentication server. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAccount = (username: string, pass: string) => {
    setUsernameOrEmail(username);
    setPassword(pass);
    setErrorMessage(null);
    setErrorCode(null);
    setStaffRoleNotice(null);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Top Website Header */}
      <header className="border-b border-white/5 bg-stone-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition">
            <Logo />
            <span className="hidden sm:inline-block text-xs font-semibold text-stone-400 border-l border-stone-800 pl-3">
              Business Portal
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/app"
              id="header-nav-launch-pos"
              className="text-xs font-bold text-stone-400 hover:text-amber-400 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Launch POS Station</span>
            </Link>
            <Link
              to="/"
              className="text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors py-1.5 px-3"
            >
              Back to Website
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Canvas */}
      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Main Login Card */}
          <div className="bg-stone-900/90 border border-stone-800/80 rounded-2xl shadow-2xl p-8 backdrop-blur-xl">
            {/* Card Header */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide mb-4">
                <Store className="w-3.5 h-3.5" />
                <span>Management Dashboard</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Sign In to Tillora
              </h1>
              <p className="text-sm text-stone-400 leading-relaxed">
                The Operating System for Your Restaurant. Manage menus, analytics, billing, and team permissions.
              </p>
            </div>

            {/* Session Expired Notice */}
            {sessionExpiredNotice && !errorMessage && (
              <div className="mb-5 bg-amber-950/40 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Your previous session has expired. Please sign in again to access your dashboard.</span>
              </div>
            )}

            {/* Error Message Alert Banner */}
            {errorMessage && (
              <div
                id="login-error-banner"
                role="alert"
                className="mb-5 bg-red-950/40 border border-red-500/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-red-200"
              >
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-300">Authentication Failed</div>
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Staff Role Notice Card (When Cashier/Server signs in to website dashboard) */}
            {staffRoleNotice && (
              <div
                id="staff-role-notice-card"
                className="mb-6 bg-gradient-to-b from-stone-800 to-stone-850 border border-amber-500/40 rounded-xl p-4 shadow-lg text-left"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                  <Monitor className="w-4 h-4" />
                  <span>Terminal Operator Account Detected</span>
                </div>
                <p className="text-xs text-stone-300 mb-4 leading-relaxed">
                  Welcome, <strong>{staffRoleNotice.name}</strong>. Your account role (
                  <span className="font-mono text-amber-400 uppercase">{staffRoleNotice.role}</span>
                  ) is authorized exclusively for the in-store POS terminal station.
                </p>
                <div className="flex flex-col gap-2">
                  <Link
                    to="/app"
                    id="btn-launch-pos-from-notice"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <span>Launch POS Workstation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStaffRoleNotice(null)}
                    className="text-stone-400 hover:text-stone-200 text-xs py-1 text-center"
                  >
                    Sign in with a different account
                  </button>
                </div>
              </div>
            )}

            {/* Main Form */}
            {!staffRoleNotice && (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Username or Email Input */}
                <div>
                  <label
                    htmlFor="website-login-username"
                    className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5"
                  >
                    Email or Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="website-login-username"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      disabled={isSubmitting}
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="e.g. admin or owner@restaurant.com"
                      className="w-full bg-stone-950 border border-stone-700/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-stone-100 text-sm rounded-xl pl-10 pr-4 py-2.5 transition placeholder:text-stone-500 disabled:opacity-50"
                      required
                    />
                  </div>
                </div>

                {/* Password / Access Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="website-login-password"
                      className="block text-xs font-semibold text-stone-300 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => alert('To reset your restaurant administrator credentials, please contact your organization owner or email support@tillora.com.')}
                      className="text-xs text-amber-400 hover:text-amber-300 transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="website-login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-stone-950 border border-stone-700/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-stone-100 text-sm rounded-xl pl-10 pr-10 py-2.5 transition placeholder:text-stone-500 disabled:opacity-50 font-mono"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-200 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="website-login-remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-700 bg-stone-950 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
                    />
                    <span className="text-xs text-stone-400">Keep me signed in for 30 days</span>
                  </label>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    id="website-login-submit-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-black py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                        <span>Verifying Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Dashboard</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Quick Helper for POS Terminal */}
            <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Looking for the POS terminal?</span>
                <Link
                  to="/app"
                  id="link-launch-pos-terminal"
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
                >
                  <span>Launch POS Station</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Don't have a Tillora account?</span>
                <Link
                  to="/get-started"
                  id="link-start-trial"
                  className="text-stone-200 hover:text-white font-semibold transition underline underline-offset-4"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>

            {/* One-Click Demo Credentials Accordion */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="w-full flex items-center justify-between text-xs font-semibold text-stone-400 hover:text-stone-300 py-1 transition"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Test Credentials (Evaluation Mode)</span>
                </div>
                <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">
                  {showDemoAccounts ? 'Hide' : 'Show'}
                </span>
              </button>

              <AnimatePresence>
                {showDemoAccounts && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-3 space-y-2"
                  >
                    <div className="text-[11px] text-stone-400 mb-2">
                      Click any role below to pre-fill test credentials:
                    </div>

                    <button
                      type="button"
                      id="btn-demo-owner"
                      onClick={() => fillDemoAccount('admin', '1234')}
                      className="w-full text-left bg-stone-950/80 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 p-2.5 rounded-lg transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                          <span>Restaurant Owner / Admin</span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                            Full Portal Access
                          </span>
                        </div>
                        <div className="text-stone-400 font-mono text-[11px]">User: admin • Pass: 1234</div>
                      </div>
                      <span className="text-[11px] text-amber-400 font-semibold">Fill →</span>
                    </button>

                    <button
                      type="button"
                      id="btn-demo-platform-admin"
                      onClick={() => fillDemoAccount('platform_admin', '9999')}
                      className="w-full text-left bg-stone-950/80 hover:bg-stone-800/80 border border-stone-800 hover:border-sky-500/50 p-2.5 rounded-lg transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                          <span>Executive Platform Admin</span>
                          <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-mono">
                            Control Plane
                          </span>
                        </div>
                        <div className="text-stone-400 font-mono text-[11px]">User: platform_admin • Pass: 9999</div>
                      </div>
                      <span className="text-[11px] text-sky-400 font-semibold">Fill →</span>
                    </button>

                    <button
                      type="button"
                      id="btn-demo-cashier"
                      onClick={() => fillDemoAccount('cashier', '3333')}
                      className="w-full text-left bg-stone-950/80 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-600 p-2.5 rounded-lg transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                          <span>POS Cashier (Operational)</span>
                          <span className="text-[9px] bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded font-mono">
                            Terminal Only
                          </span>
                        </div>
                        <div className="text-stone-400 font-mono text-[11px]">User: cashier • Pass: 3333</div>
                      </div>
                      <span className="text-[11px] text-stone-400 font-semibold">Fill →</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Security Assurance Footer */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-stone-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>256-Bit Encrypted Sessions</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Multi-Tenant Isolated</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WebsiteLoginPage;
