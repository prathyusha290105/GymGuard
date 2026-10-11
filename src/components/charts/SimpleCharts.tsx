import React from 'react';

export const AttendanceTrendChart: React.FC<{ data?: { day: string; count: number }[] }> = ({
  data = [
    { day: 'Mon', count: 42 },
    { day: 'Tue', count: 58 },
    { day: 'Wed', count: 64 },
    { day: 'Thu', count: 52 },
    { day: 'Fri', count: 71 },
    { day: 'Sat', count: 85 },
    { day: 'Sun', count: 39 },
  ],
}) => {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="w-full h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-1">
      {data.map((item, idx) => {
        const heightPct = Math.round((item.count / max) * 100);
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-emerald-400 font-mono">
              {item.count}
            </div>
            <div className="w-full max-w-[28px] bg-zinc-800 rounded-t-sm flex items-end h-full overflow-hidden group-hover:bg-zinc-750">
              <div
                style={{ height: `${heightPct}%` }}
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 group-hover:from-emerald-500 group-hover:to-emerald-300"
              />
            </div>
            <span className="text-[11px] font-medium text-zinc-400">{item.day}</span>
          </div>
        );
      })}
    </div>
  );
};

export const MembershipStatusChart: React.FC<{
  stats: {
    active: number;
    expiringSoon: number;
    expired: number;
    frozen: number;
    suspended: number;
  };
}> = ({ stats }) => {
  const total = stats.active + stats.expiringSoon + stats.expired + stats.frozen + stats.suspended || 1;

  const items = [
    { label: 'Active', count: stats.active, color: 'bg-emerald-500', text: 'text-emerald-400' },
    { label: 'Expiring Soon', count: stats.expiringSoon, color: 'bg-amber-500', text: 'text-amber-400' },
    { label: 'Expired', count: stats.expired, color: 'bg-rose-500', text: 'text-rose-400' },
    { label: 'Frozen', count: stats.frozen, color: 'bg-cyan-500', text: 'text-cyan-400' },
    { label: 'Suspended', count: stats.suspended, color: 'bg-purple-500', text: 'text-purple-400' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Progress stack */}
      <div className="h-4 w-full bg-zinc-800 rounded-full flex overflow-hidden p-0.5 gap-0.5">
        {items.map((it, idx) => {
          const widthPct = (it.count / total) * 100;
          if (widthPct === 0) return null;
          return (
            <div
              key={idx}
              style={{ width: `${widthPct}%` }}
              className={`${it.color} h-full rounded-sm transition-all duration-500`}
              title={`${it.label}: ${it.count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${it.color}`} />
            <span className="text-zinc-400">{it.label}:</span>
            <span className={`font-semibold ${it.text}`}>{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PeakHoursChart: React.FC = () => {
  const hours = [
    { time: '6am', val: 25 },
    { time: '7am', val: 45 },
    { time: '8am', val: 75 },
    { time: '9am', val: 60 },
    { time: '12pm', val: 50 },
    { time: '3pm', val: 35 },
    { time: '5pm', val: 95 },
    { time: '6pm', val: 100 },
    { time: '7pm', val: 90 },
    { time: '8pm', val: 65 },
    { time: '9pm', val: 30 },
  ];

  return (
    <div className="w-full flex items-end justify-between gap-1.5 h-32 pt-4">
      {hours.map((h, idx) => {
        const isPeak = h.val >= 90;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
            <div
              style={{ height: `${h.val}%` }}
              className={`w-full max-w-[20px] rounded-t-sm transition-all ${
                isPeak ? 'bg-amber-500' : 'bg-zinc-700 group-hover:bg-zinc-600'
              }`}
              title={`${h.time}: ${h.val}% occupancy`}
            />
            <span className={`text-[10px] ${isPeak ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
              {h.time}
            </span>
          </div>
        );
      })}
    </div>
  );
};
