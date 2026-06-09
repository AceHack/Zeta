import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Boxes, FileText, FolderTree, Gauge, ListTree, MessagesSquare,
  Play, Power, RefreshCw, RotateCw, ScrollText, Settings2, Sliders, Terminal, Trash2, TriangleAlert,
} from "lucide-react";
import {
  api, type FileNode, type K8sEvent, type LogLine, type Metrics, type PodInfo, type ResourceConfig, type ResourceVM,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HealthDot, PersonaAvatar, catIcon } from "@/components/bits";
import { MetricChart, UsageBar } from "@/components/MetricChart";
import { RoomTimeline } from "@/components/RoomTimeline";
import { cn } from "@/lib/utils";

type Tab = "overview" | "metrics" | "logs" | "console" | "files" | "config" | "events" | "room" | "danger";
const TABS: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Settings2 },
  { id: "metrics", label: "Metrics", icon: Gauge },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "console", label: "Console", icon: Terminal },
  { id: "files", label: "Files", icon: FolderTree },
  { id: "config", label: "Config", icon: Sliders },
  { id: "events", label: "Events", icon: ListTree },
  { id: "room", label: "Room", icon: MessagesSquare },
  { id: "danger", label: "Danger zone", icon: TriangleAlert },
];

const fmtAge = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`);

export function ResourceConsole({ resource, onBack, onChanged }: { resource: ResourceVM; onBack: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fqn = `${resource.namespace}/${resource.name}`;
  const Icon = catIcon(resource.category);

  const act = async (label: string, fn: () => Promise<{ message: string }>) => {
    setBusy(label);
    try {
      const r = await fn();
      setToast(r.message);
      onChanged();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="mb-5">
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All resources
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/50">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{resource.name}</h1>
            <p className="text-sm text-muted-foreground">{resource.namespace} · {resource.blueprint}</p>
          </div>
          <HealthDot health={resource.health} label={resource.phase} className="ml-1" />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("restart", () => api.lifecycle(fqn, "restart"))}>
              <RotateCw className={cn("size-3.5", busy === "restart" && "animate-spin")} /> Restart
            </Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("stop", () => api.lifecycle(fqn, "stop"))}>
              <Power className="size-3.5" /> Stop
            </Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("start", () => api.lifecycle(fqn, "start"))}>
              <Play className="size-3.5" /> Start
            </Button>
          </div>
        </div>
      </div>

      {toast && <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{toast}</div>}

      <div className="flex min-h-0 flex-1 gap-6">
        {/* sub nav */}
        <nav className="w-44 shrink-0 space-y-0.5">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            const active = tab === t.id;
            const danger = t.id === "danger";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? (danger ? "bg-destructive/15 text-destructive" : "bg-accent text-foreground") : cn("text-muted-foreground hover:bg-accent/50 hover:text-foreground", danger && "hover:text-destructive"),
                )}
              >
                <TabIcon className="size-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {/* content */}
        <div className="min-w-0 flex-1 overflow-y-auto pb-8">
          {tab === "overview" && <Overview resource={resource} fqn={fqn} />}
          {tab === "metrics" && <MetricsTab fqn={fqn} />}
          {tab === "logs" && <LogsTab fqn={fqn} />}
          {tab === "console" && <ConsoleTab fqn={fqn} />}
          {tab === "files" && <FilesTab fqn={fqn} />}
          {tab === "config" && <ConfigTab fqn={fqn} onChanged={onChanged} setToast={setToast} />}
          {tab === "events" && <EventsTab fqn={fqn} />}
          {tab === "room" && <RoomTimeline resource={fqn} />}
          {tab === "danger" && <DangerTab fqn={fqn} name={resource.name} onDeleted={onBack} />}
        </div>
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
    <div className="space-y-5">
      {resource.message && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{resource.message}</div>}
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

// ── Logs ──────────────────────────────────────────────────────────────────
function LogsTab({ fqn }: { fqn: string }) {
  const { data, err, reload } = useAsync<LogLine[]>(() => api.logs(fqn), [fqn]);
  if (err) return <Empty text="Logs unavailable." />;
  if (!data) return <Loading />;
  const color = { info: "text-foreground/80", warn: "text-warning", error: "text-destructive", debug: "text-muted-foreground" };
  return (
    <div className="space-y-3">
      <RefreshRow onClick={reload} />
      <div className="overflow-x-auto rounded-lg border border-border bg-[#0a0e14] p-3 font-mono text-xs leading-relaxed">
        {data.map((l, i) => (
          <div key={i} className="flex gap-3 whitespace-pre">
            <span className="shrink-0 text-muted-foreground/60">{l.ts}</span>
            <span className={cn("shrink-0 uppercase", color[l.level])}>{l.level.padEnd(5)}</span>
            <span className="text-foreground/90">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Console ────────────────────────────────────────────────────────────────
function ConsoleTab({ fqn }: { fqn: string }) {
  const { data } = useAsync(() => api.access(fqn), [fqn]);
  const [history, setHistory] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  if (!data) return <Loading />;
  const run = () => {
    if (!cmd.trim()) return;
    setHistory((h) => [...h, `$ ${cmd}`, "(interactive exec lands with the WebSocket channel — command queued)"]);
    setCmd("");
  };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/60 p-4 text-sm">
        <div className="font-medium">{data.console.kind === "rcon" ? "Game console (RCON)" : "Pod shell"}</div>
        <p className="mt-1 text-muted-foreground">{data.console.note}</p>
        <code className="mt-2 block rounded bg-background/50 px-2.5 py-1.5 text-xs">{data.console.command}</code>
      </div>
      <div className="rounded-lg border border-border bg-[#0a0e14] p-3 font-mono text-xs">
        <div className="min-h-[140px] space-y-1">
          {history.length === 0 ? <span className="text-muted-foreground/60">Type a command and press Enter…</span> : history.map((h, i) => <div key={i} className={h.startsWith("$") ? "text-primary" : "text-muted-foreground"}>{h}</div>)}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2">
          <span className="text-primary">$</span>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50" placeholder="status" />
        </div>
      </div>
    </div>
  );
}

// ── Files (FTP/SFTP) ────────────────────────────────────────────────────────
function FilesTab({ fqn }: { fqn: string }) {
  const [path, setPath] = useState("/data");
  const { data, err } = useAsync(() => api.files(fqn, path), [fqn, path]);
  if (err) return <Empty text="File access needs the SFTP sidecar (game servers) or exec." />;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <FolderTree className="size-4 text-muted-foreground" />
        <span className="font-mono text-xs">{path}</span>
        {path !== "/" && path !== "/data" && (
          <button className="ml-2 text-xs text-primary hover:underline" onClick={() => setPath(path.split("/").slice(0, -1).join("/") || "/")}>up</button>
        )}
      </div>
      {!data ? <Loading /> : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Size</th><th className="px-3 py-2 font-medium">Modified</th></tr></thead>
            <tbody>
              {data.entries.map((f: FileNode) => (
                <tr key={f.path} className="border-t border-border/60 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    {f.type === "dir" ? (
                      <button className="inline-flex items-center gap-2 text-primary hover:underline" onClick={() => setPath(f.path)}><FolderTree className="size-4" />{f.name}</button>
                    ) : (
                      <span className="inline-flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />{f.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.type === "dir" ? "—" : `${(f.size / 1024).toFixed(1)} KB`}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.modified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Upload / download / edit run over the SFTP sidecar (port 2222 for game servers). Browse is live; transfer UI lands with the file-proxy endpoint.</p>
    </div>
  );
}

// ── Config ──────────────────────────────────────────────────────────────────
function ConfigTab({ fqn, onChanged, setToast }: { fqn: string; onChanged: () => void; setToast: (s: string) => void }) {
  const { data, reload } = useAsync<ResourceConfig>(() => api.config(fqn), [fqn]);
  const [draft, setDraft] = useState<ResourceConfig | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(data ? structuredClone(data) : null), [data]);
  if (!draft) return <Loading />;

  const save = async () => {
    setSaving(true);
    const r = await api.applyConfig(fqn, { replicas: draft.replicas, cpu: draft.cpu, memory: draft.memory, storage: draft.storage, values: draft.values });
    setSaving(false);
    setToast(r.message);
    onChanged();
    reload();
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
