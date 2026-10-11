import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Truck, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { SignUpSchema, type SignUpInput } from '@fleetwise/shared';
import { apiPost } from '../../services/api.js';

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
  });

  const password = watch('password', '');

  const passwordChecks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const onSubmit = useCallback(async (data: SignUpInput) => {
    setServerError(null);
    try {
      const result = await apiPost<{ message: string; _devVerificationToken?: string }>('/auth/signup', data);
      setSubmitted(true);
      if (result._devVerificationToken) setDevToken(result._devVerificationToken);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  }, []);

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-10 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-success/20 border border-success/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Account created!</h2>
          <p className="text-slate-400 text-sm mb-4">
            We've sent a verification link to your email. Click it to activate your account.
          </p>
          {devToken && (
            <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20 text-left">
              <p className="text-xs text-warning font-semibold mb-1">DEV MODE — Verification token:</p>
              <p className="text-xs text-slate-400 font-mono break-all">{devToken}</p>
              <a
                href={`/api/v1/auth/verify-email?token=${devToken}`}
                className="mt-2 btn-primary btn-sm inline-flex"
              >
                Verify now (dev)
              </a>
            </div>
          )}
          <Link to="/auth/signin" className="btn-secondary mt-6 inline-flex">
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/40 via-slate-950 to-slate-950 pointer-events-none" />

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

        <div className="glass-card p-8 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100">Create account</h2>
            <p className="text-sm text-slate-400 mt-1">Start managing your fleet for free</p>
          </div>

          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 mb-4">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              <span className="text-sm text-danger">{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="displayName" className="label">Full name</label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                className={`input ${errors.displayName ? 'input-error' : ''}`}
                placeholder="Ramesh Kumar"
                {...register('displayName')}
              />
              {errors.displayName && <p className="field-error">{errors.displayName.message}</p>}
            </div>

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

            <div>
              <label htmlFor="reg-password" className="label">Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Strong password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength checklist */}
              {password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {Object.entries({
                    '10+ characters': passwordChecks.length,
                    'Uppercase letter': passwordChecks.upper,
                    'Lowercase letter': passwordChecks.lower,
                    'Number': passwordChecks.digit,
                    'Special character': passwordChecks.special,
                  }).map(([label, ok]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-success' : 'bg-slate-600'}`} />
                      <span className={`text-xs ${ok ? 'text-success' : 'text-slate-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            {/* Security assurance */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
              <Shield className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Your password is hashed with Argon2id. We never store plaintext credentials.
              </p>
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn-lg w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/auth/signin" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
