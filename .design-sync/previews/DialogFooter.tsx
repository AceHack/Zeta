import { Button, DialogBody, DialogFooter } from "zeta-portal-web";

export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[28rem] overflow-hidden rounded-xl border border-border bg-card">
      <DialogBody>
        <p className="text-sm text-muted-foreground">Apply 4 pending config changes?</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost">Review diff</Button>
        <Button>Apply</Button>
      </DialogFooter>
    </div>
  </div>
);
