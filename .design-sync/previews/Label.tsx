import { Input, Label, Textarea } from "zeta-portal-web";

// Label pairs with any form control via htmlFor.
export const PairedWithControls = () => (
  <div className="w-80 space-y-5 rounded-lg bg-background p-6 text-foreground">
    <div className="space-y-2">
      <Label htmlFor="name">Display name</Label>
      <Input id="name" placeholder="Otto" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="bio">Persona charter</Label>
      <Textarea id="bio" placeholder="What this agent is for…" />
    </div>
  </div>
);
