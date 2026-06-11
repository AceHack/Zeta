# Known-Open Bug List

Every unresolved reviewer finding across rounds lives here until
it's fixed, re-scoped, or explicitly declined (in which case it
moves to `docs/WONT-DO.md`). This file is the counterpart to
`docs/BACKLOG.md`: BACKLOG holds *features and research*; BUGS
holds *things that are broken or misleading in shipped code
and docs*.

Entries are current-state. When a bug is fixed, **delete the
entry entirely** — don't leave "fixed in round N" crud. The
fix shows up in `docs/ROUND-HISTORY.md`; this file reads clean.

## Format

Each entry:
```markdown
### <short title>
- **Site:** `file:line` (the authoritative location)
- **Found:** <round> by <reviewer expert name>
- **Severity:** P0 | P1 | P2
- **Symptom:** one sentence — what's wrong
- **Fix:** one sentence — what to do
- **Who:** architect (Kenji) unless specialist is obviously better
```

Kenji (Architect) owns the fixing work. A `bug-fixer` skill
(capability-only, no expert) encodes the procedure; Kenji
invokes it. No "bug fixer expert" persona — the wholistic
view prevents quick hacks that a specialist persona might be
tempted to ship.

---

## P0 — ship-blockers

### Expert/skill split half-done — onboarding confusion

**STATUS (triage 2026-06-12): FIXED.** `.claude/agents/` holds all 20 experts; EXPERT-REGISTRY describes the split as the standing convention. Registry and reality agree.

- **Site:** `.claude/agents/` vs `.claude/skills/` vs `docs/EXPERT-REGISTRY.md`
- **Found:** round 21 by Rune
- **Severity:** P0 onboarding
- **Symptom:** only `harsh-critic` migrated to the `.claude/agents/<name>.md`
  shape with auto-injected capability skill. The other 20 experts
  (Viktor, Hiroshi, Rune, Aminata, Anjali, Adaeze, Wei, Tariq, Imani,
  Zara, Kenji, Nadia, Aarav, Jun, Mei, Malik, Yara, Samir, Kai,
  Leilani, Soraya) still live as persona-bearing SKILL.md files.
  Registry claims the split; reality shows one pilot. A new
  contributor cannot tell if the convention is intentional or
  half-forgotten.
- **Fix:** either (a) finish the split for all remaining experts
  in one or two focused rounds, extracting each persona's
  procedure to a capability skill + leaving persona in an agent
  file, OR (b) amend the registry to mark Kira as a pilot and
  others as "migrating."

### RecursiveCounting multi-tick-seed behaviour unproven

**STATUS (triage 2026-06-12): RESOLVED via option (b) — and RELABELED.** Soraya's routing: a reliably-failing property is a REFUTATION, not open research (pure-insert witness; the affine math is sound for DAG bodies — implementation defect). Landed: the witness PINNED as a deterministic unskipped Fact (RecursiveCounting.MultiSeed.Tests.fs §REFUTATION WITNESS); `[<Experimental>]` on RecursiveCounting AND CountingClosureTable (FS57 at consumer call sites); docstring reworded to "refuted; one-shot seeds only." The positive multi-tick story routes to the signed-delta combinator's TLA+ spec (retraction-safe-semi-naive.md §7) when that work starts.

- **Site:** `src/Core/Recursive.fs:152-…`
- **Found:** round 20 by Kira; reproduced by an FsCheck
  property in `tests/Tests.FSharp/Operators/RecursiveCounting.MultiSeed.Tests.fs`
- **Severity:** P0 honesty (tests only cover one-shot seed)
- **Symptom:** docstring narrowed to "one-shot seed is proven;
  multi-tick is open research" but neither a formal argument
  nor a passing property test exists for the multi-tick case.
  The new FsCheck property in the file above reliably finds
  disagreement between `CountingClosureTable` (clamped via
  `Distinct`) and the boolean `ClosureTable` oracle on sequences
  such as
  `[[Ins(0,6);Ins(4,5)];[Ins(5,6);Ins(2,4)];[Ins(2,3)]]`.
  That test is currently `Skip`-ped; the three concrete one-shot
  scenario tests (Tests 1–3 in the same file) pass. A shipped
  research-preview combinator with a failing correctness property
  on the declared-out-of-scope path is a claim-without-evidence.
- **Fix:** (a) prove correctness under multi-tick seeds (Z3 /
  paper argument) — the gap-monotone signed-delta plan in
  `docs/research/retraction-safe-semi-naive.md` — and then remove
  the `Skip`; OR (b) mark the combinator `[<Experimental>]`,
  surface a clear precondition-violation diagnostic, and update
  the property to only exercise one-shot seeds.

---

## P1 — serious

### BloomBench.fs referenced but not on disk

**STATUS (triage 2026-06-12): FIXED.** `bench/Benchmarks/BloomBench.fs` exists and was run (see the TECH-RADAR entry below).

- **Site:** `docs/BUGS.md` and `docs/research/bloom-filter-frontier.md`
  reference `bench/Benchmarks/BloomBench.fs`; the file is
  not present on disk.
- **Found:** round 21 by Imani
- **Severity:** P1 honesty
- **Symptom:** documented-but-absent bench. References to it across
  docs suggest it was expected to land. Until it exists, Bloom
  TECH-RADAR row stays Trial and the P2 "run the bench" entry
  can't close.
- **Fix:** write the bench (scaffold exists conceptually) or remove
  the references.

### Durability.createBackingStore error message is 6 lines of prose

**STATUS (triage 2026-06-12): LIVE.** Site drifted to `src/Core/Durability.fs:214`; still ~8 wrapped lines, no FEATURE-FLAGS pointer, no `DbspError.WitnessDurablePreview` case.

- **Site:** `src/Core/Durability.fs:166-174`
- **Found:** round 21 by Kira
- **Severity:** P1
- **Symptom:** `invalidOp` body spans 6 lines; log-grep wraps badly;
  callers can't match on the prefix. No stable error code.
- **Fix:** one-line message with a pointer to
  `docs/FEATURE-FLAGS.md`. Optional: a new `DbspError.WitnessDurablePreview`
  case so callers can pattern-match instead of string-match.

### RecursiveCounting lacks [<Experimental>] attribute

**STATUS (triage 2026-06-12): FIXED** with the P0 above — attribute on both members; consumers get FS57; deliberate uses carry commented `#nowarn "57"`.

- **Site:** `src/Core/Recursive.fs` (`RecursiveCounting` combinator)
- **Found:** round 21 by Kira + Tariq
- **Severity:** P1
- **Symptom:** the "Known limitation — one-shot seed" docstring
  section warns about multi-tick-seed but only a full docstring
  reader sees it. IntelliSense summaries omit the limitation;
  callers see a `RecursiveCounting` that looks production-ready.
- **Fix:** add `[<Experimental("DBSP_COUNTING_SEMI_NAIVE")>]` to
  the extension method until multi-tick-seed correctness is
  proved or the multi-tick path is removed. Tariq additionally
  recommends a runtime op-graph walk rejecting `Distinct` under
  the feedback cell — that's a separate P2 research item.

### FeatureFlags.isEnabled "O(1)" claim is hand-waved

**STATUS (triage 2026-06-12): FIXED (by removal).** No "O(1)" claim remains anywhere; nothing left to pin.

- **Site:** `src/Core/FeatureFlags.fs:121-127`
- **Found:** round 21 by Hiroshi
- **Severity:** P1 honesty
- **Symptom:** `ConcurrentDictionary.TryGetValue` is amortised O(1)
  on a hit; env-var lookup is O(|environ|) on a miss (Linux does
  a linear scan of `environ`). The repo's "O(1)" framing (implicit
  in the spec's resolution-order scenario) is not pinned honestly.
- **Fix:** pin the actual bound in the docstring: "amortised O(1)
  on a dictionary hit; O(|environ|) on a dictionary miss with an
  env-var lookup." No code change, doc only.

### Agent-file edits (`.claude/agents/**`) uncovered in threat model

**STATUS (triage 2026-06-12): LIVE — and grown.** THREAT-MODEL.md still covers only `.claude/skills/**`; all 20 personas now live on the uncovered path. One table row; routes to Aminata.

- **Site:** `docs/security/THREAT-MODEL.md` + `.claude/agents/`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** threat model covers `SKILL.md` edits ("skill supply
  chain") but the `.claude/agents/<name>.md` agent-file path
  from the expert/skill split is not covered. An adversary PR
  could modify Kira's tone contract without touching any
  SKILL.md.
- **Fix:** add a row to the threat model's Tampering table citing
  `.claude/agents/**` as a trust artefact subject to the same
  review gate as `SKILL.md`. Extend any pre-commit hook to cover
  the new path.

### GLOSSARY.md uncovered as trust artefact

**STATUS (triage 2026-06-12): LIVE.** No glossary mention under docs/security/; no CODEOWNERS. Routes to Aminata with the row above.

- **Site:** `docs/GLOSSARY.md` + `docs/security/THREAT-MODEL.md`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** GOVERNANCE.md §7 makes the glossary "canonical" for
  shared vocabulary. A PR that poisons a safety term ("durable"
  = "eventually flushed at some unspecified time") propagates
  silently into reviewer judgement the next round. The threat
  model has no entry for GLOSSARY.md as a privileged artefact.
- **Fix:** add a Tampering-class row: glossary edits require
  Architect + second-reviewer approval; Aminata auto-assigned
  to any diff touching a security-relevant term. Codify via
  `.github/CODEOWNERS` on that path.

### BUGS.md itself is an adversary surface for bug-fixer

**STATUS (triage 2026-06-12): LIVE (site drifted).** The skill moved to `.claude/skills/workflows/blueprints/bug-fixer.md`; its steps still lack a provenance check; THREAT-MODEL.md still silent on BUGS.md as an injection surface.

- **Site:** `docs/BUGS.md` + `.claude/skills/bug-fixer/SKILL.md`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** a poisoned BUGS.md entry could steer the bug-fixer
  procedure ("drop the `Checked` guard" framed as a fix) into
  introducing a vulnerability under the guise of addressing a
  reported bug.
- **Fix:** add a step 2 requirement to `.claude/skills/bug-fixer/SKILL.md`
  — "verify the entry was authored by a known reviewer expert and
  is traceable to a round's review report." Paired with a threat-
  model row noting BUGS.md as an injection surface.

### FeatureFlags has no Stable-stage branch

**STATUS (triage 2026-06-12): LIVE (latent).** `FlagStage.Stable` exists, no flag maps to it, `isEnabled` still falls through to env resolution for a promoted flag.

- **Site:** `src/Core/FeatureFlags.fs:86-91`
- **Found:** round 20 by Viktor
- **Severity:** P1 (spec drift)
- **Symptom:** `docs/FEATURE-FLAGS.md` documents a Stable
  stage with a one-release warning-only no-op grace period
  (now reduced to "just delete on graduation"). The code's
  `stage` function has no `Stable` case for any flag; a
  flag promoted to `Stable` would fall through to env/meta
  resolution and silently read `false`.
- **Fix:** either add a Stable branch in `isEnabled` that
  returns `true` unconditionally, OR delete the Stable
  stage entirely and document graduation-means-deletion.

---

## P2 — nice to have

### MerkleTree.LeafDiff is flat O(N), not the branch-pruning walk its docstring claims

**STATUS (triage 2026-06-12): FIXED.** Docstring now states flat O(N) with the root short-circuit and names the pruning walk as an upgrade, not a description.

- **Site:** `src/Core/Merkle.fs` (`LeafDiff`, ~L134) — docstring says "O(changed + log N) branch-prunes at every matching internal level"; code is a flat loop over the whole leaf arrays.
- **Found:** 2026-06-06 by Lior
- **Symptom:** doc/impl gap — actual cost is O(N) on every diff, not the advertised pruned walk (perf, not correctness).
- **Fix:** implement the recursive top-down walk on the level digests (prune subtrees where `digestA = digestB`), or correct the docstring to O(N).
- **Who:** Naledi / Kenji

### TECH-RADAR row for Bloom sits at Trial without a bench

**STATUS (triage 2026-06-12): FIXED.** Bloom at Adopt (round 40) with measured numbers (`docs/research/bloom-bench-2026-04.md`) and a regression gate.

- **Site:** `docs/TECH-RADAR.md` (Bloom filter row)
- **Found:** round 20 by Hiroshi (complexity-reviewer)
- **Severity:** P2
- **Symptom:** Bloom row is Trial. `bench/Benchmarks/BloomBench.fs`
  exists but hasn't been run to produce numbers. No measured
  FPR / throughput backs the promotion decision either way.
- **Fix:** run the bench, record numbers in
  `docs/BENCHMARKS.md`, promote to Adopt if the numbers match
  the claim.

### `docs/EXPERT-REGISTRY.md` / `docs/CONFLICT-RESOLUTION.md` drift

**STATUS (triage 2026-06-12): FIXED.** CONFLICT-RESOLUTION defers to the registry by name — the prescribed registry-is-canon shape.

- **Sites:** both files
- **Found:** round 20 by Rune
- **Severity:** P2
- **Symptom:** the registry and `CONFLICT-RESOLUTION.md` disagree on
  the expert roster (the registry carries names; `CONFLICT-RESOLUTION.md`
  lists mostly bare role-titles). The declared-pronoun half is
  resolved — the `(she/her)` / `(he/him)` / `(they/them)` markers
  have been removed from `CONFLICT-RESOLUTION.md` per the pronoun-free
  name-canon. Roster reconciliation remains.
- **Fix:** registry is canon for names; `CONFLICT-RESOLUTION.md`
  defers to it.

---

## How to add a bug here

A reviewer (any expert) finds something broken, writes a
finding in their own report. The Architect (Kenji) folds
it into this file with a short title + site + severity.
When it's fixed, the Architect deletes the entry and adds
one line to `docs/ROUND-HISTORY.md` under the round it
shipped.

No stale "fixed" entries linger; no "originally found in
round X" provenance bloat — `ROUND-HISTORY.md` holds the
narrative, this file holds the debt.
