import * as React from "react";
import { Input, Label } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const WithLabel = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="agent-name">Agent name</Label>
      <Input id="agent-name" placeholder="e.g. alexa-2" />
    </div>
  </Canvas>
);

export const WithValue = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="ns">Namespace</Label>
      <Input id="ns" defaultValue="zeta-agents" />
    </div>
  </Canvas>
);

export const Disabled = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="owner">Owner</Label>
      <Input id="owner" defaultValue="acehack" disabled />
    </div>
  </Canvas>
);
