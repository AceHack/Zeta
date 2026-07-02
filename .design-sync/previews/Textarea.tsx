import * as React from "react";
import { Label, Textarea } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Default = () => (
  <Canvas>
    <div className="w-96 space-y-2">
      <Label htmlFor="prompt">System prompt</Label>
      <Textarea id="prompt" placeholder="You are a build agent for the Zeta factory…" />
    </div>
  </Canvas>
);

export const WithValue = () => (
  <Canvas>
    <div className="w-96 space-y-2">
      <Label htmlFor="notes">Deploy notes</Label>
      <Textarea id="notes" defaultValue={"Pin to node pool gpu-a100.\nBudget cap: 40 units/day."} />
    </div>
  </Canvas>
);

export const Disabled = () => (
  <Canvas>
    <div className="w-96 space-y-2">
      <Label htmlFor="locked">Locked config</Label>
      <Textarea id="locked" defaultValue="managed by operator" disabled />
    </div>
  </Canvas>
);
