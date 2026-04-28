# PR #235 drain log — Amara 5th courier ferry: Zeta/KSK/Aurora independent validation

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/235>
Branch: `aurora/absorb-amara-5th-ferry-zeta-ksk-aurora-validation`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Thread count at drain start: 11 unresolved (Codex P2 + Copilot mix), 3
post-merge cascade threads
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, outcome class, and resolution path.

---

## First-wave drain (11 threads, pre-merge)

### Thread 1 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:503` — Archive-header grep brittleness (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59RZpp`
- Severity: P2
- Outcome: **VERBATIM-PRESERVATION DECLINED (Otto-227)** — the L503
  archive-header check block sits inside Amara's verbatim-preserved
  ferry report. Editing the proposed checks would violate the
  signal-in-signal-out + verbatim-as-faithful-courier rule. Brittleness
  observation valid as future-implementation work; the absorb captures
  the proposal as-written, not as-implemented.

### Thread 2 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:47` — Memory file dangling (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59RZpr`
- Severity: P2
- Outcome: **STALE-RESOLVED-BY-REALITY** — cited memory file
  `project_max_human_contributor_lfg_lucent_ksk_amara_5th_ferry_pending_absorb_otto_78_2026_04_23.md`
  exists in-tree per Otto-114 forward-mirror (verified via `ls`).

### Thread 3 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:17` — Invalid ISO-8601 timestamp (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyB`
- Severity: P1
- Outcome: **FIX** — `2026-04-24T01:~Z` (literal `~` in time field) →
  `2026-04-24T01:28:58Z` (actual ISO-8601, matching the original
  commit time). Commit `c919b9b`.

### Thread 4 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:48` — Memory file dangling (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyH`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** — same memory file as Thread 2;
  exists in-tree.

### Thread 5 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:63` — BP-09 misattribution (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyL`
- Severity: P1
- Finding: doc cited BP-09 as the verbatim-preservation rule, but BP-09
  is "All state is git-diffable ASCII" (verified via grep on
  `docs/AGENT-BEST-PRACTICES.md`).
- Outcome: **FIX** — adopted suggested rewording: redirected citation to
  "courier-protocol §signal-in-signal-out, the verbatim-preservation
  rule, and prior-ferry precedent (PR #221)". Commit `c919b9b`.

### Thread 6 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:925` — "byte-for-byte" + "excluding whitespace" contradiction (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyQ`
- Severity: P1
- Outcome: **FIX** — reworded: "preserves the ferry content verbatim
  except for whitespace normalisation for markdown-lint compatibility"
  resolves the byte-for-byte-vs-normalized contradiction. Commit `c919b9b`.

### Thread 7 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:922` — Wrong section citation (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyW`
- Severity: P1
- Finding: citation to `docs/protocols/cross-agent-communication.md` §2
  (Speaker labeling) was wrong — paste-transport guidance is in a
  different section.
- Outcome: **FIX** — citation now points at "Replacement: cross-agent
  courier protocol" header/storage rules. Commit `c919b9b`.

### Thread 8 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:886` — "Cited max exactly once" claim wrong (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyh`
- Severity: P1
- Finding: text claimed `max` cited "exactly once (in the preamble)",
  but `max` appeared multiple times via attribution.
- Outcome: **FIX** — reworded to "first-name-only attribution for `max`"
  matching actual document content. Commit `c919b9b`.

### Thread 9 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:934` — CC-001 dangling reference (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyo`
- Severity: P1
- Finding: `CC-001` cited as governing carve-out resolution but not
  defined elsewhere in repo.
- Outcome: **FIX** — replaced with history-surface-per-Otto-279 framing
  ("appropriate in an absorb doc because the file preserves provenance
  rather than setting operational policy"). Commit `c919b9b`.

### Thread 10 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:820` — "filed as BACKLOG rows in this PR" claim wrong (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZyy`
- Severity: P1
- Finding: PR adds only the absorb doc; no `docs/BACKLOG.md` modifications.
- Outcome: **FIX** — reworded both occurrences to "to be filed in a
  follow-up PR" (in the scope-limits section + the governance-edits
  subsection). Commit `c919b9b`.

### Thread 11 — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:946` — Memory file dangling (Copilot)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RZy7`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** — same memory file as Threads
  2 and 4; exists in-tree.

---

## Second-wave drain (3 verbatim-preservation cascade)

### Threads A-C — `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md:498/501/503` — More archive-header proposal critiques (Codex)

- Thread IDs: `PRRT_kwDOSF9kNM59kIxX`, `PRRT_kwDOSF9kNM59kIxY`,
  `PRRT_kwDOSF9kNM59kIxZ`
- Severity: P2
- Findings:
  - L501: `docs/archive/*.md` glob targets `docs/archive` (doesn't exist
    in repo); unmatched glob → grep status 2.
  - L498: `grep -q "Do not treat as operational policy"` won't match
    when wrapped across newlines.
  - L503: archive-header lint missing `Operational status` field check.
- Outcome (all three): **VERBATIM-PRESERVATION DECLINED (Otto-227)** —
  these all sit inside Amara's verbatim-preserved ferry content. The
  brittleness concerns are valid as future-implementation work; the
  absorb captures the proposal as-authored, not as-implemented. Future
  implementation phase should use a multi-line tolerant check, target
  the real archive path(s), and verify all required fields.

---

## Pattern observations (Otto-250 training-signal class)

1. **Otto-227 verbatim-preservation discipline survived three Codex
   review rounds.** All four `docs/archive/*.md` archive-header check
   findings (L501, L498, L503 + the original L503 first-wave one) sit
   inside Amara's verbatim ferry content; uniform decline-with-future-
   work-citation reply pattern. The discipline matures into a one-line
   rule: "Amara wrote this; the absorb preserves it as-authored;
   brittleness is implementation-phase work, not absorb-phase work."

2. **Stale-resolved-by-reality at ~27% on this PR (3 of 11 first-wave).**
   Same shape as the broader pattern: Otto-114 forward-mirror landed
   the cited memory file; reviewer threads pinned to pre-mirror state.

3. **Real-fix density is high in the absorption-notes section.** 7 of 11
   first-wave threads were real Otto-authored content errors (timestamp,
   BP-09 attribution, paste-transport citation, verbatim-claim
   contradiction, CC-001 dangling, BACKLOG-claim accuracy, max-attribution
   accuracy). The absorption-notes section is current-state operational
   substrate — author content there gets rigorously reviewed; the
   verbatim ferry content is preservation surface — author content there
   is exempt.

4. **Otto-279 history-surface carve-out applied implicitly via L934
   CC-001 fix.** The CC-001 dangling reference was replaced with explicit
   "history-surface-per-Otto-279" framing, propagating the surface-class
   rule into absorb-doc governance text.

## Final resolution

All 14 threads resolved (11 first-wave at SHA `c919b9b`, 3 second-wave
verbatim-preservation declined-with-explanation). PR auto-merge SQUASH
armed; CI cleared; merge pending.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
