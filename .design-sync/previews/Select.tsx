import * as React from "react";
import { Label, Select } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Default = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="category">Category</Label>
      <Select id="category" defaultValue="databases">
        <option value="agents">Agents</option>
        <option value="databases">Databases</option>
        <option value="networking">Networking</option>
        <option value="observability">Observability</option>
      </Select>
    </div>
  </Canvas>
);

export const Disabled = () => (
  <Canvas>
    <div className="w-80 space-y-2">
      <Label htmlFor="region">Region</Label>
      <Select id="region" disabled defaultValue="local">
        <option value="local">local cluster</option>
      </Select>
    </div>
  </Canvas>
);
