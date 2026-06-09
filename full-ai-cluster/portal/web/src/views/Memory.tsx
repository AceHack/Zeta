import { useEffect, useState } from "react";
import { Brain, Database, HardDrive } from "lucide-react";
import { api, type MemoryUsage } from "@/lib/api";
import { Card } from "@/components/ui/card";

const fmtBytes = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export function Memory() {
  const [data, setData] = useState<MemoryUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.memory().then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The durable collaboration log — every Room's append-only event stream on the Longhorn volume. This <b>is</b> the persistent agent memory: it survives pod restarts and is never silently destroyed (Memory Preservation #5).
        </p>
      </div>

      {err ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{err}</div>
      ) : !data ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Brain className="size-4" /> Rooms</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.rooms.length}</div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="size-4" /> Events</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.totalEvents}</div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><HardDrive className="size-4" /> On disk</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtBytes(data.totalBytes)}</div>
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Per-room logs</h3>
            {data.rooms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No room logs yet. They appear as agents operate resources.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Room (resource)</th><th className="px-4 py-2 font-medium">Events</th><th className="px-4 py-2 font-medium">Size</th></tr>
                  </thead>
                  <tbody>
                    {data.rooms.map((r) => (
                      <tr key={r.resource} className="border-t border-border/60">
                        <td className="px-4 py-2 font-mono text-xs">{r.resource}</td>
                        <td className="px-4 py-2 tabular-nums">{r.events}</td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtBytes(r.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
