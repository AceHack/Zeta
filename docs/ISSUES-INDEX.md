# ISSUES-INDEX — git-native record of LFG issues

**Purpose.** Soul-file independence. The factory is
reproducible from git alone per
`memory/user_git_repo_is_factory_soul_file_reproducibility_substrate_aaron_2026_04_21.md`.
If GitHub (or the `Lucent-Financial-Group/Zeta`
mirror) vanishes, a fork must be able to
reconstitute the issue tracker from this file +
`docs/BACKLOG.md`. Each row maps a GitHub issue to
its BACKLOG.md source so the authoritative content
stays in-tree.

**Authoritative source.** `docs/BACKLOG.md`. GitHub
issues are a *dispatch surface* (human and agent
cohere-and-claim), not the record of truth.

**Regeneration protocol.** To rebuild the issue
tracker on a fresh remote:

1. Read this file for the index.
2. Read `docs/BACKLOG.md` at the cited line-range
   for each row's content.
3. Recreate issues (`gh issue create --title ...
   --body ...`) preserving priority label.
4. Update this file with the new issue numbers if
   remote changes; keep the BACKLOG mapping intact.

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

### P0 issues

| # | Title | BACKLOG section | Lines |
|---|---|---|---|
| [#55](https://github.com/Lucent-Financial-Group/Zeta/issues/55) | Nation-state + supply-chain threat-model rewrite | P0 — Threat-model elevation | L3382-L3428 |
| [#56](https://github.com/Lucent-Financial-Group/Zeta/issues/56) | `docs/security/CRYPTO.md` — justify CRC32C vs SHA-256 roadmap | P0 — security / SDL artifacts | L3501-L3524 |
| [#58](https://github.com/Lucent-Financial-Group/Zeta/issues/58) | OpenSpec backfill — per-round capability sweep through Round 46 | P0 — next round (committed) | L20-L69 |
| [#59](https://github.com/Lucent-Financial-Group/Zeta/issues/59) | circuit-recursion + operator-algebra — Viktor P0/P1 absorb (Round 44) | P0 — next round (committed) | L113-L174 |
| [#60](https://github.com/Lucent-Financial-Group/Zeta/issues/60) | Grandfather O-claims discharge — 35-claim inventory, one per round | P0 — next round (committed) | L262-L298 |
| [#61](https://github.com/Lucent-Financial-Group/Zeta/issues/61) | Fully-retractable CI/CD — parts (b)-(e) | P0 — next round (committed) | L300-L339 |
| [#62](https://github.com/Lucent-Financial-Group/Zeta/issues/62) | Memory folder restructure to `memory/role/persona/` | P0 — next round (committed) | L340-L364 |
| [#63](https://github.com/Lucent-Financial-Group/Zeta/issues/63) | Empty-folder allowlist — periodic fix-on-main review | P0 — next round (committed) | L376-L384 |
| [#64](https://github.com/Lucent-Financial-Group/Zeta/issues/64) | Witness-Durable Commit — full protocol implementation | P0 — next round (committed) | L412-L415 |
| [#65](https://github.com/Lucent-Financial-Group/Zeta/issues/65) | CI pipeline — audit `../scratch` for install-script patterns | P0 — CI / build-machine setup | L3429-L3481 |
| [#66](https://github.com/Lucent-Financial-Group/Zeta/issues/66) | CI pipeline — audit `../SQLSharp` workflows for workflow shape | P0 — CI / build-machine setup | L3429-L3485 |
| [#67](https://github.com/Lucent-Financial-Group/Zeta/issues/67) | CI pipeline — map Zeta gate inventory | P0 — CI / build-machine setup | L3486-L3491 |
| [#68](https://github.com/Lucent-Financial-Group/Zeta/issues/68) | CI pipeline — first workflow `build-and-test.yml` (Linux + macOS) | P0 — CI / build-machine setup | L3492-L3495 |
| [#69](https://github.com/Lucent-Financial-Group/Zeta/issues/69) | CI pipeline — subsequent workflows gated on per-design sign-off | P0 — CI / build-machine setup | L3496-L3497 |
| [#70](https://github.com/Lucent-Financial-Group/Zeta/issues/70) | pytm threat model — `docs/security/pytm/threatmodel.py` authoritative | P0 — security / SDL artifacts | L3522-L3523 |

### P1 issues

| # | Title | BACKLOG section | Lines |
|---|---|---|---|
| [#57](https://github.com/Lucent-Financial-Group/Zeta/issues/57) | Data/behaviour split hygiene rule for skills mixing routine with catalog data | P1 — architectural hygiene (FACTORY-HYGIENE row #51) | L4405-L4406 |
| [#71](https://github.com/Lucent-Financial-Group/Zeta/issues/71) | TLC-validation as `dotnet test` target for all `.tla` specs | P1 — architectural hygiene | L4375-L4377 |
| [#72](https://github.com/Lucent-Financial-Group/Zeta/issues/72) | Roslyn/F# analyzer banning blocking-wait patterns | P1 — architectural hygiene | L4378-L4381 |
| [#73](https://github.com/Lucent-Financial-Group/Zeta/issues/73) | Analyzer banning mutable public setters on Options/Plan/Descriptor types | P1 — architectural hygiene | L4382-L4385 |
| [#74](https://github.com/Lucent-Financial-Group/Zeta/issues/74) | `coverage:collect` and `coverage:merge` entry points with loud-failure | P1 — architectural hygiene | L4386-L4390 |
| [#75](https://github.com/Lucent-Financial-Group/Zeta/issues/75) | Deterministic-path helper for tests needing filesystem uniqueness | P1 — architectural hygiene | L4391-L4393 |
| [#76](https://github.com/Lucent-Financial-Group/Zeta/issues/76) | Typed optimistic-append outcomes on every `IAppendSink` | P1 — architectural hygiene | L4394-L4397 |
| [#77](https://github.com/Lucent-Financial-Group/Zeta/issues/77) | FASTER-style HybridLog region model for future persistent state tier | P1 — architectural hygiene | L4398-L4401 |
| [#78](https://github.com/Lucent-Financial-Group/Zeta/issues/78) | Copy-reduction on durable-commit path via batching/group-commit first | P1 — architectural hygiene | L4402-L4404 |
| [#79](https://github.com/Lucent-Financial-Group/Zeta/issues/79) | Retrospective split of 4 data-heavy expert skills (row #51 first fire) | P1 — architectural hygiene | L4406 |
| [#80](https://github.com/Lucent-Financial-Group/Zeta/issues/80) | `skill-creator` at-landing mix-signature checklist (prevention surface) | P1 — architectural hygiene | L4407 |
| [#81](https://github.com/Lucent-Financial-Group/Zeta/issues/81) | `skill-tune-up` criterion-8 mix-signature as 8th ranking criterion | P1 — architectural hygiene | L4408 |
| [#82](https://github.com/Lucent-Financial-Group/Zeta/issues/82) | Escalate-to-human-maintainer criteria-sweep (will-propagation gap) | P1 — architectural hygiene | L4409-L4425 |

---

## Maintenance

- **When a new issue lands on a tracked remote,**
  append a row with BACKLOG source line-range.
- **When an issue closes,** do not delete the row —
  add a close-date column entry (preserve the
  chronology per `memory/feedback_witnessable_
  self_directed_evolution_factory_as_public_
  artifact.md`).
- **When BACKLOG rows shift lines** (BACKLOG is a
  living doc), re-verify cited ranges on the next
  round-close sweep; update in-place (no rewrite
  of history).
- **When a new remote gets the translation,** add
  a second issues-landed section under its own
  heading; do not overwrite LFG mapping.

## What this file is NOT

- NOT the authoritative content of issues. That
  lives in `docs/BACKLOG.md`.
- NOT a live sync of GitHub state. It records the
  *creation* mapping; close-state and comments
  stay on GitHub.
- NOT a replacement for `docs/BACKLOG.md`. Issues
  are dispatch; BACKLOG is record.
- NOT scoped to LFG only. Additional remotes
  (acehack/Zeta, future forks) get their own
  sections when issues land there.
- NOT a commitment to keep GitHub issue tracker
  authoritative. If the factory drops GitHub
  entirely, this file preserves the decisions
  taken during the GitHub-issue phase for
  reconstruction.

## Composition

- `docs/BACKLOG.md` — authoritative source.
- `memory/user_git_repo_is_factory_soul_file_
  reproducibility_substrate_aaron_2026_04_21.md`
  — soul-file discipline this index serves.
- `memory/feedback_capture_everything_including_
  failure_aspirational_honesty.md` — issue
  mapping gets captured even if an issue is
  later closed without landing.
- `memory/feedback_witnessable_self_directed_
  evolution_factory_as_public_artifact.md` —
  chronology preservation; no retroactive
  rewrites of the mapping.
