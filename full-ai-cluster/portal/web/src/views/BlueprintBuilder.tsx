import { useRef, useState } from "react";
import { ArrowLeft, Bot, Save, SendHorizonal, Sparkles, User } from "lucide-react";
import { api, type BlueprintProposal } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GAMES = ["Garry's Mod", "Unturned", "Arma Reforger", "Valheim", "Rust", "Minecraft"];

function yaml(p: BlueprintProposal): string {
  const L: string[] = ["apiVersion: platform.zeta.io/v1alpha1", "kind: Blueprint", "metadata:", `  name: ${p.name}`, `  namespace: zeta-platform`, "spec:"];
  if (p.category) L.push(`  category: ${p.category}`);
  L.push(`  image: ${p.image}`);
  if (p.install) L.push(`  install: ${JSON.stringify(p.install)}`);
  if (p.command) L.push(`  command: [${p.command.map((c) => JSON.stringify(c)).join(", ")}]`);
  if (p.args) L.push(`  args: [${p.args.map((c) => JSON.stringify(c)).join(", ")}]`);
  if (p.env && Object.keys(p.env).length) { L.push("  env:"); for (const [k, v] of Object.entries(p.env)) L.push(`    ${k}: ${JSON.stringify(v)}`); }
  if (p.ports?.length) { L.push("  ports:"); for (const pt of p.ports) L.push(`    - { name: ${pt.name}, port: ${pt.port}, protocol: ${pt.protocol ?? "TCP"}${pt.web ? ", web: true" : ""} }`); }
  if (p.storage) L.push(`  storage: { size: ${p.storage.size}, mountPath: ${p.storage.mountPath} }`);
  if (p.resources) L.push(`  resources: { cpu: ${JSON.stringify(p.resources.cpu ?? "1")}, memory: ${JSON.stringify(p.resources.memory ?? "512Mi")} }`);
  if (p.variables?.length) { L.push("  variables:"); for (const v of p.variables) L.push(`    - { name: ${v.name}${v.default ? `, default: ${JSON.stringify(v.default)}` : ""} }`); }
  if (p.sidecars?.length) { L.push("  sidecars:"); for (const s of p.sidecars) L.push(`    - { name: ${s.name}, image: ${s.image}${s.mountDataAt ? `, mountDataAt: ${s.mountDataAt}` : ""} }`); }
  if (p.defaultExpose) L.push(`  defaultExpose: ${p.defaultExpose}`);
  return L.join("\n");
}

type Msg = { who: "you" | "agent"; text: string };

export function BlueprintBuilder({ onExit, onSaved }: { onExit: () => void; onSaved: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "agent", text: "Tell me what to build — a game server (try the chips below), a database, or a web app — and I'll draft a complete blueprint you can tweak and save." }]);
  const [draft, setDraft] = useState<BlueprintProposal | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setMsgs((m) => [...m, { who: "you", text: t }]);
    setBusy(true);
    try {
      const r = await api.buildBlueprint(t, draft ?? undefined);
      setMsgs((m) => [...m, { who: "agent", text: r.reply }]);
      if (r.spec) setDraft(r.spec);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const save = async () => {
    if (!draft) return;
    const { name, ...spec } = draft;
    await toast.promise(api.saveBlueprint(name, spec), { loading: "Saving blueprint…", success: (r) => { onSaved(); return r.message; }, error: (e) => (e as Error).message });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={onExit} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to catalog</button>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Build a blueprint</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Describe what you want and an agent drafts a deployable blueprint. Iterate, then save it to the catalog — usable by you and by automated agent tasks.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* agentic chat */}
        <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-border">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-2.5", m.who === "you" && "flex-row-reverse")}>
                <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", m.who === "you" ? "bg-foreground/85 text-background" : "bg-secondary text-muted-foreground")}>{m.who === "you" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}</div>
                <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px]", m.who === "you" ? "bg-secondary" : "bg-muted/40")}>{m.text}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {!draft && (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-2.5">
              {GAMES.map((g) => <button key={g} onClick={() => send(`Set up a ${g} server`)} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground">{g}</button>)}
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-border p-2.5">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder={draft ? 'Tweak it — "expose public", "more memory", "add variable RCON"…' : "Describe the server…"} className="text-[13px]" />
            <Button size="icon" onClick={() => send(input)} disabled={busy || !input.trim()}><SendHorizonal className="size-4" /></Button>
          </div>
        </div>

        {/* live draft */}
        <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-border">
          {!draft ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
              <Sparkles className="mb-2 size-7 opacity-50" />
              Your blueprint preview appears here as the agent drafts it.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full bg-transparent text-[15px] font-semibold outline-none" />
                  <div className="text-xs text-muted-foreground">{draft.category} · {draft.image}</div>
                </div>
                <Button size="sm" onClick={save}><Save className="size-3.5" /> Save</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2 text-xs">
                {draft.defaultExpose && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">expose: {draft.defaultExpose}</span>}
                {draft.resources?.memory && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{draft.resources.memory}</span>}
                {draft.ports?.map((p) => <span key={p.name} className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{p.port}/{p.protocol ?? "TCP"}</span>)}
                {draft.variables?.map((v) => <span key={v.name} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{v.name}</span>)}
              </div>
              <pre className="flex-1 overflow-auto bg-[#0b0f17] p-4 text-xs leading-relaxed text-foreground/90">{yaml(draft)}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
