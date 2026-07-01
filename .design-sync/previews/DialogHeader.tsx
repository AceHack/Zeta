import { DialogDescription, DialogHeader, DialogTitle } from "zeta-portal-web";

// DialogHeader is a plain bordered section — shown on a card-like panel so the
// hairline and padding read without the fixed overlay.
export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[28rem] overflow-hidden rounded-xl border border-border bg-card">
      <DialogHeader>
        <DialogTitle>Transfer ownership</DialogTitle>
        <DialogDescription>The new owner gets admin on every resource.</DialogDescription>
      </DialogHeader>
    </div>
  </div>
);
