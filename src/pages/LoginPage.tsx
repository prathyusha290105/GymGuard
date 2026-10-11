import React, { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  User,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS } from '../services/seed/seedData';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { loginWithCredentials, loginWithDemo, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const res = await loginWithCredentials(email, password);
    setSubmitting(false);
    if (res.success) {
      onLoginSuccess();
    } else {
      setErrorMsg(res.error || 'Authentication failed');
    }
  };

  const handleDemoSelect = async (role: 'OWNER' | 'STAFF' | 'MEMBER') => {
    await loginWithDemo(role);
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            GYMGUARD
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Smart Gym Management, Biometric Attendance & Door Access Control
          </p>
        </div>

        {/* 1-Click Demo Logins Banner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Instant Demo Access (Click to Test)</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleDemoSelect('OWNER')}
              className="p-2.5 rounded-xl bg-zinc-950 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/40 text-left transition-all group"
            >
              <span className="block text-xs font-bold text-white group-hover:text-emerald-400">
                Gym Owner
              </span>
              <span className="text-[10px] text-zinc-400">Full SaaS Admin</span>
            </button>

            <button
              onClick={() => handleDemoSelect('STAFF')}
              className="p-2.5 rounded-xl bg-zinc-950 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/40 text-left transition-all group"
            >
              <span className="block text-xs font-bold text-white group-hover:text-emerald-400">
                Front Staff
              </span>
              <span className="text-[10px] text-zinc-400">Check-In / Renew</span>
            </button>

            <button
              onClick={() => handleDemoSelect('MEMBER')}
              className="p-2.5 rounded-xl bg-zinc-950 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/40 text-left transition-all group"
            >
              <span className="block text-xs font-bold text-white group-hover:text-emerald-400">
                Member
              </span>
              <span className="text-[10px] text-zinc-400">Digital Pass Portal</span>
            </button>
          </div>
        </div>

        {/* Standard Email / Password Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="text-zinc-400 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="owner@gymguard.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In with Credentials'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={loginWithGoogle}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-semibold rounded-xl border border-zinc-700 transition-colors text-xs flex items-center justify-center gap-2"
            >
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 text-[11px] text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-300">Preset Demo Credentials:</p>
            <p>Owner: <code className="text-emerald-400">owner@gymguard.demo</code> / <code className="text-zinc-300">GymGuard@123</code></p>
            <p>Staff: <code className="text-emerald-400">staff@gymguard.demo</code> / <code className="text-zinc-300">GymGuard@123</code></p>
            <p>Member: <code className="text-emerald-400">member@gymguard.demo</code> / <code className="text-zinc-300">GymGuard@123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};
