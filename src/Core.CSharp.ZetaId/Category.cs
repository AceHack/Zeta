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
}
