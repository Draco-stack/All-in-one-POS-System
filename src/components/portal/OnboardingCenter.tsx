import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/apiConfig';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Store,
  Utensils,
  Layers,
  Receipt,
  Users,
  HardDrive,
  Grid,
  Box,
  Building2,
  Rocket,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

interface Step {
  key: string;
  title: string;
  description: string;
  required: boolean;
  status: 'COMPLETED' | 'INCOMPLETE' | 'RECOMMENDED' | 'NOT_APPLICABLE';
  reason?: string;
  actionRoute?: string;
}

interface ReadinessData {
  organizationId: string;
  onboardingStatus: string;
  onboardingVersion: number;
  serviceModel: string;
  isReady: boolean;
  progressPercentage: number;
  steps: Step[];
  blockingReasons: string[];
}

interface OnboardingCenterProps {
  onNavigateTab?: (tab: string) => void;
  onRefreshOverview?: () => void;
}

export const OnboardingCenter: React.FC<OnboardingCenterProps> = ({ onNavigateTab, onRefreshOverview }) => {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceModel, setSelectedServiceModel] = useState<string>('HYBRID');
  const [updatingServiceModel, setUpdatingServiceModel] = useState(false);
  const [executingTestOrder, setExecutingTestOrder] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [testOrderResult, setTestOrderResult] = useState<string | null>(null);
  const [showServiceModelModal, setShowServiceModelModal] = useState(false);

  const token = getAuthToken() || localStorage.getItem('tillora_token') || localStorage.getItem('token') || '';

  const fetchReadiness = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setReadiness(json.data);
        setSelectedServiceModel(json.data.serviceModel || 'HYBRID');
      } else {
        throw new Error(json.error || 'Failed to load onboarding status');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to onboarding server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const handleStartOnboarding = async () => {
    try {
      const res = await fetch('/api/portal/onboarding/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReadiness(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveServiceModel = async (model: string) => {
    setUpdatingServiceModel(true);
    try {
      const res = await fetch('/api/portal/onboarding/service-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ serviceModel: model }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReadiness(json.data);
        setSelectedServiceModel(model);
        setShowServiceModelModal(false);
      } else {
        alert(json.error || 'Failed to set service model');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating service model');
    } finally {
      setUpdatingServiceModel(false);
    }
  };

  const handleRunTestOrder = async () => {
    setExecutingTestOrder(true);
    setTestOrderResult(null);
    try {
      const res = await fetch('/api/portal/onboarding/test-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestOrderResult(`Safe Test Order #${json.data.order.orderNumber} punched & completed ($${json.data.order.total})`);
        setReadiness(json.data.readiness);
      } else {
        alert(json.error || 'Test order execution failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing test order');
    } finally {
      setExecutingTestOrder(false);
    }
  };

  const handleCompleteGoLive = async () => {
    if (!readiness?.isReady) return;
    setCompletingOnboarding(true);
    try {
      const res = await fetch('/api/portal/onboarding/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReadiness((prev) => (prev ? { ...prev, onboardingStatus: 'COMPLETED' } : null));
        if (onRefreshOverview) onRefreshOverview();
      } else {
        alert(json.error || 'Failed to complete onboarding');
      }
    } catch (err: any) {
      alert(err.message || 'Error completing onboarding');
    } finally {
      setCompletingOnboarding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mr-3" />
        <span className="text-gray-600 font-medium">Evaluating restaurant go-live readiness...</span>
      </div>
    );
  }

  if (error || !readiness) {
    return (
      <div className="p-6 bg-red-50 rounded-xl border border-red-200 text-red-800">
        <div className="flex items-center space-x-2 font-semibold text-lg mb-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span>Onboarding System Unavailable</span>
        </div>
        <p className="text-sm mb-4">{error || 'Could not verify onboarding readiness state.'}</p>
        <button
          onClick={fetchReadiness}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
        >
          Retry Readiness Check
        </button>
      </div>
    );
  }

  const isCompleted = readiness.onboardingStatus === 'COMPLETED';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Go-Live Readiness Center
              </span>
              <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-md text-xs font-medium border border-slate-700">
                Service Model: {readiness.serviceModel}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isCompleted ? 'Restaurant Active & Operational' : 'Restaurant Onboarding & Setup'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              {isCompleted
                ? 'Your restaurant setup is verified. You can update your operational rules or re-evaluate readiness at any time.'
                : 'Complete the server-verified setup checklist to prepare your POS hardware, menu, staff, and order routing for go-live.'}
            </p>
          </div>

          <div className="flex flex-col items-end justify-center bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 min-w-[220px]">
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-medium text-slate-400">Readiness Score</span>
              <span className="text-lg font-bold text-emerald-400">{readiness.progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${readiness.progressPercentage}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-end w-full space-x-1">
              {readiness.isReady ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 100% Ready for Orders
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {readiness.blockingReasons.length} Pending Requirement(s)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Banner if Completed */}
      {isCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-900">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Onboarding Certified</h3>
              <p className="text-xs text-emerald-700">All required menu, tax, staff, and hardware parameters are verified on server.</p>
            </div>
          </div>
          <button
            onClick={fetchReadiness}
            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-check Readiness
          </button>
        </div>
      )}

      {/* Service Model Bar & Quick Selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900">Operational Service Model</h3>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                {readiness.serviceModel}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Determines whether table floorplan, KDS, counter queues, or takeaway routing are required.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowServiceModelModal(true)}
          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition border border-gray-300 shrink-0"
        >
          Change Service Model
        </button>
      </div>

      {/* Test Order Alert banner */}
      {testOrderResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between text-blue-900 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold">{testOrderResult}</span>
          </div>
          <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
            Excluded from financial reports
          </span>
        </div>
      )}

      {/* Setup Step Checklist */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Go-Live Setup Checklist</h2>
            <p className="text-xs text-gray-500">Evaluated in real-time from your active database records</p>
          </div>
          <button
            onClick={fetchReadiness}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {readiness.steps.map((step) => {
            const isCompletedStep = step.status === 'COMPLETED';
            const isNotApplicable = step.status === 'NOT_APPLICABLE';
            const isRecommended = step.status === 'RECOMMENDED';

            return (
              <div
                key={step.key}
                className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-slate-50/80 ${
                  step.status === 'INCOMPLETE' && step.required ? 'bg-amber-50/30' : ''
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className="mt-0.5 shrink-0">
                    {isCompletedStep && (
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-full">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                    {step.status === 'INCOMPLETE' && step.required && (
                      <div className="p-1.5 bg-amber-100 text-amber-700 rounded-full">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    )}
                    {isRecommended && (
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-full">
                        <Info className="w-5 h-5" />
                      </div>
                    )}
                    {isNotApplicable && (
                      <div className="p-1.5 bg-gray-100 text-gray-400 rounded-full">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-gray-900">{step.title}</h4>
                      {step.required ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">
                          Required
                        </span>
                      ) : isNotApplicable ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded uppercase">
                          N/A
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded uppercase">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{step.description}</p>
                    {step.reason && (
                      <p className="text-[11px] text-gray-500 mt-1 italic flex items-center gap-1">
                        <span>Result:</span> {step.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {step.key === 'SERVICE_MODEL' && (
                    <button
                      onClick={() => setShowServiceModelModal(true)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition"
                    >
                      Configure
                    </button>
                  )}

                  {step.key === 'TEST_ORDER' && (
                    <button
                      onClick={handleRunTestOrder}
                      disabled={executingTestOrder}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {executingTestOrder ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Run Safe Test Order
                        </>
                      )}
                    </button>
                  )}

                  {step.actionRoute && onNavigateTab && (
                    <button
                      onClick={() => {
                        const tab = step.actionRoute?.split('tab=')[1] || 'restaurant';
                        onNavigateTab(tab);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium rounded-lg transition flex items-center gap-1"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Go Live Execution Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <Rocket className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-gray-900">Go-Live Certification</h3>
          </div>
          <p className="text-xs text-gray-600 mt-1 max-w-xl">
            {readiness.isReady
              ? 'All server checks passed! Click below to officially complete onboarding and open your restaurant for live orders.'
              : 'Complete all required setup steps listed above to unlock restaurant go-live status.'}
          </p>
          {!readiness.isReady && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
              <span className="font-semibold block mb-1">Blocking Requirements:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {readiness.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          onClick={handleCompleteGoLive}
          disabled={!readiness.isReady || completingOnboarding || isCompleted}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center space-x-2 shrink-0 shadow-md ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-none'
              : readiness.isReady
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300 shadow-none'
          }`}
        >
          {completingOnboarding ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Certifying Go-Live...</span>
            </>
          ) : isCompleted ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Go-Live Certified</span>
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              <span>Go-Live & Complete Setup</span>
            </>
          )}
        </button>
      </div>

      {/* Modal for Service Model Selection */}
      {showServiceModelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Select Restaurant Service Model</h3>
              <button
                onClick={() => setShowServiceModelModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Choosing your service model optimizes setup requirements (such as table layout, KDS screens, and takeaway queues).
            </p>

            <div className="space-y-2">
              {[
                { id: 'HYBRID', title: 'Hybrid Restaurant', desc: 'Combines Dine-In floor tables with Takeaway and Delivery.' },
                { id: 'DINE_IN', title: 'Full-Service Dine-In', desc: 'Focuses on table ordering, seating layouts, and KDS routing.' },
                { id: 'COUNTER_SERVICE', title: 'Counter / Quick-Service', desc: 'Fast order punching at cash counter, optional buzzer numbers.' },
                { id: 'TAKEAWAY_ONLY', title: 'Takeaway & Delivery Only', desc: 'No tables required. Direct order packaging and rider dispatch.' },
              ].map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedServiceModel(model.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition flex items-start space-x-3 ${
                    selectedServiceModel === model.id
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                      selectedServiceModel === model.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'
                    }`}
                  >
                    {selectedServiceModel === model.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div>
                    <span className="font-bold text-sm block">{model.title}</span>
                    <span className="text-gray-500 block mt-0.5">{model.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                onClick={() => setShowServiceModelModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveServiceModel(selectedServiceModel)}
                disabled={updatingServiceModel}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {updatingServiceModel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Service Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
