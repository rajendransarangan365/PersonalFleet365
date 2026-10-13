import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import { useContactsStore } from '../store/contacts.store.js';
import { apiPost } from '../services/api.js';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function CompulsoryPasswordChangeModal({ isOpen, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === oldPassword) {
      setError('New password cannot be the same as the temporary password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/auth/change-password', {
        email: user?.email,
        oldPassword,
        newPassword,
      });
    } catch (err: unknown) {
      console.warn('Backend password change warning:', err);
    }

    // Also sync in local contacts store
    if (user?.email) {
      const { contacts, updateContact } = useContactsStore.getState();
      const matched = contacts.find((c) => c.email?.toLowerCase() === user.email.toLowerCase());
      if (matched) {
        updateContact(matched.id, {
          tempPassword: newPassword,
          mustChangePassword: false,
        });
      }
    }

    setIsSubmitting(false);
    localStorage.setItem('fleet_pwd_changed', 'true');
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Compulsory Password Change
            </h3>
            <p className="text-xs text-amber-400 font-medium">
              First-Time Login Security Requirement
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Your account was provisioned with a temporary password. As per company security policy, you must set a private new password before accessing the fleet system.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Current Temporary Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter temporary password"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              New Secure Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-400 hover:to-brand-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{isSubmitting ? 'Updating Password...' : 'Save New Password & Enter'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
