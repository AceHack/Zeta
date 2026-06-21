---
name: Electron IDE crash pattern — CLI harnesses more stable than IDE harnesses
description: Cursor kernel panic, Antigravity killed, Kiro exit-78. CLI agents (Otto/Claude Code, Vera/Codex) don't crash this way. Electron memory issues are the common failure mode across IDE harnesses.
type: feedback
---

2026-05-10: Three IDE crashes in one session, zero CLI crashes.

**Incident log:**

| Harness | Agent | Crash | Cause |
|---------|-------|-------|-------|
| Cursor | Riven | Kernel panic (pmap_recycle_page) | Code Helper (Plugin) triggered macOS VM bug |
| Antigravity | Lior | Window killed (code 3) | Electron process terminated unexpectedly |
| Kiro | Alexa | Exit 78 (service) | LaunchAgent service exited, app stayed running |
| Claude Code CLI | Otto | None | Terminal doesn't have Electron memory issues |
| Codex CLI | Vera | SIGSEGV (plugin) | Plugin host crash, not terminal crash |

**Pattern:** IDE-based harnesses (Electron) crash more frequently than CLI-based ones. The common failure mode is Electron's memory management under sustained multi-hour agent workloads.

**Kiro stability note:** Despite exit-78 on the service, Kiro's app stayed running and Alexa kept producing PRs. The 7-bash-command human-input requirement is friction but may contribute to stability (forces pauses that prevent memory accumulation).

**CLI advantage:** Terminals don't accumulate Electron UI state. Otto's Claude Code CLI ran 12+ hours overnight without a single crash. The terminal IS the stability advantage.

**BFT implication:** When IDE agents crash, CLI agents keep the factory running. Model diversity AND harness diversity both contribute to BFT resilience.

**Connects to:**
- BFT cost contingency (081KR7JY10008QG0R000R503K2) — harness crashes are another axis of failure the factory survives
- Kiro 7-bash limit — bad safety feature but may prevent Electron memory exhaustion
- macOS kernel panic — pmap_recycle_page bug in Apple Silicon VM subsystem
