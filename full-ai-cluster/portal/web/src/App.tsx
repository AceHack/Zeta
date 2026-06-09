import { useCallback, useEffect, useState } from "react";
import { Boxes, Brain, LayoutGrid, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { api, type CatalogEntryVM, type CategoryGroupVM, type NeedsMeItemVM, type ResourceVM } from "@/lib/api";
import { Toaster } from "sonner";
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

  const crumbs = openResource
    ? [{ label: "Resources", onClick: () => setOpenResource(null) }, { label: openResource.name }]
    : [{ label: NAV.find((n) => n.id === view)?.label ?? "Resources" }];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Toaster theme="dark" position="bottom-right" closeButton toastOptions={{ style: { background: "hsl(240 6% 9%)", border: "1px solid hsl(240 4% 16%)", color: "hsl(0 0% 95%)", borderRadius: "0.45rem" } }} />

      {/* Sidebar — Linear-minimal */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex h-12 items-center gap-2 px-4">
          <div className="flex size-6 items-center justify-center rounded bg-foreground text-background"><Boxes className="size-3.5" /></div>
          <span className="text-[13px] font-semibold tracking-tight">Zeta Platform</span>
        </div>
        <div className="h-px bg-border" />
        <nav className="flex-1 space-y-px p-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id && !openResource;
            const badge = n.id === "needsme" && needs.length > 0 ? needs.length : null;
            return (
              <button
                key={n.id}
                onClick={() => { setOpenResource(null); setView(n.id); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {n.label}
                {badge && <span className="ml-auto rounded bg-warning/15 px-1.5 text-[11px] font-medium text-warning">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          AI-native · no-directives
        </div>
      </aside>

      {/* Main — cloud-console header (breadcrumb + command bar) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-5">
          <span className="text-[13px] font-medium text-muted-foreground">acme</span>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2 text-[13px]">
              <span className="text-border-strong">/</span>
              {c.onClick ? <button onClick={c.onClick} className="text-muted-foreground hover:text-foreground">{c.label}</button> : <span className="font-medium text-foreground">{c.label}</span>}
            </span>
          ))}
          <button onClick={refresh} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
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
