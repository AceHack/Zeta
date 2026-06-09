import { useCallback, useEffect, useState } from "react";
import { Boxes, Brain, LayoutGrid, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { api, type CatalogEntryVM, type CategoryGroupVM, type NeedsMeItemVM, type ResourceVM } from "@/lib/api";
import { Resources } from "@/views/Resources";
import { Create } from "@/views/Create";
import { NeedsMe } from "@/views/NeedsMe";
import { Memory } from "@/views/Memory";
import { ResourceConsole } from "@/components/ResourceConsole";
import { cn } from "@/lib/utils";

type View = "resources" | "create" | "needsme" | "memory";

const NAV: Array<{ id: View; label: string; icon: typeof LayoutGrid }> = [
  { id: "resources", label: "Resources", icon: LayoutGrid },
  { id: "create", label: "Create", icon: Plus },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "needsme", label: "Needs me", icon: ShieldAlert },
];

export default function App() {
  const [view, setView] = useState<View>("resources");
  const [openResource, setOpenResource] = useState<ResourceVM | null>(null);
  const [groups, setGroups] = useState<CategoryGroupVM[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntryVM[]>([]);
  const [needs, setNeeds] = useState<NeedsMeItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [g, c, n] = await Promise.all([api.resources(), api.catalog(), api.needsMe()]);
      setGroups(g);
      setCatalog(c);
      setNeeds(n);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/60">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
            <Boxes className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Zeta</span>
          <span className="ml-auto rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">platform</span>
        </div>
        <div className="px-5 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Manage</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id && !openResource;
            const badge = n.id === "needsme" && needs.length > 0 ? needs.length : null;
            return (
              <button
                key={n.id}
                onClick={() => { setOpenResource(null); setView(n.id); }}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
                <Icon className={cn("size-4", active && "text-primary")} />
                {n.label}
                {badge && <span className="ml-auto rounded-full bg-warning px-1.5 text-[11px] font-semibold text-background">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="m-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <div className="font-medium text-foreground/80">AI-native · no-directives</div>
          humans + agents as peers
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden bg-grid">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-6">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">A</div>
            <span className="font-medium">acme</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">human + agents</span>
          </div>
          <button onClick={refresh} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-glow p-6 lg:p-8">
          {error ? (
            <div className="mx-auto mt-20 max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
              Failed to reach the platform API: {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />)}
            </div>
          ) : openResource ? (
            <ResourceConsole resource={openResource} onBack={() => setOpenResource(null)} onChanged={refresh} />
          ) : view === "resources" ? (
            <Resources groups={groups} onOpen={setOpenResource} />
          ) : view === "create" ? (
            <Create catalog={catalog} />
          ) : view === "memory" ? (
            <Memory />
          ) : (
            <NeedsMe items={needs} onChange={refresh} />
          )}
        </main>
      </div>
    </div>
  );
}
