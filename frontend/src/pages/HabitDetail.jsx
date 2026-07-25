import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, Zap, TrendingUp, ArrowLeft, Archive, Trash2 } from 'lucide-react';
import api from '../api/axios';
import Heatmap from '../components/Heatmap';
import StatCard from '../components/StatCard';
import toast from '../components/Toast';

export default function HabitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [habit, setHabit]       = useState(null);
  const [heatmap, setHeatmap]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [habitRes, heatmapRes] = await Promise.all([
          api.get(`/api/habits/${id}`),
          api.get(`/api/analytics/heatmap/${id}`),
        ]);
        setHabit(habitRes.data);
        setHeatmap(heatmapRes.data);
      } catch {
        toast.error('Failed to load habit details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleArchive = async () => {
    try {
      await api.patch(`/api/habits/${id}`, { archived: !habit.archived });
      toast.success(habit.archived ? 'Habit restored!' : 'Habit archived');
      setHabit({ ...habit, archived: !habit.archived });
    } catch {
      toast.error('Failed to update habit');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this habit and all its history? This cannot be undone.')) return;
    try {
      await api.delete(`/api/habits/${id}`);
      toast.success('Habit deleted');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete habit');
    }
  };

  // Compute completion rate from heatmap data
  const doneDays   = heatmap.filter((d) => d.status === 'done').length;
  const totalDays  = heatmap.filter((d) => d.status !== null).length;
  const completion = totalDays ? Math.round((doneDays / totalDays) * 100) : 0;

  if (loading) {
    return (
      <div className="flex-1 p-6 lg:p-8">
        <div className="skeleton h-8 w-48 mb-6 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-28 skeleton" />)}
        </div>
        <div className="card skeleton h-48" />
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-zinc-500">Habit not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8 animate-fade-up">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl font-bold text-zinc-100">{habit.name}</h1>
            {habit.archived && (
              <span className="badge badge-amber">Archived</span>
            )}
          </div>
          <p className="text-zinc-500 text-sm">
            {habit.category} · {habit.frequency === 'weekly'
              ? `${habit.targetDaysPerWeek}× per week`
              : 'Daily'} · Created {new Date(habit.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="habit-archive-btn"
            onClick={handleArchive}
            className="btn btn-ghost text-sm"
          >
            <Archive size={15} />
            {habit.archived ? 'Restore' : 'Archive'}
          </button>
          <button
            id="habit-delete-btn"
            onClick={handleDelete}
            className="btn btn-danger text-sm"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard label="Current streak"  value={`${habit.currentStreak}d`}  icon={<Flame size={20} />}      color="amber"   />
        <StatCard label="Longest streak"  value={`${habit.longestStreak}d`}  icon={<Zap size={20} />}        color="violet"  />
        <StatCard label="Completion rate" value={`${completion}%`}           icon={<TrendingUp size={20} />}  color="emerald" />
        <StatCard label="Total done"      value={doneDays}                   icon={<Flame size={20} />}      color="rose"    />
      </div>

      {/* Heatmap */}
      <div className="card mb-6 animate-fade-up">
        <h2 className="font-semibold text-zinc-200 mb-4 text-base">Activity over the last year</h2>
        <Heatmap data={heatmap} />
      </div>

      {/* Recent check-ins */}
      <div className="card animate-fade-up">
        <h2 className="font-semibold text-zinc-200 mb-4 text-base">Recent check-ins</h2>
        {heatmap.length === 0 ? (
          <p className="text-zinc-600 text-sm">No check-ins yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...heatmap]
              .filter((d) => d.status !== null)
              .reverse()
              .slice(0, 10)
              .map((d) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between py-2 border-b border-[#2a2a35] last:border-0"
                >
                  <span className="text-zinc-400 text-sm">
                    {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className={`badge ${d.status === 'done' ? 'badge-emerald' : 'badge-amber'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
