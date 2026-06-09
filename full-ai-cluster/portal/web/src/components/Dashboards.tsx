import { useEffect, useState } from "react";
import {
  Activity, Clock, Copy, Database, Gauge, Globe, HardDrive, ListChecks, Map, Plug,
  Server, Shield, Timer, TrendingUp, Users, Zap,
} from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`);
const fmtMi = (mi: number) => (mi >= 1024 ? `${(mi / 1024).toFixed(1)} GiB` : `${mi} MiB`);

// ── shared presentational primitives ──────────────────────────────────
function Stat({ icon: Icon, label, value, sub, accent }: { icon: typeof Gauge; label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", accent)} /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
function StatusPill({ ok, warn, down, label }: { ok?: boolean; warn?: boolean; down?: boolean; label: string }) {
  const c = down ? "bg-destructive/15 text-destructive border-destructive/30" : warn ? "bg-warning/15 text-warning border-warning/30" : ok ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium", c)}><span className={cn("size-1.5 rounded-full", down ? "bg-destructive" : warn ? "bg-warning" : ok ? "bg-success" : "bg-muted-foreground")} />{label}</span>;
}
function Bar({ value, max, warn = 80, danger = 92 }: { value: number; max: number; warn?: number; danger?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", pct >= danger ? "bg-destructive" : pct >= warn ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}
function Section({ title, children, icon: Icon }: { title: string; icon: typeof Gauge; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" /> {title}</h3>
      {children}
    </div>
  );
}
const copyBtn = (text: string) => (
  <button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-3" /></button>
);

// ── the four dashboards ────────────────────────────────────────────────
function GameDash({ d }: { d: Extract<Dashboard, { kind: "game" }> }) {
  const online = d.status === "online";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill ok={online} down={!online} label={online ? "Server online" : "Server offline"} />
        <span className="text-sm text-muted-foreground">{d.game} · {d.gamemode}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users className="size-3.5" /> Players</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">{d.players.online}<span className="text-base text-muted-foreground"> / {d.players.max}</span></div>
          <Bar value={d.players.online} max={d.players.max} />
        </div>
        <Stat icon={Map} label="Map" value={<span className="text-base">{d.map}</span>} sub={`tickrate ${d.tickrate}`} />
        <Stat icon={Clock} label="Uptime" value={<span className="text-base">{d.uptime}</span>} />
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Server className="size-3.5" /> Connect</div>
          <div className="mt-1.5 flex items-center gap-1 font-mono text-sm">{d.address}{copyBtn(d.address)}</div>
        </div>
      </div>
      <Section title="Recent joins" icon={Users}>
        {d.recentJoins.length === 0 ? <p className="text-sm text-muted-foreground">No players connected.</p> : (
          <div className="divide-y divide-border/60 rounded-lg border border-border">
            {d.recentJoins.map((p) => <div key={p.name} className="flex items-center justify-between px-4 py-2 text-sm"><span>{p.name}</span><span className="text-muted-foreground">{p.at}</span></div>)}
          </div>
        )}
      </Section>
    </div>
  );
}

function DatabaseDash({ d }: { d: Extract<Dashboard, { kind: "database" }> }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill ok={d.status === "ready"} warn={d.status === "degraded"} down={d.status === "down"} label={d.status === "ready" ? "Accepting connections" : d.status} />
        <span className="text-sm text-muted-foreground">{d.engine} · {d.replication}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Plug className="size-3.5" /> Connections</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">{d.connections.active}<span className="text-base text-muted-foreground"> / {d.connections.max}</span></div>
          <Bar value={d.connections.active} max={d.connections.max} />
        </div>
        <Stat icon={HardDrive} label="Size on disk" value={fmtMi(d.sizeMi)} sub={`${d.tables} tables`} />
        <Stat icon={Zap} label="Queries / sec" value={fmtNum(d.queriesPerSec)} accent="text-primary" />
        <Stat icon={Gauge} label="Cache hit" value={`${d.cacheHitPct}%`} sub="buffer cache" />
      </div>
      <Section title="Largest tables" icon={Database}>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Table</th><th className="px-4 py-2 font-medium">Rows</th><th className="px-4 py-2 font-medium">Size</th></tr></thead>
            <tbody>{d.topTables.map((t) => <tr key={t.name} className="border-t border-border/60"><td className="px-4 py-2 font-mono text-xs">{t.name}</td><td className="px-4 py-2 tabular-nums">{fmtNum(t.rows)}</td><td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtMi(t.sizeMi)}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function WebDash({ d }: { d: Extract<Dashboard, { kind: "web" }> }) {
  const tlsWarn = d.tls.expiresInDays < 21;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill ok={d.status === "serving"} warn={d.status === "errors"} down={d.status === "down"} label={d.status === "serving" ? "Serving traffic" : d.status} />
        <a href={`https://${d.host}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Globe className="size-3.5" /> {d.host}</a>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="Requests / min" value={fmtNum(d.requestsPerMin)} accent="text-primary" />
        <Stat icon={Timer} label="Latency p50 / p95" value={<span className="text-xl">{d.p50ms} / {d.p95ms}<span className="text-sm text-muted-foreground"> ms</span></span>} />
        <Stat icon={Activity} label="Error rate" value={`${d.errorRatePct.toFixed(2)}%`} sub="5xx / total" />
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Shield className={cn("size-3.5", tlsWarn && "text-warning")} /> TLS</div>
          <div className="mt-1.5 text-sm font-medium">{d.tls.issuer}</div>
          <div className={cn("text-xs", tlsWarn ? "text-warning" : "text-muted-foreground")}>expires in {d.tls.expiresInDays}d</div>
        </div>
      </div>
      <Section title="Top routes" icon={Globe}>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Method</th><th className="px-4 py-2 font-medium">Path</th><th className="px-4 py-2 font-medium">Hits</th></tr></thead>
            <tbody>{d.routes.map((r) => <tr key={r.path} className="border-t border-border/60"><td className="px-4 py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{r.method}</span></td><td className="px-4 py-2 font-mono text-xs">{r.path}</td><td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtNum(r.hits)}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function WorkerDash({ d }: { d: Extract<Dashboard, { kind: "worker" }> }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill ok={d.status === "running"} warn={d.status === "idle"} down={d.status === "failed"} label={d.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Runs today" value={d.runsToday} sub={`success ${d.successRatePct}%`} accent="text-primary" />
        <Stat icon={Clock} label="Last run" value={<span className="text-base">{d.lastRun}</span>} sub={`next ${d.nextRun}`} />
        <Stat icon={Timer} label="Avg duration" value={`${d.avgDurationSec}s`} />
        <Stat icon={Activity} label="Queue depth" value={d.queueDepth} sub="pending items" />
      </div>
    </div>
  );
}

export function ResourceDashboard({ fqn }: { fqn: string }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setErr(null);
    setD(null);
    api.dashboard(fqn).then(setD).catch((e) => setErr(e.message));
  }, [fqn]);
  if (err) return <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">Dashboard data needs the in-cluster ResourceOps backend.</div>;
  if (!d) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />)}</div>;
  switch (d.kind) {
    case "game": return <GameDash d={d} />;
    case "database": return <DatabaseDash d={d} />;
    case "web": return <WebDash d={d} />;
    case "worker": return <WorkerDash d={d} />;
  }
}
