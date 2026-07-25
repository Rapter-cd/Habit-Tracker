import { useState, useEffect } from 'react';
import { User, Save, Archive, Trash2, RotateCcw } from 'lucide-react';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import toast from '../components/Toast';

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile]   = useState({ name: '', avatar: '' });
  const [habits, setHabits]     = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingHabits, setLoadingHabits] = useState(true);

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', avatar: user.avatar || '' });
  }, [user]);

  useEffect(() => {
    api.get('/api/habits?includeArchived=true')
      .then((r) => setHabits(r.data))
      .catch(() => toast.error('Failed to load habits'))
      .finally(() => setLoadingHabits(false));
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/api/auth/profile', {
        name: profile.name,
        avatar: profile.avatar || null,
      });
      setUser(data);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleArchive = async (habit) => {
    try {
      await api.patch(`/api/habits/${habit._id}`, { archived: !habit.archived });
      setHabits((prev) =>
        prev.map((h) => h._id === habit._id ? { ...h, archived: !h.archived } : h)
      );
      toast.success(habit.archived ? 'Habit restored!' : 'Habit archived');
    } catch {
      toast.error('Failed to update habit');
    }
  };

  const deleteHabit = async (habit) => {
    if (!window.confirm(`Delete "${habit.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/habits/${habit._id}`);
      setHabits((prev) => prev.filter((h) => h._id !== habit._id));
      toast.success('Habit deleted');
    } catch {
      toast.error('Failed to delete habit');
    }
  };

  const activeHabits   = habits.filter((h) => !h.archived);
  const archivedHabits = habits.filter((h) => h.archived);

  return (
    <div className="flex-1 p-6 lg:p-8 max-w-3xl">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 mt-1 text-sm">Manage your profile and habits</p>
      </div>

      {/* Profile card */}
      <div className="card mb-6 animate-fade-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <User size={18} className="text-violet-400" />
          </div>
          <h2 className="font-semibold text-zinc-200">Profile</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden">
              {profile.avatar
                ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                : profile.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Avatar URL</label>
              <input
                id="settings-avatar"
                type="url"
                className="input text-sm"
                placeholder="https://example.com/avatar.jpg"
                value={profile.avatar}
                onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Display name</label>
            <input
              id="settings-name"
              type="text"
              className="input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              className="input opacity-50 cursor-not-allowed"
              value={user?.email || ''}
              disabled
            />
            <p className="text-xs text-zinc-600 mt-1">Email cannot be changed.</p>
          </div>

          <div className="flex justify-end mt-1">
            <button
              id="settings-save-profile"
              type="submit"
              disabled={savingProfile}
              className="btn btn-primary"
            >
              {savingProfile
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Save size={15} /> Save profile</>}
            </button>
          </div>
        </form>
      </div>

      {/* Habits management */}
      <div className="card animate-fade-up">
        <h2 className="font-semibold text-zinc-200 mb-5">Manage habits</h2>

        {loadingHabits ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Active habits */}
            {activeHabits.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mb-3">Active</p>
                <div className="flex flex-col gap-2">
                  {activeHabits.map((h) => (
                    <div key={h._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#1e1e28] border border-[#2a2a35]">
                      <div>
                        <p className="text-zinc-200 text-sm font-medium">{h.name}</p>
                        <p className="text-zinc-600 text-xs">{h.category} · {h.frequency}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleArchive(h)}
                          className="btn btn-ghost text-xs py-1.5 px-3"
                        >
                          <Archive size={13} /> Archive
                        </button>
                        <button
                          onClick={() => deleteHabit(h)}
                          className="btn btn-danger text-xs py-1.5 px-3"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archived habits */}
            {archivedHabits.length > 0 && (
              <div>
                <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mb-3">Archived</p>
                <div className="flex flex-col gap-2">
                  {archivedHabits.map((h) => (
                    <div key={h._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#1a1a22] border border-[#252530] opacity-70">
                      <div>
                        <p className="text-zinc-400 text-sm font-medium">{h.name}</p>
                        <p className="text-zinc-600 text-xs">{h.category} · {h.frequency}</p>
                      </div>
                      <button
                        onClick={() => toggleArchive(h)}
                        className="btn btn-ghost text-xs py-1.5 px-3"
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {habits.length === 0 && (
              <p className="text-zinc-600 text-sm py-4 text-center">No habits yet. Create one on the Dashboard!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
