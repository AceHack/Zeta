# PR #433 drain log — drain follow-up to #226: priority tie-break + strip-paired-delimiters + dedup-by-source_path

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/433>
Branch: `drain/226-followup-priority-tiebreak-and-strip-and-dedup`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 3 substantive Codex post-merge findings on
parent #226 (memory reconciliation algorithm design v0).
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of three substantive
algorithm-correctness findings on the memory-reconciliation spec.

This PR is the **first post-merge cascade** to #226 (research:
memory reconciliation algorithm design v0 — Amara Determinize 3/5,
L-effort design). #434 was the second cascade (CC schema alignment
covered in `434-drain-log.md`); this `433` is the first cascade
catching three orthogonal algorithm-correctness improvements.

---

## Threads — orthogonal algorithm-correctness improvements

### Thread 1 — chain_head liveness vs priority-tie-break-for-winner distinction

- Reviewer: chatgpt-codex-connector
- Severity: P1 (algorithm correctness)
- Finding: parent #226's spec conflated two distinct invariants:
  - **chain_head liveness**: at most one fact per canonical key has
    `status: active` at any time (Invariant 2).
  - **priority tie-break for winner**: when (under the design
    invariants 1-5) two facts somehow both end up active
    simultaneously (which shouldn't happen but invariant-6 provides
    a deterministic fallback), priority breaks the tie.
  Conflating them muddled the rendering rules: the renderer needs
  to know which invariant a check is enforcing — chain_head
  liveness (read invariant 2) vs winner-selection-when-multiple-
  active (read invariant 6).
- Outcome: **FIX** — distinguished the two concepts in the spec:
  Invariant 2 covers chain_head liveness; Invariant 6 covers
  priority-tie-break-for-winner. Renderer rules now cite the
  appropriate invariant + treat them as orthogonal checks.

### Thread 2 — Markdown formatting strip = paired-delimiter only (preserve `_internal_var`)

- Reviewer: chatgpt-codex-connector
- Severity: P1 (canonical-key normalization correctness)
- Finding: parent's canonical-key normalization rule "Strip
  markdown formatting" was over-broad: `_text_` paired emphasis
  should be unwrapped (`text`) but `_internal_var` (a Python-style
  identifier) should be preserved. Same for paired backticks vs
  stray backtick. The strip rule needed to be paired-delimiter-
  only, not raw-character-removal.
- Outcome: **FIX** — rule reformulated as "Strip markdown
  formatting *delimiters* — i.e. unwrap text from paired
  emphasis/code spans rather than removing every occurrence of
  those characters as raw chars":
  - `**text**` → `text` (paired `**` removed, content kept)
  - `*text*` → `text` (paired `*` around a word removed)
  - `_text_` → `text` (paired `_` around a word removed, where
    `text` matches `[A-Za-z0-9-]+`; preserves identifiers like
    `_internal_var` or `__private`)
  - `` `text` `` → `text` (paired backticks removed)
  Single occurrences and unpaired delimiters NOT stripped —
  `_internal_var` stays as `_internal_var`, `a_b_c` stays as
  `a_b_c`, stray backtick survives.

### Thread 3 — MEMORY.md dedup by source_path (multiple typed facts → one index row)

- Reviewer: chatgpt-codex-connector
- Severity: P1 (rendering correctness)
- Finding: parent's `MEMORY.md` index rendering rule didn't
  specify dedup behavior when the same memory file (same
  `source_path`) has multiple typed facts (e.g., user_*.md
  containing both feedback + preference facts). Without dedup, the
  index would have one row per fact instead of one row per file.
- Outcome: **FIX** — dedup-by-source_path: multiple typed facts
  from the same source file produce ONE index row (synthesized
  from the highest-priority fact's title + description). One file
  → one index row; multiple facts → one row's content reflects the
  best-available summary.

---

## Pattern observations (Otto-250 training-signal class)

1. **Spec-correctness findings on algorithm designs benefit from
   per-invariant orthogonal-checks reasoning.** Thread 1's
   chain_head-liveness vs priority-tie-break distinction is a
   classic case: two invariants that look similar at high level
   (both involve "which fact wins") but apply at different points
   in the algorithm (one normal-case, one fallback). Codex catches
   conflation reliably; fix template is to enumerate the invariants
   + cite the specific one each check enforces.

2. **Paired-delimiter-vs-raw-character is a normalization-rule
   precision class.** Thread 2's "Strip markdown formatting" rule
   is the same class as #206's K-relations subset-vs-superset
   precision error: both involve a rule whose obvious surface
   reading is broader than the actual intended scope. Fix template:
   rephrase the rule with explicit delimiter-pairing condition;
   list both the paired forms (stripped) and the unpaired forms
   (preserved) so implementers can verify against the test case
   `_internal_var` stays unchanged.

3. **Index-rendering dedup is its own correctness class.** Thread
   3's MEMORY.md dedup-by-source_path is the kind of finding that
   only surfaces when the implementation hits a multi-fact file;
   the spec absent the dedup rule leaves the implementer to guess.
   Fix template: every index/summary rule that aggregates over a
   collection needs an explicit dedup-key + dedup-strategy.

4. **Memory-reconciliation algorithm-design feedback is an
   ongoing iterative class.** #226 → #433 → #434 walk the
   algorithm spec through three cascade waves catching different
   correctness gaps:
   - #226 initial: schema + canonical-key normalization +
     priority/supersession/status semantics
   - #433 (first cascade): chain_head-liveness vs priority-tie-
     break distinction + paired-delimiter strip + dedup-by-source_path
   - #434 (second cascade): CC schema alignment with live
     `docs/CONTRIBUTOR-CONFLICTS.md` headers + idempotent-
     generator strategy + Open-table targeting
   Algorithm-design specs benefit from multiple cascade waves;
   each wave catches a different class of correctness gap.

## Final resolution

All threads resolved at SHA `ae9de60` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
