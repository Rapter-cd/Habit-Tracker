import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Users, Flame, Hash, LogOut } from 'lucide-react';
import api from '../api/axios';
import toast from '../components/Toast';
import useAuthStore from '../store/authStore';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup]             = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('members'); // 'members' | 'leaderboard'

  useEffect(() => {
    const load = async () => {
      try {
        const [gRes, lRes] = await Promise.all([
          api.get(`/api/groups/${id}`),
          api.get(`/api/groups/${id}/leaderboard`),
        ]);
        setGroup(gRes.data);
        setLeaderboard(lRes.data);
      } catch {
        toast.error('Failed to load group');
        navigate('/groups');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleLeave = async () => {
    if (!window.confirm('Leave this group?')) return;
    try {
      await api.post(`/api/groups/${id}/leave`);
      toast.success('You left the group');
      navigate('/groups');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 lg:p-8">
        <div className="skeleton h-8 w-48 mb-6 rounded-xl" />
        <div className="card skeleton h-64" />
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="flex-1 p-6 lg:p-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Groups
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-zinc-100">{group.name}</h1>
          {group.description && (
            <p className="text-zinc-500 text-sm mt-1">{group.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
              <Users size={14} /> {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
              <Hash size={14} />
              <code className="font-mono text-zinc-400">{group.inviteCode}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(group.inviteCode); toast.info('Copied!'); }}
                className="text-violet-400 hover:text-violet-300 text-xs"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
        <button onClick={handleLeave} className="btn btn-danger text-sm">
          <LogOut size={14} /> Leave group
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-[#18181f] border border-[#2a2a35] rounded-xl w-fit mb-6">
        {['members', 'leaderboard'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-text-main'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {group.members.map((member) => (
            <div key={member._id} className="card animate-fade-up">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 overflow-hidden">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    : member.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-200 text-sm truncate">{member.name}</p>
                    {member._id === group.createdBy && (
                      <Crown size={13} className="text-amber-400 flex-shrink-0" title="Group creator" />
                    )}
                    {member._id === user?.id && (
                      <span className="bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">You</span>
                    )}
                  </div>
                  <p className="text-zinc-600 text-xs truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-orange-400">
                  <Flame size={14} />
                  <span className="font-semibold">{member.totalCurrentStreak}</span>
                  <span className="text-orange-600 text-xs">streak pts</span>
                </div>
                <span className="text-zinc-600 text-xs">{member.activeHabits} habit{member.activeHabits !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div className="card animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={18} className="text-amber-400" />
            <h2 className="font-semibold text-zinc-200">30-day completion leaderboard</h2>
          </div>
          <p className="text-zinc-600 text-xs mb-5">
            Ranked by % of habit check-ins completed in the last 30 days. Fairer than raw streak count — new members can compete from day 1.
          </p>

          <div className="flex flex-col gap-2">
            {leaderboard.map((member, i) => (
              <div
                key={member._id}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  member._id === user?.id
                    ? 'bg-primary/10 border border-primary/25'
                    : 'bg-[#191817] border border-transparent hover:border-border'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {i < 3 ? (
                    <span className="text-xl">{MEDAL[i]}</span>
                  ) : (
                    <span className="text-zinc-500 font-bold text-sm">#{i + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 overflow-hidden">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    : member.name[0].toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-200 text-sm truncate">
                    {member.name}
                    {member._id === user?.id && <span className="ml-2 text-primary text-xs font-medium">(you)</span>}
                  </p>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-border rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${member.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-zinc-200 w-10 text-right">{member.score}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
