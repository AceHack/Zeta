import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "zeta-portal-web";

export const ResourceTabs = () => (
  <div className="bg-background p-6 text-foreground">
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="success">Ready</Badge>
          <span>3 replicas · image zeta/api:2.4.1 · last deploy 12m ago</span>
        </div>
      </TabsContent>
      <TabsContent value="logs">
        <p className="text-sm text-muted-foreground">Log stream…</p>
      </TabsContent>
    </Tabs>
  </div>
);

export const SecondTabActive = () => (
  <div className="bg-background p-6 text-foreground">
    <Tabs defaultValue="logs">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>
      <TabsContent value="logs">
        <p className="font-mono text-xs text-muted-foreground">
          14:02:11 gateway listening on :8443
          <br />
          14:02:12 joined JetStream cluster (3 peers)
        </p>
      </TabsContent>
    </Tabs>
  </div>
);
