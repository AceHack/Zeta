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
    <div className="flex h-screen overflow-hidden bg-background bg-grid">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Zeta</span>
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">platform</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            const badge = n.id === "needsme" && needs.length > 0 ? needs.length : null;
            return (
              <button
                key={n.id}
                onClick={() => { setOpenResource(null); setView(n.id); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {n.label}
                {badge && <span className="ml-auto rounded-full bg-warning px-1.5 text-[11px] font-semibold text-background">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
          <div className="font-medium text-foreground/70">AI-native · no-directives</div>
          humans + agents as peers
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">acme</span>
            <span className="text-muted-foreground">/ human + agents</span>
          </div>
          <button onClick={refresh} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
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
