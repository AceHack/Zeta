import { useEffect, useState } from "react";
import { Boxes, Cpu, MemoryStick, Plus, Server } from "lucide-react";
import { api, type ClusterCapacity, type TenantUsage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const cores = (m: number) => (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1);
const gib = (mi: number) => (mi / 1024).toFixed(mi >= 10240 ? 0 : 1);
const pctOf = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = pctOf(used, total);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span className="tabular-nums">{pct}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct > 85 ? "bg-destructive" : pct > 65 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Admin() {
  const [tab, setTab] = useState<"cluster" | "tenants">("cluster");
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Admin</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Cluster capacity and per-tenant hardware allocation.</p>
      </div>
      <div className="mb-5 flex items-center gap-0.5 border-b border-border">
        {(["cluster", "tenants"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] capitalize", tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t}</button>
        ))}
      </div>
      {tab === "cluster" ? <ClusterView /> : <TenantsView />}
    </div>
  );
}

// ── Cluster capacity ────────────────────────────────────────────────────
function ClusterView() {
  const [c, setC] = useState<ClusterCapacity | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.cluster().then(setC).catch((e) => setErr(e.message)); }, []);
  if (err) return <Empty text="Cluster reads need the in-cluster admin backend (Node/Pod RBAC)." />;
  if (!c) return <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/40" />)}</div>;
  const t = c.totals;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card icon={Cpu} label="CPU" value={`${cores(t.cpuRequestedMilli)} / ${cores(t.cpuAllocMilli)} cores`} sub="requested / allocatable"><Meter used={t.cpuRequestedMilli} total={t.cpuAllocMilli} label="committed" /></Card>
        <Card icon={MemoryStick} label="Memory" value={`${gib(t.memRequestedMi)} / ${gib(t.memAllocMi)} GiB`} sub="requested / allocatable"><Meter used={t.memRequestedMi} total={t.memAllocMi} label="committed" /></Card>
        <Card icon={Boxes} label="Pods" value={`${t.pods} / ${t.podCapacity}`} sub={`${t.nodeCount} nodes`}><Meter used={t.pods} total={t.podCapacity} label="scheduled" /></Card>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Server className="size-4 text-muted-foreground" /> Nodes</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Node</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">CPU</th><th className="px-4 py-2 font-medium">Memory</th><th className="px-4 py-2 font-medium">Pods</th></tr></thead>
            <tbody>
              {c.nodes.map((n) => (
                <tr key={n.name} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{n.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{n.role}</td>
                  <td className="px-4 py-2"><span className={n.ready ? "text-success" : "text-destructive"}>{n.ready ? "Ready" : "NotReady"}</span></td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{cores(n.cpuRequestedMilli)} / {cores(n.cpuAllocMilli)}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{gib(n.memRequestedMi)} / {gib(n.memAllocMi)} Gi</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{n.podsRunning} / {n.podCapacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tenants ──────────────────────────────────────────────────────────────
function TenantsView() {
  const [tenants, setTenants] = useState<TenantUsage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<TenantUsage | "new" | null>(null);
  const load = () => api.tenants().then(setTenants).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <Empty text="Tenant reads need the in-cluster admin backend (Namespace/ResourceQuota RBAC)." />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">{tenants?.length ?? "…"} tenants</div>
        <Button size="sm" onClick={() => setEdit("new")}><Plus className="size-3.5" /> New tenant</Button>
      </div>
      {!tenants ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />)}</div>
      ) : tenants.length === 0 ? (
        <Empty text="No tenants yet. Create one to allocate a namespace + quota." />
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <div key={t.namespace} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div><div className="text-[13px] font-medium">{t.displayName ?? t.namespace}</div><div className="font-mono text-xs text-muted-foreground">{t.namespace}{!t.hasQuota && " · no quota"}</div></div>
                <Button variant="outline" size="sm" onClick={() => setEdit(t)}>Edit quota</Button>
              </div>
              {t.hasQuota && (
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  <Meter used={t.cpu.usedMilli} total={t.cpu.allocMilli} label={`CPU ${cores(t.cpu.usedMilli)}/${cores(t.cpu.allocMilli)}`} />
                  <Meter used={t.mem.usedMi} total={t.mem.allocMi} label={`Mem ${gib(t.mem.usedMi)}/${gib(t.mem.allocMi)}Gi`} />
                  <Meter used={t.storage.usedMi} total={t.storage.allocMi} label={`Disk ${gib(t.storage.usedMi)}/${gib(t.storage.allocMi)}Gi`} />
                  <Meter used={t.pods.used} total={t.pods.alloc} label={`Pods ${t.pods.used}/${t.pods.alloc}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {edit && <TenantDialog tenant={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function TenantDialog({ tenant, onClose, onSaved }: { tenant: TenantUsage | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !tenant;
  const [f, setF] = useState({
    name: tenant?.namespace ?? "",
    namespace: tenant?.namespace ?? "",
    displayName: tenant?.displayName ?? "",
    cpu: tenant ? cores(tenant.cpu.allocMilli) : "4",
    memory: tenant ? `${gib(tenant.mem.allocMi)}Gi` : "16Gi",
    storage: tenant ? `${gib(tenant.storage.allocMi)}Gi` : "100Gi",
    pods: String(tenant?.pods.alloc ?? 30),
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    await toast.promise(api.applyTenant({ name: f.name, namespace: f.namespace, displayName: f.displayName || undefined, quota: { cpu: f.cpu, memory: f.memory, storage: f.storage, pods: Number(f.pods) || 0 } }), {
      loading: "Applying tenant…", success: (r) => { onSaved(); return r.message; }, error: (e) => (e as Error).message,
    });
  };
  return (
    <Dialog open onClose={onClose}>
      <DialogHeader><DialogTitle>{isNew ? "New tenant" : `Edit ${tenant!.namespace}`}</DialogTitle></DialogHeader>
      <DialogBody>
        <div className="space-y-4">
          {isNew && (
            <div className="grid grid-cols-2 gap-3">
              <F label="Name"><Input value={f.name} onChange={(e) => set({ name: e.target.value, namespace: f.namespace || e.target.value })} placeholder="acme" /></F>
              <F label="Namespace"><Input value={f.namespace} onChange={(e) => set({ namespace: e.target.value })} placeholder="acme" /></F>
              <F label="Display name"><Input value={f.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder="Acme Corp" /></F>
            </div>
          )}
          <div>
            <div className="mb-2 text-sm font-medium">Quota — hardware sold to this tenant</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <F label="CPU (cores)"><Input value={f.cpu} onChange={(e) => set({ cpu: e.target.value })} /></F>
              <F label="Memory"><Input value={f.memory} onChange={(e) => set({ memory: e.target.value })} /></F>
              <F label="Storage"><Input value={f.storage} onChange={(e) => set({ storage: e.target.value })} /></F>
              <F label="Max pods"><Input type="number" value={f.pods} onChange={(e) => set({ pods: e.target.value })} /></F>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Applies a Tenant CR → the controller provisions the namespace, ResourceQuota, LimitRange and NetworkPolicy.</p>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={isNew && (!f.name || !f.namespace)}>{isNew ? "Create tenant" : "Save quota"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

const Card = ({ icon: Icon, label, value, sub, children }: { icon: typeof Cpu; label: string; value: string; sub?: string; children?: React.ReactNode }) => (
  <div className="rounded-lg border border-border p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" /> {label}</div>
    <div className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight">{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    {children}
  </div>
);
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
const Empty = ({ text }: { text: string }) => <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-[13px] text-muted-foreground">{text}</div>;
