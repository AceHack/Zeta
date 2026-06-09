import { Boxes, ExternalLink, Layers, MessagesSquare, Settings2 } from "lucide-react";
import type { ResourceVM } from "@/lib/api";
import { Sheet, SheetBody, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { HealthDot, PersonaAvatar, catIcon } from "@/components/bits";
import { RoomTimeline } from "@/components/RoomTimeline";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function ResourceDetail({ resource, onClose }: { resource: ResourceVM | null; onClose: () => void }) {
  if (!resource) return null;
  const Icon = catIcon(resource.category);
  const fqn = `${resource.namespace}/${resource.name}`;

  return (
    <Sheet open={!!resource} onClose={onClose}>
      <SheetHeader>
        <div className="flex items-center gap-3 pr-8">
          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate">{resource.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">{resource.namespace} · {resource.blueprint}</p>
          </div>
          <HealthDot health={resource.health} label={resource.phase} className="ml-auto" />
        </div>
      </SheetHeader>
      <SheetBody>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview"><Settings2 className="size-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="children"><Layers className="size-3.5" /> Objects</TabsTrigger>
            <TabsTrigger value="room"><MessagesSquare className="size-3.5" /> Room</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {resource.message && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {resource.message}
              </div>
            )}
            <div className="rounded-lg border border-border bg-background/30 px-4">
              <Row k="Resource"><code className="text-xs">{fqn}</code></Row>
              <Row k="Blueprint"><Badge variant="secondary">{resource.blueprint}</Badge></Row>
              <Row k="Category">{resource.category}</Row>
              <Row k="Exposure">{resource.expose}</Row>
              {resource.host && (
                <Row k="Host">
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`https://${resource.host}`} target="_blank" rel="noreferrer">
                    {resource.host} <ExternalLink className="size-3" />
                  </a>
                </Row>
              )}
              <Row k="Operated by"><PersonaAvatar id={resource.admin} kind="persona" /></Row>
            </div>
          </TabsContent>

          <TabsContent value="children">
            {resource.children.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No child objects reported yet.</p>
            ) : (
              <div className="space-y-2">
                {resource.children.map((c) => (
                  <div key={c} className="flex items-center gap-2 rounded-md border border-border bg-background/30 px-3 py-2 text-sm">
                    <Boxes className="size-4 text-muted-foreground" />
                    <code className="text-xs">{c}</code>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="room">
            <RoomTimeline resource={fqn} />
          </TabsContent>
        </Tabs>
      </SheetBody>
    </Sheet>
  );
}
