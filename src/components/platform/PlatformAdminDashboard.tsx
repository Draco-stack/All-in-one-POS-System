import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Lock,
  Eye,
  LogOut,
  Sliders,
  DollarSign,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  FileText,
  GitBranch,
  Tablet,
  KeyRound,
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShoppingCart,
  Store,
  Clock,
  Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { appConfig } from '../../config/appConfig';

interface PlatformOverviewData {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
  };
  infrastructure: {
    totalBranches: number;
    totalUsers: number;
    totalOrders: number;
    totalProcessedVolume: number;
  };
  subscriptions: Array<{
    plan: string;
    status: string;
    _count: { _all: number };
  }>;
  system: {
    nodeVersion: string;
    uptimeSeconds: number;
    memoryUsageMb: number;
    environment: string;
    serverTimestamp: string;
  };
  recentActivity: any[];
}

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED';
  createdAt: string;
  branchCount: number;
  userCount: number;
  orderCount: number;
  customerCount: number;
  menuItemCount: number;
  deviceCount: number;
  subscription: {
    plan: string;
    status: string;
  };
  owner?: {
    name: string;
    username: string;
  };
}

export const PlatformAdminDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tillora_platform_token') || localStorage.getItem('token') || null);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'search' | 'organizations' | 'branches' | 'users' | 'devices' | 'subscriptions' | 'orders' | 'audit' | 'diagnostics'
  >('overview');

  // Auth state
  const [loginUsername, setLoginUsername] = useState('platform_admin');
  const [loginPin, setLoginPin] = useState('9999');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Data state
  const [overview, setOverview] = useState<PlatformOverviewData | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [reminderLogs, setReminderLogs] = useState<any[]>([]);

  // Search Results
  const [searchResults, setSearchResults] = useState<{
    organizations: any[];
    branches: any[];
    users: any[];
    devices: any[];
    orders: any[];
  } | null>(null);

  // Active Support Session state ("View as Restaurant")
  const [activeSupportSession, setActiveSupportSession] = useState<{
    organization: any;
    sessionStartedAt: string;
    adminId: string;
  } | null>(null);

  // Modals state
  const [trialModalOrg, setTrialModalOrg] = useState<any | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(7);
  const [extensionReason, setExtensionReason] = useState<string>('');

  // User modal state (Create / Edit)
  const [userModal, setUserModal] = useState<{
    mode: 'create' | 'edit';
    user?: any;
    isOpen: boolean;
  }>({ mode: 'create', isOpen: false });
  const [userForm, setUserForm] = useState({
    organizationId: '',
    branchId: '',
    name: '',
    username: '',
    pin: '',
    role: 'CASHIER',
    phone: '',
    active: true,
  });

  // Branch modal state (Create / Edit)
  const [branchModal, setBranchModal] = useState<{
    mode: 'create' | 'edit';
    branch?: any;
    isOpen: boolean;
  }>({ mode: 'create', isOpen: false });
  const [branchForm, setBranchForm] = useState({
    organizationId: '',
    name: '',
    slug: '',
    address: '',
    phone: '',
    taxRate: 0,
    printerIp: '',
    printerPort: 9100,
    active: true,
  });

  // Org Edit Modal
  const [editOrgModal, setEditOrgModal] = useState<any | null>(null);
  const [editOrgForm, setEditOrgForm] = useState({ name: '', slug: '' });

  // Password Reset Reveal Modal
  const [passwordResetResult, setPasswordResetResult] = useState<{
    username: string;
    tempPassword: string;
    message: string;
  } | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orgFilter, setOrgFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const formatCurrency = (amt: number) => {
    return `Rs. ${Number(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), pin: loginPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      if (data.token) {
        localStorage.setItem('tillora_platform_token', data.token);
        setToken(data.token);
        setCurrentRole(data.user?.role || '');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tillora_platform_token');
    setToken(null);
    setCurrentRole('');
    setActiveSupportSession(null);
  };

  // Fetch helpers
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (res.status === 401 || res.status === 403) {
      if (res.status === 403) {
        setActionMessage({
          type: 'error',
          text: 'Access Denied: You do not have Platform Executive Admin privileges.',
        });
      }
    }
    return res;
  };

  const loadOverview = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/platform-admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/organizations?limit=100`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgDetail = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/platform-admin/organizations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrg(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadBranches = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/branches?limit=100`;
      if (orgFilter !== 'ALL') url += `&organizationId=${orgFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setBranches(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/users?limit=100`;
      if (orgFilter !== 'ALL') url += `&organizationId=${orgFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/devices?limit=100`;
      if (orgFilter !== 'ALL') url += `&organizationId=${orgFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/platform-admin/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/orders?limit=100`;
      if (orgFilter !== 'ALL') url += `&organizationId=${orgFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `/api/platform-admin/audit-logs?limit=100`;
      if (orgFilter !== 'ALL') url += `&organizationId=${orgFilter}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    if (!token) return;
    try {
      const res = await fetchWithAuth('/api/platform-admin/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const performGlobalSearch = async () => {
    if (!token || !searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/platform-admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Support Mode ("View as Restaurant")
  const handleStartSupportSession = async (org: any) => {
    try {
      const res = await fetchWithAuth('/api/platform-admin/support-session/start', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: org.id,
          reason: `Platform Executive Admin started inspection for organization '${org.name}'`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSupportSession(data.data);
        setActionMessage({
          type: 'success',
          text: `Support session initiated for ${org.name}. Access is actively audited.`,
        });
        loadOrgDetail(org.id);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to start support session' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleEndSupportSession = async () => {
    if (!activeSupportSession) return;
    try {
      await fetchWithAuth('/api/platform-admin/support-session/end', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: activeSupportSession.organization?.id,
          reason: 'Executive admin concluded support session',
        }),
      });
      setActiveSupportSession(null);
      setActionMessage({ type: 'success', text: 'Support session terminated. All logs saved.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Organization Actions
  const handleUpdateOrgStatus = async (orgId: string, newStatus: string) => {
    try {
      const res = await fetchWithAuth(`/api/platform-admin/organizations/${orgId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: 'Platform executive action from admin console' }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Organization status changed to ${newStatus}` });
        loadOrganizations();
        if (selectedOrg && selectedOrg.id === orgId) {
          loadOrgDetail(orgId);
        }
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update status' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSaveOrgDetails = async () => {
    if (!editOrgModal) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/organizations/${editOrgModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editOrgForm),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Organization '${data.data.name}' updated successfully` });
        setEditOrgModal(null);
        loadOrganizations();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update organization' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleExtendTrial = async () => {
    if (!trialModalOrg) return;
    if (!extensionReason.trim()) {
      setActionMessage({ type: 'error', text: 'Explicit administrative reason is strictly required to extend a trial.' });
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/platform-admin/organizations/${trialModalOrg.id}/extend-trial`, {
        method: 'POST',
        body: JSON.stringify({ extensionDays, reason: extensionReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: data.message });
        setTrialModalOrg(null);
        setExtensionReason('');
        loadOrganizations();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to extend trial' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error extending trial' });
    }
  };

  // Branch Actions
  const handleSaveBranch = async () => {
    try {
      if (branchModal.mode === 'create') {
        const res = await fetchWithAuth('/api/platform-admin/branches', {
          method: 'POST',
          body: JSON.stringify(branchForm),
        });
        const data = await res.json();
        if (res.ok) {
          setActionMessage({ type: 'success', text: data.message || 'Branch created' });
          setBranchModal({ mode: 'create', isOpen: false });
          loadBranches();
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to create branch' });
        }
      } else {
        const res = await fetchWithAuth(`/api/platform-admin/branches/${branchModal.branch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(branchForm),
        });
        const data = await res.json();
        if (res.ok) {
          setActionMessage({ type: 'success', text: data.message || 'Branch updated' });
          setBranchModal({ mode: 'edit', isOpen: false });
          loadBranches();
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to update branch' });
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to deactivate or remove this branch?')) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/branches/${branchId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message || 'Branch modified' });
        loadBranches();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to delete branch' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // User Actions
  const handleSaveUser = async () => {
    try {
      if (userModal.mode === 'create') {
        const res = await fetchWithAuth('/api/platform-admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
        const data = await res.json();
        if (res.ok) {
          setActionMessage({ type: 'success', text: data.message || 'User created' });
          setUserModal({ mode: 'create', isOpen: false });
          loadUsers();
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to create user' });
        }
      } else {
        const res = await fetchWithAuth(`/api/platform-admin/users/${userModal.user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: userForm.name,
            role: userForm.role,
            phone: userForm.phone,
            branchId: userForm.branchId || null,
            active: userForm.active,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setActionMessage({ type: 'success', text: data.message || 'User updated' });
          setUserModal({ mode: 'edit', isOpen: false });
          loadUsers();
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to update user' });
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    if (!confirm(`Generate a secure temporary credential for user @${username}? All active sessions will be revoked.`)) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordResetResult({
          username: data.username,
          tempPassword: data.tempPassword,
          message: data.message,
        });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to reset credential' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleRevokeUserSessions = async (userId: string, username: string) => {
    try {
      const res = await fetchWithAuth(`/api/platform-admin/users/${userId}/revoke-sessions`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to revoke sessions' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Permanently remove or deactivate staff account @${username}?`)) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message || 'Account processed' });
        loadUsers();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to delete user' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Device Actions
  const handleRevokeDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Revoke authorization for POS/terminal '${name}'? It will be blocked from accessing the fleet.`)) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/devices/${deviceId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Revoked by Executive Administrator' }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message });
        loadDevices();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to revoke device' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleReactivateDevice = async (deviceId: string) => {
    try {
      const res = await fetchWithAuth(`/api/platform-admin/devices/${deviceId}/reactivate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message });
        loadDevices();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to reactivate device' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleUnpairDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Unpair and remove registration record for '${name}'?`)) return;
    try {
      const res = await fetchWithAuth(`/api/platform-admin/devices/${deviceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message });
        loadDevices();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to unpair device' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleUpdateSubscriptionPlan = async (subId: string, plan: string) => {
    try {
      const res = await fetchWithAuth(`/api/platform-admin/subscriptions/${subId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Subscription plan updated to ${plan}` });
        loadSubscriptions();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update plan' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  useEffect(() => {
    if (token) {
      if (activeTab === 'overview') loadOverview();
      else if (activeTab === 'organizations') loadOrganizations();
      else if (activeTab === 'branches') loadBranches();
      else if (activeTab === 'users') loadUsers();
      else if (activeTab === 'devices') loadDevices();
      else if (activeTab === 'subscriptions') loadSubscriptions();
      else if (activeTab === 'orders') loadOrders();
      else if (activeTab === 'audit') loadAuditLogs();
      else if (activeTab === 'diagnostics') loadHealth();
    }
  }, [token, activeTab, statusFilter, orgFilter]);

  // If not logged in, render executive login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{appConfig.appName} Executive Super-Admin</h1>
              <p className="text-xs text-slate-400">Platform Fleet Governance & Universal Control</p>
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-amber-300 text-xs mb-6">
            <strong>Platform Authority Notice:</strong> This terminal provides complete platform-wide management over all restaurant organizations, branches, staff, devices, and subscriptions. Standard restaurant accounts cannot authenticate here.
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Executive Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="platform_admin"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Executive PIN / Password</label>
              <input
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="••••"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{loginLoading ? 'Authenticating Platform Access...' : 'Enter Executive Control Center'}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
              ← Return to Tillora Website
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Active Support Viewing Mode Banner */}
      {activeSupportSession && (
        <div className="bg-amber-500 text-slate-950 px-6 py-2 flex items-center justify-between text-xs font-semibold shadow-md">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>
              SUPPORT INSPECTION ACTIVE: Currently inspecting organization <strong>{activeSupportSession.organization?.name}</strong> ({activeSupportSession.organization?.slug}). All operations are logged under Executive Super-Admin authority.
            </span>
          </div>
          <button
            onClick={handleEndSupportSession}
            className="bg-slate-950 hover:bg-slate-900 text-amber-400 px-3 py-1 rounded text-xs transition-colors"
          >
            End Support Session
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-sm tracking-tight">{appConfig.appName}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Executive Super-Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Platform-Wide Multi-Tenant Control Center</p>
          </div>
        </div>

        {/* Global notification message */}
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs px-3 py-1.5 rounded-lg border flex items-center space-x-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="hover:opacity-70">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        <div className="flex items-center space-x-3">
          <a
            href="/portal"
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            Customer Portal
          </a>
          <a
            href="/app"
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            Launch POS
          </a>
          <button
            onClick={handleLogout}
            className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-900/40 bg-rose-950/30 hover:bg-rose-900/40 transition-colors flex items-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/30 p-4 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Fleet Intelligence
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'overview'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Platform Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'search'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Global Fleet Search</span>
          </button>

          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mt-4 mb-2">
            Tenant Management
          </div>

          <button
            onClick={() => setActiveTab('organizations')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'organizations'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Organizations</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'branches'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Branches & Outlets</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'users'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff & Accounts</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'devices'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>POS & KDS Terminals</span>
          </button>

          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'subscriptions'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>SaaS Subscriptions</span>
          </button>

          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mt-4 mb-2">
            Operations & Health
          </div>

          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'orders'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Operational Orders Log</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'audit'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Platform Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeTab === 'diagnostics'
                ? 'bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>System Health</span>
          </button>
        </aside>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Platform Fleet Telemetry</h2>
                  <p className="text-xs text-slate-400">Universal aggregate status across all restaurants in the Tillora ecosystem</p>
                </div>
                <button
                  onClick={loadOverview}
                  className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Telemetry</span>
                </button>
              </div>

              {overview && (
                <>
                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                        <span>Total Organizations</span>
                        <Building2 className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{overview.tenants.total}</div>
                      <div className="flex items-center space-x-2 mt-2 text-[11px]">
                        <span className="text-emerald-400">{overview.tenants.active} Active</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-blue-400">{overview.tenants.trial} Trial</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-rose-400">{overview.tenants.suspended} Suspended</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                        <span>Active Branches</span>
                        <Layers className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{overview.infrastructure.totalBranches}</div>
                      <p className="text-[11px] text-slate-500 mt-2">Physical Outlets & Kitchens</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                        <span>Total Processed Volume</span>
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{formatCurrency(overview.infrastructure.totalProcessedVolume)}</div>
                      <p className="text-[11px] text-slate-500 mt-2">{overview.infrastructure.totalOrders} Total Orders</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                        <span>Active Staff Accounts</span>
                        <Users className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{overview.infrastructure.totalUsers}</div>
                      <p className="text-[11px] text-slate-500 mt-2">Platform & Restaurant Staff</p>
                    </div>
                  </div>

                  {/* System Health Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-amber-400" />
                      <span>Runtime Environment Telemetry</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block mb-1">Node Version</span>
                        <span className="font-mono font-medium text-slate-200">{overview.system.nodeVersion}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block mb-1">Process Uptime</span>
                        <span className="font-mono font-medium text-slate-200">{Math.floor(overview.system.uptimeSeconds / 60)} mins</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block mb-1">Heap Memory</span>
                        <span className="font-mono font-medium text-slate-200">{overview.system.memoryUsageMb} MB</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-slate-500 block mb-1">Environment</span>
                        <span className="font-mono font-medium text-emerald-400">{overview.system.environment.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Platform Activity */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>Real-Time Audit Stream</span>
                    </h3>
                    <div className="divide-y divide-slate-800 text-xs">
                      {overview.recentActivity?.map((log: any) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-mono text-amber-400 font-medium mr-2">[{log.action}]</span>
                            <span className="text-slate-300">{log.entity} #{log.entityId}</span>
                          </div>
                          <span className="text-slate-500 text-[11px] font-mono">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. GLOBAL FLEET SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white">Global Platform Search</h2>
                <p className="text-xs text-slate-400">
                  Search instantaneously across all Organizations, Outlets, Staff Accounts, POS Terminals, and Orders.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by restaurant name, slug, staff username, device ID, order number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && performGlobalSearch()}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={performGlobalSearch}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  Search Fleet
                </button>
              </div>

              {searchResults && (
                <div className="space-y-6">
                  {/* Organizations Results */}
                  {searchResults.organizations?.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Organizations ({searchResults.organizations.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.organizations.map((org: any) => (
                          <div key={org.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-white text-sm">{org.name}</div>
                              <div className="text-xs text-slate-500 font-mono">{org.slug} • {org.status}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleStartSupportSession(org)}
                                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs"
                              >
                                Support View
                              </button>
                              <button
                                onClick={() => loadOrgDetail(org.id)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                              >
                                Drilldown
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Branches Results */}
                  {searchResults.branches?.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Branches ({searchResults.branches.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.branches.map((b: any) => (
                          <div key={b.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-white text-sm">{b.name}</div>
                              <div className="text-xs text-slate-500 font-mono">{b.organization?.name} • /{b.slug}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${b.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {b.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users Results */}
                  {searchResults.users?.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Staff Accounts ({searchResults.users.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.users.map((u: any) => (
                          <div key={u.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-white text-sm">{u.name}</div>
                              <div className="text-xs text-slate-500 font-mono">@{u.username} • {u.organization?.name} • {u.role}</div>
                            </div>
                            <button
                              onClick={() => handleResetPassword(u.id, u.username)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs"
                            >
                              Reset Credential
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Devices Results */}
                  {searchResults.devices?.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Devices ({searchResults.devices.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.devices.map((d: any) => (
                          <div key={d.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-white text-sm">{d.name}</div>
                              <div className="text-xs text-slate-500 font-mono">{d.deviceIdentifier} • {d.organization?.name}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${d.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {d.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. ORGANIZATIONS TAB */}
          {activeTab === 'organizations' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Restaurant Organizations</h2>
                  <p className="text-xs text-slate-400">Complete fleet management, status controls, and deep drilldown</p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search tenant name or slug..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadOrganizations()}
                      className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TRIAL">Trial</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>

                  <button
                    onClick={loadOrganizations}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-3 px-4 font-medium">Tenant Organization</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Plan</th>
                        <th className="py-3 px-4 font-medium">Branches</th>
                        <th className="py-3 px-4 font-medium">Staff</th>
                        <th className="py-3 px-4 font-medium">Orders</th>
                        <th className="py-3 px-4 font-medium">Created</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {organizations.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{org.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{org.slug} ({org.id})</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                org.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : org.status === 'TRIAL'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {org.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-amber-400">{org.subscription?.plan}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{org.branchCount}</td>
                          <td className="py-3 px-4 text-slate-300">{org.userCount}</td>
                          <td className="py-3 px-4 text-slate-300">{org.orderCount}</td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(org.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleStartSupportSession(org)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 text-[11px]"
                            >
                              Support View
                            </button>
                            <button
                              onClick={() => {
                                setEditOrgModal(org);
                                setEditOrgForm({ name: org.name, slug: org.slug });
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setTrialModalOrg(org)}
                              className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 rounded border border-amber-900/40 text-[11px]"
                            >
                              Extend Trial
                            </button>
                            <button
                              onClick={() => loadOrgDetail(org.id)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px]"
                            >
                              Drilldown
                            </button>
                            {org.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleUpdateOrgStatus(org.id, 'SUSPENDED')}
                                className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded border border-rose-900/40 text-[11px]"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateOrgStatus(org.id, 'ACTIVE')}
                                className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 rounded border border-emerald-900/40 text-[11px]"
                              >
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. BRANCHES TAB */}
          {activeTab === 'branches' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Multi-Branch Fleet</h2>
                  <p className="text-xs text-slate-400">All restaurant outlets, kitchens, and branches across the platform</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setBranchModal({ mode: 'create', isOpen: true });
                      setBranchForm({
                        organizationId: organizations[0]?.id || '',
                        name: '',
                        slug: '',
                        address: '',
                        phone: '',
                        taxRate: 0,
                        printerIp: '',
                        printerPort: 9100,
                        active: true,
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Branch</span>
                  </button>

                  <button
                    onClick={loadBranches}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Branch Name</th>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Slug</th>
                      <th className="py-3 px-4 font-medium">Phone / Address</th>
                      <th className="py-3 px-4 font-medium">Fleet Metrics</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {branches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{b.name}</td>
                        <td className="py-3 px-4 text-slate-300">{b.organization?.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">/{b.slug}</td>
                        <td className="py-3 px-4 text-slate-400">
                          <div>{b.phone || '-'}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{b.address || '-'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <span className="text-slate-200 font-mono font-medium">{b._count?.users || 0}</span> staff •{' '}
                          <span className="text-slate-200 font-mono font-medium">{b._count?.devices || 0}</span> devices •{' '}
                          <span className="text-slate-200 font-mono font-medium">{b._count?.orders || 0}</span> orders
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {b.active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setBranchModal({ mode: 'edit', branch: b, isOpen: true });
                              setBranchForm({
                                organizationId: b.organizationId,
                                name: b.name,
                                slug: b.slug,
                                address: b.address || '',
                                phone: b.phone || '',
                                taxRate: b.taxRate || 0,
                                printerIp: b.printerIp || '',
                                printerPort: b.printerPort || 9100,
                                active: b.active,
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 rounded text-xs"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. USERS & STAFF TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Staff Accounts & Permissions</h2>
                  <p className="text-xs text-slate-400">All user accounts across all restaurant organizations and branches</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setUserModal({ mode: 'create', isOpen: true });
                      setUserForm({
                        organizationId: organizations[0]?.id || '',
                        branchId: '',
                        name: '',
                        username: '',
                        pin: '',
                        role: 'CASHIER',
                        phone: '',
                        active: true,
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>

                  <button
                    onClick={loadUsers}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">User Name</th>
                      <th className="py-3 px-4 font-medium">Username</th>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium">Role</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">@{u.username}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {u.organization ? u.organization.name : 'Platform Scope'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {u.branch ? u.branch.name : 'All Branches'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-amber-400 font-semibold">{u.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {u.active ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleResetPassword(u.id, u.username)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleRevokeUserSessions(u.id, u.username)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Revoke Sessions
                          </button>
                          <button
                            onClick={() => {
                              setUserModal({ mode: 'edit', user: u, isOpen: true });
                              setUserForm({
                                organizationId: u.organizationId || '',
                                branchId: u.branchId || '',
                                name: u.name,
                                username: u.username,
                                pin: '',
                                role: u.role,
                                phone: u.phone || '',
                                active: u.active,
                              });
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 rounded text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. POS & KDS DEVICES TAB */}
          {activeTab === 'devices' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">POS Terminals & Connected Devices</h2>
                  <p className="text-xs text-slate-400">All registered counters, tablets, kitchen displays, and customer screens</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadDevices}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Device Name</th>
                      <th className="py-3 px-4 font-medium">Identifier</th>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium">Device Type</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {devices.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{d.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{d.deviceIdentifier}</td>
                        <td className="py-3 px-4 text-slate-300">{d.organization?.name}</td>
                        <td className="py-3 px-4 text-slate-400">{d.branch ? d.branch.name : 'Unassigned'}</td>
                        <td className="py-3 px-4 font-mono text-amber-400">{d.deviceType}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {d.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleRevokeDevice(d.id, d.name)}
                              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 rounded text-xs"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateDevice(d.id)}
                              className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/40 rounded text-xs"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => handleUnpairDevice(d.id, d.name)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Unpair
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. SUBSCRIPTIONS TAB */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">SaaS Subscriptions & Billing Tiers</h2>
                  <p className="text-xs text-slate-400">Manage customer subscription tiers & entitlements</p>
                </div>
                <button
                  onClick={loadSubscriptions}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Subscription ID</th>
                      <th className="py-3 px-4 font-medium">Current Plan</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Change Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          {sub.organization?.name || sub.organizationId}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{sub.id}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-amber-400">{sub.plan}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {['STARTER', 'BUSINESS', 'ENTERPRISE'].map((tier) => (
                            <button
                              key={tier}
                              disabled={sub.plan === tier}
                              onClick={() => handleUpdateSubscriptionPlan(sub.id, tier)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                                sub.plan === tier
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 opacity-50 cursor-default'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. OPERATIONAL ORDERS LOG TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Operational Sales & Orders Log</h2>
                  <p className="text-xs text-slate-400">Read-only platform support visibility for diagnosing customer transactions</p>
                </div>
                <button
                  onClick={loadOrders}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Orders</span>
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Order #</th>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium">Amount</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Payment</th>
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-white">#{o.orderNumber}</td>
                        <td className="py-3 px-4 text-slate-300">{o.organization?.name}</td>
                        <td className="py-3 px-4 text-slate-400">{o.branch?.name}</td>
                        <td className="py-3 px-4 font-mono text-amber-400 font-semibold">{formatCurrency(o.total || o.totalAmount)}</td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{o.paymentMethod}</td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                          {new Date(o.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. AUDIT TRAIL TAB */}
          {activeTab === 'audit' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Global Platform Audit Trail</h2>
                  <p className="text-xs text-slate-400">Immutable security and operational event log stream</p>
                </div>
                <button
                  onClick={loadAuditLogs}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Entity</th>
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">User</th>
                      <th className="py-3 px-4 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-bold">{log.action}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {log.entity} #{log.entityId}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-sans">
                          {log.organization?.name || log.organizationId || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-sans">
                          {log.user?.username ? `@${log.user.username}` : log.userId}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">{log.ipAddress || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10. DIAGNOSTICS & HEALTH TAB */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">System Diagnostics & DB Pool</h2>
                  <p className="text-xs text-slate-400">Database connectivity and container health monitoring</p>
                </div>
                <button
                  onClick={loadHealth}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Run Diagnostics</span>
                </button>
              </div>

              {healthData && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white text-base">Database & Service State: {healthData.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-1">Prisma DB Latency</span>
                      <span className="text-xl font-mono font-bold text-emerald-400">
                        {healthData.database?.latencyMs} ms
                      </span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-1">Server Process Uptime</span>
                      <span className="text-xl font-mono font-bold text-blue-400">
                        {healthData.system?.uptime} seconds
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
                    <div className="text-slate-400 mb-2 font-semibold">Memory Profiling:</div>
                    <pre className="text-slate-300 overflow-x-auto">
                      {JSON.stringify(healthData.system?.memoryUsage, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Controlled Trial Extension Modal */}
      <AnimatePresence>
        {trialModalOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">Controlled Trial Extension</h3>
                </div>
                <button
                  onClick={() => setTrialModalOrg(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div>
                <div className="text-xs text-slate-400">Target Organization:</div>
                <div className="text-sm font-bold text-white mt-0.5">{trialModalOrg.name} ({trialModalOrg.slug})</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Extension Duration (Days):
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(parseInt(e.target.value, 10) || 7)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Administrative Reason (Mandatory for Audit Trail):
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="e.g. Granted 7-day pilot extension for restaurant onboarding..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setTrialModalOrg(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendTrial}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow"
                >
                  Confirm & Extend Trial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Create / Edit Modal */}
      <AnimatePresence>
        {userModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">
                  {userModal.mode === 'create' ? 'Create Staff / User Account' : 'Edit Staff Account'}
                </h3>
                <button onClick={() => setUserModal({ ...userModal, isOpen: false })}>
                  <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {userModal.mode === 'create' && (
                  <div>
                    <label className="text-slate-400 block mb-1">Organization</label>
                    <select
                      value={userForm.organizationId}
                      onChange={(e) => setUserForm({ ...userForm, organizationId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    placeholder="Jane Doe"
                  />
                </div>

                {userModal.mode === 'create' && (
                  <div>
                    <label className="text-slate-400 block mb-1">Username</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      placeholder="janedoe"
                    />
                  </div>
                )}

                {userModal.mode === 'create' && (
                  <div>
                    <label className="text-slate-400 block mb-1">Initial PIN / Password</label>
                    <input
                      type="password"
                      value={userForm.pin}
                      onChange={(e) => setUserForm({ ...userForm, pin: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      placeholder="••••"
                    />
                  </div>
                )}

                <div>
                  <label className="text-slate-400 block mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="CASHIER">CASHIER</option>
                    <option value="SERVER">SERVER</option>
                    <option value="RIDER">RIDER</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setUserModal({ ...userModal, isOpen: false })}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Save User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branch Create / Edit Modal */}
      <AnimatePresence>
        {branchModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">
                  {branchModal.mode === 'create' ? 'Create Outlet / Branch' : 'Edit Branch'}
                </h3>
                <button onClick={() => setBranchModal({ ...branchModal, isOpen: false })}>
                  <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {branchModal.mode === 'create' && (
                  <div>
                    <label className="text-slate-400 block mb-1">Organization</label>
                    <select
                      value={branchForm.organizationId}
                      onChange={(e) => setBranchForm({ ...branchForm, organizationId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-slate-400 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    placeholder="DHA Phase 5 Outlet"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Branch Slug</label>
                  <input
                    type="text"
                    value={branchForm.slug}
                    onChange={(e) => setBranchForm({ ...branchForm, slug: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                    placeholder="dha-phase-5"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Address</label>
                  <input
                    type="text"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    placeholder="Plot 12-C, 5th Commercial Lane..."
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    placeholder="+92 21 35890000"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setBranchModal({ ...branchModal, isOpen: false })}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBranch}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Save Branch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Organization Modal */}
      <AnimatePresence>
        {editOrgModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Edit Organization Details</h3>
                <button onClick={() => setEditOrgModal(null)}>
                  <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={editOrgForm.name}
                    onChange={(e) => setEditOrgForm({ ...editOrgForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Organization Slug (URL identifier)</label>
                  <input
                    type="text"
                    value={editOrgForm.slug}
                    onChange={(e) => setEditOrgForm({ ...editOrgForm, slug: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setEditOrgModal(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOrgDetails}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Save Organization
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Organization Drilldown Modal */}
      <AnimatePresence>
        {selectedOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-white">{selectedOrg.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                      {selectedOrg.slug}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">ID: {selectedOrg.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrg(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 text-xs">
                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Total Revenue</span>
                    <span className="text-base font-bold text-white">
                      {formatCurrency(selectedOrg.stats?.totalRevenue)}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Completed Orders</span>
                    <span className="text-base font-bold text-white">
                      {selectedOrg.stats?.completedOrders}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Current Status</span>
                    <span className="text-base font-bold text-amber-400">
                      {selectedOrg.status}
                    </span>
                  </div>
                </div>

                {/* Branches */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Branches ({selectedOrg.branches?.length})</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800">
                    {selectedOrg.branches?.map((b: any) => (
                      <div key={b.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-200">{b.name}</span>
                          <span className="text-[11px] text-slate-500 ml-2 font-mono">({b.slug})</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Users / Staff Accounts ({selectedOrg.users?.length})</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800 max-h-48 overflow-y-auto">
                    {selectedOrg.users?.map((u: any) => (
                      <div key={u.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-200">{u.name}</span>
                          <span className="text-[11px] text-slate-500 ml-2 font-mono">@{u.username}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">
                            {u.role}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {u.active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Temporary Password Display Modal */}
      <AnimatePresence>
        {passwordResetResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-amber-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <KeyRound className="w-6 h-6" />
                <h3 className="font-bold text-white text-base">Temporary Credential Generated</h3>
              </div>

              <p className="text-xs text-slate-300">
                A new secure credential has been generated for staff user <strong className="text-white">@{passwordResetResult.username}</strong>. All prior active sessions have been invalidated.
              </p>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-xs text-slate-500 block mb-1">Temporary Security Code / PIN</span>
                <span className="text-2xl font-mono font-bold text-amber-400 tracking-wider">
                  {passwordResetResult.tempPassword}
                </span>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px]">
                <strong>Security Notice:</strong> This code will only be displayed once and is never stored in plaintext or audit logs. Please communicate this directly to the verified restaurant owner or staff member.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setPasswordResetResult(null)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  I Have Recorded This Credential
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
