import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Left side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-[#11100f] border-r border-[#2a2725] p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#e8e4df 1px, transparent 1px), linear-gradient(90deg, #e8e4df 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">StreakUp</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Consistency is the <br />ultimate hack.
          </h2>
          <p className="text-muted text-lg max-w-md">
            Join thousands of users building better habits and hitting their goals every single day.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-zinc-600">
          &copy; {new Date().getFullYear()} StreakUp Inc.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-[420px] animate-fade-up">
          {/* Logo (Mobile only) */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
              <Zap size={24} className="text-primary" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
              <p className="text-muted mt-1.5 text-sm">Sign in to keep your streaks alive</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 text-rose-400 text-sm animate-fade-in">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    className="input pl-10"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pl-10 pr-10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full mt-2 py-2.5"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-muted text-sm mt-6">
              No account?{' '}
              <Link to="/register" className="text-white hover:text-primary transition-colors font-medium">
                Create one for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
