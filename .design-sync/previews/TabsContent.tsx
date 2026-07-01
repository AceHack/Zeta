import { Tabs, TabsContent, TabsList, TabsTrigger } from "zeta-portal-web";

// TabsContent requires the Tabs context — only the active pane renders.
export const InTabs = () => (
  <div className="bg-background p-6 text-foreground">
    <Tabs defaultValue="metrics">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>
      <TabsContent value="metrics">
        <p className="text-sm text-muted-foreground">CPU 38% · memory 1.2 GiB / 4 GiB · 214 req/s</p>
      </TabsContent>
    </Tabs>
  </div>
);
