import { PersonaAvatar } from "zeta-portal-web";

export const Kinds = () => (
  <div className="flex flex-col gap-3 rounded-lg bg-background p-6 text-foreground">
    <PersonaAvatar id="aaron" kind="human" />
    <PersonaAvatar id="otto" kind="persona" />
    <PersonaAvatar id="vera" kind="persona" />
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-6 rounded-lg bg-background p-6 text-foreground">
    <PersonaAvatar id="kenji" size="sm" />
    <PersonaAvatar id="kenji" size="md" />
  </div>
);
