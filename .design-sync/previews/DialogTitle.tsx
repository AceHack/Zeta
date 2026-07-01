import { DialogHeader, DialogTitle } from "zeta-portal-web";

export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[28rem] overflow-hidden rounded-xl border border-border bg-card">
      <DialogHeader>
        <DialogTitle>Rotate credentials</DialogTitle>
      </DialogHeader>
    </div>
  </div>
);
