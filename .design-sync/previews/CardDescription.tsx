import { Card, CardDescription, CardHeader, CardTitle } from "zeta-portal-web";

// CardDescription is the muted line under CardTitle — shown in its parent.
export const InCardHeader = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Memory</CardTitle>
        <CardDescription>Long-horizon store · 12,304 entries · compacted 2h ago</CardDescription>
      </CardHeader>
    </Card>
  </div>
);
