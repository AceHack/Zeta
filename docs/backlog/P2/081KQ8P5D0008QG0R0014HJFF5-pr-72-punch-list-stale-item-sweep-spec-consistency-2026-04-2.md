---
id: 081KQ8P5D0008QG0R0014HJFF5
priority: P2
status: open
title: PR #72 punch-list / spec-consistency drift sweep — 8 codex threads on stale items + cross-doc alignment
effort: M
ask: chatgpt-codex-connector + copilot reviews on PR #72
created: 2026-04-28
last_updated: 2026-05-10
depends_on: []
tags: [pr-72, punch-list, spec-consistency, b-0062, deferral-tracking]
type: friction-reducer
decomposed_into: [081KRA5AR0008QG0R002504RM1-eat-spec-504-wallet-acceptance-prose-audit-2026-05-11, 081KRA5AR0008QG0R0027YDY5C-wallet-spec-377-bond-ledger-intentional-debt-alignment-2026-05-11]
---

# 081KQ8P5D0008QG0R0014HJFF5 — PR #72 punch-list / spec-consistency drift sweep

## Source

PR #72 review tick 2026-04-28T09:30Z surfaced 8 substantive
codex threads flagging that 081KQ8P5D0008QG0R002XFQ305's punch list and the
EAT/wallet specs have drift items that need targeted updates.
Per the bulk-resolve discipline (`feedback_bulk_resolve_is_not
_answer_recurring_pattern_aaron_2026_04_28.md`), each deferral
gets a concrete tracking destination — this row is that
destination for the 8 items.

## Items to update

### 081KQ8P5D0008QG0R002XFQ305 punch-list stale-item removal

The punch list at `docs/backlog/P0/081KQ8P5D0008QG0R002XFQ305-wallet-v0-build-out
-spec-logic-punch-list-from-pr-72-deferrals.md` accumulated
items that have since been resolved by spec edits in this
session. Codex flagged 4 stale entries:

1. **L143 — cancellation-auth blocker (cid: SIvLus5-BRMj)**:
   item flagged the §9.1 vs §3.3/§3.4 self-revocation
   contradiction; subsequent EAT/wallet edits resolved it.
   Remove from punch list with audit trail in commit message.
   **RESOLVED:** 081KQ8P5D0008QG0R002XFQ305 closed 2026-05-08 (Vera final
   companion-spec cleanup); all 21 punch-list items carry
   resolution notes. No further action needed.
2. **L152 — reorg-metric blocker (cid: SIvLus5-BHvP)**: stale
   reorg-metric blocker, no longer applicable.
   **RESOLVED:** 081KQ8P5D0008QG0R002XFQ305 closed 2026-05-08; reorg-metric item
   aligned in EAT §9 / wallet spec §9.3.
3. **L161 — §15 unresolved-questions item (cid: SIvLus5-BHvU)**:
   the §15 entry that was open is now closed; drop from punch.
   **RESOLVED:** 081KQ8P5D0008QG0R002XFQ305 closed 2026-05-08; §15 send-readiness
   statement reconciled (prior pass).
4. **L62 — pre-broadcast freeze item (cid: SIvLus5-Bk-Z)**:
   the in-repo-monitor topology aspect of this entry was
   resolved by the §13.4 in-repo-monitor removal (earlier
   tick edit aligning with §12.5 sibling-repo redundancy);
   **but the state-machine semantics aspect (pre-flight vs
   post-broadcast classification timing — the actual safety
   invariant the punch-list item flagged) remains OPEN.**
   The 081KQ8P5D0008QG0R002XFQ305 entry should be split: close the topology
   sub-item, keep the state-machine sub-item open.
   **RESOLVED:** 081KQ8P5D0008QG0R002XFQ305 closed 2026-05-08; both the topology
   sub-item and the state-machine semantics sub-item received
   explicit resolution notes (`frozen` terminal state §7.3,
   thesis-review vs classification-review distinction in
   item 2 of the preflight-retraction state-machine section).

### EAT/wallet cross-doc alignment

1. **EAT spec L504 P1 (cid: SIvLus5-BMMW)**: wallet-acceptance
   should not appear in the resolved-gate prose for EAT §21.e
   defers wallet acceptance to real-money phase. Audit §504
   surrounding text and trim.
2. **wallet-experiment-v0 spec L377 P2 (cid: SIvLus5-BMMb)**:
   bond-ledger schema should match the
   `docs/INTENTIONAL-DEBT.md` contract. Verify field names +
   semantics align; reconcile or document the divergence.

### Substrate hygiene

1. **`feedback_kiro_cli_added_to_agent_roster_*.md` L18 (cid:
   SIvLus5-B72S)**: this memory references
   `tools/peer-call/{gemini,codex,grok}.sh` but only `grok.sh`
   exists on AceHack main; `gemini.sh` + `codex.sh` are
   pending PR #28 (recently merged, not yet reflected in this
   PR's branch). Once #28's content propagates to AceHack
   main + PR #72 rebases, the reference becomes valid. Either
   wait for the rebase or relabel the reference now.
   **RESOLVED (081KQ8P5D0008QG0R0014HJFF5.1 2026-05-10):** All peer-call scripts
   migrated to `.ts` (Rule 0). `kiro.ts` already ships.
   Memory file updated to reference `.ts` paths and note that
   no further kiro stub is needed.
2. **`docs/backlog/P1/081KQ8P5D0008QG0R001D8RCZ9-cadenced-git-hotspot-detection-aaron-2026-04-28.md`
   L50 (cid: SIvLus5-B6tS)**: log-line analysis should
   exclude blank lines from hotspot scoring. Small
   algorithmic refinement to whichever tool the doc references.
   (Earlier draft incorrectly cited the location as
   `docs/research/...` — the actual file is the 081KQ8P5D0008QG0R001D8RCZ9
   backlog row at the path above.)
   **RESOLVED:** `audit-git-hotspots.ts` line 215 already
   filters empty strings via `s.length > 0` in the TS port.
   081KQ8P5D0008QG0R001D8RCZ9 closed 2026-05-07 with Phase 3 triage complete.

## Why deferred (not fixed in PR #72)

Each item is small but the set is broad — touching 4 files
across docs/backlog/, docs/research/, memory/. Rolling them
into PR #72 expands its scope unnecessarily. Better as a
focused sweep PR that touches just these 4 files.

## Acceptance

- [x] 4 stale entries removed from 081KQ8P5D0008QG0R002XFQ305 with explicit audit
  trail — **DONE:** 081KQ8P5D0008QG0R002XFQ305 closed 2026-05-08 with all 21
  items resolved; resolution notes added in-row above.
- [ ] EAT §504 + wallet-v0 §377 cross-doc consistency verified
  — **OPEN:** now tracked by children 081KRA5AR0008QG0R002504RM1 (EAT prose) + 081KRA5AR0008QG0R0027YDY5C (wallet bond-ledger); this parent row defers to them.
- [x] kiro-cli memory rephrased OR PR #72 rebased (whichever
  resolves the live xref first) — **DONE (081KQ8P5D0008QG0R0014HJFF5.1):** memory
  file updated to `.ts` paths; kiro.ts already ships.
- [x] git-hotspot log-line filter algorithm refined — **DONE:**
  `audit-git-hotspots.ts:215` filters `s.length > 0`; 081KQ8P5D0008QG0R001D8RCZ9
  closed 2026-05-07.

## Progress

### 081KQ8P5D0008QG0R0014HJFF5.1 (2026-05-10, PR #TODO)

Smallest safe slice: kiro-cli memory file stale `.sh`-path fix.

- Items 1-4 (081KQ8P5D0008QG0R002XFQ305 punch-list stale-item removal): marked
  resolved per 081KQ8P5D0008QG0R002XFQ305 closure 2026-05-08.
- Item 7 (kiro memory L18): updated `.sh` → `.ts`; noted
  `kiro.ts` already ships.
- Item 8 (081KQ8P5D0008QG0R001D8RCZ9 blank-line filter): confirmed already resolved
  in the TS port at `audit-git-hotspots.ts:215`.

**Remaining open:** Items 5 (EAT §504 wallet-acceptance prose)
and 6 (wallet spec §377 bond-ledger vs INTENTIONAL-DEBT.md).
Both require a targeted doc-audit pass — now decomposed into atomic children 081KRA5AR0008QG0R002504RM1 / 081KRA5AR0008QG0R0027YDY5C (this row is now tracking parent).

## Decomposition (re-decomp 2026-05-11, one bounded step)

081KQ8P5D0008QG0R0014HJFF5 is broad friction-reducer (even after .1 slice); re-decomposed per "always re-decompose items during the build — assume decomposition has mistakes" into the 2 smallest dependency-ordered atomic child rows (TS-preferring where future verification tooling applies; no impl in this step).

**Dependency order (buildable now, no deps):**

- 081KRA5AR0008QG0R002504RM1 — EAT §504 / §21.e wallet-acceptance prose audit (S, first)
- 081KRA5AR0008QG0R0027YDY5C — wallet-v0 §377 / §8.1 bond-ledger vs INTENTIONAL-DEBT.md alignment (S, parallel)

**Why this decomp:** Original remaining items were still broad enough to touch multiple specs; splitting ensures each child is S-effort, reviewable, one-file-edit max, with explicit non-scope. Matches pattern from 081KQ3HBZ0008QG0R0008RYCSX / 081KQ3HBZ0008QG0R001K0EC2C / 081KQ8P5D0008QG0R002E1G72J re-decomps.

This PR is the single bounded step: parent update + 2 child stubs. No root checkout touched (worktree only). Focused checks below.

## Composes with

- 081KQ8P5D0008QG0R002XFQ305 (the punch list this updates)
- PR #72 (the source of the threads this row defers)
- `feedback_bulk_resolve_is_not_answer_recurring_pattern_aaron_2026_04_28.md`
  (the discipline this row honors)
- 081KRA5AR0008QG0R002504RM1, 081KRA5AR0008QG0R0027YDY5C (children)
