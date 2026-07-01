import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "zeta-portal-web";

export const ServiceCard = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>zeta-api</CardTitle>
          <Badge variant="success">Ready</Badge>
        </div>
        <CardDescription>Production · us-east-1 · 3 replicas</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Query gateway for the incremental compute substrate. Serves the DBSP operator graph over NATS JetStream; last
          deploy rolled out 12 minutes ago with zero failed health checks.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          View logs
        </Button>
        <Button size="sm">Open console</Button>
      </CardFooter>
    </Card>
  </div>
);

export const PlainContent = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardContent className="pt-6">
        <p className="text-sm">
          A bare Card + CardContent, no header — the shape used for stat tiles and list wrappers.
        </p>
      </CardContent>
    </Card>
  </div>
);
