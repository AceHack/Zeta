import { SheetHeader, SheetTitle } from "zeta-portal-web";

export const OnPanel = () => (
  <div className="bg-background p-6 text-foreground">
    <div className="w-[26rem] overflow-hidden rounded-xl border border-border bg-card">
      <SheetHeader>
        <SheetTitle>Room timeline</SheetTitle>
      </SheetHeader>
    </div>
  </div>
);
