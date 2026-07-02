import * as React from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Default = () => (
  <Canvas>
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Alexa — coding agent</CardTitle>
        <CardDescription>Autonomous loop on the Zeta factory floor, phase-locked to seed S=4.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge variant="success">running</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Uptime</span>
          <span>14d 6h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Model</span>
          <span>qwen3-coder</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="outline" className="flex-1">Logs</Button>
        <Button size="sm" className="flex-1">Open console</Button>
      </CardFooter>
    </Card>
  </Canvas>
);

export const HeaderOnly = () => (
  <Canvas>
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Blueprint: postgres</CardTitle>
        <CardDescription>Stateful · expose: cluster · category: databases</CardDescription>
      </CardHeader>
    </Card>
  </Canvas>
);

export const ContentGrid = () => (
  <Canvas>
    <div className="grid w-[560px] grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CPU</CardTitle>
          <CardDescription>cluster average</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">42%</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Memory</CardTitle>
          <CardDescription>16 nodes</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">61%</CardContent>
      </Card>
    </div>
  </Canvas>
);
