# ISSUES-INDEX — git-native record of LFG issues

**Purpose.** Git-repo independence for the issue
tracker. If GitHub (or the
`Lucent-Financial-Group/Zeta` mirror) vanishes, a
fork must be able to reconstitute the issue
tracker from this file + `docs/BACKLOG.md` alone.
Each row maps a GitHub issue to its BACKLOG.md
source by **section header + bullet keyword** so
the authoritative content stays in-tree and the
mapping stays stable as BACKLOG.md evolves.

**Authoritative source.** `docs/BACKLOG.md`.
GitHub issues are a *dispatch surface* (human and
agent cohere-and-claim), not the record of truth.

**Why section + keyword instead of line numbers.**
BACKLOG.md is a living document; line numbers
drift on every edit. A `## P0 — Threat-model
elevation` section header and a
`**Nation-state + supply-chain threat-model
rewrite**` bullet keyword survive arbitrary churn
below and around them. Reconstruction tooling
greps the section, then greps the bullet keyword.

## Regeneration protocol

To rebuild the issue tracker on a fresh remote:

1. Read this file for the index.
2. For each row, open `docs/BACKLOG.md`, locate
   the cited **section header**, then locate the
   bullet whose bold-title prefix matches the
   **keyword**.
3. Copy the bullet body as the issue body.
4. Recreate the issue
   (`gh issue create --title ...  --body ...`)
   preserving the priority label from the row.
5. Update this file with the new issue numbers
   if the remote changes; keep the
   section+keyword mapping intact.

**Verification after edits.** Reconstruction-
tooling MUST verify each section + keyword
actually resolves to exactly one bullet before
the row is considered valid. A missing section or
a keyword that matches zero / multiple bullets is
a repair-needed signal; flag, don't guess.

---

## Issues created 2026-04-21 (round-44-speculative)

**Remote:** `Lucent-Financial-Group/Zeta` (LFG).

**Batch provenance.** Translated from
`docs/BACKLOG.md` P0 + P1 sections via parallel
agent dispatch; 28 issues landed (#55-#82); three
pilot issues (#55-#57) followed by 25 batched
issues.

**Labels used.** `P0`, `P1`, `security`, `ci-cd`,
`threat-model`, `factory-hygiene`,
`architecture`, plus GitHub defaults.

**Source-availability note.** Six rows
(#57, #60, #63, #79, #80, #81) cite BACKLOG
sections whose specific bullets are expected to
land on main during the speculative-branch drain
(Batch 6 / Task #198 in the round tracker). On
this PR branch they are marked `source pending
Batch 6 drain`; the section is authoritative and
the keyword will resolve once the drain lands.
Re-verify after Batch 6.

### P0 issues

| # | Title | BACKLOG section | Bullet keyword |
|---|---|---|---|
| [#55](https://github.com/Lucent-Financial-Group/Zeta/issues/55) | Nation-state + supply-chain threat-model rewrite | `## P0 — Threat-model elevation (round-30 anchor)` | `**Nation-state + supply-chain threat-model rewrite.**` |
| [#56](https://github.com/Lucent-Financial-Group/Zeta/issues/56) | `docs/security/CRYPTO.md` — justify CRC32C vs SHA-256 roadmap | `## P0 — security / SDL artifacts` | ``**`docs/security/CRYPTO.md`**`` |
| [#58](https://github.com/Lucent-Financial-Group/Zeta/issues/58) | OpenSpec backfill — per-round capability sweep through Round 46 | `## P0 — next round (committed)` | `**OpenSpec coverage backfill — delete-all-code recovery gap**` |
| [#59](https://github.com/Lucent-Financial-Group/Zeta/issues/59) | circuit-recursion + operator-algebra — Viktor P0/P1 absorb (Round 44) | `## P0 — next round (committed)` | `**circuit-recursion + operator-algebra: Viktor P0/P1 findings from Round-43-ship adversarial audit (Round 44 absorb)**` |
| [#60](https://github.com/Lucent-Financial-Group/Zeta/issues/60) | Grandfather O-claims discharge — 35-claim inventory, one per round | `## P0 — next round (committed)` | ``**Grandfather `O(·)` claims discharge — one per round**`` |
| [#61](https://github.com/Lucent-Financial-Group/Zeta/issues/61) | Fully-retractable CI/CD — parts (b)-(e) | `## P0 — next round (committed)` | `**Fully-retractable CI/CD**` |
| [#62](https://github.com/Lucent-Financial-Group/Zeta/issues/62) | Memory folder restructure to `memory/role/persona/` | `## P0 — next round (committed)` | ``**Memory folder restructure: `memory/role/persona/`**`` |
| [#63](https://github.com/Lucent-Financial-Group/Zeta/issues/63) | Empty-folder allowlist — periodic fix-on-main review | `## P0 — next round (committed)` | `**Empty-folder fix-on-main sweep**` |
| [#64](https://github.com/Lucent-Financial-Group/Zeta/issues/64) | Witness-Durable Commit — full protocol implementation | `## P0 — next round (committed)` | `**Witness-Durable Commit mode**` |
| [#65](https://github.com/Lucent-Financial-Group/Zeta/issues/65) | CI pipeline — audit `../scratch` for install-script patterns | `## P0 — CI / build-machine setup (round-29 anchor)` | `**First-class CI pipeline for Zeta.**` sub-task 1 (`Audit ../scratch for install-script patterns`) |
| [#66](https://github.com/Lucent-Financial-Group/Zeta/issues/66) | CI pipeline — audit `../SQLSharp` workflows for workflow shape | `## P0 — CI / build-machine setup (round-29 anchor)` | `**First-class CI pipeline for Zeta.**` sub-task 2 (`Audit ../SQLSharp .github/workflows/ for workflow shape`) |
| [#67](https://github.com/Lucent-Financial-Group/Zeta/issues/67) | CI pipeline — map Zeta gate inventory | `## P0 — CI / build-machine setup (round-29 anchor)` | `**First-class CI pipeline for Zeta.**` sub-task 3 (`Map Zeta's actual gate list`) |
| [#68](https://github.com/Lucent-Financial-Group/Zeta/issues/68) | CI pipeline — first workflow `build-and-test.yml` (Linux + macOS) | `## P0 — CI / build-machine setup (round-29 anchor)` | `**First-class CI pipeline for Zeta.**` sub-task 4 (`First workflow: build-and-test.yml`) |
| [#69](https://github.com/Lucent-Financial-Group/Zeta/issues/69) | CI pipeline — subsequent workflows gated on per-design sign-off | `## P0 — CI / build-machine setup (round-29 anchor)` | `**First-class CI pipeline for Zeta.**` sub-task 5 (`Subsequent workflows added one at a time`) |
| [#70](https://github.com/Lucent-Financial-Group/Zeta/issues/70) | pytm threat model — `docs/security/pytm/threatmodel.py` authoritative | `## P0 — security / SDL artifacts` | `**pytm threat model**` |

### P1 issues

| # | Title | BACKLOG section | Bullet keyword |
|---|---|---|---|
| [#57](https://github.com/Lucent-Financial-Group/Zeta/issues/57) | Data/behaviour split hygiene rule for skills mixing routine with catalog data | `## P1 — architectural hygiene` | `FACTORY-HYGIENE row #51` (source pending Batch 6 drain) |
| [#71](https://github.com/Lucent-Financial-Group/Zeta/issues/71) | TLC-validation as `dotnet test` target for all `.tla` specs | `## P1 — architectural hygiene` | ``**TLC-validation as a `dotnet test` target.**`` |
| [#72](https://github.com/Lucent-Financial-Group/Zeta/issues/72) | Roslyn/F# analyzer banning blocking-wait patterns | `## P1 — architectural hygiene` | `**Roslyn / F# analyzer for blocking-wait patterns.**` |
| [#73](https://github.com/Lucent-Financial-Group/Zeta/issues/73) | Analyzer banning mutable public setters on Options/Plan/Descriptor types | `## P1 — architectural hygiene` | `**F#/Roslyn analyzer for mutable public setters on options/ config/plan shapes.**` |
| [#74](https://github.com/Lucent-Financial-Group/Zeta/issues/74) | `coverage:collect` and `coverage:merge` entry points with loud-failure | `## P1 — architectural hygiene` | ``**`coverage:collect` + `coverage:merge` entry points.**`` |
| [#75](https://github.com/Lucent-Financial-Group/Zeta/issues/75) | Deterministic-path helper for tests needing filesystem uniqueness | `## P1 — architectural hygiene` | `**Deterministic-path helper for tests needing filesystem uniqueness.**` |
| [#76](https://github.com/Lucent-Financial-Group/Zeta/issues/76) | Typed optimistic-append outcomes on every `IAppendSink` | `## P1 — architectural hygiene` | ``**Typed optimistic-append outcomes on every `IAppendSink`.**`` |
| [#77](https://github.com/Lucent-Financial-Group/Zeta/issues/77) | FASTER-style HybridLog region model for future persistent state tier | `## P1 — architectural hygiene` | `**FASTER-style HybridLog region model for any future persistent state tier.**` |
| [#78](https://github.com/Lucent-Financial-Group/Zeta/issues/78) | Copy-reduction on durable-commit path via batching/group-commit first | `## P1 — architectural hygiene` | `**Copy-reduction on the durable-commit path.**` |
| [#79](https://github.com/Lucent-Financial-Group/Zeta/issues/79) | Retrospective split of 4 data-heavy expert skills (row #51 first fire) | `## P1 — architectural hygiene` | `Retrospective split — 4 data-heavy expert skills` (source pending Batch 6 drain) |
| [#80](https://github.com/Lucent-Financial-Group/Zeta/issues/80) | `skill-creator` at-landing mix-signature checklist (prevention surface) | `## P1 — architectural hygiene` | `skill-creator at-landing mix-signature checklist` (source pending Batch 6 drain) |
| [#81](https://github.com/Lucent-Financial-Group/Zeta/issues/81) | `skill-tune-up` criterion-8 mix-signature as 8th ranking criterion | `## P1 — architectural hygiene` | `skill-tune-up criterion-8 mix-signature` (source pending Batch 6 drain) |
| [#82](https://github.com/Lucent-Financial-Group/Zeta/issues/82) | Escalate-to-human-maintainer criteria-sweep (will-propagation gap) | `## P1 — architectural hygiene` | `**"Escalate to human maintainer" criteria-sweep.**` |

---

## Maintenance

- **When a new issue lands on a tracked remote,**
  append a row with BACKLOG section + keyword.
- **When an issue closes,** do not delete the row —
  add a close-date column entry (preserve the
  chronology; destructive edits erase the record
  of when decisions happened).
- **When BACKLOG rows are edited in place,** the
  section + keyword mapping is expected to survive.
  If a bullet is renamed (keyword changes), update
  the row. If a bullet is split, update the row to
  point at both survivors (or to the larger of the
  two, with a note).
- **When a new remote gets the translation,** add
  a second issues-landed section under its own
  heading; do not overwrite LFG mapping.
- **When a row flagged `source pending <batch>
  drain` unblocks,** remove the pending note and
  verify the keyword resolves to exactly one
  bullet on the current branch.

## What this file is NOT

- NOT the authoritative content of issues. That
  lives in `docs/BACKLOG.md`.
- NOT a live sync of GitHub state. It records the
  *creation* mapping; close-state and comments
  stay on GitHub.
- NOT a replacement for `docs/BACKLOG.md`. Issues
  are dispatch; BACKLOG is record.
- NOT scoped to LFG only. Additional remotes get
  their own sections when issues land there.
- NOT a commitment to keep GitHub issue tracker
  authoritative. If the factory drops GitHub
  entirely, this file preserves the decisions
  taken during the GitHub-issue phase for
  reconstruction.
- NOT tied to specific line numbers. Section +
  keyword anchoring was chosen deliberately so
  BACKLOG can churn underneath without
  invalidating this index.

## Composition

- `docs/BACKLOG.md` — authoritative source the
  section + keyword pairs resolve against.
- `GOVERNANCE.md` §2 (docs read as current state,
  not history) — why the mapping uses durable
  anchors rather than byte offsets.
- `GOVERNANCE.md` §24 (one install script
  consumed three ways) — record-discipline
  companion: authoritative-in-tree, dispatch-out.
- `docs/HUMAN-BACKLOG.md` — parallel register for
  issues that require the human maintainer's
  disposition rather than agent-actionable work.
