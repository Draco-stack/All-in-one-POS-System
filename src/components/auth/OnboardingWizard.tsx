import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building, Store, User, CreditCard, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    branchName: '',
    plan: 'STARTER'
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');
    if (planParam) {
      let p = planParam.toUpperCase();
      if (p === 'PRO' || p === 'PROFESSIONAL') p = 'BUSINESS';
      if (['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'].includes(p)) {
        setFormData(prev => ({ ...prev, plan: p }));
      }
    }
  }, [location]);

  const updateForm = (key: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password || formData.password !== formData.confirmPassword) {
        setError('Please fill all fields correctly. Passwords must match.');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    } else if (step === 2) {
      if (!formData.restaurantName) {
        setError('Restaurant name is required.');
        return;
      }
    } else if (step === 3) {
      if (!formData.branchName) {
        setError('Branch name is required.');
        return;
      }
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Automatically log in by storing token in localStorage or context, but since this is 
      // the onboarding wizard outside POS context for a moment, let's just redirect to login 
      // with a success message or automatically log them in by setting localStorage and reloading.
      localStorage.setItem('pos_jwt_token_v5', JSON.stringify(data.token));
      localStorage.setItem('pos_current_user_v5', JSON.stringify(data.user));
      localStorage.setItem('pos_is_logged_in_v5', JSON.stringify(true));
      
      if (formData.plan !== 'FREE' && formData.plan !== 'STARTER') {
         // Create Stripe Checkout Session
         try {
           const checkoutRes = await fetch('/api/billing/create-checkout', {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${data.token}`
             },
             body: JSON.stringify({ plan: formData.plan })
           });
           const checkoutData = await checkoutRes.json();
           if (checkoutData.url) {
             window.location.href = checkoutData.url;
             return;
           }
         } catch (e) {
           console.warn('Checkout creation failed:', e);
         }
      }
      
      window.location.href = '/app';
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Tillora</h1>
          <p className="text-slate-400 mt-2 text-sm">Let's set up your restaurant in a few easy steps.</p>
        </div>

        {/* Progress Bar */}
        <div className="flex px-8 pt-6 pb-2 items-center justify-between relative">
          <div className="absolute left-12 right-12 top-9 h-0.5 bg-slate-100 -z-10" />
          {[
            { id: 1, icon: User, label: 'Account' },
            { id: 2, icon: Building, label: 'Business' },
            { id: 3, icon: Store, label: 'Branch' },
            { id: 4, icon: CreditCard, label: 'Plan' },
          ].map((s) => {
            const isActive = step === s.id;
            const isPast = step > s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive ? 'border-blue-600 bg-blue-50 text-blue-600' :
                  isPast ? 'border-green-500 bg-green-50 text-green-600' :
                  'border-slate-200 bg-white text-slate-400'
                }`}>
                  {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-semibold mb-4">Create your owner account</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" value={formData.name} onChange={e => updateForm('name', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="John Doe" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e => updateForm('email', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type="password" value={formData.password} onChange={e => updateForm('password', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input type="password" value={formData.confirmPassword} onChange={e => updateForm('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Repeat your password" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-semibold mb-4">Name your business</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant / Organization Name</label>
                <input type="text" value={formData.restaurantName} onChange={e => updateForm('restaurantName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. Central Perk" autoFocus />
                <p className="text-xs text-slate-500 mt-2">This is your main organizational tenant name.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-semibold mb-4">Your first location</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
                <input type="text" value={formData.branchName} onChange={e => updateForm('branchName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. Main Branch, Downtown" autoFocus />
                <p className="text-xs text-slate-500 mt-2">You can add more branches later from the Admin Dashboard.</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-semibold mb-4">Choose your plan</h2>
              
              <div className="grid grid-cols-1 gap-4">
                {['STARTER', 'BUSINESS', 'ENTERPRISE'].map(plan => (
                  <label key={plan} className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all ${
                    formData.plan === plan ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input type="radio" name="plan" value={plan} className="sr-only" checked={formData.plan === plan} onChange={() => updateForm('plan', plan)} />
                    <span className="flex flex-1">
                      <span className="flex flex-col">
                        <span className="block text-sm font-medium text-slate-900">{plan.charAt(0) + plan.slice(1).toLowerCase()}</span>
                        <span className="mt-1 flex items-center text-sm text-slate-500">
                          {plan === 'STARTER' && 'For small cafes and pop-ups.'}
                          {plan === 'BUSINESS' && 'Advanced analytics & multi-branch.'}
                          {plan === 'ENTERPRISE' && 'Custom integrations & support.'}
                        </span>
                      </span>
                    </span>
                    <CheckCircle2 className={`h-5 w-5 ${formData.plan === plan ? 'text-blue-600' : 'text-transparent'}`} aria-hidden="true" />
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">
                Note: You can upgrade your plan or complete payment processing later from the billing dashboard.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
            {step > 1 ? (
              <button onClick={prevStep} type="button" disabled={isLoading} className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors">
                Back
              </button>
            ) : (
              <div /> // Spacer
            )}
            
            {step < 4 ? (
              <button onClick={nextStep} type="button" className="flex items-center gap-2 bg-slate-900 text-white px-8 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} type="button" disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning...</>
                ) : (
                  'Complete Setup'
                )}
              </button>
            )}
          </div>
          
          {step === 1 && (
            <div className="mt-6 text-center text-sm text-slate-500">
              Already have an account? <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline font-medium">Sign in instead</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
