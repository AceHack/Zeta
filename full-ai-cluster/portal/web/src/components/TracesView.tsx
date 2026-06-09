import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { api, type Trace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const serviceColor: Record<string, string> = {
  web: "bg-blue-500/70", nginx: "bg-blue-500/70", postgres: "bg-violet-500/70", srcds: "bg-emerald-500/70", steam: "bg-amber-500/70", lua: "bg-cyan-500/70",
};

export function TracesView({ fqn }: { fqn: string }) {
  const [traces, setTraces] = useState<Trace[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const load = () => api.traces(fqn).then((t) => { setTraces(t); setSel(t[0]?.traceId ?? null); }).catch(() => setTraces([]));
  useEffect(() => { setTraces(null); load(); /* eslint-disable-next-line */ }, [fqn]);

  const exportTraces = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(traces, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${fqn.replace("/", "_")}-traces.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Traces exported");
  };

  if (!traces) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />)}</div>;
  if (traces.length === 0) return <div className="rounded-lg border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground">No traces collected. Tracing needs the in-cluster OpenTelemetry collector.</div>;
  const active = traces.find((t) => t.traceId === sel) ?? traces[0]!;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">{traces.length} recent traces</div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button><Button variant="outline" size="sm" onClick={exportTraces}><Download className="size-3.5" /> Export</Button></div>
      </div>

      {/* trace list */}
      <div className="overflow-hidden rounded-lg border border-border">
        {traces.map((t, i) => (
          <button key={t.traceId} onClick={() => setSel(t.traceId)} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-white/[0.02]", i > 0 && "border-t border-border", sel === t.traceId && "bg-white/[0.03]")}>
            <span className={cn("size-1.5 rounded-full", t.status === "error" ? "bg-destructive" : "bg-success")} />
            <span className="font-mono text-xs text-muted-foreground">{t.traceId}</span>
            <span className="flex-1 truncate font-medium">{t.rootName}</span>
            <span className="text-xs text-muted-foreground">{t.startedAt}</span>
            <span className={cn("tabular-nums", t.totalMs > 1000 ? "text-warning" : "text-muted-foreground")}>{t.totalMs}ms</span>
          </button>
        ))}
      </div>

      {/* waterfall for the selected trace */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between text-[13px]"><span className="font-medium">{active.rootName}</span><span className="text-muted-foreground">{active.totalMs}ms · {active.spans.length} spans</span></div>
        <div className="space-y-1.5">
          {active.spans.map((s) => {
            const leftPct = (s.startMs / active.totalMs) * 100;
            const widthPct = Math.max(1.5, (s.durationMs / active.totalMs) * 100);
            return (
              <div key={s.id} className="grid grid-cols-[180px_1fr_56px] items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 truncate"><span className={cn("size-2 shrink-0 rounded-sm", serviceColor[s.service] ?? "bg-muted-foreground")} /><span className="truncate" title={s.name}>{s.name}</span></div>
                <div className="relative h-4 rounded bg-muted/40">
                  <div className={cn("absolute top-0 h-4 rounded", s.status === "error" ? "bg-destructive/70" : serviceColor[s.service] ?? "bg-primary/70")} style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                </div>
                <div className="text-right tabular-nums text-muted-foreground">{s.durationMs}ms</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
