import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Users, Settings, Zap, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics',  icon: BarChart2,       label: 'Analytics' },
  { to: '/groups',     icon: Users,            label: 'Groups' },
  { to: '/settings',   icon: Settings,         label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col py-6 px-4 border-r border-border bg-surface z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Zap size={16} className="text-primary" />
        </div>
        <span className="font-display font-bold text-lg text-white">StreakUp</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="mt-auto pt-4 border-t border-border">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0 overflow-hidden">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-200 truncate">{user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  );
}
