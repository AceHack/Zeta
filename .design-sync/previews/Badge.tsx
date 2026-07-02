import * as React from "react";
import { Badge } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Variants = () => (
  <Canvas>
    <div className="flex flex-wrap items-center gap-3">
      <Badge>agent</Badge>
      <Badge variant="secondary">stateful</Badge>
      <Badge variant="outline">databases</Badge>
      <Badge variant="success">running</Badge>
      <Badge variant="warning">gated: budget</Badge>
      <Badge variant="destructive">failed</Badge>
    </div>
  </Canvas>
);

export const InContext = () => (
  <Canvas>
    <div className="flex w-96 items-center justify-between rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium">postgres-primary</div>
      <div className="flex gap-2">
        <Badge variant="secondary">expose: cluster</Badge>
        <Badge variant="success">healthy</Badge>
      </div>
    </div>
  </Canvas>
);
