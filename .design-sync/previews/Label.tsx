import * as React from "react";
import { Input, Label, Textarea } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Default = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="blueprint">Blueprint name</Label>
      <Input id="blueprint" placeholder="e.g. redis-cache" />
    </div>
  </Canvas>
);

export const ForTextarea = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="desc">Description</Label>
      <Textarea id="desc" placeholder="What should this agent do?" />
    </div>
  </Canvas>
);
