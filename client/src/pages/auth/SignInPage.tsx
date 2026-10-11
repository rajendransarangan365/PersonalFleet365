import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SignInSchema, type SignInInput } from '@fleetwise/shared';
import { apiPost } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';
import type { User } from '@fleetwise/shared';

export default function SignInPage() {
  const navigate = useNavigate();
  const { setTokenAndUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
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

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/50 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Truck className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">FleetWise</h1>
            <p className="text-xs text-slate-500">Fleet Management Platform</p>
          </div>
        </div>

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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} FleetWise. All rights reserved.
        </p>
      </div>
    </div>
  );
}
