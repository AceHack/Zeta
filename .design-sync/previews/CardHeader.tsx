import { Badge, Card, CardDescription, CardHeader, CardTitle } from "zeta-portal-web";

// CardHeader only lays out inside a Card — shown in its parent composition.
export const InCard = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>rooms-postgres</CardTitle>
          <Badge variant="warning">Progressing</Badge>
        </div>
        <CardDescription>Database · shared cluster · 2 replicas</CardDescription>
      </CardHeader>
    </Card>
  </div>
);
