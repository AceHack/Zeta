import { Card, CardContent, CardHeader, CardTitle } from "zeta-portal-web";

export const InCard = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Rollout summary</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>3/3 replicas healthy</li>
          <li>p95 latency 41 ms</li>
          <li>0 failed probes in the last hour</li>
        </ul>
      </CardContent>
    </Card>
  </div>
);
