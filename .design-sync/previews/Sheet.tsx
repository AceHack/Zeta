import * as React from "react";
import { Badge, Button, Sheet, SheetBody, SheetHeader, SheetTitle } from "zeta-portal-web";

export const Open = () => (
  <Sheet open onClose={() => {}}>
    <SheetHeader>
      <SheetTitle>alexa-2 — control panel</SheetTitle>
    </SheetHeader>
    <SheetBody className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="success">running</Badge>
        <Badge variant="secondary">qwen3-coder</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Autonomous coding agent on the factory floor. Ticks every minute; commits carry the AgencySignature trailer.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline">View logs</Button>
        <Button size="sm" variant="destructive">Stop agent</Button>
      </div>
    </SheetBody>
  </Sheet>
);
