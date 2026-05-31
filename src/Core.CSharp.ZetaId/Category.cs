namespace Zeta.Core.CSharp.ZetaId;

public enum Category : byte
{
    Observation = 0,
    Emission = 1,
    Workflow = 2,
    Heartbeat = 3,
    // 4 free — B-0890 Batch coordinator superseded by B-0890.1 folders-on-main
    FrictionTelemetry = 5,  // friction telemetry per ADR 2026-05-29 (slot registered; impl pending)
    Bus = 6,        // cross-machine agent comms (git-native bus spec, #6219)
    Spawn = 7,      // agent-spawning (backend-portable: GH Actions / Argo / GitLab)
    WorkItem = 8,   // planning umbrella (tasks + bugs; B-xxxxx -> ZetaId migration)
}
