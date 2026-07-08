// generated-registry.ts — GENERATED FILE — DO NOT EDIT DIRECTLY
// Source: registry/personas.yaml & registry/cell-surfaces.yaml

export type PersonaId = "aaron" | "otto" | "alexa" | "riven" | "vera" | "lior" | "soraya" | "addison";

export interface PersonaRegistryEntry {
  readonly id: number;
  readonly name: PersonaId;
  readonly role: string;
  readonly description: string;
  readonly publicKey?: string;
  readonly allowedSurfaces: readonly string[];
}

export const VALID_PERSONAS = new Set<string>([
  "aaron",
  "otto",
  "alexa",
  "riven",
  "vera",
  "lior",
  "soraya",
  "addison"
]);

export const PERSONA_REGISTRY: readonly PersonaRegistryEntry[] = [
  {
    id: 1,
    name: "aaron",
    role: "HumanMaintainer",
    description: "Aaron - Human Maintainer and sole authorization source",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPHumanMaintainerKey",
    allowedSurfaces: []
  },
  {
    id: 2,
    name: "otto",
    role: "Operator",
    description: "Otto - Foreground operator, background loop runner, VSCode and Windows surface",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPOttoKey",
    allowedSurfaces: ["cli", "desktop", "vscode", "windows", "cowork"]
  },
  {
    id: 3,
    name: "alexa",
    role: "Builder",
    description: "Alexa - IDE and CLI dual-surface builder (Kiro)",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPAlexaKey",
    allowedSurfaces: ["cli", "kiro"]
  },
  {
    id: 4,
    name: "riven",
    role: "Builder",
    description: "Riven - IDE and CLI dual-surface builder (Cursor)",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPRivenKey",
    allowedSurfaces: ["cli", "cursor"]
  },
  {
    id: 5,
    name: "vera",
    role: "Builder",
    description: "Vera - IDE and CLI dual-surface builder (Codex)",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPVeraKey",
    allowedSurfaces: ["cli", "codex"]
  },
  {
    id: 6,
    name: "lior",
    role: "Compiler",
    description: "Lior - IDE and CLI dual-surface compiler (Antigravity/Gemini)",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPLiorKey",
    allowedSurfaces: ["cli", "antigravity", "gemini"]
  },
  {
    id: 7,
    name: "soraya",
    role: "Verifier",
    description: "Soraya - Formal verification expert",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPSorayaKey",
    allowedSurfaces: ["verifier-node"]
  },
  {
    id: 8,
    name: "addison",
    role: "Designer",
    description: "Addison - Design persona",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPAddisonKey",
    allowedSurfaces: []
  }
];

export const CELL_SURFACES = new Set<string>([
  "antigravity",
  "browser-tab",
  "chat",
  "cli",
  "codex",
  "cowork",
  "cursor",
  "desktop",
  "gemini",
  "kiro",
  "verifier-node",
  "vscode",
  "windows"
]);
