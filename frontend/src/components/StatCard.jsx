/**
 * StatCard — a compact metric card used on Dashboard, HabitDetail, Analytics.
 *
 * Props:
 *   label    {string}        — metric label
 *   value    {string|number} — primary value
 *   sub      {string}        — optional subtitle
 *   icon     {ReactNode}     — lucide icon element
 *   color    {string}        — 'violet'|'emerald'|'amber'|'rose'
 *   loading  {boolean}       — shows skeleton when true
 */
const colorMap = {
  violet:  { iconBg: 'bg-violet-500/10', iconText: 'text-violet-400', hover: 'hover:border-violet-500/30' },
  emerald: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-400', hover: 'hover:border-emerald-500/30' },
  amber:   { iconBg: 'bg-amber-500/10', iconText: 'text-amber-400', hover: 'hover:border-amber-500/30' },
  rose:    { iconBg: 'bg-rose-500/10', iconText: 'text-rose-400', hover: 'hover:border-rose-500/30' },
};

export default function StatCard({ label, value, sub, icon, color = 'emerald', loading = false }) {
  const theme = colorMap[color] || colorMap.emerald;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="skeleton h-8 w-8 rounded-lg mb-4" />
        <div className="skeleton h-7 w-16 mb-2" />
        <div className="skeleton h-4 w-24" />
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-xl p-6 transition-colors ${theme.hover} animate-fade-up`}>
      <div className="flex items-center justify-between mb-4">
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.iconBg} ${theme.iconText}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        {value}
      </div>
      <div className="text-muted text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-[#6a6662] text-xs mt-1.5">{sub}</div>}
    </div>
  );
}
