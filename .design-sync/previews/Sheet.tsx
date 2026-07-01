import { Badge, Button, Sheet, SheetBody, SheetHeader, SheetTitle } from "zeta-portal-web";

// Sheet is a fixed right-side drawer portal — rendered open, single full-card
// cell (cfg.overrides.Sheet: cardMode single + viewport).
export const ResourcePanel = () => (
  <div className="min-h-[540px] bg-background text-foreground">
    <Sheet open onClose={() => {}}>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <SheetTitle>zeta-api</SheetTitle>
          <Badge variant="success">Ready</Badge>
        </div>
      </SheetHeader>
      <SheetBody className="space-y-4">
        <p className="text-sm text-muted-foreground">Production · us-east-1 · 3 replicas · image zeta/api:2.4.1</p>
        <div className="flex gap-2">
          <Button size="sm">Redeploy</Button>
          <Button variant="outline" size="sm">
            Scale
          </Button>
          <Button variant="destructive" size="sm">
            Stop
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  </div>
);
