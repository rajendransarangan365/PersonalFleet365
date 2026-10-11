import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Truck, AlertCircle, CheckCircle2, Sparkles, KeyRound, ShieldAlert, Copy, Check, ChevronRight } from 'lucide-react';
import { SignInSchema, type SignInInput } from '@fleetwise/shared';
import { apiPost } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';
import type { User } from '@fleetwise/shared';
import OnboardingWizardModal from '../../components/OnboardingWizardModal.js';
import FleetLogo from '../../components/FleetLogo.js';

interface SignInPageProps {
  devMode?: boolean;
}

export default function SignInPage({ devMode }: SignInPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setTokenAndUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Check if accessed via secret /dev route or ?dev=1
  const [isDevMode, setIsDevMode] = useState(() => {
    return Boolean(devMode || location.pathname.includes('/dev') || searchParams.get('dev') === 'true' || searchParams.get('dev') === '1');
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
  });

  const onSubmit = useCallback(
    async (data: SignInInput) => {
      setServerError(null);
      try {
        const result = await apiPost<{
          accessToken: string;
          user: User;
          businesses: Array<{ businessId: string; role: string }>;
        }>('/auth/signin', data);

        setTokenAndUser(result.accessToken, result.user, result.businesses.map((b) => ({
          ...b,
          permissions: [],
        })));

        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
        setServerError(msg);
      }
    },
    [setTokenAndUser, navigate],
  );

  const DEMO_ACCOUNTS = [
    {
      role: 'fleet_owner' as const,
      label: 'Fleet Owner (Admin)',
      email: 'owner@fleetwise.in',
      password: 'Password@123',
      badge: 'Full Fleet Control',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      description: 'Profit simulator, finance, loan EMI tracking, live GPS',
      target: '/dashboard',
    },
    {
      role: 'fleet_manager' as const,
      label: 'Fleet Manager (Operations)',
      email: 'manager@fleetwise.in',
      password: 'Password@123',
      badge: 'Dispatch Operations',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      description: 'Driver assignments, vehicle maintenance, VoIP calling & chat',
      target: '/trips',
    },
    {
      role: 'driver' as const,
      label: 'Commercial Driver',
      email: 'driver@fleetwise.in',
      password: 'Password@123',
      badge: 'Driver Console',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Live trip GPS tracker, vehicle condition photos, duty task dispatch',
      target: '/driver-portal',
    },
  ];

  const handleAutoFill = (email: string, password: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', password, { shouldValidate: true });
  };

  const handleInstantDemoLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    handleAutoFill(account.email, account.password);
    setServerError(null);

    try {
      const result = await apiPost<{
        accessToken: string;
        user: User;
        businesses: Array<{ businessId: string; role: string }>;
      }>('/auth/signin', { email: account.email, password: account.password });

      setTokenAndUser(result.accessToken, result.user, result.businesses.map((b) => ({
        ...b,
        permissions: [],
      })));
    } catch {
      // Instant offline / fallback demo session
      const mockUser: User = {
        id: `demo_${account.role}_01`,
        email: account.email,
        displayName: account.label,
        role: account.role,
        isActive: true,
        emailVerified: true,
      } as any;

      setTokenAndUser('demo_jwt_access_token_mock', mockUser, [
        { businessId: 'demo_fleet_biz_01', role: account.role, permissions: [] },
      ]);
    }

    setSuccess(true);
    setTimeout(() => navigate(account.target), 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/50 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Fleet365 Stylized Logo */}
        <FleetLogo size="xl" subtitle="Commercial Fleet Management Platform" className="justify-center mb-6" />

        {/* Secret Demo Access Portal (/dev) */}
        {isDevMode && (
          <div className="glass-card p-5 border-brand-500/30 bg-slate-900/95 shadow-2xl mb-6 animate-slide-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Secret Demo Access Portal</h3>
              </div>
              <span className="bg-brand-500/20 text-brand-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-brand-500/30">
                Direct Link: /dev
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2 mb-3">
              Pre-configured demo profiles with immediate access and live test credentials:
            </p>

            <div className="space-y-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.role}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{acc.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${acc.badgeColor}`}>
                        {acc.badge}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
                      <span>Email: <span className="text-slate-200 select-all">{acc.email}</span></span>
                      <span>Password: <span className="text-slate-200 select-all">{acc.password}</span></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAutoFill(acc.email, acc.password)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                      title="Auto-fill email & password"
                    >
                      Auto-Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInstantDemoLogin(acc)}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md flex items-center gap-1 transition-transform active:scale-95"
                      title="1-Click Instant Login"
                    >
                      <span>Launch</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card */}
        <div className="glass-card p-8 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100">Welcome back</h2>
            <p className="text-sm text-slate-400 mt-1">Sign in to your FleetWise account</p>
          </div>

          {/* Success state */}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 mb-4">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              <span className="text-sm text-success">Signed in! Redirecting…</span>
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 mb-4">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              <span className="text-sm text-danger">{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Your password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              id="signin-submit"
              type="submit"
              disabled={isSubmitting || success}
              className="btn-primary btn-lg w-full mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create account
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="w-full btn-secondary text-xs py-2.5 flex items-center justify-center gap-2 text-brand-400 border-brand-500/30 hover:bg-brand-500/10 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Easy Step-by-Step Fleet Onboarding</span>
            </button>
          </div>
        </div>

        {/* Secret Dev Mode Toggle */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setIsDevMode((v) => !v)}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1.5 mx-auto transition-colors font-mono"
            id="secret-dev-toggle"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isDevMode ? 'Hide Secret Demo Logins' : 'Secret Demo Access (/dev)'}</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-4">
          © {new Date().getFullYear()} FleetWise. All rights reserved.
        </p>
      </div>

      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
}
