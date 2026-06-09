import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { CategoryGroupVM, ResourceVM } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HealthDot, PersonaAvatar, catIcon, categoryMeta } from "@/components/bits";
import { ResourceDetail } from "@/components/ResourceDetail";

const HEALTHS = ["all", "ready", "progressing", "error", "unknown"] as const;

export function Resources({ groups }: { groups: CategoryGroupVM[] }) {
  const [q, setQ] = useState("");
  const [healthFilter, setHealthFilter] = useState<(typeof HEALTHS)[number]>("all");
  const [selected, setSelected] = useState<ResourceVM | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        resources: g.resources.filter(
          (r) =>
            (healthFilter === "all" || r.health === healthFilter) &&
            (!needle || `${r.name} ${r.namespace} ${r.blueprint} ${r.admin}`.toLowerCase().includes(needle)),
        ),
      }))
      .filter((g) => g.resources.length > 0);
  }, [groups, q, healthFilter]);

  const total = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} deployed across your namespaces — you and your agents, top-down.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources…" className="w-64 pl-8" />
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            {HEALTHS.map((h) => (
              <button
                key={h}
                onClick={() => setHealthFilter(h)}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${healthFilter === h ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No resources match. Try the <b>Create</b> tab to deploy from a blueprint.
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map((g) => {
            const Icon = catIcon(g.category);
            return (
              <section key={g.category}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{categoryMeta[g.category]?.label ?? g.category}</h2>
                  <Badge variant="secondary">{g.resources.length}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.resources.map((r) => (
                    <Card
                      key={`${r.namespace}/${r.name}`}
                      onClick={() => setSelected(r)}
                      className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                    >
                      <div className="flex items-start justify-between p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">{r.name}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.namespace} · {r.blueprint}</p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
                        <HealthDot health={r.health} label={r.phase} />
                        <div className="flex items-center gap-2">
                          {r.expose !== "none" && <Badge variant="outline">{r.expose}</Badge>}
                          <PersonaAvatar id={r.admin} kind="persona" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ResourceDetail resource={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
