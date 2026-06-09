import { useEffect, useState } from "react";
import { Clock, Globe, Plug, Shield } from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`);

function useDash(fqn: string) {
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => { setD(null); api.dashboard(fqn).then(setD).catch(() => setD(null)); }, [fqn]);
  return d;
}
const Loading = () => <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/40" />)}</div>;

// ── Database → Connections ──────────────────────────────────────────────
export function ConnectionsTab({ fqn }: { fqn: string }) {
  const d = useDash(fqn);
  if (!d) return <Loading />;
  if (d.kind !== "database") return null;
  const pct = Math.round((d.connections.active / d.connections.max) * 100);
  // synthesize a small connection list from the active count
  const apps = ["orders-api", "checkout-worker", "admin-dashboard", "metrics-exporter", "replica-sync"];
  const rows = Array.from({ length: Math.min(d.connections.active, 8) }, (_, i) => ({ app: apps[i % apps.length]!, state: i % 4 === 0 ? "idle" : "active", since: `${(i * 7) % 59}m` }));
  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 font-medium"><Plug className="size-4 text-muted-foreground" /> Connection pool</span><span className="tabular-nums">{d.connections.active} / {d.connections.max} ({pct}%)</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct > 85 ? "bg-destructive" : pct > 65 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Active connections</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Client</th><th className="px-4 py-2 font-medium">State</th><th className="px-4 py-2 font-medium">Connected</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border"><td className="px-4 py-2 font-mono text-xs">{r.app}</td><td className="px-4 py-2"><span className={cn("text-xs", r.state === "active" ? "text-success" : "text-muted-foreground")}>{r.state}</span></td><td className="px-4 py-2 text-muted-foreground">{r.since} ago</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Web → Routes & domains ──────────────────────────────────────────────
export function RoutesTab({ fqn }: { fqn: string }) {
  const d = useDash(fqn);
  if (!d) return <Loading />;
  if (d.kind !== "web") return null;
  const tlsWarn = d.tls.expiresInDays < 21;
  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div><div className="flex items-center gap-2 text-[13px] font-medium"><Globe className="size-4 text-muted-foreground" /> {d.host}</div><div className="mt-1 text-xs text-muted-foreground">Published on the shared Cilium Gateway</div></div>
          <a href={`https://${d.host}`} target="_blank" rel="noreferrer" className="text-[13px] text-primary hover:underline">Open ↗</a>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs"><Shield className={cn("size-3.5", tlsWarn ? "text-warning" : "text-success")} /> TLS via {d.tls.issuer} · <span className={tlsWarn ? "text-warning" : "text-muted-foreground"}>expires in {d.tls.expiresInDays}d</span></div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Routes</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Method</th><th className="px-4 py-2 font-medium">Path</th><th className="px-4 py-2 font-medium">Hits</th></tr></thead>
            <tbody>{d.routes.map((r) => <tr key={r.path} className="border-t border-border"><td className="px-4 py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{r.method}</span></td><td className="px-4 py-2 font-mono text-xs">{r.path}</td><td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtNum(r.hits)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Worker → Schedule & runs ────────────────────────────────────────────
export function ScheduleTab({ fqn }: { fqn: string }) {
  const d = useDash(fqn);
  if (!d) return <Loading />;
  if (d.kind !== "worker") return null;
  const runs = Array.from({ length: 6 }, (_, i) => ({ at: `${12 - i}:00`, status: i === 2 ? "failed" : "succeeded", dur: `${d.avgDurationSec + (i % 3) * 2}s` }));
  return (
    <div className="max-w-3xl space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-3.5" /> Last run</div><div className="mt-1 text-sm font-medium">{d.lastRun}</div></div>
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Next run</div><div className="mt-1 text-sm font-medium">{d.nextRun}</div></div>
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Success rate</div><div className="mt-1 text-sm font-medium text-success">{d.successRatePct}%</div></div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent runs</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Started</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Duration</th></tr></thead>
            <tbody>{runs.map((r, i) => <tr key={i} className="border-t border-border"><td className="px-4 py-2">{r.at}</td><td className="px-4 py-2"><span className={cn("text-xs", r.status === "succeeded" ? "text-success" : "text-destructive")}>{r.status}</span></td><td className="px-4 py-2 tabular-nums text-muted-foreground">{r.dur}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
