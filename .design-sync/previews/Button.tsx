import { Button } from "zeta-portal-web";

// The app applies bg-background/text-foreground on <body>; cards need it explicitly.
const frame = "flex flex-wrap items-center gap-3 rounded-lg bg-background p-6 text-foreground";

export const Variants = () => (
  <div className={frame}>
    <Button>Deploy service</Button>
    <Button variant="secondary">Duplicate</Button>
    <Button variant="outline">Configure</Button>
    <Button variant="ghost">Dismiss</Button>
    <Button variant="link">View logs</Button>
    <Button variant="success">Approve</Button>
    <Button variant="destructive">Delete</Button>
  </div>
);

export const Sizes = () => (
  <div className={frame}>
    <Button size="lg">Create cluster</Button>
    <Button size="default">Create cluster</Button>
    <Button size="sm">Create cluster</Button>
    <Button size="icon" aria-label="Add">
      +
    </Button>
  </div>
);

export const Disabled = () => (
  <div className={frame}>
    <Button disabled>Deploying…</Button>
    <Button variant="outline" disabled>
      Configure
    </Button>
    <Button variant="destructive" disabled>
      Delete
    </Button>
  </div>
);
