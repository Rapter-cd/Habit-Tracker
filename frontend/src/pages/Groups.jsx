import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Hash, ArrowRight, Flame } from 'lucide-react';
import api from '../api/axios';
import toast from '../components/Toast';

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch all groups the user belongs to (from user.groups, then GET each)
  useEffect(() => {
    const load = async () => {
      try {
        // We'll use the user's groups array from auth; but it's simpler to
        // just try fetching all groups we can — if the user has no groups
        // the array is empty. We use a custom endpoint that aggregates.
        // For now, groups are stored on the user doc — fetch /api/auth/me
        // to get group IDs, then fetch details for each.
        const { data: me } = await api.get('/api/auth/me');
        const details = await Promise.all(
          (me.groups || []).map((gid) =>
            api.get(`/api/groups/${gid}`).then((r) => r.data).catch(() => null)
          )
        );
        setGroups(details.filter(Boolean));
      } catch {
        toast.error('Failed to load groups');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/groups', createForm);
      // Fetch full group detail
      const detail = await api.get(`/api/groups/${data._id}`);
      setGroups((prev) => [detail.data, ...prev]);
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      toast.success('Group created! Share the invite code 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/groups/join', { inviteCode: inviteCode.trim() });
      const detail = await api.get(`/api/groups/${data._id}`);
      setGroups((prev) => {
        const exists = prev.find((g) => g._id === data._id);
        return exists ? prev : [detail.data, ...prev];
      });
      setShowJoin(false);
      setInviteCode('');
      toast.success(`Joined ${data.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid invite code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-zinc-100">Groups</h1>
          <p className="text-zinc-500 mt-1 text-sm">Stay accountable with your friends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)} className="btn btn-ghost">
            <Hash size={16} /> Join via code
          </button>
          <button id="create-group-btn" onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus size={16} /> Create group
          </button>
        </div>
      </div>

      {/* Groups list */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-36 skeleton" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
            <Users size={36} className="text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No groups yet</h2>
          <p className="text-zinc-600 max-w-xs mb-6 text-sm">
            Create a group and invite friends to keep each other accountable.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus size={16} /> Create my first group
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {groups.map((group) => (
            <div
              key={group._id}
              className="card card-hover cursor-pointer animate-fade-up"
              onClick={() => navigate(`/groups/${group._id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg">
                  {group.name[0].toUpperCase()}
                </div>
                <ArrowRight size={16} className="text-zinc-600 mt-1" />
              </div>
              <h3 className="font-semibold text-zinc-100 mb-1">{group.name}</h3>
              {group.description && (
                <p className="text-zinc-500 text-xs mb-3 line-clamp-2">{group.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                  <Users size={13} /> {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1 text-orange-400 text-xs font-medium">
                  <Flame size={12} />
                  {group.members?.reduce((s, m) => s + (m.totalCurrentStreak || 0), 0)} total streaks
                </div>
              </div>
              {/* Invite code */}
              <div className="mt-3 pt-3 border-t border-[#2a2a35] flex items-center gap-2">
                <Hash size={13} className="text-zinc-600" />
                <code className="text-xs text-zinc-500 font-mono">{group.inviteCode}</code>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(group.inviteCode);
                    toast.info('Invite code copied!');
                  }}
                  className="ml-auto text-xs text-violet-400 hover:text-violet-300"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
            <h2 className="font-display text-xl font-bold text-zinc-100 mb-5">Create group</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Group name</label>
                <input
                  id="create-group-name"
                  className="input" placeholder="e.g. Morning Warriors"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Description (optional)</label>
                <textarea
                  className="input resize-none h-20"
                  placeholder="What's this group about?"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
                <button id="create-group-submit" type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join via code modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
            <h2 className="font-display text-xl font-bold text-zinc-100 mb-5">Join a group</h2>
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Invite code</label>
                <input
                  id="join-group-code"
                  className="input font-mono tracking-widest uppercase"
                  placeholder="8-character code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required autoFocus maxLength={8}
                />
              </div>
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setShowJoin(false)} className="btn btn-ghost flex-1">Cancel</button>
                <button id="join-group-submit" type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
