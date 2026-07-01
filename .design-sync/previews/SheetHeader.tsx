import { SheetHeader, SheetTitle } from "zeta-portal-web";

// SheetHeader is a plain bordered section — shown on a card-like panel.
export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[26rem] overflow-hidden rounded-xl border border-border bg-card">
      <SheetHeader>
        <SheetTitle>Environment variables</SheetTitle>
      </SheetHeader>
    </div>
  </div>
);
