import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MinusCircle, Flame, ChevronRight, Archive } from 'lucide-react';
import api from '../api/axios';
import toast from './Toast';

/**
 * HabitCard — shown on the Dashboard for each habit.
 *
 * Props:
 *   habit      {object}   — full habit document from the API
 *   onCheckin  {function} — called after a successful check-in with updated habit data
 */
export default function HabitCard({ habit, onCheckin }) {
  const [loading, setLoading] = useState(null); // 'done' | 'skipped' | null
  const navigate = useNavigate();

  const categoryColors = {
    Health:   'badge-emerald', Learning: 'badge-violet', Fitness:  'badge-amber',
    General:  'badge-rose',   Work:     'badge-violet',  Mindfulness: 'badge-emerald',
  };

  const handleCheckin = async (status) => {
    setLoading(status);
    try {
      const { data } = await api.post(`/api/habits/${habit._id}/checkin`, { status });
      onCheckin(data.habit);
      toast.success(status === 'done' ? '🔥 Checked in!' : 'Skipped for today');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to check in';
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card card-hover animate-fade-up group relative overflow-hidden">
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-l-xl opacity-80" />

      <div className="pl-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`badge ${categoryColors[habit.category] || 'badge-violet'}`}>
                {habit.category || 'General'}
              </span>
              <span className="badge badge-amber">
                {habit.frequency === 'weekly'
                  ? `${habit.targetDaysPerWeek}×/wk`
                  : 'Daily'}
              </span>
            </div>
            <h3 className="font-semibold text-zinc-100 text-base truncate">{habit.name}</h3>
          </div>

          {/* Streak badge */}
          <div className="flex items-center gap-1.5 bg-[#d99021]/10 border border-[#d99021]/20 rounded-lg px-3 py-1.5 flex-shrink-0">
            <Flame size={14} className="text-[#f2ad41]" />
            <span className="text-[#f2ad41] font-bold text-sm">{habit.currentStreak}</span>
            <span className="text-[#d99021] text-xs">day{habit.currentStreak !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            id={`habit-done-${habit._id}`}
            onClick={() => handleCheckin('done')}
            disabled={!!loading}
            className="btn btn-success flex-1 text-sm"
          >
            {loading === 'done'
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle2 size={15} />}
            Done
          </button>
          <button
            id={`habit-skip-${habit._id}`}
            onClick={() => handleCheckin('skipped')}
            disabled={!!loading}
            className="btn btn-ghost text-sm px-3"
          >
            {loading === 'skipped'
              ? <span className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
              : <MinusCircle size={15} />}
          </button>
          <button
            onClick={() => navigate(`/habits/${habit._id}`)}
            className="btn btn-ghost text-sm px-3"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
