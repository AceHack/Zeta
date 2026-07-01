import { Badge, SheetBody, SheetHeader, SheetTitle } from "zeta-portal-web";

export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[26rem] overflow-hidden rounded-xl border border-border bg-card">
      <SheetHeader>
        <SheetTitle>Secrets</SheetTitle>
      </SheetHeader>
      <SheetBody className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-muted-foreground">DATABASE_URL</span>
          <Badge variant="outline">managed</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-muted-foreground">NATS_CREDS</span>
          <Badge variant="outline">rotated 3d ago</Badge>
        </div>
      </SheetBody>
    </div>
  </div>
);
