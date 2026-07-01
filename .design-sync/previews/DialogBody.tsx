import { DialogBody, DialogHeader, DialogTitle } from "zeta-portal-web";

export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[28rem] overflow-hidden rounded-xl border border-border bg-card">
      <DialogHeader>
        <DialogTitle>Release notes</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm text-muted-foreground">
          2.4.1 — fixes the JetStream reconnect loop, adds per-room quota badges, and speeds up the trace view by ~3× on
          long spans.
        </p>
      </DialogBody>
    </div>
  </div>
);
