import { Input, Label } from "zeta-portal-web";

const field = "w-80 space-y-2";

export const WithLabel = () => (
  <div className="space-y-5 rounded-lg bg-background p-6 text-foreground">
    <div className={field}>
      <Label htmlFor="svc">Service name</Label>
      <Input id="svc" placeholder="zeta-api" />
    </div>
    <div className={field}>
      <Label htmlFor="img">Image</Label>
      <Input id="img" defaultValue="zeta/api:2.4.1" />
    </div>
  </div>
);

export const States = () => (
  <div className="space-y-5 rounded-lg bg-background p-6 text-foreground">
    <div className={field}>
      <Label htmlFor="ok">Filled</Label>
      <Input id="ok" defaultValue="wss://bus.zeta.internal:4222" />
    </div>
    <div className={field}>
      <Label htmlFor="off">Disabled</Label>
      <Input id="off" disabled placeholder="Managed by the cluster" />
    </div>
  </div>
);
