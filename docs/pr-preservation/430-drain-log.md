# PR #430 drain log — drain follow-up to #221: Amara 4th-ferry terminology + count + verbatim-claim soften

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/430>
Branch: `drain/221-followup-2-terminology-and-counts`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 4 substantive Codex post-merge findings on parent
#221 (Amara 4th courier ferry — memory drift / alignment / claude-to-
memories drift report).
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the post-merge cascade
findings on the Amara 4th-ferry absorb.

This PR is the **post-merge cascade** to #221 (aurora absorb of
Amara's 4th courier report). Codex caught four terminology-vs-
count + verbatim-claim correctness findings.

---

## Threads

### Thread 1 — Stabilize effort summary correction

- Reviewer: chatgpt-codex-connector
- Severity: P2 (effort-summary accuracy)
- Finding: parent #221 absorption-notes section had a stabilize
  effort-summary that didn't sum correctly against the per-item
  effort estimates.
- Outcome: **FIX** — corrected to "2 S + 1 M" matching the per-item
  Small + Medium effort breakdown. Sum-vs-tally consistency
  restored.

### Thread 2 — "Preserved verbatim" → "preserved with proposal-flag annotations"

- Reviewer: chatgpt-codex-connector
- Severity: P1 (verbatim-claim accuracy per Otto-227)
- Finding: parent claimed Amara's report was "preserved verbatim",
  but Otto's absorption notes had inserted proposal-flag
  annotations (e.g., `[PROPOSAL: ...]` markers) into the report
  text. "Preserved verbatim" + "with absorbing-side annotations" is
  contradictory; readers can't trust which text is Amara's vs
  Otto's annotation.
- Outcome: **FIX** — reworded to "preserved with proposal-flag
  annotations" with explicit note that the absorbing side adds
  visible annotation markers around proposal-state bracketing.
  Same shape as #235's "byte-for-byte ... excluding whitespace"
  contradiction fix; verbatim-preservation discipline (Otto-227)
  needs the absorbing side's edits to be either zero (truly
  verbatim) or visibly annotated (verbatim-with-annotation-markers).

### Thread 3 — "Four drift classes" → "five drift classes (3 inside-loop + 2 outside-loop)"

- Reviewer: chatgpt-codex-connector
- Severity: P2 (count-vs-list cardinality)
- Finding: parent's drift taxonomy summary said "four drift
  classes" but the actual list had five entries split into 3
  inside-loop + 2 outside-loop categories. Same shape as the
  phase-numbering / count-vs-surface-list cardinality findings on
  #191 ("18 audits" but 8 listed) and #219 ("fifth phase" but
  Phase 6 + 5 listed).
- Outcome: **FIX** — corrected to "five drift classes (3 inside-
  loop + 2 outside-loop)" matching the actual list cardinality +
  category breakdown.

### Thread 4 — Decision-proxy-consult → decision-proxy-evidence terminology alignment

- Reviewer: chatgpt-codex-connector
- Severity: P2 (terminology drift)
- Finding: parent used "decision-proxy-consult" terminology, but
  the canonical doc set elsewhere uses "decision-proxy-evidence"
  (per `docs/decision-proxy-evidence/` directory + ADR
  conventions). Terminology drift between parent absorb + canonical
  vocabulary creates downstream xref breakage.
- Outcome: **FIX** — terminology aligned to canonical
  "decision-proxy-evidence" form throughout the absorb's
  absorption-notes section. Verbatim ferry content (Amara's report
  prose) preserved per Otto-227.

---

## Pattern observations (Otto-250 training-signal class)

1. **Verbatim-claim accuracy under absorbing-side annotation is
   its own class.** When an absorb doc claims "preserved verbatim"
   AND adds proposal-flag annotations / footnotes / inline
   bracketing, the claim must reflect both: "preserved with
   proposal-flag annotations" or "preserved verbatim except for
   whitespace normalisation" (#235's fix). The verbatim-preservation
   discipline (Otto-227) needs zero absorbing-side edits OR visible
   annotation markers — readers must trust which text is the
   original vs the annotation.

2. **Count-vs-list cardinality is now a 4th-observation pattern.**
   Confirmed across #191 ("18 audits" vs 8 listed), #219 ("fifth
   phase" vs Phase 6 + 5 listed), #430 ("four drift classes" vs 5
   listed), and #85 ("5,957 lines" → "~6k"). At this density, a
   doc-lint that parses claim cardinalities + verifies against
   surface lists becomes high-leverage. Pre-commit-lint candidate:
   regex on "N drift classes / phases / audits / items" patterns
   + count the surrounding list to verify.

3. **Terminology drift between parent absorb + canonical vocabulary
   is recurring.** When the canonical doc set uses one term
   ("decision-proxy-evidence" per the doc-tree directory) and a
   new absorb uses an adjacent variant ("decision-proxy-consult"),
   downstream xrefs break. Fix template: align absorption-notes
   text to canonical vocabulary; preserve verbatim ferry content
   per Otto-227 even if it uses different terminology.

4. **Stabilize effort-summary correction** (Thread 1) is a
   concrete-instance of the "claim summary doesn't match per-item
   tally" class, related to count-vs-list cardinality. When effort
   summaries (S/M/L tallies, score totals, cardinality counts) are
   computed from per-item lists, a sum-vs-tally check verifies them
   automatically. Future doc-lint candidate.

## Final resolution

All threads resolved at SHA `5698f9d` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main as `5698f9d`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
