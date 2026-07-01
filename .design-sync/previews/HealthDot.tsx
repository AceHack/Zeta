import { HealthDot } from "zeta-portal-web";

export const AllStates = () => (
  <div className="flex flex-col gap-3 rounded-lg bg-background p-6 text-foreground">
    <HealthDot health="ready" label="Ready" />
    <HealthDot health="progressing" label="Progressing" />
    <HealthDot health="error" label="Error" />
    <HealthDot health="unknown" label="Unknown" />
  </div>
);

export const NoLabel = () => (
  <div className="flex items-center gap-4 rounded-lg bg-background p-6 text-foreground">
    <HealthDot health="ready" />
    <HealthDot health="error" />
  </div>
);
