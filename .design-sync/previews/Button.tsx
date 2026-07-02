import * as React from "react";
import { Button } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Variants = () => (
  <Canvas>
    <div className="flex flex-wrap items-center gap-3">
      <Button>Deploy agent</Button>
      <Button variant="secondary">Duplicate</Button>
      <Button variant="outline">Build a blueprint</Button>
      <Button variant="ghost">Back</Button>
      <Button variant="link">View logs</Button>
      <Button variant="success">Approve</Button>
      <Button variant="destructive">Deny</Button>
    </div>
  </Canvas>
);

export const Sizes = () => (
  <Canvas>
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Save</Button>
      <Button size="default">Configure &amp; deploy</Button>
      <Button size="lg">Get started</Button>
      <Button size="icon" aria-label="Send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 3 3 9-3 9 19-9Z" />
          <path d="M6 12h16" />
        </svg>
      </Button>
    </div>
  </Canvas>
);

export const Disabled = () => (
  <Canvas>
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Deploying…</Button>
      <Button variant="outline" disabled>Duplicate</Button>
      <Button variant="destructive" disabled>Deny</Button>
    </div>
  </Canvas>
);

export const FullWidth = () => (
  <Canvas>
    <div className="w-72">
      <Button className="w-full">Configure &amp; deploy</Button>
    </div>
  </Canvas>
);
