import { useEffect, useState } from "react";
import { Clock, Database, Download, HardDriveDownload, Play, RotateCcw, Save, Table2 } from "lucide-react";
import { api, type Dashboard, type QueryResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`);
const fmtMi = (mi: number) => (mi >= 1024 ? `${(mi / 1024).toFixed(1)} GiB` : `${mi} MiB`);

const SNIPPETS = ["\\dt", "SELECT * FROM orders LIMIT 10", "SELECT count(*) FROM orders", "SELECT version()"];

// ── Query console ───────────────────────────────────────────────────────
export function QueryTab({ fqn }: { fqn: string }) {
  const [sql, setSql] = useState("SELECT * FROM orders LIMIT 10");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    try {
      const r = await api.query(fqn, sql);
      setResult(r);
      if (r.error) toast.error("Query error", { description: r.error });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  const exportCsv = () => {
    if (!result || result.error) return;
    const csv = [result.columns.join(","), ...result.rows.map((r) => r.map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : c)).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "query-result.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
          spellCheck={false}
          rows={4}
          className="w-full resize-y bg-[#0b0f17] px-4 py-3 font-mono text-[13px] text-foreground/90 outline-none"
          placeholder="SELECT … (⌘/Ctrl+Enter to run)"
        />
        <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
          <Button size="sm" onClick={run} disabled={running}><Play className="size-3.5" /> {running ? "Running…" : "Run"}</Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl+Enter</span>
          <div className="ml-auto flex items-center gap-1">
            {SNIPPETS.map((s) => <button key={s} onClick={() => setSql(s)} className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground">{s}</button>)}
          </div>
        </div>
      </div>

      {result && (result.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 font-mono text-[13px] text-destructive">{result.error}</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{result.rowCount} row{result.rowCount === 1 ? "" : "s"} · {result.durationMs}ms</span>
            {result.columns.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-3.5" /> CSV</Button>}
          </div>
          {result.columns.length > 0 && (
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{result.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}</tr></thead>
                <tbody>{result.rows.map((row, i) => <tr key={i} className="border-t border-border">{row.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{String(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Schema / tables browser ───────────────────────────────────────────────
export function TablesTab({ fqn }: { fqn: string }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.dashboard(fqn).then(setD).catch(() => setD(null)); }, [fqn]);
  if (!d || d.kind !== "database") return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/40" />)}</div>;
  const cols: Record<string, Array<[string, string]>> = {
    orders: [["id", "bigint PK"], ["customer_id", "bigint FK"], ["total", "numeric(10,2)"], ["status", "text"], ["created_at", "timestamptz"]],
    line_items: [["id", "bigint PK"], ["order_id", "bigint FK"], ["sku", "text"], ["qty", "int"], ["price", "numeric(10,2)"]],
    customers: [["id", "bigint PK"], ["email", "citext UNIQUE"], ["created_at", "timestamptz"]],
  };
  return (
    <div className="max-w-3xl space-y-2">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Database className="size-4" /> public · {d.tables} tables · {fmtMi(d.sizeMi)}</div>
      <div className="overflow-hidden rounded-lg border border-border">
        {d.topTables.map((t, i) => (
          <div key={t.name} className={cn(i > 0 && "border-t border-border")}>
            <button onClick={() => setOpen(open === t.name ? null : t.name)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-white/[0.02]">
              <Table2 className="size-4 text-muted-foreground" />
              <span className="flex-1 font-mono text-xs">{t.name}</span>
              <span className="tabular-nums text-muted-foreground">{fmtNum(t.rows)} rows</span>
              <span className="tabular-nums text-muted-foreground">{fmtMi(t.sizeMi)}</span>
            </button>
            {open === t.name && cols[t.name] && (
              <div className="border-t border-border bg-surface px-4 py-2">
                <table className="text-xs"><tbody>{cols[t.name]!.map(([c, ty]) => <tr key={c}><td className="py-1 pr-6 font-mono">{c}</td><td className="py-1 text-muted-foreground">{ty}</td></tr>)}</tbody></table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Backups ────────────────────────────────────────────────────────────────
export function BackupsTab({ fqn }: { fqn: string }) {
  const name = fqn.split("/")[1];
  const backups = [
    { id: "bk-0608-0200", at: "2026-06-08 02:00", size: "1.9 GiB", type: "scheduled" },
    { id: "bk-0607-0200", at: "2026-06-07 02:00", size: "1.9 GiB", type: "scheduled" },
    { id: "bk-0606-1412", at: "2026-06-06 14:12", size: "1.8 GiB", type: "manual" },
  ];
  const backupNow = () => toast.promise(new Promise((r) => setTimeout(r, 1400)), { loading: `Backing up ${name}…`, success: "Backup complete — snapshot stored on Longhorn.", error: "Backup failed" });
  const restore = (id: string) => toast.promise(new Promise((r) => setTimeout(r, 1400)), { loading: `Restoring ${id}…`, success: `Restored ${name} from ${id}.`, error: "Restore failed" });
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="text-[13px]"><div className="flex items-center gap-2 font-medium"><Clock className="size-4 text-muted-foreground" /> Scheduled backups</div><div className="mt-1 text-xs text-muted-foreground">Daily at 02:00 UTC · retained 14 days · Longhorn snapshot</div></div>
        <Button size="sm" onClick={backupNow}><Save className="size-3.5" /> Backup now</Button>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent backups</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          {backups.map((b, i) => (
            <div key={b.id} className={cn("group flex items-center gap-3 px-4 py-2.5 text-[13px]", i > 0 && "border-t border-border")}>
              <HardDriveDownload className="size-4 text-muted-foreground" />
              <span className="font-mono text-xs">{b.id}</span>
              <span className="text-muted-foreground">{b.at}</span>
              <span className="text-xs text-muted-foreground">{b.type}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{b.size}</span>
              <Button variant="outline" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => restore(b.id)}><RotateCcw className="size-3" /> Restore</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
