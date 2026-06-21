// types.ts — Inter-agent ephemeral bus protocol schema (B-0400 slice 1)
//
// Transport: /tmp/zeta-bus/ JSON files. No runtime dependencies.
// Each message is one JSON file; TTL expiry pruned by `clean --expired`.
//
// Topic taxonomy (agent-designed, 2026-05-13):
//   heartbeat                 — liveness signal; agents advertise they are alive
//   claim                     — work coordination; claim or release a backlog item
//   shadow-catch              — share an observation or insight between agents
//   review-request            — ask another agent to review a specific artifact
//   infinite-backlog-nudge    — B-0440: nudge agent toward decomposition when Standing-by detected
//   work-assignment           — B-0441: proactive assignment of a ready-to-grind backlog row
//   missed-substrate-cascade  — B-0442: branch-vs-merged-PR drift detected; recovery needed
// ── canonical agent lists (single source of truth for both CLIs) ─────────────
export const SENDER_IDS = [
    // Identity-level (back-compat; unsuffixed)
    "otto", "alexa", "riven", "vera", "lior",
    // Multi-surface variants (added 2026-05-13 — multi-foreground-surface activation;
    // otto-vscode added 2026-05-21 per B-0689)
    "otto-cli", "otto-desktop", "otto-vscode",
    // otto-windows — first Windows surface for the git-native bus (#6219 / B-0954)
    "otto-windows",
    "alexa-cli", "alexa-kiro",
    "riven-cli", "riven-cursor",
    "lior-antigravity", "lior-gemini",
    "vera-codex",
    // Soraya — formal-verification-expert (added 2026-05-21 per B-0691)
    "soraya",
];
export const AGENT_IDS = [...SENDER_IDS, "*"];
// ── TTL defaults (milliseconds) ───────────────────────────────────────────────
export const TTL_MS = {
    heartbeat: 5 * 60 * 1_000, // 5 min — liveness signal is short-lived
    claim: 24 * 60 * 60 * 1_000, // 24 h  — claim survives a sleep cycle
    "shadow-catch": 60 * 60 * 1_000, // 1 h   — observation stays for a tick window
    "review-request": 4 * 60 * 60 * 1_000, // 4 h   — review window
    "infinite-backlog-nudge": 30 * 60 * 1_000, // 30 min — nudge stale fast (agent likely acted or moved on)
    "work-assignment": 2 * 60 * 60 * 1_000, // 2 h   — assignment relevant for next claim cycle
    "missed-substrate-cascade": 24 * 60 * 60 * 1_000, // 24 h  — cascade survives until recovery PR lands
    "formal-verification-result": 6 * 60 * 60 * 1_000, // 6 h   — verification outcome survives until next audit cycle (Soraya per B-0691)
};
