import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, Sparkles } from "lucide-react";
import { api, type LogLine } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PersonaAvatar } from "@/components/bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LEVELS = ["all", "info", "warn", "error", "debug"] as const;
const levelStyle: Record<LogLine["level"], string> = {
  info: "text-foreground/70 border-border",
  warn: "text-warning border-warning/30 bg-warning/5",
  error: "text-destructive border-destructive/30 bg-destructive/5",
  debug: "text-muted-foreground border-border",
};

export function LogsView({ fqn, admin = "otto" }: { fqn: string; admin?: string }) {
  const [lines, setLines] = useState<LogLine[] | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [q, setQ] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const load = () => api.logs(fqn).then(setLines).catch(() => setLines([]));
  useEffect(() => { setLines(null); setAnalysis(null); load(); /* eslint-disable-next-line */ }, [fqn]);

  const filtered = useMemo(() => {
    if (!lines) return [];
    const needle = q.trim().toLowerCase();
    return lines.filter((l) => (level === "all" || l.level === level) && (!needle || l.text.toLowerCase().includes(needle)));
  }, [lines, level, q]);

  const counts = useMemo(() => {
    const c = { error: 0, warn: 0 };
    for (const l of lines ?? []) { if (l.level === "error") c.error++; if (l.level === "warn") c.warn++; }
    return c;
  }, [lines]);

  const exportLogs = () => {
    const text = (lines ?? []).map((l) => `${l.ts} ${l.level.toUpperCase().padEnd(5)} ${l.text}`).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fqn.replace("/", "_")}-logs.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported");
  };

  const askAI = async () => {
    setAsking(true);
    setAnalysis(null);
    try {
      const room = await api.chat(fqn, "Analyze the recent logs and traces — what's wrong and how do we fix it?");
      const reply = [...room.events].reverse().find((e) => e.proposedBy.kind === "persona" && e.body.type === "message");
      setAnalysis(reply ? String((reply.body as { text?: string }).text ?? "") : "Posted to the room.");
      toast.success(`${admin} analyzed the logs`, { description: "Full exchange is in the Room tab." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={cn("rounded px-2 py-1 text-xs capitalize transition-colors", level === l ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {l}{l === "error" && counts.error > 0 && <span className="ml-1 text-destructive">{counts.error}</span>}{l === "warn" && counts.warn > 0 && <span className="ml-1 text-warning">{counts.warn}</span>}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-8 w-48 pl-8 text-[13px]" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportLogs}><Download className="size-3.5" /> Export</Button>
          <Button size="sm" onClick={askAI} disabled={asking}><Sparkles className={cn("size-3.5", asking && "animate-pulse")} /> {asking ? "Analyzing…" : `Ask ${admin}`}</Button>
        </div>
      </div>

      {/* AI analysis panel (the log/trace connector) */}
      {analysis && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium"><PersonaAvatar id={admin} kind="persona" /><span className="text-muted-foreground">analyzed the logs + traces</span></div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{analysis}</p>
        </div>
      )}

      {/* organized log table */}
      {!lines ? (
        <div className="space-y-1.5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-7 animate-pulse rounded bg-muted/40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground">No log lines match.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border font-mono text-[12.5px]">
          {filtered.map((l, i) => (
            <div key={i} className={cn("flex gap-3 border-l-2 px-3 py-1.5", levelStyle[l.level], i > 0 && "border-t border-t-border")}>
              <span className="shrink-0 select-none text-muted-foreground/50">{l.ts}</span>
              <span className="w-10 shrink-0 select-none text-[10px] uppercase opacity-70">{l.level}</span>
              <span className="whitespace-pre-wrap break-words">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
