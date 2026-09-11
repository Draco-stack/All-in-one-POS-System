import React, { useState, useEffect } from 'react';
import {
  Building2,
  CreditCard,
  Users,
  HardDrive,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LogOut,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Store,
  ChevronRight,
  Zap,
  Mail,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

interface PortalData {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    trialUsedAt?: string | null;
    settings?: string;
    createdAt: string;
  };
  subscription: {
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate?: string | null;
    trialEndsAt?: string | null;
    daysRemaining: number | null;
    showCriticalWarning: boolean;
    isExpired: boolean;
  } | null;
  counts: {
    branches: number;
    staff: number;
    devices: number;
    orders: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    user?: { name: string; role: string };
  }>;
}

interface TeamMember {
  id: string;
  name: string;
  username: string;
  role: string;
  phone?: string;
  active: boolean;
  branch?: { name: string };
}

interface Device {
  id: string;
  deviceName: string;
  deviceType: string;
  status: string;
  ipAddress?: string;
  branch?: { name: string };
}

interface Session {
  id: string;
  ipAddress: string;
  deviceInfo: string;
  lastUsedAt: string;
  user: { name: string; role: string; username: string };
}

export function CustomerPortalDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'restaurant' | 'team' | 'devices' | 'security'>('overview');
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  const token = localStorage.getItem('tillora_token') || localStorage.getItem('token') || '';

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPortalData(json.data);
      } else {
        setError(json.error || 'Failed to fetch customer portal overview');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching customer portal');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/portal/team', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.success) setTeamMembers(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/portal/devices', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.success) setDevices(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/portal/sessions', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.success) setSessions(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'team') fetchTeam();
    if (activeTab === 'devices') fetchDevices();
    if (activeTab === 'security') fetchSessions();
  }, [activeTab]);

  const handleUpgradePlan = async (planName: string) => {
    setUpgradingPlan(planName);
    setUpgradeSuccess(null);
    try {
      const res = await fetch('/api/portal/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planName }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUpgradeSuccess(`Successfully upgraded subscription to ${planName}!`);
        await fetchPortalData();
      } else {
        alert(json.error || 'Upgrade failed');
      }
    } catch (err: any) {
      alert(err.message || 'Network error during upgrade');
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/portal/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tillora_token');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  if (loading && !portalData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-sky-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Loading Tillora Customer Portal...</span>
        </div>
      </div>
    );
  }

  const sub = portalData?.subscription;
  const org = portalData?.organization;
  const counts = portalData?.counts;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Critical Expiration Alert Header */}
      {sub?.showCriticalWarning && (
        <div className="bg-amber-600 text-white px-6 py-3 font-medium flex items-center justify-between border-b border-amber-500 shadow-md">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-200 animate-bounce" />
            <span>
              <strong>SUBSCRIPTION EXPIRING SOON:</strong> Your Tillora {sub.plan} plan has only{' '}
              <strong>{sub.daysRemaining} {sub.daysRemaining === 1 ? 'day' : 'days'} remaining</strong>!
            </span>
          </div>
          <button
            onClick={() => setActiveTab('subscription')}
            className="bg-white text-amber-900 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-50 transition shadow"
          >
            Renew / Upgrade Now →
          </button>
        </div>
      )}

      {/* Top Application Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow">
              T
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Tillora</span>
          </div>
          <span className="text-slate-600 text-xl font-light">|</span>
          <span className="text-slate-300 text-sm font-medium bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
            Customer Portal
          </span>
          {org && (
            <span className="text-slate-400 text-xs font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              {org.name} ({org.slug})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {sub && (
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                sub.status === 'TRIALING'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {sub.plan} • {sub.status} {sub.daysRemaining !== null ? `(${sub.daysRemaining}d)` : ''}
              </span>
            </div>
          )}

          <a
            href="/app"
            className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 shadow transition"
          >
            <span>Open POS Terminal</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Portal Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 space-x-6">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col space-y-1 self-start">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Restaurant Management
          </div>
          {[
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard, badge: sub?.showCriticalWarning ? '!' : null },
            { id: 'restaurant', label: 'Restaurant Settings', icon: Store },
            { id: 'team', label: 'Team Directory', icon: Users },
            { id: 'devices', label: 'Hardware & POS Terminals', icon: HardDrive },
            { id: 'security', label: 'Security & Sessions', icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-xs animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 p-4 rounded-xl mb-6 flex items-center space-x-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {upgradeSuccess && (
            <div className="bg-emerald-900/30 border border-emerald-700/50 text-emerald-200 p-4 rounded-xl mb-6 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{upgradeSuccess}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Welcome, {org?.name}</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Manage your multi-tenant restaurant operations, subscriptions, and POS devices from your dedicated Customer Portal.
                </p>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                    <span>Subscription Plan</span>
                    <Sparkles className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-2">{sub?.plan || 'STARTER'}</div>
                  <div className="text-xs text-sky-400 mt-1 flex items-center space-x-1">
                    <span>{sub?.status}</span>
                    {sub?.daysRemaining !== null && <span>• {sub?.daysRemaining} days left</span>}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                    <span>Active Branches</span>
                    <Building2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-2">{counts?.branches || 1}</div>
                  <div className="text-xs text-slate-500 mt-1">Multi-location enabled</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                    <span>Team Members</span>
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-2">{counts?.staff || 1}</div>
                  <div className="text-xs text-slate-500 mt-1">Role-based POS access</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                    <span>POS & KDS Devices</span>
                    <HardDrive className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-2">{counts?.devices || 0}</div>
                  <div className="text-xs text-slate-500 mt-1">Hardware paired</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-800/30 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Ready to serve customers?</h3>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Launch the POS terminal directly or assign new staff members to register shifts.
                  </p>
                </div>
                <a
                  href="/app"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center space-x-2 shadow transition"
                >
                  <span>Launch Tillora POS</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Recent Activity Log */}
              <div>
                <h3 className="font-bold text-white text-base mb-3">Recent Account & Security Activity</h3>
                <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden">
                  {portalData?.recentActivity && portalData.recentActivity.length > 0 ? (
                    portalData.recentActivity.map((log) => (
                      <div key={log.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-sky-400"></div>
                          <span className="font-mono text-slate-300 font-medium">{log.action}</span>
                          <span className="text-slate-500">by {log.user?.name || 'System'}</span>
                        </div>
                        <span className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-500 text-sm">No recent activity logged.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTION & BILLING */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Subscription & Plan Management</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Server-authoritative entitlement status, 14-day trial details, and plan upgrades.
                </p>
              </div>

              {/* Current Subscription Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Current Entitlement
                    </span>
                    <h3 className="text-3xl font-black text-white mt-1 flex items-center space-x-3">
                      <span>{sub?.plan || 'STARTER'} PLAN</span>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                          sub?.status === 'TRIALING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {sub?.status}
                      </span>
                    </h3>
                  </div>

                  {sub?.trialEndsAt && (
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-right">
                      <div className="text-slate-400 text-xs font-medium">Trial Expiration</div>
                      <div className="text-white font-bold text-lg mt-0.5">
                        {new Date(sub.trialEndsAt).toLocaleDateString()}
                      </div>
                      <div className="text-amber-400 text-xs font-semibold mt-1">
                        {sub.daysRemaining} days remaining
                      </div>
                    </div>
                  )}
                </div>

                {org?.trialUsedAt && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center text-xs text-slate-400 space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    <span>
                      One-time 14-Day Trial recorded on {new Date(org.trialUsedAt).toLocaleDateString()}. Re-registering does not grant duplicate trials.
                    </span>
                  </div>
                )}
              </div>

              {/* Available Plans for Upgrade */}
              <div>
                <h3 className="font-bold text-white text-lg mb-4">Available Enterprise Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { name: 'STARTER', price: '$29', period: '/month', branches: '2 Branches', staff: 'Up to 10 Staff', devices: '5 Terminals', recommended: false },
                    { name: 'BUSINESS', price: '$79', period: '/month', branches: 'Up to 10 Branches', staff: 'Up to 50 Staff', devices: '20 Terminals', recommended: true },
                    { name: 'ENTERPRISE', price: '$199', period: '/month', branches: 'Unlimited Branches', staff: 'Unlimited Staff', devices: 'Unlimited Terminals', recommended: false },
                  ].map((plan) => (
                    <div
                      key={plan.name}
                      className={`bg-slate-900 rounded-xl p-6 border flex flex-col justify-between relative ${
                        plan.recommended ? 'border-sky-500/60 shadow-lg shadow-sky-950/50' : 'border-slate-800'
                      }`}
                    >
                      {plan.recommended && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow">
                          Most Popular
                        </span>
                      )}
                      <div>
                        <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                        <div className="mt-3 flex items-baseline text-white">
                          <span className="text-3xl font-extrabold">{plan.price}</span>
                          <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
                        </div>
                        <ul className="mt-6 space-y-3 text-sm text-slate-300">
                          <li className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-sky-400" />
                            <span>{plan.branches}</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-sky-400" />
                            <span>{plan.staff}</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-sky-400" />
                            <span>{plan.devices}</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-sky-400" />
                            <span>Full KDS & Thermal Print Bridge</span>
                          </li>
                        </ul>
                      </div>

                      <button
                        onClick={() => handleUpgradePlan(plan.name)}
                        disabled={upgradingPlan === plan.name || sub?.plan === plan.name}
                        className={`mt-8 w-full py-2.5 rounded-lg text-sm font-semibold transition ${
                          sub?.plan === plan.name
                            ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            : plan.recommended
                            ? 'bg-sky-600 hover:bg-sky-500 text-white shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-white'
                        }`}
                      >
                        {upgradingPlan === plan.name
                          ? 'Upgrading...'
                          : sub?.plan === plan.name
                          ? 'Current Active Plan'
                          : `Upgrade to ${plan.name}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESTAURANT SETTINGS */}
          {activeTab === 'restaurant' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Restaurant Business Profile</h2>
                <p className="text-slate-400 text-sm mt-1">
                  View and manage business settings for {org?.name}.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Restaurant Name</label>
                    <input
                      type="text"
                      readOnly
                      value={org?.name || ''}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Organization Slug</label>
                    <input
                      type="text"
                      readOnly
                      value={org?.slug || ''}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-slate-400 text-sm mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Account Status</label>
                    <input
                      type="text"
                      readOnly
                      value={org?.status || ''}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-emerald-400 font-bold text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Account Created</label>
                    <input
                      type="text"
                      readOnly
                      value={org ? new Date(org.createdAt).toLocaleDateString() : ''}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-slate-400 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEAM DIRECTORY */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Staff & Team Directory</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Users with authorized access to your restaurant's POS system.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Username / Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {teamMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-white">{m.name}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{m.username}</td>
                        <td className="px-4 py-3">
                          <span className="bg-sky-950 text-sky-400 border border-sky-800 px-2.5 py-0.5 rounded text-xs font-bold uppercase">
                            {m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{m.branch?.name || 'Main Branch'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              m.active ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                            }`}
                          >
                            {m.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HARDWARE DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Registered POS & KDS Terminals</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Paired hardware terminals operating inside your restaurant branches.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {devices.length > 0 ? (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Device Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">IP Address</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {devices.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-3 font-semibold text-white">{d.deviceName}</td>
                          <td className="px-4 py-3 text-slate-400">{d.deviceType}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{d.ipAddress || 'DHCP'}</td>
                          <td className="px-4 py-3 text-slate-400">{d.branch?.name || 'Main Branch'}</td>
                          <td className="px-4 py-3">
                            <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold">
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No hardware POS terminals or KDS displays currently registered.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SECURITY & SESSIONS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Active Security Sessions</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Active login sessions across all POS terminals and web interfaces.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                {sessions.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{s.user?.name} ({s.user?.role})</div>
                      <div className="text-slate-500 text-xs font-mono mt-0.5">
                        IP: {s.ipAddress} • {s.deviceInfo}
                      </div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        Last Active: {new Date(s.lastUsedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      Revoke Session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
