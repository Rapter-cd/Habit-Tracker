import { useState, useEffect, useCallback } from 'react';
import { Plus, Flame, CalendarCheck2, Zap, Target } from 'lucide-react';
import api from '../api/axios';
import HabitCard from '../components/HabitCard';
import StatCard from '../components/StatCard';
import toast from '../components/Toast';
import useAuthStore from '../store/authStore';
import { format } from 'date-fns';

const CATEGORIES = ['Health', 'Fitness', 'Learning', 'Work', 'Mindfulness', 'General'];

export default function Dashboard() {
  const { user } = useAuthStore();
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Health', frequency: 'daily', targetDaysPerWeek: 3 });
  const [creating, setCreating] = useState(false);

  const fetchHabits = useCallback(async () => {
    try {
      const { data } = await api.get('/api/habits');
      setHabits(data);
    } catch {
      toast.error('Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const handleCheckin = (updatedHabit) => {
    setHabits((prev) =>
      prev.map((h) =>
        h._id === updatedHabit._id
          ? { ...h, currentStreak: updatedHabit.currentStreak, longestStreak: updatedHabit.longestStreak }
          : h
      )
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/api/habits', form);
      setHabits((prev) => [data, ...prev]);
      setShowModal(false);
      setForm({ name: '', category: 'Health', frequency: 'daily', targetDaysPerWeek: 3 });
      toast.success('Habit created! 🎯');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create habit');
    } finally {
      setCreating(false);
    }
  };

  // Summary stats from current habits
  const totalActive = habits.length;
  const activeStreaks = habits.filter((h) => h.currentStreak > 0).length;
  const longestStreak = habits.reduce((m, h) => Math.max(m, h.longestStreak), 0);

  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="flex-1 min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <p className="text-zinc-500 text-sm mb-1">{today}</p>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
              <span className="text-white">{user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">
              {totalActive === 0 ? "You haven't created any habits yet." : `You have ${totalActive} active habit${totalActive !== 1 ? 's' : ''} today.`}
            </p>
          </div>
          <button
            id="create-habit-btn"
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            <Plus size={18} /> New Habit
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard label="Active habits"    value={totalActive}    icon={<Target size={20} />}       color="violet"  loading={loading} />
        <StatCard label="Active streaks"   value={activeStreaks}  icon={<Flame size={20} />}        color="amber"   loading={loading} />
        <StatCard label="Longest streak"   value={`${longestStreak}d`} icon={<Zap size={20} />}   color="emerald" loading={loading} />
        <StatCard label="Checked in today" value={habits.filter(h => h.currentStreak > 0).length} icon={<CalendarCheck2 size={20} />} color="rose" loading={loading} />
      </div>

      {/* Habits grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-36 skeleton" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 shadow-sm">
            <Zap size={36} className="text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No habits yet</h2>
          <p className="text-zinc-600 max-w-xs mb-6 text-sm">
            Create your first habit and start building a streak today. Consistency is the key!
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={18} /> Create my first habit
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {habits.map((habit) => (
            <HabitCard key={habit._id} habit={habit} onCheckin={handleCheckin} />
          ))}
        </div>
      )}

      {/* Create habit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
            <h2 className="text-xl font-bold text-white mb-5 tracking-tight">New habit</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Habit name</label>
                <input
                  id="new-habit-name"
                  className="input"
                  placeholder="e.g. Morning run, Read 20 pages…"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Category</label>
                  <select
                    id="new-habit-category"
                    className="input"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Frequency</label>
                  <select
                    id="new-habit-frequency"
                    className="input"
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {form.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">
                    Days per week target
                  </label>
                  <input
                    type="number" min="1" max="7"
                    className="input"
                    value={form.targetDaysPerWeek}
                    onChange={(e) => setForm({ ...form, targetDaysPerWeek: Number(e.target.value) })}
                  />
                </div>
              )}

              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  id="create-habit-submit"
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary flex-1"
                >
                  {creating
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
