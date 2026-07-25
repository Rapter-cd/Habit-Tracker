import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      setError(apiErrors ? apiErrors[0].msg : err.response?.data?.message || 'Registration failed.');
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
            Start your streak <br />today.
          </h2>
          <p className="text-muted text-lg max-w-md">
            Join thousands of users building better habits and hitting their goals every single day. Free forever.
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
              <h1 className="text-2xl font-bold text-white tracking-tight">Create account</h1>
              <p className="text-muted mt-1.5 text-sm">Free forever. No credit card needed.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 text-rose-400 text-sm animate-fade-in">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="reg-name"
                    type="text"
                    placeholder="Alex Johnson"
                    className="input pl-10"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="reg-email"
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
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
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
                id="reg-submit"
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full mt-2 py-2.5"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Create account'}
              </button>
            </form>

            <p className="text-center text-muted text-sm mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-white hover:text-primary transition-colors font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
