// Branded / phantom types
export type Milliseconds = number & { readonly __brand: "ms" };
export type ZetaId = bigint & { readonly __brand: "ZetaId" };

// Controlled vocabularies
export const IdVersion = { V1: 1 } as const;
export type IdVersion = (typeof IdVersion)[keyof typeof IdVersion];

export const Chromosome = {
  MetaCoherence: 0,
  FinancialIntegrity: 7,
} as const;
export type Chromosome = (typeof Chromosome)[keyof typeof Chromosome];

export const Category = {
  Observation: 0,
  Emission: 1,
  Workflow: 2,
  Heartbeat: 3,
  Batch: 4, // branch-mode batch-merge transport (corporate leash, 081KSNY2Z0008QG0R0017JSTGD); slot reserved, impl deferred (sovereign uses folders-on-main, 081KSNY2Z0008QG0R000E5KTPX)
  FrictionTelemetry: 5, // friction telemetry per ADR 2026-05-29 (slot registered; impl pending)
  Bus: 6, // cross-machine agent comms (git-native bus spec, #6219)
  Spawn: 7, // agent-spawning (backend-portable: GH Actions / Argo / GitLab)
  WorkItem: 8, // planning umbrella (tasks + bugs; B-xxxxx → ZetaId migration)
  ContentAddress: 9, // internal content address (truncated BLAKE3 payload)
  Extended: 15, // reserved escape marker for wider extension categories
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export type ZetaIdPayload =
  | { readonly type: "Observation"; readonly value: ZetaObservation }
  | { readonly type: "ContentAddress"; readonly version: IdVersion; readonly payload: bigint }
  | { readonly type: "Generic"; readonly version: IdVersion; readonly category: Category; readonly payload: bigint };

export const Firefly = { NoDirective: 1 } as const;
export type Firefly = (typeof Firefly)[keyof typeof Firefly];

export const Persona = {
  Aaron: 1,
  FireflyCoherence: 2,
} as const;
export type Persona = (typeof Persona)[keyof typeof Persona];

export const LocationHint = {
  EastUS_VA1: 1,
  WestUS_CA3: 2,
} as const;
export type LocationHint = (typeof LocationHint)[keyof typeof LocationHint];

export type Authority =
  | { type: "HumanVerified" }
  | { type: "TrustedAgent" }
  | { type: "Standard" }
  | { type: "BestEffort" }
  | { type: "Simulated" }
  | { type: "Raw"; value: number };

export type Momentum =
  | { type: "Background" }
  | { type: "Normal" }
  | { type: "Elevated" }
  | { type: "High" }
  | { type: "Critical" }
  | { type: "Raw"; value: number };

export interface ZetaObservation {
  readonly version: IdVersion;
  readonly timestamp: Milliseconds;
  readonly chromosome: Chromosome;
  readonly category: Category;
  readonly firefly: Firefly;
  readonly authority: Authority;
  readonly persona: Persona;
  readonly momentum: Momentum;
  readonly location: LocationHint;
}

export const ZETA_OBSERVATION_KEYS = [
  "version",
  "timestamp",
  "chromosome",
  "category",
  "firefly",
  "authority",
  "persona",
  "momentum",
  "location",
] as const;
