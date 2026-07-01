import { Badge } from "zeta-portal-web";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-6 text-foreground">
    <Badge>Default</Badge>
    <Badge variant="secondary">v2.4.1</Badge>
    <Badge variant="outline">us-east-1</Badge>
    <Badge variant="success">Ready</Badge>
    <Badge variant="warning">Progressing</Badge>
    <Badge variant="destructive">Error</Badge>
  </div>
);
