// Controlled vocabularies
export const IdVersion = { V1: 1 };
export const Chromosome = {
    MetaCoherence: 0,
    FinancialIntegrity: 7,
};
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
};
export const Firefly = { NoDirective: 1 };
export const Persona = {
    Aaron: 1,
    FireflyCoherence: 2,
};
export const LocationHint = {
    EastUS_VA1: 1,
    WestUS_CA3: 2,
};
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
];
