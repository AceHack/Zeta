import { Label, Textarea } from "zeta-portal-web";

export const Default = () => (
  <div className="w-96 space-y-2 rounded-lg bg-background p-6 text-foreground">
    <Label htmlFor="notes">Deploy notes</Label>
    <Textarea
      id="notes"
      defaultValue="Rolls the gateway to 2.4.1. JetStream consumers drain first; expect ~30s of elevated p95 during the switchover."
    />
  </div>
);

export const Disabled = () => (
  <div className="w-96 space-y-2 rounded-lg bg-background p-6 text-foreground">
    <Label htmlFor="frozen">Change reason</Label>
    <Textarea id="frozen" disabled placeholder="Locked during rollout" />
  </div>
);
