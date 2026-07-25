import { useMemo } from 'react';

/**
 * Heatmap Component
 *
 * Renders a GitHub-style contribution heatmap using CSS Grid.
 * No external library — built entirely with div grid + inline styles.
 *
 * Design decisions:
 * - 53 columns (weeks) × 7 rows (Mon–Sun) = up to 371 cells for a full year
 * - Color intensity:
 *     null/no data  → #1e1e28 (empty, dark)
 *     "skipped"     → #78350f (amber-900 equivalent)
 *     "done"        → #059669 to #10b981 (emerald gradient by recency)
 * - Cells are 12×12px with 3px gap
 * - Month labels appear above the grid
 *
 * Props:
 *   data  {Array<{date: string, status: 'done'|'skipped'|null}>}
 *         Must cover exactly 365 days, sorted ascending.
 */

const CELL_SIZE = 13; // px
const CELL_GAP  = 3;  // px

const statusColor = (status) => {
  if (!status)           return 'rgba(255, 255, 255, 0.03)';
  if (status === 'done') return '#0fa185'; // custom emerald
  if (status === 'skipped') return '#8a5b28'; // muted warm amber/brown
  return 'rgba(255, 255, 255, 0.03)';
};

const statusBorderColor = (status) => {
  if (!status)           return 'rgba(255, 255, 255, 0.05)';
  if (status === 'done') return '#14bc9c';
  if (status === 'skipped') return '#a67236';
  return 'rgba(255, 255, 255, 0.05)';
};

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Heatmap({ data = [] }) {
  // Organise data into a 2D structure: weeks[] of days[0..6]
  const { weeks, monthLabels } = useMemo(() => {
    if (!data.length) return { weeks: [], monthLabels: [] };

    // Pad the start so the first cell aligns to Monday (ISO weekday 1)
    const firstDate = new Date(data[0].date);
    const dayOfWeek = firstDate.getDay(); // 0=Sun…6=Sat
    const isoDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon…6=Sun
    const padded = [...Array(isoDay).fill(null), ...data];

    // Split into weeks of 7
    const weeksArr = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeksArr.push(padded.slice(i, i + 7));
    }

    // Determine which column each month label should appear above
    const labels = [];
    let lastMonth = -1;
    weeksArr.forEach((week, wi) => {
      const firstReal = week.find(Boolean);
      if (firstReal) {
        const m = new Date(firstReal.date).getMonth();
        if (m !== lastMonth) {
          labels.push({ col: wi, label: MONTH_NAMES[m] });
          lastMonth = m;
        }
      }
    });

    return { weeks: weeksArr, monthLabels: labels };
  }, [data]);

  if (!weeks.length) {
    return (
      <div className="skeleton h-32 w-full rounded-xl" />
    );
  }

  const totalW = weeks.length * (CELL_SIZE + CELL_GAP);

  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'flex', gap: `${CELL_GAP}px`, position: 'relative', paddingTop: '22px', minWidth: totalW }}>
        {/* Month labels */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18 }}>
          {monthLabels.map(({ col, label }) => (
            <span
              key={`${col}-${label}`}
              style={{
                position: 'absolute',
                left: col * (CELL_SIZE + CELL_GAP),
                fontSize: 11,
                color: '#71717a',
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Day-of-week labels column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, marginRight: CELL_GAP }}>
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              style={{
                width: 24, height: CELL_SIZE,
                fontSize: 10, color: '#52525b',
                display: 'flex', alignItems: 'center',
                fontWeight: 500,
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}>
            {week.map((cell, di) => {
              if (!cell) {
                return (
                  <div
                    key={di}
                    style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 }}
                  />
                );
              }
              return (
                <div
                  key={di}
                  title={`${cell.date}: ${cell.status || 'no check-in'}`}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 3,
                    background: statusColor(cell.status),
                    border: `1px solid ${statusBorderColor(cell.status)}`,
                    cursor: 'default',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.35)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 justify-end">
        <span className="text-xs text-muted">Less</span>
        {[null, 'done', 'done', 'done'].map((s, i) => (
          <div
            key={i}
            style={{
              width: 12, height: 12, borderRadius: 3,
              background: i === 0 ? 'rgba(255, 255, 255, 0.03)' : i === 1 ? '#097561' : i === 2 ? '#0fa185' : '#14bc9c',
              border: `1px solid ${i === 0 ? 'rgba(255, 255, 255, 0.05)' : '#14bc9c'}`,
            }}
          />
        ))}
        <span className="text-xs text-muted">More</span>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: '#8a5b28', border: '1px solid #a67236' }} />
        <span className="text-xs text-muted">Skipped</span>
      </div>
    </div>
  );
}
