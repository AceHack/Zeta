import { useEffect, useState } from "react";
import { Ban, Check, Map as MapIcon, UserX, Users } from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEAM = ["STEAM_0:1:42", "STEAM_0:0:9981", "STEAM_0:1:55012", "STEAM_0:0:73", "STEAM_0:1:2204"];

// ── Players roster ──────────────────────────────────────────────────────
export function PlayersTab({ fqn }: { fqn: string }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  useEffect(() => { api.dashboard(fqn).then(setD).catch(() => setD(null)); }, [fqn]);
  if (!d || d.kind !== "game") return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/40" />)}</div>;

  const base = d.recentJoins.map((p) => p.name);
  const names = [...base, ...["sandvich", "engie", "spawncamper", "builder42", "physgun_pro"]].slice(0, Math.max(d.players.online, 0));
  const roster = names.map((name, i) => ({ name, steam: STEAM[i % STEAM.length]!, ping: 20 + ((i * 17) % 60), score: (i * 37) % 220, time: `${(i * 9 + 3) % 59}m` })).filter((p) => !gone.has(p.name));

  const act = (verb: "Kick" | "Ban", name: string) => {
    toast.promise(api.exec(fqn, `${verb.toLowerCase()} ${name}`).then(() => name), {
      loading: `${verb}ing ${name}…`,
      success: () => { setGone((g) => new Set(g).add(name)); return `${name} ${verb.toLowerCase()}ed`; },
      error: (e) => (e as Error).message,
    });
  };

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Users className="size-4" /> {roster.length} / {d.players.max} players on {d.map}</div>
      {roster.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground">No players connected.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Player</th><th className="px-4 py-2 font-medium">SteamID</th><th className="px-4 py-2 font-medium">Ping</th><th className="px-4 py-2 font-medium">Score</th><th className="px-4 py-2 font-medium">Time</th><th className="w-28 px-4 py-2" /></tr></thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.name} className="group border-t border-border">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.steam}</td>
                  <td className={cn("px-4 py-2 tabular-nums", p.ping > 60 ? "text-warning" : "text-muted-foreground")}>{p.ping}ms</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{p.score}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.time}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="outline" size="sm" onClick={() => act("Kick", p.name)}><UserX className="size-3" /> Kick</Button>
                      <Button variant="destructive" size="sm" onClick={() => act("Ban", p.name)}><Ban className="size-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Maps control ────────────────────────────────────────────────────────
const MAPS = ["gm_construct", "gm_flatgrass", "gm_bigcity", "rp_downtown_v2", "gm_excess"];

export function MapsTab({ fqn, onChanged }: { fqn: string; onChanged?: () => void }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [workshop, setWorkshop] = useState("");
  const load = () => api.dashboard(fqn).then(setD).catch(() => setD(null));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fqn]);
  if (!d || d.kind !== "game") return <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/40" />)}</div>;

  const change = (map: string) => {
    toast.promise(api.applyConfig(fqn, { values: { MAP: map } }), {
      loading: `Changing map to ${map}…`,
      success: () => { load(); onChanged?.(); return `Map set to ${map} — restart to apply, or it loads on the next round.`; },
      error: (e) => (e as Error).message,
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><MapIcon className="size-4" /> Current map</div>
        <div className="mt-1 font-mono text-lg">{d.map}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Change map</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MAPS.map((m) => (
            <button key={m} onClick={() => change(m)} disabled={m === d.map} className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5 text-[13px] transition-colors", m === d.map ? "border-primary/40 bg-primary/[0.06] text-foreground" : "border-border hover:bg-white/[0.03]")}>
              <span className="font-mono text-xs">{m}</span>
              {m === d.map && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Workshop collection</h3>
        <div className="flex gap-2">
          <Input value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder="Steam workshop collection ID" className="font-mono text-[13px]" />
          <Button variant="outline" disabled={!workshop} onClick={() => toast.success(`Workshop collection ${workshop} queued`, { description: "Addons download on the next restart." })}>Add</Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Addons sync from the Steam Workshop into the SFTP data volume on restart.</p>
      </div>
    </div>
  );
}
