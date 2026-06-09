import { useCallback, useEffect, useState } from "react";
import {
  Boxes, CalendarClock, FolderTree, Gauge, Globe, HardDriveDownload, ListTree, Map as MapIcon, MessagesSquare, Plug,
  Play, Power, RefreshCw, RotateCw, ScrollText, Settings2, Sliders, Table2, TerminalSquare, Trash2, TriangleAlert, Users, Waypoints,
} from "lucide-react";
import {
  api, type K8sEvent, type Metrics, type PodInfo, type ResourceConfig, type ResourceVM,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HealthDot, PersonaAvatar, catIcon } from "@/components/bits";
import { MetricChart, UsageBar } from "@/components/MetricChart";
import { RoomTimeline } from "@/components/RoomTimeline";
import { Terminal } from "@/components/Terminal";
import { FileExplorer } from "@/components/FileExplorer";
import { ResourceDashboard } from "@/components/Dashboards";
import { LogsView } from "@/components/LogsView";
import { TracesView } from "@/components/TracesView";
import { ConnectionsTab, RoutesTab, ScheduleTab } from "@/components/TypeTabs";
import { BackupsTab, QueryTab, TablesTab } from "@/components/DatabaseTabs";
import { MapsTab, PlayersTab } from "@/components/GameTabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "overview" | "metrics" | "logs" | "traces" | "console" | "files" | "query" | "tables" | "backups" | "players" | "maps" | "connections" | "routes" | "schedule" | "config" | "events" | "room" | "danger";
type TabDef = { id: Tab; label: string; icon: typeof Gauge };

const T: Record<string, TabDef> = {
  overview: { id: "overview", label: "Overview", icon: Settings2 },
  metrics: { id: "metrics", label: "Metrics", icon: Gauge },
  logs: { id: "logs", label: "Logs", icon: ScrollText },
  traces: { id: "traces", label: "Traces", icon: Waypoints },
  console: { id: "console", label: "Console", icon: TerminalSquare },
  files: { id: "files", label: "Files", icon: FolderTree },
  query: { id: "query", label: "Query", icon: TerminalSquare },
  tables: { id: "tables", label: "Tables", icon: Table2 },
  backups: { id: "backups", label: "Backups", icon: HardDriveDownload },
  players: { id: "players", label: "Players", icon: Users },
  maps: { id: "maps", label: "Maps", icon: MapIcon },
  connections: { id: "connections", label: "Connections", icon: Plug },
  routes: { id: "routes", label: "Routes", icon: Globe },
  schedule: { id: "schedule", label: "Schedule", icon: CalendarClock },
  config: { id: "config", label: "Config", icon: Sliders },
  events: { id: "events", label: "Events", icon: ListTree },
  room: { id: "room", label: "Room", icon: MessagesSquare },
  danger: { id: "danger", label: "Danger zone", icon: TriangleAlert },
};

/** Per-resource-type tab sets — a database has no Files/shell; a game has RCON+Files; etc. */
function tabsFor(category: string): TabDef[] {
  const common = [T.overview!, T.metrics!, T.logs!, T.traces!];
  const tail = [T.config!, T.events!, T.room!, T.danger!];
  switch (category) {
    // game: live roster + map control + RCON console + SFTP files
    case "game": return [...common, T.players!, T.maps!, T.console!, T.files!, ...tail];
    // database: SQL query console + schema browser + connections + backups — no shell/files
    case "database": return [...common, T.query!, T.tables!, T.connections!, T.backups!, ...tail];
    // web: routes/domains + a shell console
    case "web": return [...common, T.routes!, T.console!, ...tail];
    // worker: schedule/runs + a shell console
    default: return [...common, T.schedule!, T.console!, ...tail];
  }
}

const fmtAge = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`);

export function ResourceConsole({ resource, onBack, onChanged }: { resource: ResourceVM; onBack: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const fqn = `${resource.namespace}/${resource.name}`;
  const Icon = catIcon(resource.category);
  const tabs = tabsFor(resource.category);

  const act = async (label: string, pending: string, fn: () => Promise<{ message: string }>) => {
    setBusy(label);
    await toast.promise(fn(), {
      loading: pending,
      success: (r) => { onChanged(); return r.message; },
      error: (e) => (e as Error).message,
    });
    setBusy(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* header — flat, command-bar style */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border"><Icon className="size-[18px] text-muted-foreground" /></div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{resource.name}</h1>
          <p className="text-xs text-muted-foreground">{resource.namespace} · {resource.blueprint}</p>
        </div>
        <HealthDot health={resource.health} label={resource.phase} className="ml-1" />
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("restart", "Restarting…", () => api.lifecycle(fqn, "restart"))}><RotateCw className={cn("size-3.5", busy === "restart" && "animate-spin")} /> Restart</Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("stop", "Stopping…", () => api.lifecycle(fqn, "stop"))}><Power className="size-3.5" /> Stop</Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("start", "Starting…", () => api.lifecycle(fqn, "start"))}><Play className="size-3.5" /> Start</Button>
        </div>
      </div>

      {/* horizontal tab bar — per resource type */}
      <div className="mb-5 flex items-center gap-0.5 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const TabIcon = t.icon;
          const active = tab === t.id;
          const danger = t.id === "danger";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors",
                active ? (danger ? "border-destructive text-destructive" : "border-foreground text-foreground") : cn("border-transparent text-muted-foreground hover:text-foreground", danger && "hover:text-destructive"),
              )}
            >
              <TabIcon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* content */}
      <div className="min-w-0 flex-1 overflow-y-auto pb-8">
        {tab === "overview" && <Overview resource={resource} fqn={fqn} />}
        {tab === "metrics" && <MetricsTab fqn={fqn} />}
        {tab === "logs" && <LogsView fqn={fqn} admin={resource.admin} />}
        {tab === "traces" && <TracesView fqn={fqn} />}
        {tab === "console" && <TerminalTab fqn={fqn} />}
        {tab === "query" && <QueryTab fqn={fqn} />}
        {tab === "tables" && <TablesTab fqn={fqn} />}
        {tab === "backups" && <BackupsTab fqn={fqn} />}
        {tab === "players" && <PlayersTab fqn={fqn} />}
        {tab === "maps" && <MapsTab fqn={fqn} onChanged={onChanged} />}
        {tab === "files" && <FileExplorer fqn={fqn} category={resource.category} />}
        {tab === "connections" && <ConnectionsTab fqn={fqn} />}
        {tab === "routes" && <RoutesTab fqn={fqn} />}
        {tab === "schedule" && <ScheduleTab fqn={fqn} />}
        {tab === "config" && <ConfigTab fqn={fqn} onChanged={onChanged} />}
        {tab === "events" && <EventsTab fqn={fqn} />}
        {tab === "room" && <RoomTimeline resource={fqn} admin={resource.admin} />}
        {tab === "danger" && <DangerTab fqn={fqn} name={resource.name} onDeleted={onBack} />}
      </div>
    </div>
  );
}

// ── async helper ───────────────────────────────────────────────────────
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; err: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setErr(null);
    fn().then(setData).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(load, [load]);
  return { data, err, reload: load };
}
const Loading = () => <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />)}</div>;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────
function Overview({ resource, fqn }: { resource: ResourceVM; fqn: string }) {
  const { data: pods } = useAsync<PodInfo[]>(() => api.info(fqn), [fqn]);
  return (
    <div className="space-y-6">
      {resource.message && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{resource.message}</div>}

      {/* type-specific dashboard — game vs database vs web vs worker */}
      <ResourceDashboard fqn={fqn} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Blueprint"><Badge variant="secondary">{resource.blueprint}</Badge></Stat>
        <Stat label="Exposure">{resource.expose}{resource.host ? ` · ${resource.host}` : ""}</Stat>
        <Stat label="Operated by"><PersonaAvatar id={resource.admin} kind="persona" /></Stat>
        <Stat label="Pods">{pods ? `${pods.filter((p) => p.ready).length}/${pods.length} ready` : "…"}</Stat>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Boxes className="size-4 text-muted-foreground" /> Pods</h3>
        {!pods ? <Loading /> : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Phase</th><th className="px-3 py-2 font-medium">Restarts</th><th className="px-3 py-2 font-medium">Node</th><th className="px-3 py-2 font-medium">IP</th><th className="px-3 py-2 font-medium">Age</th></tr>
              </thead>
              <tbody>
                {pods.map((p) => (
                  <tr key={p.name} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{p.name}</td>
                    <td className="px-3 py-2"><span className={p.ready ? "text-success" : "text-destructive"}>{p.phase}</span></td>
                    <td className="px-3 py-2 tabular-nums">{p.restarts}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.node}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.ip}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtAge(p.ageSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {resource.children.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Kubernetes objects</h3>
          <div className="flex flex-wrap gap-2">
            {resource.children.map((c) => <code key={c} className="rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs">{c}</code>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metrics ──────────────────────────────────────────────────────────────
function MetricsTab({ fqn }: { fqn: string }) {
  const { data, err, reload } = useAsync<Metrics>(() => api.metrics(fqn), [fqn]);
  if (err) return <Empty text="Metrics need metrics-server in-cluster." />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-4">
      <RefreshRow onClick={reload} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MetricChart label="CPU" color="text-primary" data={data.series.map((p) => p.cpu)} max={data.cpuLimitMilli} value={`${data.cpuMilli}m`} sub={`limit ${data.cpuLimitMilli}m`} />
        <MetricChart label="Memory" color="text-violet-400" data={data.series.map((p) => p.mem)} max={data.memLimitMi} value={`${data.memMi} Mi`} sub={`limit ${data.memLimitMi} Mi`} />
      </div>
      {data.storageTotalMi > 0 && <UsageBar label="Storage (Longhorn volume)" used={Math.round(data.storageUsedMi / 1024)} total={Math.round(data.storageTotalMi / 1024)} unit="Gi" />}
    </div>
  );
}

// ── Terminal (logs + console unified) ────────────────────────────────────────
function TerminalTab({ fqn }: { fqn: string }) {
  const { data } = useAsync(() => api.access(fqn), [fqn]);
  if (!data) return <Loading />;
  return <Terminal fqn={fqn} kind={data.console.kind} />;
}

// ── Config ──────────────────────────────────────────────────────────────────
function ConfigTab({ fqn, onChanged }: { fqn: string; onChanged: () => void }) {
  const { data, reload } = useAsync<ResourceConfig>(() => api.config(fqn), [fqn]);
  const [draft, setDraft] = useState<ResourceConfig | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(data ? structuredClone(data) : null), [data]);
  if (!draft) return <Loading />;

  const save = async () => {
    setSaving(true);
    await toast.promise(
      api.applyConfig(fqn, { replicas: draft.replicas, cpu: draft.cpu, memory: draft.memory, storage: draft.storage, values: draft.values }),
      { loading: "Applying configuration…", success: (r) => { onChanged(); reload(); return r.message; }, error: (e) => (e as Error).message },
    );
    setSaving(false);
  };
  const setV = (k: string, v: string) => setDraft({ ...draft, values: { ...draft.values, [k]: v } });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Replicas"><Input type="number" min={0} value={draft.replicas} onChange={(e) => setDraft({ ...draft, replicas: Number(e.target.value) })} /></Field>
        <Field label="Exposure"><Input value={draft.expose} disabled /></Field>
        <Field label="CPU limit"><Input value={draft.cpu} onChange={(e) => setDraft({ ...draft, cpu: e.target.value })} /></Field>
        <Field label="Memory limit"><Input value={draft.memory} onChange={(e) => setDraft({ ...draft, memory: e.target.value })} /></Field>
        {draft.storage !== undefined && <Field label="Storage (grow only)"><Input value={draft.storage} onChange={(e) => setDraft({ ...draft, storage: e.target.value })} /></Field>}
        {draft.host && <Field label="Host"><Input value={draft.host} disabled /></Field>}
      </div>
      {Object.keys(draft.values).length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">Blueprint variables</div>
          <div className="space-y-3 rounded-lg border border-border bg-background/30 p-4">
            {Object.entries(draft.values).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 items-center gap-3">
                <Label className="col-span-1">{k}</Label>
                <Input className="col-span-2" value={v} onChange={(e) => setV(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
      {Object.keys(draft.env).length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">Environment</div>
          <div className="rounded-lg border border-border bg-background/30 p-4 font-mono text-xs">
            {Object.entries(draft.env).map(([k, v]) => <div key={k} className="text-muted-foreground">{k}=<span className="text-foreground/90">{v}</span></div>)}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Applying…" : "Apply changes"}</Button>
        <span className="text-xs text-muted-foreground">Patches the Deployable; the controller reconciles.</span>
      </div>
    </div>
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
);

// ── Events ──────────────────────────────────────────────────────────────────
function EventsTab({ fqn }: { fqn: string }) {
  const { data, reload } = useAsync<K8sEvent[]>(() => api.events(fqn), [fqn]);
  if (!data) return <Loading />;
  return (
    <div className="space-y-3">
      <RefreshRow onClick={reload} />
      <div className="space-y-1.5">
        {data.map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
            <Badge variant={e.type === "Warning" ? "warning" : "secondary"}>{e.reason}</Badge>
            <span className="flex-1 text-foreground/85">{e.message}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{e.ts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────
function DangerTab({ fqn, name, onDeleted }: { fqn: string; name: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const del = async () => {
    await api.lifecycle(fqn, "delete");
    onDeleted();
  };
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 font-medium text-destructive"><TriangleAlert className="size-4" /> Delete this resource</div>
        <p className="mt-1 text-sm text-muted-foreground">Removes the Deployable and cascades to its children — <b>including its persistent volume</b>. This is a gated, non-reversible action.</p>
        <Button variant="destructive" className="mt-4" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Delete {name}</Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogHeader><DialogTitle>Delete {name}?</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">Type <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{name}</code> to confirm. The volume and all data are destroyed.</p>
          <Input className="mt-3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="destructive" disabled={typed !== name} onClick={del}><Trash2 className="size-4" /> Permanently delete</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────
const Empty = ({ text }: { text: string }) => <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">{text}</div>;
const RefreshRow = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="size-3.5" /> Refresh</button>
);
