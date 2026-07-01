import { Card, CardDescription, CardHeader, CardTitle } from "zeta-portal-web";

// CardTitle is the header's heading line — shown in its parent composition.
export const InCardHeader = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Blueprint builder</CardTitle>
        <CardDescription>Compose a deployable stack from typed blocks</CardDescription>
      </CardHeader>
    </Card>
  </div>
);
