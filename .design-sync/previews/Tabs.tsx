import * as React from "react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "zeta-portal-web";

// Dark-only DS: cells render on the app's dark canvas, as they would in the portal.
const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-block rounded-lg bg-background p-6 text-foreground">{children}</div>
);

export const Default = () => (
  <Canvas>
    <Tabs defaultValue="overview" className="w-[520px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle>alexa-2</CardTitle>
            <CardDescription>Coding agent · qwen3-coder · namespace zeta-agents</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm">
            <Badge variant="success">running</Badge>
            <span className="text-muted-foreground">last tick 20s ago</span>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="logs">
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">log stream…</div>
      </TabsContent>
      <TabsContent value="settings">
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">settings…</div>
      </TabsContent>
    </Tabs>
  </Canvas>
);

export const SecondTabActive = () => (
  <Canvas>
    <Tabs defaultValue="logs" className="w-[520px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="logs">
        <div className="rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          <div>20:31:02 tick: observe → plan → commit</div>
          <div>20:31:14 pushed 1 commit to origin/main</div>
          <div>20:31:15 CI green (build 4182)</div>
        </div>
      </TabsContent>
    </Tabs>
  </Canvas>
);
