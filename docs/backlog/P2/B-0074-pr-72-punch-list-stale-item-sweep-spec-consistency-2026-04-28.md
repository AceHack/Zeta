---
id: B-0074
priority: P2
status: open
title: PR #72 punch-list / spec-consistency drift sweep — 8 codex threads on stale items + cross-doc alignment
effort: M
ask: chatgpt-codex-connector + copilot reviews on PR #72
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-72, punch-list, spec-consistency, b-0062, deferral-tracking]
---

# B-0074 — PR #72 punch-list / spec-consistency drift sweep

## Source

PR #72 review tick 2026-04-28T09:30Z surfaced 8 substantive
codex threads flagging that B-0062's punch list and the
EAT/wallet specs have drift items that need targeted updates.
Per the bulk-resolve discipline (`feedback_bulk_resolve_is_not
_answer_recurring_pattern_aaron_2026_04_28.md`), each deferral
gets a concrete tracking destination — this row is that
destination for the 8 items.

## Items to update

### B-0062 punch-list stale-item removal

The punch list at `docs/backlog/P0/B-0062-wallet-v0-build-out
-spec-logic-punch-list-from-pr-72-deferrals.md` accumulated
items that have since been resolved by spec edits in this
session. Codex flagged 4 stale entries:

1. **L143 — cancellation-auth blocker (cid: SIvLus5-BRMj)**:
   item flagged the §9.1 vs §3.3/§3.4 self-revocation
   contradiction; subsequent EAT/wallet edits resolved it.
   Remove from punch list with audit trail in commit message.
2. **L152 — reorg-metric blocker (cid: SIvLus5-BHvP)**: stale
   reorg-metric blocker, no longer applicable.
3. **L161 — §15 unresolved-questions item (cid: SIvLus5-BHvU)**:
   the §15 entry that was open is now closed; drop from punch.
4. **L62 — pre-broadcast freeze item (cid: SIvLus5-Bk-Z)**:
   the in-repo-monitor topology aspect of this entry was
   resolved by the §13.4 in-repo-monitor removal (earlier
   tick edit aligning with §12.5 sibling-repo redundancy);
   **but the state-machine semantics aspect (pre-flight vs
   post-broadcast classification timing — the actual safety
   invariant the punch-list item flagged) remains OPEN.**
   The B-0062 entry should be split: close the topology
   sub-item, keep the state-machine sub-item open.

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
2. **`docs/backlog/P1/B-0067-cadenced-git-hotspot-detection-aaron-2026-04-28.md`
   L50 (cid: SIvLus5-B6tS)**: log-line analysis should
   exclude blank lines from hotspot scoring. Small
   algorithmic refinement to whichever tool the doc references.
   (Earlier draft incorrectly cited the location as
   `docs/research/...` — the actual file is the B-0067
   backlog row at the path above.)

## Why deferred (not fixed in PR #72)

Each item is small but the set is broad — touching 4 files
across docs/backlog/, docs/research/, memory/. Rolling them
into PR #72 expands its scope unnecessarily. Better as a
focused sweep PR that touches just these 4 files.

## Acceptance

- 4 stale entries removed from B-0062 with explicit audit
  trail
- EAT §504 + wallet-v0 §377 cross-doc consistency verified
- kiro-cli memory rephrased OR PR #72 rebased (whichever
  resolves the live xref first)
- git-hotspot log-line filter algorithm refined

## Composes with

- B-0062 (the punch list this updates)
- PR #72 (the source of the threads this row defers)
- `feedback_bulk_resolve_is_not_answer_recurring_pattern_aaron_2026_04_28.md`
  (the discipline this row honors)
