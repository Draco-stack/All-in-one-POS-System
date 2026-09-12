import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  RefreshCw,
  Lock,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  Eye,
  Check,
  X,
  AlertCircle,
  Sliders,
  PlusCircle,
  MinusCircle,
  FileCheck,
  UserCheck
} from 'lucide-react';
import { getAuthToken } from '../../utils/apiConfig';

export interface FinancialApprovalItem {
  id: string;
  type: 'CASH_ADJUSTMENT' | 'CASH_AUDIT' | 'DISCOUNT_OVERRIDE' | 'REFUND_APPROVAL' | 'VARIANCE_RESOLUTION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  requesterId: string;
  approverId?: string | null;
  amount: number;
  reason: string;
  reasonCode?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  rejectionReason?: string | null;
  metadata?: string | null;
  createdAt: string;
  processedAt?: string | null;
  requester?: { id: string; name: string; username: string; role: string };
  approver?: { id: string; name: string; username: string; role: string };
  branch?: { id: string; name: string };
  shift?: { id: string; shiftNumber: string; cashierName: string };
}

export interface CashMovementItem {
  id: string;
  shiftId?: string | null;
  movementType: string;
  amount: number;
  direction: string;
  reason: string;
  reasonCode?: string | null;
  performedById: string;
  approvalId?: string | null;
  createdAt: string;
  performedBy?: { id: string; name: string; username: string; role: string };
  approval?: { id: string; status: string; approverId?: string | null };
}

export interface CashAuditItem {
  id: string;
  shiftId: string;
  conductedById: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  varianceClassification: 'WITHIN_TOLERANCE' | 'REQUIRES_REVIEW' | 'MATERIAL_VARIANCE';
  reason?: string | null;
  reasonCode?: string | null;
  approvalId?: string | null;
  notes?: string | null;
  createdAt: string;
  conductedBy?: { id: string; name: string; username: string; role: string };
  approval?: { id: string; status: string };
}

interface FinancialControlsCenterProps {
  currentUserId?: string;
  currentUserRole?: string;
  onApprovalCountChange?: (count: number) => void;
}

export function FinancialControlsCenter({
  currentUserId,
  currentUserRole,
  onApprovalCountChange,
}: FinancialControlsCenterProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'movements' | 'audits'>('approvals');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  
  const [approvals, setApprovals] = useState<FinancialApprovalItem[]>([]);
  const [movements, setMovements] = useState<CashMovementItem[]>([]);
  const [audits, setAudits] = useState<CashAuditItem[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected Approval Modal
  const [selectedApproval, setSelectedApproval] = useState<FinancialApprovalItem | null>(null);
  const [managerPin, setManagerPin] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [modalAction, setModalAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  // Cash In / Out Form Modal
  const [showCashModal, setShowCashModal] = useState<boolean>(false);
  const [cashDirection, setCashDirection] = useState<'IN' | 'OUT'>('IN');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashReason, setCashReason] = useState<string>('');
  const [cashReasonCode, setCashReasonCode] = useState<string>('PETTY_CASH');
  const [cashPin, setCashPin] = useState<string>('');

  // Spot Check Audit Modal
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [auditShiftId, setAuditShiftId] = useState<string>('');
  const [countedCash, setCountedCash] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');

  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    const token = getAuthToken();

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Approvals
      const appRes = await fetch('/api/approvals', { headers });
      if (appRes.ok) {
        const data = await appRes.json();
        const appList = data.approvals || [];
        setApprovals(appList);
        const pendingCount = appList.filter((a: FinancialApprovalItem) => a.status === 'PENDING').length;
        if (onApprovalCountChange) onApprovalCountChange(pendingCount);
      }

      // 2. Fetch Cash Movements
      const movRes = await fetch('/api/cash/movements', { headers });
      if (movRes.ok) {
        const data = await movRes.json();
        setMovements(data.movements || []);
      }

      // 3. Fetch Cash Audits
      const audRes = await fetch('/api/cash/audits', { headers });
      if (audRes.ok) {
        const data = await audRes.json();
        setAudits(data.audits || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch financial control data:', err);
      setError('Error loading financial exception data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Approve / Reject Submission
  const handleProcessApproval = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedApproval) return;

    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setError('Please provide a reason for rejecting this request.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = getAuthToken();
      const endpoint = `/api/approvals/${selectedApproval.id}/${action === 'APPROVED' ? 'approve' : 'reject'}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin: managerPin,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process approval request');
      }

      setSuccessMsg(`Approval request successfully ${action === 'APPROVED' ? 'approved' : 'rejected'}.`);
      setSelectedApproval(null);
      setModalAction(null);
      setManagerPin('');
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error processing approval request');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Cash Movement Creation
  const handleCreateCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount || Number(cashAmount) <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!cashReason.trim()) {
      setError('Please enter a valid reason for this cash movement.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = getAuthToken();
      const res = await fetch('/api/cash/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          movementType: cashDirection === 'IN' ? 'CASH_IN' : 'CASH_OUT',
          direction: cashDirection,
          amount: Number(cashAmount),
          reason: cashReason.trim(),
          reasonCode: cashReasonCode,
          managerPin: cashPin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record cash movement');
      }

      if (data.requiresApproval) {
        setSuccessMsg(`Amount exceeds threshold. Manager approval request submitted (ID: ${data.approval?.id}).`);
      } else {
        setSuccessMsg(`Cash ${cashDirection === 'IN' ? 'In' : 'Out'} of $${Number(cashAmount).toFixed(2)} successfully recorded.`);
      }

      setShowCashModal(false);
      setCashAmount('');
      setCashReason('');
      setCashPin('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error submitting cash movement');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Conduct Spot Check Audit
  const handleConductAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditShiftId.trim()) {
      setError('Please select or enter a Shift ID for spot check audit.');
      return;
    }
    if (countedCash === '' || Number(countedCash) < 0) {
      setError('Please enter valid physical cash counted.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = getAuthToken();
      const res = await fetch('/api/cash/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shiftId: auditShiftId.trim(),
          actualCash: Number(countedCash),
          notes: auditNotes.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to conduct cash audit');
      }

      if (data.requiresApproval) {
        setSuccessMsg(`Spot check completed. Variance (${data.audit.variance >= 0 ? '+' : ''}$${data.audit.variance.toFixed(2)}) requires manager approval.`);
      } else {
        setSuccessMsg('Spot check completed. Cash count matches within standard tolerance.');
      }

      setShowAuditModal(false);
      setCountedCash('');
      setAuditNotes('');
      setAuditShiftId('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error conducting spot check audit');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered Approvals
  const filteredApprovals = approvals.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CASH_ADJUSTMENT': return 'Cash Adjustment';
      case 'CASH_AUDIT': return 'Cash Audit Variance';
      case 'DISCOUNT_OVERRIDE': return 'Discount Override';
      case 'REFUND_APPROVAL': return 'Refund Approval';
      case 'VARIANCE_RESOLUTION': return 'Variance Resolution';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">Financial Exceptions & Approval Queue</h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Authoritative control over register cash adjustments, spot check audits, discount overrides, and manager sign-offs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCashModal(true); setError(null); }}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Cash In / Out
            </button>
            <button
              onClick={() => { setShowAuditModal(true); setError(null); }}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
            >
              <FileCheck className="w-4 h-4 mr-1.5" />
              Spot Check Audit
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Banner Messages */}
        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-6 gap-6">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'approvals'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
            {approvals.filter((a) => a.status === 'PENDING').length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                {approvals.filter((a) => a.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'movements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Cash Movements ({movements.length})
          </button>

          <button
            onClick={() => setActiveTab('audits')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'audits'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Spot Check Audits ({audits.length})
          </button>
        </div>
      </div>

      {/* TAB 1: APPROVALS QUEUE */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Filter className="w-3.5 h-3.5" />
                Status:
              </div>
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Exception Types</option>
                <option value="CASH_ADJUSTMENT">Cash Adjustments</option>
                <option value="CASH_AUDIT">Cash Audit Variances</option>
                <option value="DISCOUNT_OVERRIDE">Discount Overrides</option>
                <option value="REFUND_APPROVAL">Refund Approvals</option>
                <option value="VARIANCE_RESOLUTION">Variance Resolutions</option>
              </select>
            </div>
          </div>

          {/* Approval Cards List */}
          {filteredApprovals.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">No financial approval requests match filter criteria.</p>
              <p className="text-sm text-slate-500 mt-1">All financial operations are reconciled.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredApprovals.map((approval) => {
                const isRequesterSelf = currentUserId && approval.requesterId === currentUserId;

                return (
                  <div
                    key={approval.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(approval.status)}
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {getTypeLabel(approval.type)}
                        </span>
                        <span className="text-xs text-slate-500">
                          ID: <code className="text-slate-700 font-mono">{approval.id.slice(0, 8)}</code>
                        </span>
                      </div>

                      <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span>${approval.amount.toFixed(2)}</span>
                        {approval.reasonCode && (
                          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {approval.reasonCode}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-700 font-medium">"{approval.reason}"</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Requester: <strong className="text-slate-700">{approval.requester?.name || 'Cashier'}</strong> ({approval.requester?.role})</span>
                        {approval.approver && (
                          <span>Approver: <strong className="text-slate-700">{approval.approver.name}</strong></span>
                        )}
                        <span>Date: {new Date(approval.createdAt).toLocaleString()}</span>
                        {approval.shift && (
                          <span>Shift: <strong className="text-slate-700">{approval.shift.shiftNumber}</strong></span>
                        )}
                      </div>

                      {/* Segregation of Duties Warning */}
                      {isRequesterSelf && approval.status === 'PENDING' && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 inline-flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          Segregation of Duties: You submitted this request and cannot approve it yourself.
                        </div>
                      )}

                      {approval.rejectionReason && (
                        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mt-2">
                          <strong>Rejection Reason:</strong> {approval.rejectionReason}
                        </p>
                      )}
                    </div>

                    {/* Action Controls */}
                    {approval.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedApproval(approval);
                            setModalAction('APPROVE');
                            setError(null);
                          }}
                          disabled={Boolean(isRequesterSelf)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors ${
                            isRequesterSelf
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                          title={isRequesterSelf ? 'Requester cannot approve own request' : 'Approve Request'}
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>

                        <button
                          onClick={() => {
                            setSelectedApproval(approval);
                            setModalAction('REJECT');
                            setError(null);
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CASH MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Authorized Till Cash Flows (Paid In / Paid Out)</h3>
            <span className="text-xs text-slate-500">Includes till adjustments and petty cash entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Type / Direction</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Approval Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No cash movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(mov.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          mov.direction === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {mov.direction === 'IN' ? <ArrowDownRight className="w-3 h-3 mr-1" /> : <ArrowUpRight className="w-3 h-3 mr-1" />}
                          {mov.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        ${mov.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium max-w-xs truncate">
                        {mov.reason}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {mov.performedBy?.name || 'Staff'} ({mov.performedBy?.role})
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {mov.approval ? (
                          getStatusBadge(mov.approval.status)
                        ) : (
                          <span className="text-slate-500 font-medium">Direct Authorized</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SPOT CHECK AUDITS */}
      {activeTab === 'audits' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Register Shift Spot Check Audit Records</h3>
            <span className="text-xs text-slate-500">Server-authoritative cash reconciliation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Shift ID</th>
                  <th className="px-4 py-3">Expected Cash</th>
                  <th className="px-4 py-3">Physical Counted</th>
                  <th className="px-4 py-3">Variance</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No spot check cash audits recorded.
                    </td>
                  </tr>
                ) : (
                  audits.map((aud) => (
                    <tr key={aud.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(aud.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                        {aud.shiftId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        ${aud.expectedCash.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        ${aud.actualCash.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 font-mono font-bold ${
                        aud.variance === 0 ? 'text-slate-700' : aud.variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {aud.variance >= 0 ? '+' : ''}${aud.variance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {aud.varianceClassification === 'WITHIN_TOLERANCE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                            Within Tolerance
                          </span>
                        )}
                        {aud.varianceClassification === 'REQUIRES_REVIEW' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                            Requires Review
                          </span>
                        )}
                        {aud.varianceClassification === 'MATERIAL_VARIANCE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                            Material Variance
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {aud.conductedBy?.name || 'Manager'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPROVAL / REJECTION PROCESSING MODAL */}
      {selectedApproval && modalAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Approve Financial Request
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    Reject Financial Request
                  </>
                )}
              </h3>
              <button
                onClick={() => { setSelectedApproval(null); setModalAction(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Type:</span>
                <span className="font-bold text-slate-800">{getTypeLabel(selectedApproval.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-slate-900 text-base">${selectedApproval.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requester:</span>
                <span className="font-medium text-slate-800">{selectedApproval.requester?.name || 'Staff'} ({selectedApproval.requester?.role})</span>
              </div>
              <div className="pt-1 text-xs text-slate-600">
                <strong>Reason:</strong> "{selectedApproval.reason}"
              </div>
            </div>

            {/* Rejection Reason Input */}
            {modalAction === 'REJECT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rejection Reason (Required)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide explicit explanation for rejecting this request..."
                  rows={3}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            )}

            {/* Manager PIN Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Manager PIN Authentication
              </label>
              <input
                type="password"
                maxLength={8}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                placeholder="Enter Manager PIN"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono text-center tracking-widest text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter authorized Manager PIN to sign off on this exception.
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-1.5 border border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => { setSelectedApproval(null); setModalAction(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleProcessApproval(modalAction === 'APPROVE' ? 'APPROVED' : 'REJECTED')}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm flex items-center gap-1.5 transition-colors ${
                  modalAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm {modalAction === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH IN / OUT MODAL */}
      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCashMovement} className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                Register Cash In / Cash Out
              </h3>
              <button type="button" onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direction Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setCashDirection('IN')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  cashDirection === 'IN' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Cash In (Paid In)
              </button>
              <button
                type="button"
                onClick={() => setCashDirection('OUT')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  cashDirection === 'OUT' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                Cash Out (Paid Out)
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-base font-mono font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Amounts over $50 require Manager Approval.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Reason Code
              </label>
              <select
                value={cashReasonCode}
                onChange={(e) => setCashReasonCode(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="PETTY_CASH">Petty Cash Expense</option>
                <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                <option value="CUSTOMER_REFUND">Customer Cash Refund</option>
                <option value="TILL_FLOAT_ADDITION">Till Float Addition</option>
                <option value="TILL_SKIM">Till Cash Skim / Drop</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Detailed Reason / Notes
              </label>
              <input
                type="text"
                required
                value={cashReason}
                onChange={(e) => setCashReason(e.target.value)}
                placeholder="e.g. Paid $30 cash to ice supplier"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Manager PIN (Optional for Instant Authorization)
              </label>
              <input
                type="password"
                maxLength={8}
                value={cashPin}
                onChange={(e) => setCashPin(e.target.value)}
                placeholder="Enter Manager PIN"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono text-center tracking-widest text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCashModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
                Submit Cash Movement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SPOT CHECK AUDIT MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleConductAudit} className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Conduct Register Spot Check Audit
              </h3>
              <button type="button" onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Shift ID / Register Shift
              </label>
              <input
                type="text"
                required
                value={auditShiftId}
                onChange={(e) => setAuditShiftId(e.target.value)}
                placeholder="e.g. SH-1001 or Shift UUID"
                className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the target open shift identifier to audit against server expected cash.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Physical Cash Counted ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="0.00"
                className="w-full text-base font-mono font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Audit Notes / Observations
              </label>
              <input
                type="text"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="Unscheduled midday register drawer check"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
                Submit Spot Check
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
