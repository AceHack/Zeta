import { Tabs, TabsList, TabsTrigger } from "zeta-portal-web";

// TabsList requires the Tabs context — shown in its parent composition.
export const InTabs = () => (
  <div className="bg-background p-6 text-foreground">
    <Tabs defaultValue="tables">
      <TabsList>
        <TabsTrigger value="tables">Tables</TabsTrigger>
        <TabsTrigger value="queries">Queries</TabsTrigger>
        <TabsTrigger value="backups">Backups</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);
