import { useMemo, useState } from "react";
import { Check, Copy, Rocket } from "lucide-react";
import type { CatalogEntryVM } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { catIcon, categoryMeta } from "@/components/bits";

const EXPOSE = ["none", "cluster", "lan", "public"];

function buildManifest(bp: CatalogEntryVM, form: { name: string; namespace: string; expose: string; replicas: string; host: string; values: Record<string, string> }): string {
  const lines = [
    "apiVersion: platform.zeta.io/v1alpha1",
    "kind: Deployable",
    "metadata:",
    `  name: ${form.name || "my-" + bp.blueprint}`,
    `  namespace: ${form.namespace || "default"}`,
    "spec:",
    `  blueprint: ${bp.blueprint}`,
  ];
  if (form.expose && form.expose !== bp.defaultExpose) lines.push(`  expose: ${form.expose}`);
  if (form.replicas && form.replicas !== "1") lines.push(`  replicas: ${form.replicas}`);
  if (form.host) lines.push(`  host: ${form.host}`);
  const vals = Object.entries(form.values).filter(([, v]) => v !== "");
  if (vals.length) {
    lines.push("  values:");
    for (const [k, v] of vals) lines.push(`    ${k}: ${JSON.stringify(v)}`);
  }
  lines.push("  ai:", "    admin: otto", "    policy: default", "    room: enabled");
  return lines.join("\n");
}

export function Create({ catalog }: { catalog: CatalogEntryVM[] }) {
  const [picked, setPicked] = useState<CatalogEntryVM | null>(null);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create a resource</h1>
        <p className="mt-1 text-sm text-muted-foreground">Deploy from a blueprint. New types are <b>data</b> — the same engine renders them all.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((bp) => {
          const Icon = catIcon(bp.category);
          return (
            <Card key={bp.blueprint} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize">{bp.blueprint}</span>
                    <Badge variant="outline">{categoryMeta[bp.category]?.label ?? bp.category}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{bp.image}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{bp.stateful ? "stateful" : "stateless"}</Badge>
                <Badge variant="secondary">expose: {bp.defaultExpose}</Badge>
                {bp.variables.length > 0 && <Badge variant="secondary">{bp.variables.length} var{bp.variables.length > 1 ? "s" : ""}</Badge>}
              </div>
              <Button className="mt-4 w-full" onClick={() => setPicked(bp)}>
                <Rocket className="size-4" /> Configure & deploy
              </Button>
            </Card>
          );
        })}
      </div>
      {picked && <ConfigureDialog bp={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function ConfigureDialog({ bp, onClose }: { bp: CatalogEntryVM; onClose: () => void }) {
  const [step, setStep] = useState<"config" | "review">("config");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    namespace: "default",
    expose: bp.defaultExpose,
    replicas: "1",
    host: "",
    values: Object.fromEntries(bp.variables.map((v) => [v.name, v.default ?? ""])) as Record<string, string>,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const setVal = (k: string, v: string) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }));

  const manifest = useMemo(() => buildManifest(bp, form), [bp, form]);
  const showHost = form.expose === "public";

  const copy = async () => {
    await navigator.clipboard.writeText(manifest);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="capitalize">Deploy {bp.blueprint}</DialogTitle>
        <DialogDescription>{step === "config" ? "Configure this instance." : "Review the generated Deployable."}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        {step === "config" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={`my-${bp.blueprint}`} />
              </div>
              <div className="space-y-1.5">
                <Label>Namespace</Label>
                <Input value={form.namespace} onChange={(e) => set({ namespace: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Exposure</Label>
                <Select value={form.expose} onChange={(e) => set({ expose: e.target.value })}>
                  {EXPOSE.map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Replicas</Label>
                <Input type="number" min={0} value={form.replicas} onChange={(e) => set({ replicas: e.target.value })} />
              </div>
              {showHost && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Public host</Label>
                  <Input value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="app.example.com" />
                </div>
              )}
            </div>

            {bp.variables.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">Blueprint variables</div>
                <div className="space-y-3 rounded-lg border border-border bg-background/30 p-4">
                  {bp.variables.map((v) => (
                    <div key={v.name} className="grid grid-cols-3 items-center gap-3">
                      <Label className="col-span-1">
                        {v.name}
                        {v.description && <span className="block text-xs font-normal text-muted-foreground">{v.description}</span>}
                      </Label>
                      <Input className="col-span-2" value={form.values[v.name] ?? ""} onChange={(e) => setVal(v.name, e.target.value)} placeholder={v.default} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <Button variant="outline" size="sm" className="absolute right-2 top-2" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
            </Button>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background/50 p-4 text-xs leading-relaxed text-foreground/90">{manifest}</pre>
            <p className="mt-3 text-xs text-muted-foreground">
              Apply with <code className="rounded bg-muted px-1.5 py-0.5">kubectl apply -f -</code>. A one-click deploy (the portal applying this for you) lands with the create API + write RBAC.
            </p>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {step === "review" && <Button variant="ghost" onClick={() => setStep("config")}>Back</Button>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {step === "config" ? (
          <Button onClick={() => setStep("review")}>Review</Button>
        ) : (
          <Button variant="success" onClick={copy}><Rocket className="size-4" /> Copy manifest</Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
