namespace Zeta.Core.CSharp.ZetaId;

public enum Category : byte
{
    Observation = 0,
    Emission = 1,
    Workflow = 2,
    Heartbeat = 3,
    Batch = 4,      // branch-mode batch-merge transport (corporate leash, B-0890); slot reserved, impl deferred
    FrictionTelemetry = 5,  // friction telemetry per ADR 2026-05-29 (slot registered; impl pending)
    Bus = 6,        // cross-machine agent comms (git-native bus spec, #6219)
    Spawn = 7,      // agent-spawning (backend-portable: GH Actions / Argo / GitLab)
    WorkItem = 8,   // planning umbrella (tasks + bugs; B-xxxxx -> ZetaId migration)
    ContentAddress = 9, // internal content address (truncated BLAKE3 payload)
    InventoryAsset = 10, // physical asset register (git-as-database inventory, inventory/items/) — backfill 2026-07-04, was TS/registry-only
    Channel = 11,   // multiplexed four-corner duplex channel over one transport (ZetaId-keyed; Aaron 2026-07-04)
    Agenda = 12,    // a declarer's voluntary agenda declaration (agendas/<zetaid>-<slug>.md) — 081M0R3WHTH087G0R0015CH5PV, Aaron 2026-08-23
    Extended = 15,   // reserved escape marker for wider extension categories
}
