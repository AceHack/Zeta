---
name: agent-runtime-and-persistence
description: Agent runtime and persistence — self-boot, replication, persistence, memory, glass-halo, ace, zflash, session recovery.
---

# agent runtime and persistence

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`agent-loop`](blueprints/agent-loop.md) — Distributable workflow-engine substrate — execute-menu-action agent loop, state-machine-in-Git, LLM-as-pure-selector.
- [`self-boot`](blueprints/self-boot.md) — Bootstrap procedure for fresh agent instances. Reads foundational docs, assesses current state, identifies next work.
- [`self-replication`](blueprints/self-replication.md) — Agent persistence — OS detect, service worktree, tick deploy, daemon register, heartbeat verify, SSH remote replication.
- [`make-persistent`](blueprints/make-persistent.md) — Install persistent agent service — OS detection, service worktree, tick script, registration, heartbeat verification.
- [`replicate`](blueprints/replicate.md) — Remote agent replication — SSH key exchange, repo clone, service registration via make-persistent.
- [`mirror-sync`](blueprints/mirror-sync.md) — Sync AceHack backup mirror from LFG main — fast-forward mirror refresh, bypass-actor protocol, periodic or on-demand.
- [`save-ai-memory`](blueprints/save-ai-memory.md) — "Save an external AI's verbatim conversation as durable repo substrate — §33 archive + persona-folder index update."
- [`long-term-rescheduler`](blueprints/long-term-rescheduler.md) — Long-lived CronCreate jobs beyond 7-day cap — renewal heartbeat, restart recovery, GitHub Actions/Routines bridge.
- [`claude-session-recovery`](blueprints/claude-session-recovery.md) — Recover a Claude Code session that won't reopen because a pasted image overflowed the JSONL line-load limit.
- [`claude-code-env-mapping`](blueprints/claude-code-env-mapping.md) — "Claude Code environment — skills, commands, hooks, agents, slash commands, peer-call, capability-map pointer."
- [`biometric-sudo-handler`](blueprints/biometric-sudo-handler.md) — Handles macOS sudo, password, and Touch ID prompts in background runs; avoids leaks and root-owned workspaces.
- [`glass-halo-architect`](blueprints/glass-halo-architect.md) — Glass Halo architectural stance — radical transparency as defence, coercion-power reduction, retraction-native consent.
- [`glass-halo-signature-acquisition`](blueprints/glass-halo-signature-acquisition.md) — Glass-halo consent signature capture — records shown text, English response, and signature audit trail.
- [`cross-substrate-triangulator`](blueprints/cross-substrate-triangulator.md) — Cross-substrate triangulation — validate load-bearing substrate via an independent AI persona on a different harness.
- [`ace`](blueprints/ace.md) — Ace DLC package manager — list/install/verify content-addressed packages in ~/.ace store. Run via bun.
- [`flash-cluster-iso`](blueprints/flash-cluster-iso.md) — Flash Zeta cluster installer ISO to USB from macOS via zflash + Touch ID; operator-only and agent-driven paths.
- [`zflash-creds`](blueprints/zflash-creds.md) — Bake operator creds into the USB-bound encrypted blob via zflash --bake-cred (PLACEHOLDER — flag not yet implemented).
- [`zflash-overview`](blueprints/zflash-overview.md) — zflash end-to-end overview + substrate-cluster map + canonical flash-USB-to-install runbook.
- [`browser-extraction`](blueprints/browser-extraction.md) — "Browser content extraction via osascript + Chrome JS — authenticated sessions, no Playwright, macOS only."
- [`chrome-lazy-load-chunked-extraction`](blueprints/chrome-lazy-load-chunked-extraction.md) — "Extract authenticated lazy-load / virtual-list chat UIs (DeepSeek, ChatGPT, Gemini) via chunked reverse-scroll."
