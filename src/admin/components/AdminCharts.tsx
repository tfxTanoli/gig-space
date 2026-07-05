import { useMemo, useState } from 'react';
import type { AdminUser } from './AdminUsersTable';
import type { AdminService } from './AdminServicesTable';
import type { AdminOrder } from './AdminOrdersTable';

interface Props {
  users: AdminUser[];
  services: AdminService[];
  orders: AdminOrder[];
}

type DataPoint = { label: string; value: number };

const WEEKS = 8;

function buildWeeklyData(timestamps: number[]): DataPoint[] {
  const now = Date.now();
  const points: DataPoint[] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86_400_000;
    const end   = now - w * 7 * 86_400_000;
    const value = timestamps.filter((ts) => ts >= start && ts < end).length;
    const date = new Date(end);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    points.push({ label, value });
  }
  return points;
}

// Compact axis labels: 1.2k, 3.4M, etc.
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function LineChart({
  data,
  stroke,
  gradId,
  formatValue,
}: {
  data: DataPoint[];
  stroke: string;
  gradId: string;
  formatValue: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 320, H = 96;
  const PAD_L = 30, PAD_R = 8, PAD_T = 10, PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);

  // Scale to an even integer ceiling so the mid tick is a whole number and the
  // axis never repeats a value (e.g. max 1 used to render as "1, 1, 0").
  const tickMax = max <= 1 ? 1 : Math.ceil(max / 2) * 2;

  const x = (i: number) => PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD_T + (1 - v / tickMax) * plotH;

  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`;

  // Horizontal gridlines / Y-axis ticks — drop the mid tick when the range is
  // too small for it to be a distinct integer.
  const ticks = tickMax <= 1 ? [tickMax, 0] : [tickMax, tickMax / 2, 0];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {ticks.map((t, i) => {
          const ty = PAD_T + (i / (ticks.length - 1)) * plotH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={ty} x2={W - PAD_R} y2={ty} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD_L - 5} y={ty + 3} textAnchor="end" className="fill-slate-500" style={{ fontSize: '8px' }}>
                {compact(t)}
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        <path d={fillPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover guide + emphasized point */}
        {hover !== null && (
          <line x1={pts[hover].x} y1={PAD_T} x2={pts[hover].x} y2={PAD_T + plotH} stroke={stroke} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 3.5 : 2} fill={stroke} stroke="#0f172a" strokeWidth={hover === i ? 1.5 : 0} />
        ))}

        {/* Invisible hover bands — one per point, robust to SVG scaling */}
        {data.map((_, i) => {
          const bandW = plotW / data.length;
          return (
            <rect
              key={i}
              x={PAD_L + i * bandW - (i === 0 ? PAD_L : 0)}
              y={0}
              width={bandW + (i === 0 ? PAD_L : 0)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10 px-2 py-1 rounded-md bg-slate-900 border border-slate-700 shadow-lg whitespace-nowrap"
          style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100}%` }}
        >
          <p className="text-[10px] text-slate-400 leading-tight">Week of {data[hover].label}</p>
          <p className="text-xs font-semibold text-white leading-tight">{formatValue(data[hover].value)}</p>
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between mt-1" style={{ paddingLeft: `${(PAD_L / W) * 100}%`, paddingRight: `${(PAD_R / W) * 100}%` }}>
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-slate-600">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  total: string | number;
  data: DataPoint[];
  color: string;
  stroke: string;
  gradId: string;
  formatValue: (v: number) => string;
}

function ChartCard({ title, total, data, color, stroke, gradId, formatValue }: ChartCardProps) {
  const last = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? 0;

  // Always show a badge (the client wanted one on every chart). Handle the
  // zero-baseline cases gracefully instead of hiding the badge.
  const trend = (() => {
    if (prev === 0 && last === 0) return { text: '0%', up: true };
    if (prev === 0)               return { text: 'New', up: true };
    const t = ((last - prev) / prev) * 100;
    return { text: `${t >= 0 ? '+' : ''}${t.toFixed(0)}%`, up: t >= 0 };
  })();

  return (
    <div className="bg-surface rounded-xl border border-slate-800 p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{total}</p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
            trend.up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}
          title="Change vs. previous week"
        >
          {trend.text} vs last week
        </span>
      </div>

      <div className="mt-4">
        <LineChart data={data} stroke={stroke} gradId={gradId} formatValue={formatValue} />
      </div>
    </div>
  );
}

export default function AdminCharts({ users, services, orders }: Props) {
  const usersData   = useMemo(() => buildWeeklyData(users.map((u) => u.createdAt)), [users]);
  const postsData   = useMemo(() => buildWeeklyData(services.map((s) => s.createdAt ?? 0)), [services]);
  const ordersData  = useMemo(() => buildWeeklyData(orders.map((o) => o.createdAt)), [orders]);
  const revenueData = useMemo(() => {
    const now = Date.now();
    const points: DataPoint[] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const start = now - (w + 1) * 7 * 86_400_000;
      const end   = now - w * 7 * 86_400_000;
      const total = orders
        .filter((o) => o.createdAt >= start && o.createdAt < end && o.status === 'completed')
        .reduce((s, o) => s + o.amount, 0);
      const date = new Date(end);
      points.push({ label: `${date.getMonth() + 1}/${date.getDate()}`, value: total });
    }
    return points;
  }, [orders]);

  const totalUsers   = users.length;
  const totalPosts   = services.length;
  const totalOrders  = orders.length;
  const totalRevenue = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.amount, 0);

  const fmtNum = (v: number) => v.toLocaleString();
  const fmtUSD = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ChartCard title="Total Users"  total={totalUsers.toLocaleString()}  data={usersData}  color="text-blue-400"    stroke="#60a5fa" gradId="chart-users"   formatValue={fmtNum} />
      <ChartCard title="Total Posts"  total={totalPosts.toLocaleString()}  data={postsData}  color="text-purple-400"  stroke="#c084fc" gradId="chart-posts"   formatValue={fmtNum} />
      <ChartCard title="Total Orders" total={totalOrders.toLocaleString()} data={ordersData} color="text-yellow-400"  stroke="#facc15" gradId="chart-orders"  formatValue={fmtNum} />
      <ChartCard title="Total Revenue" total={fmtUSD(totalRevenue)}        data={revenueData} color="text-emerald-400" stroke="#34d399" gradId="chart-revenue" formatValue={fmtUSD} />
    </div>
  );
}
