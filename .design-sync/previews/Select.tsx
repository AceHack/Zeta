import { Label, Select } from "zeta-portal-web";

export const Default = () => (
  <div className="w-80 space-y-2 rounded-lg bg-background p-6 text-foreground">
    <Label htmlFor="region">Region</Label>
    <Select id="region" defaultValue="us-east-1">
      <option value="us-east-1">us-east-1</option>
      <option value="eu-west-1">eu-west-1</option>
      <option value="ap-southeast-2">ap-southeast-2</option>
    </Select>
  </div>
);

export const Disabled = () => (
  <div className="w-80 space-y-2 rounded-lg bg-background p-6 text-foreground">
    <Label htmlFor="tier">Tier</Label>
    <Select id="tier" disabled defaultValue="shared">
      <option value="shared">Shared cluster</option>
    </Select>
  </div>
);
