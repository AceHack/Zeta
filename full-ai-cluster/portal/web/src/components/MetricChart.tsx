import { useMemo } from "react";

interface Props {
  data: number[];
  max: number;
  color?: string; // tailwind text-* color for stroke/fill via currentColor
  height?: number;
  label: string;
  value: string;
  sub?: string;
}

/** A dependency-free SVG area chart with a current-value header. */
export function MetricChart({ data, max, color = "text-primary", height = 64, label, value, sub }: Props) {
  const W = 320;
  const path = useMemo(() => {
    if (data.length === 0) return { line: "", area: "" };
    const n = data.length;
    const x = (i: number) => (i / (n - 1)) * W;
    const y = (v: number) => height - (Math.min(v, max) / (max || 1)) * (height - 6) - 3;
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return { line: `M${pts.join(" L")}`, area: `M0,${height} L${pts.join(" L")} L${W},${height} Z` };
  }, [data, max, height]);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={`mt-2 h-16 w-full ${color}`}>
        <defs>
          <linearGradient id={`g-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path.area} fill={`url(#g-${label})`} />
        <path d={path.line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** A horizontal usage bar (e.g. storage used / total). */
export function UsageBar({ label, used, total, unit, color = "bg-primary" }: { label: string; used: number; total: number; unit: string; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{used}{unit} / {total}{unit}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${pct > 85 ? "bg-destructive" : pct > 65 ? "bg-warning" : color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{pct}% used</div>
    </div>
  );
}
