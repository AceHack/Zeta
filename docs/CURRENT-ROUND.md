# Current Round — 28 (open)

Round 27 closed; narrative absorbed into
`docs/ROUND-HISTORY.md`. Round 28 opens with these
deferred items carried over from round 27:

## Status

- **Round number:** 28
- **Opened:** 2026-04-18 (continuous from round-27 close)
- **Classification:** split — non-trivial P1 carryover
  from reviewer pass + other deferred work.
- **Reviewer budget:** 2-3 per §13 + mandatory Kira+Rune
  floor per §20 on any code-landing phase.

## Carried from round 27

**Reviewer P1 findings (Kira + Rune, logged to DEBT):**
- `OutputBuffer` tick-stamp + invalidate-on-tick-end.
- `ReadDependencies` defensive copy at registration.
- `box plugin` triple-evaluation → `let boxed = box plugin` once.
- `BayesianRateOp` `int64` accumulator → `Checked.(+)` or saturate.
- `INestedFixpointParticipant` inherits `IOperator<'TOut>`.
- `PluginHarness` id-space via `Int32.MinValue`-range synthetics.
- `IOperator<'T>` → `IZetaOperator<'T>` rename (before external adoption).
- `Op<'T>.Value` mixed-accessibility hover-doc pointing at `OutputBuffer.Publish`.
- `PluginApi.fs` split when >300 lines.
- PLUGIN-AUTHOR.md `[<Extension>]` explanation in sample.
- Extract `internal assignHarnessId` helper shared by `Circuit.Build` + `PluginHarness`.

**Design work still open:**
- `IsDbspLinear` Lean predicate + B1/B2/B3/chain_rule
  closures (Tariq option-c; half-day B2, two days full).
- FsCheck law runner at `Circuit.Build()` per capability
  tag — unblocks PLUGIN-AUTHOR.md's soft-claim in "Known
  limits of round-27."

**Persona-notes migration tail:**
- 6 remaining persona notebooks still in single-file
  layout (`public-api-designer.md`, `skill-tune-up-ranker.md`,
  `best-practices-scratch.md`, `algebra-owner.md`,
  `formal-verification-expert.md`, `agent-experience-researcher.md`).
  Lazy migration per §21; convert when a persona next
  writes a typed memory entry.

**Other deferred:**
- Rune on `docs/STYLE.md` decision (small).
- UX + DX persona proposals.
- Empathy-coach persona spawn (naming pending).

## Workflow cadence (established round-26, codified round-27)

- Each round runs on its own branch (`round-N`).
- Coherent changes within a round become separate commits
  where it helps readability.
- Round-close = PR from `round-N` to `main` + merge.
- Reviewer pass per §20 before round-close.
- Maintainer may request a review pass on the branch diff
  before merge; ask before pushing the merge.

## Open asks to the maintainer

- **NuGet prefix reservation** on `nuget.org` for
  `Zeta.*` — maintainer owns.
- **`global.json` `rollForward`** — status quo vs relaxed
  (silent-pick status quo unless objection).
- **Eval-harness MVP scope** — still pending since round
  23.
- **Repo visibility** — currently private on AceHack;
  flip to public when ready.

## Next architect actions

1. Open `round-28` branch off `main` once round-27 PR
   merges.
2. Anchor choice: **FsCheck law runner** (unblocks
   plugin-author trust + validates Tariq's design) or
   **OutputBuffer tick-stamp** (closes Kira's P0 that
   DEBT'd this round). Recommend law runner — larger
   impact, removes the soft-claim from PLUGIN-AUTHOR.md.
3. Dispatch code-phase reviewer floor (Kira + Rune) per
   §20 on any code that lands.

## Notes for the next Kenji waking

- `memory/` is canonical shared memory (not the
  sandbox). See GOVERNANCE.md §18 + §22.
- `memory/persona/<persona>/` is per-persona memory.
  Kenji's seat already folder-migrated; others lazy.
- Reviewer pass per §20 is mandatory every code-landing
  round. Kira + Rune is the floor.
- Public API changes go through Ilyana per §19.
- `~/.claude/projects/` is Claude Code sandbox, not git.
  Do not cite as canonical (§22).
