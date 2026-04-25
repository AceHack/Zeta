# PR #85 drain log — Round 44 batch 5: BACKLOG-per-row-file restructure ADR (draft)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/85>
Branch: `land-backlog-per-row-file-batch5`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Thread count at drain start: 11 unresolved (Copilot P1/P2)
Rebase context: clean rebase onto `origin/main`; PR head was at a stale
merge commit (`eae7a37`); my push at `d38e109` brought in current main +
the fixes — verified content equivalence + improvements.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, severity, outcome class.

This PR is the draft ADR for the `docs/BACKLOG.md` per-row-file
restructure. Drain caught a high density of internal-consistency
findings (id-vs-filename ambiguity, directory-name reconciliation,
tier-scheme vs directory-tree gap, "never edit / hand-append"
contradiction) plus the standard line-count drift + name-attribution
findings.

---

## Outcome distribution: 7 FIX + 1 OTTO-279 SURFACE-CLASS + 3 dups

### A: FIX — Internal-consistency + factual fixes (10 thread-IDs across 7 fixes)

#### Thread A1 — `:36` + `:59` — PR description vs ADR directory name (Copilot P1 ×2)

- Reviewer: copilot-pull-request-reviewer
- Thread IDs: `PRRT_kwDOSF9kNM58rOCI` + `PRRT_kwDOSF9kNM58rTwj`
- Severity: P1
- Finding: PR description references `docs/backlog-rows/` but ADR
  uses `docs/backlog/<tier>/...`. Two-way ambiguity.
- Outcome: **FIX** — added explicit reconciliation note marking
  `docs/backlog/` as canonical for the ADR; PR description's
  `docs/backlog-rows/` is historical wording. Downstream references
  follow the ADR path. Commit `d38e109`.

#### Thread A2 — `:35` — id-vs-filename consistency (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM58rTw0`
- Severity: P1
- Finding: ADR described per-row files under
  `docs/backlog/<tier>/<id>.md`, but the directory shape later used
  `<slug>-<YYYY-MM-DD>.md` filenames. Path/ID scheme inconsistent
  throughout.
- Outcome: **FIX** — id-vs-filename ambiguity resolved inline: the
  `<slug>-<YYYY-MM-DD>` filename stem IS the row's `id`.
  `docs/backlog/<tier>/<slug>-<YYYY-MM-DD>.md` is the canonical path
  pattern; per-row-file id ≡ filename stem. Commit `d38e109`.

#### Thread A3 — `:68` — Tier scheme has `declined` but no `declined/` folder (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM58rOB2`
- Severity: P1
- Outcome: **FIX** — added `docs/backlog/declined/` to the directory
  tree alongside `shipped/`. Tier scheme now matches the directory
  shape. Commit `d38e109`.

#### Thread A4 — `:140` — "Never edit index" + "hand-append" contradiction (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM58rTwe`
- Severity: P1
- Finding: authoring rules said "Never edit the index directly" but
  then instructed to "hand-append the index line"; semantic
  contradiction.
- Outcome: **FIX** — reworded: existing index entries are read-only
  (don't hand-edit them); new rows may append a new index line in
  the same PR as the row file OR leave to the next regeneration.
  Index ordering / formatting is generator output, not authoring
  surface. Distinguishing existing-entries (read-only) from
  append-only-new-entries resolves the contradiction. Commit
  `d38e109`.

#### Thread A5 — `:275` + `:276` — `tools/migrations/` claimed as existing convention (Copilot P1 ×2)

- Thread IDs: `PRRT_kwDOSF9kNM58rOB_` + `PRRT_kwDOSF9kNM58rTwv`
- Severity: P1
- Finding: ADR stated `tools/migrations/YYYY-MM-DD-<name>/` as an
  established convention, but no such subtree exists in the repo.
- Outcome: **FIX** — reframed as "Proposed convention for this ADR"
  rather than an existing repo convention. Adopting it requires
  creating the subtree as part of the implementation PR. Commit
  `d38e109`.

#### Thread A6 — `:13` — Line count drift (Copilot P2 ×2)

- Thread IDs: `PRRT_kwDOSF9kNM58rOCF` + `PRRT_kwDOSF9kNM58rTwp`
- Severity: P2
- Finding: ADR cited `docs/BACKLOG.md` as 5,957 lines; current file
  was 6,094 lines (drift target).
- Outcome: **FIX** — replaced exact `5,957` with `~6k lines` plus
  explicit note that live count drifts as the backlog grows; ADR
  uses the order-of-magnitude figure to avoid staleness. Commit
  `d38e109`.

#### Thread A7 — `:234` — Trailing `+` continuation (Copilot P2)

- Thread ID: `PRRT_kwDOSF9kNM58rOCO`
- Severity: P2
- Finding: Round 45 bullet ended with trailing `+` and continued on
  next line — reads as editing artifact and may trip markdownlint.
- Outcome: **FIX** — reformatted bullet to use commas / "and"
  instead of the trailing-`+` line break. Reads as prose. Commit
  `d38e109`.

### B: OTTO-279 SURFACE-CLASS

#### Thread B1 — `:5` — Aaron / Kenji / Iris / Bodhi names in ADR body (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM58rOBq`
- Severity: P1
- Outcome: **OTTO-279 SURFACE-CLASS** — `docs/DECISIONS/` is
  history-class per Otto-279 surface-class refinement: research /
  decisions / round-history / aurora-archive / pr-preservation
  surfaces all permit first-name attribution for both human
  contributors and named agents. Role-ref-only applies to current-
  state surfaces (skill bodies, code, README, public-facing prose,
  behavioural docs, threat models). ADRs preserve point-in-time
  provenance — names ARE the provenance and stripping them would
  erase the audit trail.

---

## Pattern observations (Otto-250 training-signal class)

1. **Internal-consistency-finding density was high on this draft
   ADR.** 5 of 7 distinct fixes were internal-consistency findings:
   tier-scheme vs directory-tree gap (A3), id-vs-filename
   inconsistency (A2), "never edit / hand-append" contradiction
   (A4), `tools/migrations/` claimed-vs-actual (A5), PR-description
   vs ADR directory name (A1). Draft ADRs tend to evolve their own
   self-references during authoring; reviewers catch the
   accumulated inconsistencies.

2. **Otto-279 surface-class for ADRs as history-class preserved
   provenance.** ADR decision-makers are the real-life provenance
   trail of the decision; stripping names would break the audit
   chain. Same pattern as aurora-archive (#235 / #219) and research
   surfaces (#135 / #377). The history-class carve-out is
   mature-uniform across surfaces now.

3. **Live-count vs frozen-count drift is its own findings class.**
   Thread A6 (line count drift) is the same shape as future
   findings on time-stamps, line-numbers, statistics that change
   between draft-and-merge. Fix template: order-of-magnitude
   approximations + explicit drift-tolerance note.

4. **Stale merge-commit on PR head needed force-push reconciliation.**
   Notable PR-mechanics nuance: PR head pointed at a stale merge
   commit `eae7a37` (a "merge main into branch" pattern that
   accumulated several rounds before drain). My rebase + force-push
   produced linear history at `d38e109` that included current main
   PLUS my fixes. PR view took a few seconds to reflect the new oid.
   Worth knowing: rebase + force-push sometimes appears to "lose
   content" against a stale merge-commit head, but actually fixes
   the content equivalence.

## Final resolution

All 11 threads resolved at SHA `d38e109` (10 thread-IDs across
7 fixes + 1 surface-class). PR auto-merge SQUASH armed; CI cleared;
merge pending.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
