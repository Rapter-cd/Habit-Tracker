import { Link } from 'react-router-dom';
import { Zap, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Landing() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Navigation */}
      <nav className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <Zap size={16} className="text-primary" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">StreakUp</span>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted hover:text-white transition-colors">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary text-sm py-2">
                Start for free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 z-10 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#191817] border border-[#2a2725] text-xs font-medium text-muted mb-8 animate-fade-up">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          v1.0 is now live
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight max-w-4xl leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Build habits that <br className="hidden md:block" />
          <span className="text-primary">actually stick.</span>
        </h1>
        
        <p className="text-lg text-muted max-w-xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          Track your daily routines, maintain streaks, and stay accountable with your friends. A minimal, developer-focused habit tracker.
        </p>
        
        <div className="flex items-center gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {isAuthenticated ? (
             <Link to="/dashboard" className="btn btn-primary py-3 px-6 text-base">
               Open App
             </Link>
          ) : (
             <Link to="/register" className="btn btn-primary py-3 px-6 text-base">
               Start your streak
             </Link>
          )}
        </div>

        {/* Features/Mock UI Preview */}
        <div className="w-full max-w-5xl mx-auto mt-24 grid md:grid-cols-3 gap-6 text-left animate-fade-up" style={{ animationDelay: '0.4s' }}>
          
          <div className="bg-[#191817] border border-[#2a2725] rounded-2xl p-8 transition-colors hover:border-[#3b3733]">
            <div className="w-10 h-10 rounded-xl bg-[#2a2725] flex items-center justify-center mb-5">
              <CheckCircle2 size={20} className="text-[#e8e4df]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Daily Tracking</h3>
            <p className="text-muted text-sm leading-relaxed">
              Check in daily with a single click. Keep your momentum going and watch your streaks grow over time.
            </p>
          </div>

          <div className="bg-[#191817] border border-[#2a2725] rounded-2xl p-8 transition-colors hover:border-[#3b3733]">
            <div className="w-10 h-10 rounded-xl bg-[#2a2725] flex items-center justify-center mb-5">
              <TrendingUp size={20} className="text-[#e8e4df]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">GitHub-style Heatmaps</h3>
            <p className="text-muted text-sm leading-relaxed">
              Visualize your progress with beautiful activity heatmaps. Spot patterns and optimize your routine easily.
            </p>
          </div>

          <div className="bg-[#191817] border border-[#2a2725] rounded-2xl p-8 transition-colors hover:border-[#3b3733]">
            <div className="w-10 h-10 rounded-xl bg-[#2a2725] flex items-center justify-center mb-5">
              <Users size={20} className="text-[#e8e4df]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Social Accountability</h3>
            <p className="text-muted text-sm leading-relaxed">
              Create private groups with friends. Compete on leaderboards based on consistency, not just raw streaks.
            </p>
          </div>

        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-8 text-center text-muted text-sm border-t border-[#2a2725]">
        <p>&copy; {new Date().getFullYear()} StreakUp. Built for consistency.</p>
      </footer>
    </div>
  );
}
