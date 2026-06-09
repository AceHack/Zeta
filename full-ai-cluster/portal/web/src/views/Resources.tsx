import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { CategoryGroupVM, ResourceVM } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { HealthDot, catIcon, categoryMeta } from "@/components/bits";

const HEALTHS = ["all", "ready", "progressing", "error", "unknown"] as const;

export function Resources({ groups, onOpen }: { groups: CategoryGroupVM[]; onOpen: (r: ResourceVM) => void }) {
  const [q, setQ] = useState("");
  const [healthFilter, setHealthFilter] = useState<(typeof HEALTHS)[number]>("all");

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
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Resources</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{total} deployed across your namespaces.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-56 pl-8 text-[13px]" />
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            {HEALTHS.map((h) => (
              <button
                key={h}
                onClick={() => setHealthFilter(h)}
                className={`rounded px-2 py-1 text-xs capitalize transition-colors ${healthFilter === h ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-[13px] text-muted-foreground">
          No resources match. Use <b className="font-medium text-foreground">Create</b> to deploy from a blueprint.
        </div>
      ) : (
        <div className="space-y-7">
          {filtered.map((g) => {
            const Icon = catIcon(g.category);
            return (
              <section key={g.category}>
                <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5" />
                  {categoryMeta[g.category]?.label ?? g.category}
                  <span className="text-muted-foreground/50">· {g.resources.length}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  {g.resources.map((r, i) => (
                    <button
                      key={`${r.namespace}/${r.name}`}
                      onClick={() => onOpen(r)}
                      className={`group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.namespace}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{r.blueprint}</span>
                          {r.expose !== "none" && <><span className="text-border-strong">·</span><span>{r.expose}{r.host ? ` ${r.host}` : ""}</span></>}
                        </div>
                      </div>
                      <HealthDot health={r.health} label={r.phase} />
                      <span className="hidden text-xs text-muted-foreground sm:inline">{r.admin}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
