import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Target, Flame, Zap } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import toast from '../components/Toast';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-xl px-4 py-2 text-sm shadow-xl">
        <p className="text-zinc-400 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
            {typeof p.value === 'number' ? `${p.value}%` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [summary, setSummary]   = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          api.get('/api/analytics/summary'),
          api.get('/api/analytics/completion-over-time'),
        ]);
        setSummary(sRes.data);
        setTimeline(tRes.data.map((d) => ({
          ...d,
          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })));
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const barData = summary?.habitStats
    ?.sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 8)
    .map((h) => ({ name: h.name.length > 16 ? h.name.slice(0, 14) + '…' : h.name, rate: h.completionRate }))
    || [];

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-zinc-100">Analytics</h1>
        <p className="text-zinc-500 mt-1 text-sm">Your habit performance over the last 30 days</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard label="Completion rate" value={`${summary?.overallCompletionRate ?? 0}%`} icon={<TrendingUp size={20} />} color="violet"  loading={loading} />
        <StatCard label="Active streaks"  value={summary?.totalActiveStreaks ?? 0}           icon={<Flame size={20} />}      color="amber"   loading={loading} />
        <StatCard label="Active habits"   value={summary?.activeHabits ?? 0}                icon={<Target size={20} />}     color="emerald" loading={loading} />
        <StatCard
          label="Best habit"
          value={summary?.bestHabit?.completionRate != null ? `${summary.bestHabit.completionRate}%` : '—'}
          sub={summary?.bestHabit?.name}
          icon={<Zap size={20} />}
          color="rose"
          loading={loading}
        />
      </div>

      {/* Line chart — completion rate over time */}
      <div className="card mb-6 animate-fade-up">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={18} className="text-violet-400" />
          <h2 className="font-semibold text-zinc-200">Daily completion rate (last 30 days)</h2>
        </div>
        {loading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : timeline.length === 0 ? (
          <p className="text-zinc-600 text-sm py-8 text-center">No data yet — start checking in your habits!</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="completionRate"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart — per-habit completion */}
      <div className="card animate-fade-up">
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 size={18} className="text-emerald-400" />
          <h2 className="font-semibold text-zinc-200">Per-habit completion rate</h2>
        </div>
        {loading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : barData.length === 0 ? (
          <p className="text-zinc-600 text-sm py-8 text-center">No habits to display.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rate" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
