import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CircleCheck, Copy, Loader2, Rocket, Server, Sliders, Sparkles,
} from "lucide-react";
import type { CatalogEntryVM } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { catIcon, categoryMeta } from "@/components/bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EXPOSE: Array<{ v: string; label: string; help: string }> = [
  { v: "none", label: "Internal only", help: "No network access from outside the pod. For background workers." },
  { v: "cluster", label: "Cluster", help: "Reachable by other workloads in the cluster (a ClusterIP Service). Typical for databases." },
  { v: "lan", label: "LAN", help: "A LoadBalancer IP on your local network (Cilium LB-IPAM). Typical for game servers." },
  { v: "public", label: "Public HTTPS", help: "Published on a public hostname over TLS via the Gateway. For web apps." },
];

type Form = { name: string; namespace: string; expose: string; replicas: string; host: string; values: Record<string, string> };

function buildManifest(bp: CatalogEntryVM, f: Form): string {
  const lines = [
    "apiVersion: platform.zeta.io/v1alpha1",
    "kind: Deployable",
    "metadata:",
    `  name: ${f.name || "my-" + bp.blueprint}`,
    `  namespace: ${f.namespace || "default"}`,
    "spec:",
    `  blueprint: ${bp.blueprint}`,
  ];
  if (f.expose !== bp.defaultExpose) lines.push(`  expose: ${f.expose}`);
  if (f.replicas !== "1") lines.push(`  replicas: ${f.replicas}`);
  if (f.host) lines.push(`  host: ${f.host}`);
  const vals = Object.entries(f.values).filter(([, v]) => v !== "");
  if (vals.length) { lines.push("  values:"); for (const [k, v] of vals) lines.push(`    ${k}: ${JSON.stringify(v)}`); }
  lines.push("  ai:", "    admin: otto", "    policy: default", "    room: enabled");
  return lines.join("\n");
}

// ── catalog (step 0) ───────────────────────────────────────────────────
export function Create({ catalog }: { catalog: CatalogEntryVM[] }) {
  const [picked, setPicked] = useState<CatalogEntryVM | null>(null);
  if (picked) return <DeployWizard bp={picked} onExit={() => setPicked(null)} />;
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create a resource</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a blueprint to deploy. New types are data — the same engine renders them all.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((bp) => {
          const Icon = catIcon(bp.category);
          return (
            <Card key={bp.blueprint} className="card-hover flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50"><Icon className="size-5 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold capitalize">{bp.blueprint}</span><Badge variant="outline">{categoryMeta[bp.category]?.label ?? bp.category}</Badge></div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{bp.image}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge variant="secondary">{bp.stateful ? "stateful" : "stateless"}</Badge>
                <Badge variant="secondary">expose: {bp.defaultExpose}</Badge>
              </div>
              <Button className="mt-4 w-full" onClick={() => setPicked(bp)}><Rocket className="size-4" /> Configure & deploy</Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── wizard ─────────────────────────────────────────────────────────────
type StepId = "basics" | "options" | "review" | "provision";
const STEPS: Array<{ id: StepId; label: string; icon: typeof Server }> = [
  { id: "basics", label: "Basics", icon: Server },
  { id: "options", label: "Configuration", icon: Sliders },
  { id: "review", label: "Review", icon: CircleCheck },
];

function DeployWizard({ bp, onExit }: { bp: CatalogEntryVM; onExit: () => void }) {
  const [step, setStep] = useState<StepId>("basics");
  const [form, setForm] = useState<Form>({
    name: "", namespace: "default", expose: bp.defaultExpose, replicas: "1", host: "",
    values: Object.fromEntries(bp.variables.map((v) => [v.name, v.default ?? ""])),
  });
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const manifest = useMemo(() => buildManifest(bp, form), [bp, form]);
  const nameValid = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(form.name);
  const stepIdx = STEPS.findIndex((s) => s.id === step);

  if (step === "provision") return <Provisioning bp={bp} form={form} onDone={onExit} onBack={() => setStep("review")} />;

  return (
    <div>
      <button onClick={onExit} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to catalog</button>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">{(() => { const I = catIcon(bp.category); return <I className="size-5 text-muted-foreground" />; })()}</div>
        <div><h1 className="text-xl font-semibold capitalize tracking-tight">Deploy {bp.blueprint}</h1><p className="text-sm text-muted-foreground">{bp.image}</p></div>
      </div>

      <div className="flex gap-8">
        {/* step rail */}
        <ol className="hidden w-48 shrink-0 space-y-1 md:block">
          {STEPS.map((s, i) => {
            const done = i < stepIdx, active = s.id === step;
            return (
              <li key={s.id}>
                <div className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-accent font-medium text-foreground" : "text-muted-foreground")}>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", done ? "border-success bg-success/15 text-success" : active ? "border-primary text-primary" : "border-border")}>{done ? <Check className="size-3" /> : i + 1}</span>
                  {s.label}
                </div>
              </li>
            );
          })}
        </ol>

        {/* step content */}
        <div className="min-w-0 max-w-2xl flex-1">
          {step === "basics" && (
            <Step title="Basics" desc="Name your instance and pick which namespace it lives in. The name must be DNS-safe (lowercase letters, numbers, dashes).">
              <Field label="Name" help="Used as the Kubernetes object name and the connect identity.">
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={`my-${bp.blueprint}`} />
                {form.name && !nameValid && <p className="mt-1 text-xs text-destructive">Lowercase letters, numbers and dashes only; must start and end alphanumeric.</p>}
              </Field>
              <Field label="Namespace" help="Tenant boundary. Resources, quota and the operating persona are scoped here.">
                <Input value={form.namespace} onChange={(e) => set({ namespace: e.target.value })} />
              </Field>
            </Step>
          )}

          {step === "options" && (
            <Step title="Configuration" desc="How this resource is exposed, how many replicas it runs, and its blueprint-specific settings.">
              <Field label="Exposure" help={EXPOSE.find((x) => x.v === form.expose)?.help}>
                <Select value={form.expose} onChange={(e) => set({ expose: e.target.value })}>
                  {EXPOSE.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                </Select>
              </Field>
              {form.expose === "public" && (
                <Field label="Public host" help="The hostname this app is published on. A TLS certificate is requested automatically.">
                  <Input value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="app.example.com" />
                </Field>
              )}
              <Field label="Replicas" help="How many copies to run. Stateful resources (databases, game servers) usually run one.">
                <Input type="number" min={0} value={form.replicas} onChange={(e) => set({ replicas: e.target.value })} className="w-32" />
              </Field>
              {bp.variables.length > 0 && (
                <div className="pt-2">
                  <div className="mb-1 text-sm font-medium">Blueprint settings</div>
                  <p className="mb-3 text-xs text-muted-foreground">Variables this blueprint exposes. Defaults are pre-filled.</p>
                  <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
                    {bp.variables.map((v) => (
                      <Field key={v.name} label={v.name} help={v.description}>
                        <Input value={form.values[v.name] ?? ""} onChange={(e) => set({ values: { ...form.values, [v.name]: e.target.value } })} placeholder={v.default} />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </Step>
          )}

          {step === "review" && (
            <Step title="Review" desc="This is the exact Deployable that will be created. The controller renders it into Kubernetes objects and an agent begins operating it.">
              <div className="space-y-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
                <Row k="Name" v={form.name || `my-${bp.blueprint}`} />
                <Row k="Namespace" v={form.namespace} />
                <Row k="Blueprint" v={bp.blueprint} />
                <Row k="Exposure" v={EXPOSE.find((x) => x.v === form.expose)?.label ?? form.expose} />
                {form.expose === "public" && form.host && <Row k="Host" v={form.host} />}
                <Row k="Replicas" v={form.replicas} />
              </div>
              <ManifestBlock manifest={manifest} />
            </Step>
          )}

          {/* footer nav */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={() => (stepIdx === 0 ? onExit() : setStep(STEPS[stepIdx - 1]!.id))}>
              <ArrowLeft className="size-4" /> {stepIdx === 0 ? "Cancel" : "Back"}
            </Button>
            {step === "review" ? (
              <Button variant="success" onClick={() => setStep("provision")}><Rocket className="size-4" /> Deploy</Button>
            ) : (
              <Button disabled={step === "basics" && (!form.name || !nameValid)} onClick={() => setStep(STEPS[stepIdx + 1]!.id)}>
                Continue <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── provisioning (staged progress) ─────────────────────────────────────
const STAGES = [
  "Validating the Deployable spec",
  "Resolving the blueprint",
  "Creating Kubernetes objects",
  "Provisioning storage (Longhorn)",
  "Scheduling pods",
  "Pulling the container image",
  "Starting the workload",
  "Opening the collaboration room",
];

function Provisioning({ bp, form, onDone }: { bp: CatalogEntryVM; form: Form; onDone: () => void; onBack: () => void }) {
  const name = form.name || `my-${bp.blueprint}`;
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setDone(i);
      if (i < STAGES.length) timer = setTimeout(tick, 420 + (i % 3) * 220);
      else { setFinished(true); toast.success(`${name} provisioned`, { description: "The resource is running and an agent is operating it." }); }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-lg border", finished ? "border-success/40 bg-success/10" : "border-border bg-muted/50")}>
          {finished ? <CircleCheck className="size-5 text-success" /> : <Loader2 className="size-5 animate-spin text-primary" />}
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{finished ? "Provisioned" : "Provisioning"} {name}</h1>
          <p className="text-sm text-muted-foreground">{finished ? "Your resource is live." : "Creating and starting your resource…"}</p>
        </div>
      </div>

      <ol className="space-y-1">
        {STAGES.map((s, i) => {
          const isDone = i < done, current = i === done && !finished;
          return (
            <li key={s} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", current && "bg-accent/50")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", isDone ? "border-success bg-success/15 text-success" : current ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {isDone ? <Check className="size-3" /> : current ? <Loader2 className="size-3 animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
              </span>
              <span className={cn(isDone ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            </li>
          );
        })}
      </ol>

      {finished && (
        <div className="mt-6 flex gap-2">
          <Button onClick={onDone}><Sparkles className="size-4" /> Done</Button>
        </div>
      )}
    </div>
  );
}

// ── small presentational helpers ───────────────────────────────────────
const Step = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    <div className="mt-5 space-y-5">{children}</div>
  </div>
);
const Field = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    {children}
    {help && <p className="text-xs text-muted-foreground">{help}</p>}
  </div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
);
function ManifestBlock({ manifest }: { manifest: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="absolute right-2 top-2" onClick={() => { navigator.clipboard.writeText(manifest); setCopied(true); toast.success("Manifest copied"); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="overflow-x-auto rounded-lg border border-border bg-background/50 p-4 text-xs leading-relaxed text-foreground/90">{manifest}</pre>
    </div>
  );
}
