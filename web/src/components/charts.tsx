/**
 * Shared Recharts chart components — used across all role dashboards.
 * Each component is interactive (filter/sort/hover), animated, and themed
 * to match the CampusLedger design system.
 */
import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────
   Shared types
───────────────────────────────────────────────────────────── */
export type ChartPoint = { label: string; value: number };

export const CHART_PALETTE = [
  '#4F6EF7', '#22C55E', '#F59E0B', '#EF4444',
  '#A78BFA', '#06B6D4', '#F97316', '#84CC16',
  '#EC4899', '#14B8A6',
];

/* ─────────────────────────────────────────────────────────────
   Formatters
───────────────────────────────────────────────────────────── */
function fmtVal(n: number, currency?: boolean): string {
  if (currency) {
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${Math.round(n)}`;
  }
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n * 10) / 10);
}

function fmtFull(n: number, currency?: boolean): string {
  if (!currency) return String(n);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/* ─────────────────────────────────────────────────────────────
   Shared tooltip box style
───────────────────────────────────────────────────────────── */
const TT: React.CSSProperties = {
  background: 'var(--bg-surface, #1a1f2e)',
  border: '1px solid var(--border-color, #3a3d4d)',
  borderRadius: 12,
  padding: '10px 16px',
  boxShadow: '0 10px 32px rgba(0,0,0,0.25)',
  fontSize: '0.82rem',
  minWidth: 164,
};

/* ─────────────────────────────────────────────────────────────
   Filter bar sub-component (reused by DashBarChart)
───────────────────────────────────────────────────────────── */
type SortKey = 'default' | 'desc' | 'asc' | 'az';

function FilterBar({
  search, onSearch,
  sortBy, onSort,
  shown, total,
}: {
  search: string; onSearch: (v: string) => void;
  sortBy: SortKey; onSort: (v: SortKey) => void;
  shown: number; total: number;
}) {
  const sorts: { key: SortKey; label: string }[] = [
    { key: 'default', label: 'Default' },
    { key: 'desc',    label: '↓ High'  },
    { key: 'asc',     label: '↑ Low'   },
    { key: 'az',      label: 'A→Z'     },
  ];

  return (
    <div
      style={{
        display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap',
        padding: '0 2px 10px',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        marginBottom: 10,
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg
          width="12" height="12" viewBox="0 0 20 20" fill="none"
          style={{
            position: 'absolute', left: 7, top: '50%',
            transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none',
          }}
        >
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" />
          <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            paddingLeft: 24, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            fontSize: '0.73rem', borderRadius: 8, width: 108,
            border: '1.5px solid var(--border-color, #d1d5db)',
            background: 'var(--bg-surface, #fff)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
      </div>

      {/* Sort pills */}
      {sorts.map(({ key, label }) => {
        const active = sortBy === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSort(key)}
            style={{
              fontSize: '0.71rem', padding: '2px 9px', borderRadius: 20, lineHeight: 1.5,
              border: `1.5px solid ${active ? '#4F6EF7' : 'var(--border-color, #d1d5db)'}`,
              background: active ? '#4F6EF7' : 'transparent',
              color: active ? '#fff' : 'var(--text-muted, #6b7280)',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        );
      })}

      {/* Item count */}
      <span
        style={{
          marginLeft: 'auto', fontSize: '0.71rem', padding: '2px 9px', borderRadius: 20,
          background: 'var(--bg-muted-2, #f3f4f6)',
          color: 'var(--text-muted, #6b7280)', fontWeight: 600,
          border: '1px solid var(--border-color, #e5e7eb)',
        }}
      >
        {shown}/{total}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DashBarChart
   Vertical bar chart with live search + sort + item count.
═══════════════════════════════════════════════════════════════ */
export function DashBarChart({
  data,
  height = 220,
  color = '#4F6EF7',
  multiColor = false,
  currency = false,
  filterable = true,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  multiColor?: boolean;
  currency?: boolean;
  filterable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('default');

  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const displayed = [...data]
    .filter((d) => !search || d.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'desc') return b.value - a.value;
      if (sortBy === 'asc')  return a.value - b.value;
      if (sortBy === 'az')   return a.label.localeCompare(b.label);
      return 0;
    });

  const chartData = displayed.map((d, i) => ({
    label: d.label,
    value: d.value,
    name:  d.label.length > 13 ? d.label.slice(0, 12) + '…' : d.label,
    fill:  multiColor ? CHART_PALETTE[i % CHART_PALETTE.length] : color,
  }));

  type PL = Array<{ payload: typeof chartData[0] }>;

  return (
    <div style={{ width: '100%' }}>
      {filterable && (
        <FilterBar
          search={search} onSearch={setSearch}
          sortBy={sortBy} onSort={setSortBy}
          shown={displayed.length} total={data.length}
        />
      )}

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', opacity: 0.5, fontSize: '0.85rem' }}>
          No items match the filter.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 14, left: 0, bottom: 52 }}
            barCategoryGap="34%"
          >
            <CartesianGrid
              strokeDasharray="3 3" vertical={false}
              stroke="var(--border-color, #e5e7eb)" opacity={0.65}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-primary, #374151)', fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
              interval={0} angle={-38} textAnchor="end" height={52}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted, #6b7280)' }}
              axisLine={false} tickLine={false}
              width={currency ? 52 : 32}
              tickFormatter={(v: number) => fmtVal(v, currency)}
            />
            <RTip
              cursor={{ fill: 'rgba(79,110,247,0.07)' }}
              content={(props) => {
                const pl = (props.payload as unknown as PL) ?? [];
                if (!props.active || !pl.length) return null;
                const d = pl[0].payload;
                return (
                  <div style={TT}>
                    <p style={{
                      margin: '0 0 8px', fontWeight: 700, fontSize: '0.87rem',
                      borderBottom: '1px solid var(--border-color, #3a3d4d)', paddingBottom: 7,
                    }}>
                      {d.label}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.75 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: d.fill, display: 'inline-block' }} />
                        Value
                      </span>
                      <strong>{fmtFull(d.value, currency)}</strong>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              barSize={12}
              radius={[4, 4, 0, 0]}
              animationBegin={0}
              animationDuration={820}
              animationEasing="ease-out"
              isAnimationActive
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DashLineChart
   Smooth animated area/line chart with styled tooltip.
═══════════════════════════════════════════════════════════════ */
export function DashLineChart({
  data,
  height = 200,
  color = '#4F6EF7',
  currency = false,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  currency?: boolean;
}) {
  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const gradId = `lg-${color.replace('#', '')}`;
  const chartData = data.map((d) => ({ name: d.label, value: d.value, label: d.label }));

  type PL = Array<{ payload: { label: string; value: number } }>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3" vertical={false}
          stroke="var(--border-color, #e5e7eb)" opacity={0.65}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--text-muted, #6b7280)' }}
          tickLine={false} axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted, #6b7280)' }}
          axisLine={false} tickLine={false}
          width={currency ? 52 : 32}
          tickFormatter={(v: number) => fmtVal(v, currency)}
        />
        <RTip
          content={(props) => {
            const pl = (props.payload as unknown as PL) ?? [];
            if (!props.active || !pl.length) return null;
            const d = pl[0].payload;
            return (
              <div style={TT}>
                <p style={{
                  margin: '0 0 8px', fontWeight: 700,
                  borderBottom: '1px solid var(--border-color, #3a3d4d)', paddingBottom: 7,
                }}>
                  {d.label}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.75 }}>
                    <span style={{ width: 10, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
                    Value
                  </span>
                  <strong>{fmtFull(d.value, currency)}</strong>
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2, cursor: 'pointer' }}
          animationBegin={0}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DashPieChart
   Interactive donut/pie chart with hover highlight + legend.
═══════════════════════════════════════════════════════════════ */
export function DashPieChart({
  data,
  donut = false,
}: {
  data: ChartPoint[];
  donut?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length || total === 0) {
    return <div className="chart-empty-msg">No data available</div>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {/* Pie / Donut */}
      <div style={{ flex: '0 0 auto', width: 152, height: 152 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%" cy="50%"
              innerRadius={donut ? 44 : 0}
              outerRadius={68}
              paddingAngle={2}
              animationBegin={0}
              animationDuration={900}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  opacity={active === null || active === i ? 1 : 0.45}
                  stroke={active === i ? '#fff' : 'none'}
                  strokeWidth={active === i ? 2.5 : 0}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                />
              ))}
            </Pie>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <RTip
              formatter={((value: any, name: any) => {
                const n = typeof value === 'number' ? value : Number(value ?? 0);
                return [`${n} (${((n / total) * 100).toFixed(1)}%)`, String(name ?? '')];
              }) as any}
              contentStyle={TT}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, minWidth: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((d, i) => {
          const pct  = ((d.value / total) * 100).toFixed(1);
          const isAct = active === i;
          const col   = CHART_PALETTE[i % CHART_PALETTE.length];
          return (
            <div
              key={d.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 6px', borderRadius: 6, cursor: 'pointer',
                transition: 'all 0.15s',
                opacity: active === null || isAct ? 1 : 0.5,
                background: isAct ? `${col}18` : 'transparent',
              }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: col, flexShrink: 0, display: 'inline-block',
              }} />
              <span style={{ fontSize: '0.79rem', flex: 1, fontWeight: isAct ? 600 : 400 }}>
                {d.label}
              </span>
              <span style={{ fontSize: '0.79rem', fontWeight: 700 }}>{d.value}</span>
              <span style={{ fontSize: '0.71rem', opacity: 0.6, minWidth: 36, textAlign: 'right' }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
