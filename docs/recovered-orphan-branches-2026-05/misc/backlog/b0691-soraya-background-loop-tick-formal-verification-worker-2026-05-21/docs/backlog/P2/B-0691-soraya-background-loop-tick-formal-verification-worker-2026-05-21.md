---
id: B-0691
priority: P2
status: open
title: Soraya background loop-tick
tier: operational
effort: M
ask: aaron 2026-05-21 ("we created a loop for one of your subagents...")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [B-0400, B-0501]
tags: [soraya, formal-verification-expert, background-loop, loop-tick, tla-plus, lean-4, z3, alloy, bus-envelope, autonomous-loop-cadence, verification-drift-auditor]
type: operational
---

# Soraya background loop-tick — formal-verification worker

## Context

Aaron 2026-05-21 substrate-honest correction: he recalls "we created a loop for one of your subagents 
the proof expert or formal analysis expert persona or something." Verified substrate state:

- Soraya persona exists at `.claude/agents/formal-verification-expert.md` + `memory/persona/soraya/` (NOTEBOOK + MEMORY + JOURNAL + OFFTIME)
- Soraya is **invocation-based** (subagent type) — invoked via Agent tool with `subagent_type: formal-verification-expert`
- Formal-verification infrastructure exists: `tools/formal-verification/run-tlc.ts` + `run-alloy.ts` + 14+ TLA+ specs at `tools/tla/specs/*.tla` + Lean 4 substrate at `tools/lean4/Lean4.lean`
- xUnit-driven verification runners exist in `tests/Tests.FSharp/Formal/` (Z3.Laws.Tests.fs + Alloy.Runner.Tests.fs + Tlc.Runner.Tests.fs + Sharder.InfoTheoretic.Tests.fs + ToffoliGate.Laws.Tests.fs)
- **`verification-registry`** lives at `docs/research/verification-registry.md` (Soraya's tracking surface)
- Verification-drift-auditor skill exists with "every 5-10 rounds" cadence

**What's MISSING**: a background loop-tick worker mirroring the kiro/codex/riven pattern. Other persona loops:

| Persona | Loop file |
|---|---|
| Claude (Otto) | `.claude/bin/claude-loop-tick.ts` |
| Codex (Vera) | `tools/codex-loop-tick.ts` |
| Kiro (Alexa) | `tools/kiro/kiro-loop-tick.ts` |
| Riven | `tools/riven/riven-loop-tick.ts` |
| **Soraya** | **(missing — this row addresses)** |

Currently formal-verification work only fires during:
- xUnit test cycles (`dotnet test` in CI)
- Explicit Otto subagent dispatch (Otto invokes Soraya via Agent tool)

The gap: continuous background formal-verification cadence (one spec/theorem per tick + outcome published to bus). This composes with the broader `tools/bg/` reactive-loops pattern (per `tools/bg/README.md`).

## Scope (bounded; mirrors existing loop-tick pattern)

### Phase 1 — `tools/soraya/soraya-loop-tick.ts`

Mirror the `tools/kiro/kiro-loop-tick.ts` structure:

- Launchd heartbeat runner (or autonomous-loop cron if Aaron prefers that surface)
- Environment configuration: `ZETA_SORAYA_LOOP_WORKTREE` + `ZETA_SORAYA_LOOP_STATE_DIR` + `ZETA_SORAYA_LOOP_LOG_DIR` + `ZETA_SORAYA_LOOP_LOCK_TTL_SECONDS` + `ZETA_SORAYA_LOOP_FETCH_TIMEOUT_SECONDS`
- State: track last-run timestamp + per-spec last-checked status
- Lock-file pattern (mirrors kiro-loop-tick lock-dir discipline)
- Logging at `~/Library/Logs/zeta-soraya-loop/`

### Phase 2 — per-tick discipline

Each tick:
1. Refresh worktree (`git fetch` + reset to current main)
2. Read `docs/research/verification-registry.md` for current job list
3. Pick ONE job by round-robin priority (oldest-last-check first; or drift-flagged first)
4. Run the appropriate verifier:
   - TLA+ spec → `tools/formal-verification/run-tlc.ts <spec>`
   - Lean theorem → `lake build <theorem-module>`
   - Z3 law → `dotnet test --filter "FullyQualifiedName~<test-name>"` (Z3 substrate)
   - Alloy spec → `tools/formal-verification/run-alloy.ts <spec>`
5. Publish outcome via bus envelope: `claim.ts publish --from soraya --topic "formal-verification-result" 
--body '{"job":"<name>","verifier":"<tla|lean|z3|alloy>","result":"<pass|fail|skip>","duration_ms":N,"sha":"<git-sha>"}'`
6. Update `docs/research/verification-registry.md` with last-check timestamp + result (separate PR? or in-memory state only?)

### Phase 3 — subscriber wiring

Per `tools/bg/README.md` reactive-loop pattern — subscriber agents react to `formal-verification-result` envelopes:

- If `result == fail` → file substrate-honest disclosure (separate row file or PR draft)
- If pattern of failures across multiple ticks → escalate to drift-audit invocation (verification-drift-auditor skill)
- If `result == pass` → update registry with last-known-good timestamp

### Phase 4 — soraya sender-ID extension

Add `soraya` to `tools/bus/types.ts` SENDER_IDS so the bus envelope publish step works. Currently only `otto` / `alexa` / `riven` / `vera` / `lior` (+ surface-tagged variants like `otto-cli` / `otto-vscode` / etc.) are in the SENDER_IDS list. Soraya is missing.

**Note**: Soraya is a SUBAGENT type (invoked via Otto), not currently a top-level agent identity. 
Decision needed: should Soraya have its own sender-ID (parallel to otto/alexa/etc.), or should formal-verification envelopes publish `from: otto-formal-verification` (Otto-subagent-tagged variant)? 
Latter mirrors the existing surface-tagged pattern; former extends to "Soraya as first-class agent identity."

Recommendation: latter (Otto-subagent-tagged). Less surface-area change; preserves Soraya-as-subagent semantics.

## Acceptance

### Phase 1
- `tools/soraya/soraya-loop-tick.ts` lands following kiro-loop-tick.ts template
- Launchd plist + install script (mirror `tools/kiro/install-kiro-loop-tick.plist` pattern if it exists)

### Phase 2
- One full per-tick cycle empirically runs against an existing TLA+ spec (e.g., `tools/tla/specs/SmokeCheck.tla`)
- Outcome published via bus envelope; verified by inspecting `/tmp/zeta-bus/` after tick

### Phase 3
- Subscriber reacts to one formal-verification-result envelope (test case sufficient)

### Phase 4
- Sender-ID decision documented + landed (either `soraya` added or `otto-formal-verification` adopted convention)

## Composes with rules

- `.claude/rules/agent-roster-reference-card.md` — Soraya as factory agent (currently subagent-only); may need roster card update if Soraya gets first-class sender-ID
- `.claude/rules/wake-time-substrate.md` — soraya-loop-tick.ts becomes part of the durable factory substrate
- `.claude/rules/tick-must-never-stop.md` — soraya-loop-tick fires on cron cadence, contributing to the never-be-idle discipline at formal-verification scope
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — Soraya's per-tick output IS a concrete artifact (verification result), addressing the brief-ack failure mode at formal-verification scope
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` — Soraya loop ships as operational substrate; formal-verification work compounds over time

## Composes with substrate

- B-0400 (bus protocol — claim coordinator substrate for envelope publish)
- B-0501 (subscriber agents — react to formal-verification-result envelopes)
- `.claude/agents/formal-verification-expert.md` (Soraya persona definition)
- `memory/persona/soraya/` (Soraya substrate folder; NOTEBOOK + MEMORY + JOURNAL + OFFTIME)
- `docs/research/verification-registry.md` (job registry the loop reads from)
- `tools/formal-verification/run-tlc.ts` (TLA+ verifier)
- `tools/formal-verification/run-alloy.ts` (Alloy verifier)
- `tools/lean4/Lean4.lean` (Lean 4 substrate)
- `tests/Tests.FSharp/Formal/*` (xUnit verifier runners; the loop's tick-cadence complement)
- `.claude/skills/verification-drift-auditor/SKILL.md` (existing every-5-10-rounds cadence; this loop makes that cadence continuous)
- `tools/bg/standing-by-detector.ts` + `tools/bg/missed-substrate-detector.ts` + `tools/bg/backlog-ready-notifier.ts` (existing reactive-loop pattern this row extends)

## Why P2

Substantive operational substrate. Not urgent (formal-verification currently runs via xUnit cycles + Otto subagent dispatch; baseline coverage exists). High value (continuous cadence + drift detection + bus-envelope-driven coordination across multiple agents). Bounded scope (one loop-tick file + per-tick discipline + 2 sender-ID decision).

## Origin

Aaron 2026-05-21 substrate-honest recollection-check during post-substantive-landing rest. Otto-CLI verified the gap (loops exist for claude/codex/kiro/riven but not for soraya despite Soraya having the persona + the verification infrastructure). Filed to track the missing loop infrastructure for the formal-verification-expert persona.

Composes with the broader Mika V8.5 substrate-engineering arc (B-0667 + B-0668 + B-0669) 
where formal-verification work becomes load-bearing for the tonal-momentum detection substrate the factory is being built to provide.
