import { Tabs, TabsList, TabsTrigger } from "zeta-portal-web";

// TabsTrigger requires the Tabs context — active vs inactive shown in-parent.
export const ActiveAndInactive = () => (
  <div className="bg-background p-6 text-foreground">
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);
