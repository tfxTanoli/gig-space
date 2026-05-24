import { useMemo } from 'react';
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

function buildWeeklyData(timestamps: number[], getValue?: (i: number) => number): DataPoint[] {
  const now = Date.now();
  const points: DataPoint[] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86_400_000;
    const end   = now - w * 7 * 86_400_000;
    const inRange = timestamps.filter((ts) => ts >= start && ts < end);
    const value = getValue
      ? inRange.reduce((sum, _, i) => sum + getValue(i), 0)
      : inRange.length;
    const date = new Date(end);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    points.push({ label, value });
  }
  return points;
}

function SparkLine({
  data,
  color,
  fill,
}: {
  data: DataPoint[];
  color: string;
  fill: string;
}) {
  const W = 280;
  const H = 64;
  const PAD = 4;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = 0;

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.value - min) / (max - min)) * (H - PAD * 2);
    return { x, y };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(H - PAD).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.3" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${color})`} />
      <path d={linePath} fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={fill} />
      ))}
    </svg>
  );
}

interface ChartCardProps {
  title: string;
  total: string | number;
  data: DataPoint[];
  color: string;
  fill: string;
  isCurrency?: boolean;
}

function ChartCard({ title, total, data, color, fill }: ChartCardProps) {
  const last = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? 0;
  const trend = prev === 0 ? null : ((last - prev) / prev) * 100;

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-800 p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{total}</p>
        </div>
        {trend !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
            trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(0)}% vs last week
          </span>
        )}
      </div>

      <div className="mt-4">
        <SparkLine data={data} color={title} fill={fill} />
      </div>

      <div className="flex justify-between mt-2">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-slate-600">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function AdminCharts({ users, services, orders }: Props) {
  const usersData     = useMemo(() => buildWeeklyData(users.map((u) => u.createdAt)), [users]);
  const postsData     = useMemo(() => buildWeeklyData(services.map((s) => s.createdAt ?? 0)), [services]);
  const ordersData    = useMemo(() => buildWeeklyData(orders.map((o) => o.createdAt)), [orders]);
  const revenueData   = useMemo(() => {
    const byWeek: DataPoint[] = buildWeeklyData(orders.map((o) => o.createdAt));
    const now = Date.now();
    return byWeek.map((pt, w) => {
      const start = now - (WEEKS - w) * 7 * 86_400_000;
      const end   = now - (WEEKS - w - 1) * 7 * 86_400_000;
      const total = orders
        .filter((o) => o.createdAt >= start && o.createdAt < end && o.status === 'completed')
        .reduce((s, o) => s + o.amount, 0);
      return { ...pt, value: total };
    });
  }, [orders]);

  const totalUsers   = users.length;
  const totalPosts   = services.length;
  const totalOrders  = orders.length;
  const totalRevenue = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.amount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ChartCard
        title="Total Users"
        total={totalUsers.toLocaleString()}
        data={usersData}
        color="text-blue-400"
        fill="#60a5fa"
      />
      <ChartCard
        title="Total Posts"
        total={totalPosts.toLocaleString()}
        data={postsData}
        color="text-purple-400"
        fill="#c084fc"
      />
      <ChartCard
        title="Total Orders"
        total={totalOrders.toLocaleString()}
        data={ordersData}
        color="text-yellow-400"
        fill="#facc15"
      />
      <ChartCard
        title="Total Revenue"
        total={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        data={revenueData}
        color="text-emerald-400"
        fill="#34d399"
        isCurrency
      />
    </div>
  );
}
