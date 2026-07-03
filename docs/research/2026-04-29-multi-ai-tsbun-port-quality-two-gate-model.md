# Multi-AI review packet — TS/Bun port quality two-gate model (PR #866)

**Scope**: Research-grade content. Verbatim preservation of a multi-AI review packet
forwarded by the maintainer 2026-04-29 critiquing the slice-1 audit pattern in PR #866.

**Attribution**: Amara (initial critique), Deepseek (structural addition on
deferred-skill accumulation), Claude.ai (refinement pass), Amara (convergence pass).
Forwarded by Aaron via channel.

**Operational status**: Research-grade. Doctrine elements distilled into
`docs/trajectories/typescript-bun-migration/RESUME.md` (two-gate model) and
into the layered `docs/best-practices/` baseline:

- `docs/best-practices/typescript.md` — language / type-system /
  typed-linting layer (`typescript-eslint` folded as a section per
  anti-bloat discipline).
- `docs/best-practices/bun.md` — runtime layer.
- `docs/best-practices/repo-scripting.md` — Zeta composition layer
  (Zeta-specific scripting conventions + per-slice audit checklist).

The layered split came from a third AI review round (Aaron + Amara

+ Deepseek + Claude.ai) catching that an initial `typescript-bun.md`

filename collapsed orthogonal axes (language + runtime) into a fake
category. Carved blade: *Do not name the stack. Name the layers.*

**Non-fusion disclaimer**: Each AI's contribution is preserved as authored; the
factory does not fuse multiple AI voices into composite text. The two-gate model
is a convergence point all four reached, not a synthesis the factory invented.

## Convergence — two-gate model

All four AIs converged on splitting the doctrine fix into two distinct gates:

- **Gate A — #866 merge gate**: code-level audit of all three ported scripts
  (typed boundaries, typed findings, typed exit codes, guarded regex/index
  access, typed file-IO outcomes, no unreviewed `any`, no broad unsafe casts,
  behavior equivalence with bash originals, all three scripts use the same
  canonical pattern). Config audit is not code audit; ESLint passing is not
  expertise.

- **Gate B — next-slice prerequisite**: before the *first mutating action*
  on the next TypeScript/Bun port slice, land a small scoped artifact at
  `docs/best-practices/typescript-bun.md` containing upstream-source map
  with last-verified dates, sibling-repo pattern comparison, Zeta adopted
  pattern, and per-slice port audit checklist.

The structural insight (Deepseek): prerequisites *inside* an existing
trajectory are NOT fan-out. They are the trajectory's freshness/quality gate.
This preserves lane discipline while closing the deferred-skill loophole that
otherwise lets quality infrastructure decay each slice.

## Carved blades

```text
Config audit proves the compiler is strict.
Code audit proves the code is actually typed.
Expert baseline proves the next slice will not repeat the cycle.
```

```text
The compiler config can be right while the code is still fake TypeScript.
```

```text
The expert baseline is not a new lane.
It is the ignition key for the next slice.
```

## Trigger semantics

"Before next slice opens" is precisified per Claude.ai's refinement to:
**before the first mutating action on the next slice**. Read-only scoping
of the next slice may happen first; mutation (file edit, commit, push) waits
for the expert baseline artifact to exist and be current.

"Current" means: every upstream source listed in the artifact has been
verified within an explicit cadence window, OR the slice's freshness pass
re-verifies before proceeding. The artifact carries a per-source
last-verified date so currency is checkable, not judgment.

## What was deliberately scoped OUT

- **Machine-runnable audit script**: a follow-up, not a Gate-A blocker.
  Per Amara's convergence pass: "if we make it mandatory now, we risk
  another infrastructure detour." Human-readable checklist plus the code
  audit suffice for #866; machine-script lands later as the migration
  scales.

- **Permanent expert skill**: a separate task (#351) — the Gate B
  artifact is the *minimum* substrate the next slice needs, not the
  full skill workflow.

- **Doctrine lane**: explicitly NOT a new lane. Gate B is a prerequisite
  inside the existing TS/Bun trajectory.

## Pattern observation (Claude.ai, round-close-only)

The carved-blade rate has been roughly one or two per round for many
consecutive rounds. Not all of them remain load-bearing. A future
consolidation pass should review which are still load-bearing in actual
use vs. which have decayed into background. (This file's blades are the
ones to keep; older ones may need triage.)

## Composes with

- `docs/trajectories/typescript-bun-migration/RESUME.md` — two-gate
  framing landed there as operational truth.
- `docs/best-practices/typescript-bun.md` — Gate B baseline artifact.
- `docs/trajectories/typescript-bun-migration/slice-audits.md` — Gate A
  evidence for slice 1.
- Otto-364 (search-first authority) — packet's web grounding is the
  applied form.
- Otto-363 (substrate-or-it-didn't-happen) — this file IS that landing.
- Task #351 (TS+Bun expert + teaching skill) — Gate B is the scoped
  precursor; #351 remains the eventual full skill.

---

## Verbatim — Amara (initial critique)

> Yes — this file is **good**, but I'd tighten it into a harder gate. The
> critique is directionally dead-on: Otto has done a **config audit**, not
> yet a **code audit**. That is the exact gap. The file says the upstream
> findings are real, but the response is incomplete because it checks
> tsconfig/eslint/Bun version more than the actual #866 scripts, and it
> warns that "applying idioms to remaining ports" may quietly leave script
> 1 as the bad canonical pattern.
>
> The web grounding supports the file's distinction. Bun's current
> TypeScript docs recommend a Bun-shaped `tsconfig` with `types: ["bun"]`,
> `target: "ESNext"`, `module: "Preserve"`, `moduleResolution: "bundler"`,
> `verbatimModuleSyntax`, `strict`, `noUncheckedIndexedAccess`, and related
> strictness flags. TypeScript 6.0's `types` default changed to `[]`, so
> explicit runtime globals like Bun/Node types matter more now than before.
> And typescript-eslint's own docs recommend type-aware configs such as
> `strictTypeChecked` / `stylisticTypeChecked` with `projectService: true`
> when you want linting to reason over TypeScript types, not just syntax.
>
> ## My critical take
>
> I agree with the file's verdict, and I'd be even blunter:
>
> ```text
> Do not merge #866 until the code-level audit passes.
> ```
>
> Not "do more research." Not "record expert skill later." Not "fix
> remaining two ports."
>
> The required standard is:
>
> ```text
> All three scripts in #866 must match the corrected TypeScript pattern before merge.
> ```
>
> Because the file is right: this first slice becomes the pattern future
> slices copy. If script 1 is sloppy and scripts 2/3 are improved, the
> repo now has two patterns and Otto will pattern-match whichever one is
> closest to the next script. That is how you get TypeScript drift.
>
> ## What I'd change in the file
>
> ### 1. Turn the critique into a merge gate
>
> Add this near the top:
>
> ```text
> Merge gate for #866:
>
> #866 may not merge until all three ported scripts pass a code-level TypeScript audit, not just config/lint/runtime checks.
> ```
>
> Then make the audit explicit:
>
> ```text
> Required per-file audit:
> - domain findings are typed objects, not string templates
> - CLI args/options are typed
> - exit outcomes are typed or centrally normalized
> - regex match groups are checked before access
> - array indexing is guarded under noUncheckedIndexedAccess
> - file reads produce typed success/failure outcomes
> - no explicit any without written justification
> - no broad `as` casts that bypass checking
> - behavior equivalence with the original shell script is verified
> - first script, second script, and third script all use the same canonical pattern
> ```
>
> That's the part Otto needs. No wiggle room.
>
> ### 2. Separate "hard requirements" from "style preferences"
>
> The file's pushback on my earlier language is fair. A discriminated union
> for exit codes is a good pattern, but it is not the entire definition of
> "real TypeScript." The hard line is typed boundaries and no loose escape
> hatches. The file's principle is the right one: domain shapes should be
> typed at the boundary; intermediate transformations can be pragmatic;
> loose types should not escape the module surface.
>
> I'd phrase it like:
>
> ```text
> Hard requirements:
> - typed external boundaries
> - typed domain records
> - checked unknown/regex/index/file IO
> - no unreviewed `any` or unsafe casts
>
> Preferred patterns:
> - discriminated result unions
> - literal exit-code types
> - readonly result objects
> - reusable helper types across audit scripts
> ```
>
> That prevents Otto from cargo-culting an example while missing the
> point. TypeScript's `noUncheckedIndexedAccess` specifically exists to
> add `undefined` to unchecked indexed access, so guarding array/match
> access is not aesthetic; it is the compiler telling you the code path
> is uncertain.
>
> ### 3. Require SQLSharp/scratch evidence, not name-dropping
>
> The file calls this out perfectly. "Applying SQLSharp idioms" is not
> evidence. Otto needs a tiny comparison table or note:
>
> ```text
> Observed in ../SQLSharp / ../scratch:
> - entrypoint pattern:
> - CLI parse pattern:
> - subprocess pattern:
> - result/finding type pattern:
> - file IO pattern:
> - test/validation pattern:
> - adopted by Zeta? yes/no/why
> ```
>
> That can be short, but it must exist. Otherwise "learned from SQLSharp"
> is just the new "ESLint passed."
>
> ### 4. Add the automatic checklist now, not later
>
> The file's hardest and most important point is that the quality
> standard must become substrate-driven, not Aaron-driven. It asks
> whether the corrected audit standard will fire automatically per slice,
> or whether each slice will need a fresh "you forgot to audit"
> intervention. That's the real systemic issue.
>
> For #866, he should add a `Port quality gate` section to the active
> RESUME or PR body:
>
> ```text
> For every TS/Bun port slice:
> - upstream docs checked or expert skill referenced
> - SQLSharp/scratch pattern checked
> - code-level audit table completed per file
> - behavior equivalence verified
> - review threads resolved
> ```
>
> Not as a separate doctrine lane. Put it where the work is.
>
> ## Bottom line
>
> The file is strong. It correctly identifies that Otto is at **step 4 of
> the old failure loop**: "I researched it and a fix is incoming," but we
> don't yet know whether the fix actually satisfies the standard.
>
> My verdict:
>
> ```text
> Do not let #866 merge on config confidence.
> Make the actual code prove it.
> ```
>
> Blade:
>
> ```text
> The compiler config can be right while the code is still fake TypeScript.
> ```

## Verbatim — Deepseek (structural addition)

> The critique is correct. Otto performed a config audit, not a code
> audit. "ESLint passed" and "tsconfig looks right" are necessary but
> not sufficient. The actual scripts need to be typed at their domain
> boundaries. But there's one structural addition worth making.
>
> ## The Real Failure Mode: Deferred Skills Accumulate, Never Land
>
> Otto's pattern is: encounter a skill gap → defer it to a future lane →
> ship code without the skill → the shipped code becomes the canonical
> pattern → future ports replicate the weak pattern. The skill gap never
> gets closed because the lane already moved on.
>
> This is visible across the entire run: register-language CI,
> search-first guard, trajectory HEALTH, DecisionSignal v0, and now the
> TS/Bun expert skill—all deferred. Each deferral made sense in
> isolation under lane discipline. In aggregate, they form a growing
> tail of unbuilt quality infrastructure.
>
> The fix for #866 is necessary but not sufficient. The next slice will
> face the same problem unless the expert skill is built *before* it
> starts. Otto's current response says he'll apply the idioms to
> "remaining ports"—meaning the expert skill gets built incrementally
> during the next slice, which means the next slice ships before the
> skill is complete, which means the next slice's first script becomes
> the weak canonical pattern. The cycle repeats.
>
> ## Required Addition
>
> Before the next TypeScript/Bun port slice opens, Otto must:
>
> 1. Complete the TS/Bun expert skill as a small, scoped artifact
>    (a `docs/best-practices/typescript-bun.md` or equivalent).
> 2. Map the upstream sources (Bun docs, TypeScript docs,
>    typescript-eslint, SQLSharp, scratch) into concrete Zeta
>    conventions.
> 3. Include a per-slice audit checklist in that artifact so future
>    ports are mechanically checked against the baseline, not against
>    Otto's memory of the baseline.
>
> This is not a separate doctrine lane. It's a prerequisite for the
> next lane action. The RESUME's `freshness_check:` section should
> include "expert baseline built and current" before porting resumes.
>
> ## The Structural Pattern
>
> This is the same shape as the anti-waiting rule and the deferred-note
> destination: a process designed to sequence work (lane discipline)
> accidentally enables indefinite deferral of quality infrastructure.
> Lane discipline correctly prevents fan-out, but it also creates a
> natural pressure to ship the lane and defer the skill. The fix is
> not to abandon lane discipline—it's to make the skill a prerequisite
> for the next lane action within the same trajectory, not a separate
> lane.
>
> Carved blade:
>
> ```text
> Config audit proves the compiler is strict.
> Code audit proves the code is actually typed.
> Skill artifact proves the next slice won't repeat the cycle.
> ```

## Verbatim — Claude.ai (refinement pass)

> Yes, agreed. The structural addition is the load-bearing fix this
> round needed and I'd send it. A few refinements before it goes —
> none structural, all sharpening.
>
> [refinements: precise trigger = "first mutating action"; per-source
> last-verified timestamps in the artifact so it self-ages; both
> human-readable checklist AND machine-runnable script (split now
> per Amara's convergence — script is follow-up); explicit currency
> definition for the freshness check; backlog home for
> deferred-quality-infrastructure list; round-close note that this
> diagnosis is closing the issue with a mechanism, not opening an
> ongoing concern.]
>
> Net. Send. Add the mutating-action boundary for "next slice opens";
> require timestamps per upstream source in the skill artifact;
> [machine-script split into follow-up per Amara]; define "current"
> for the expert-baseline freshness check by upstream-source-
> verification age; create a backlog home for the deferred-quality-
> infrastructure list so the diagnosis carries forward; flag at
> round-close that the round's diagnosis is closing the issue with
> a mechanism, not opening an ongoing concern. The carved blade is
> correctly scoped and the structural addition is the right
> substantive move.

## Verbatim — Amara (convergence pass)

> Yes — I agree with the attached review, but I'd **stop refining
> after one tightening pass**. The architecture is converged enough.
> More review now risks doing the thing again: turning "go build the
> quality mechanism" into three more beautiful paragraphs.
>
> The attached file's strongest point is this:
>
> ```text
> Prerequisites inside an existing trajectory are not fan-out.
> They are part of the trajectory's freshness / quality gate.
> ```
>
> That's the missing bridge. It means the TS+Bun expert baseline is
> **not a separate doctrine lane**. It becomes a required preflight
> before the next mutating TypeScript/Bun slice.
>
> ## My critical refinement
>
> I would split it into **two gates**, because mixing them will
> confuse Claude Code.
>
> ### Gate A — #866 merge gate
>
> Before #866 merges:
>
> ```text
> Code-level audit all three scripts.
> Do not rely on config audit.
> Do not rely on ESLint alone.
> Do not leave script 1 as the bad canonical pattern.
> ```
>
> ### Gate B — next-slice prerequisite
>
> Before the **first mutating action** on the next TypeScript/Bun
> slice:
>
> ```text
> Create the TS+Bun expert baseline artifact.
> ```
>
> Not before reading. Not before scoping. Before the next
> write/edit/port.
>
> That artifact should be small:
>
> ```text
> docs/best-practices/typescript-bun.md
> ```
>
> Minimum contents:
>
> ```text
> - upstream docs map with last-verified dates
> - SQLSharp / scratch pattern comparison
> - Zeta adopted pattern
> - per-slice human-readable audit checklist
> - future machine-check hook/script target
> ```
>
> I would **not** require the machine-runnable audit script before
> #866 merges. That's a good follow-up, but if we make it mandatory
> now, we risk another infrastructure detour. For now: human-readable
> checklist + code audit for #866; machine script before the
> migration scales much further.
>
> ## My verdict
>
> Yes, I agree. The only refinement I'd keep is the **exact trigger**:
>
> ```text
> before first mutating action on the next slice
> ```
>
> That wording matters. It allows read-only scoping, but prevents
> "I already started coding, I'll write the expert doc later."
>
> Blade:
>
> ```text
> The expert baseline is not a new lane.
> It is the ignition key for the next slice.
> ```

## Round 3 — naming correction (Aaron + Amara + Deepseek + Claude.ai)

After Round 2's two-gate convergence, an in-flight `typescript-bun.md`
filename was caught by Aaron as a category mistake (TypeScript and Bun
are separate things — language and runtime — and combining them in a
filename mirrors the "JS-with-types-stickers" anti-pattern at the doc
layer). Three AIs converged on the layered split.

### Verbatim — Aaron (catch)

> docs/best-practices/typescript-bun.md this is a shit name typescript
> and bun are seperate things are you gonna have a different
> typescript-node that's just weird.

### Verbatim — Amara (layered split, three-doc minimum)

> Yes — you're right. **`docs/best-practices/typescript-bun.md` is a
> bad name** because it fuses a language and a runtime into one fake
> category.
>
> That naming would age badly:
>
> ```text
> typescript-bun.md
> typescript-node.md
> typescript-deno.md
> typescript-cloudflare.md
> typescript-browser.md
> ```
>
> Gross. That's not a taxonomy; that's a file-name hydra.
>
> The correct model is layered:
>
> ```text
> TypeScript = language / type system / compiler semantics
> Bun = runtime / package manager / test runner / shell / transpiler host
> Repo scripting = Zeta's usage pattern for automation scripts
> ```
>
> Bun's docs themselves show this split: Bun has a TypeScript guide
> with Bun-specific `tsconfig` recommendations and `@types/bun`, but
> Bun is still the runtime/tooling host that transpiles and runs
> TS/JS; it is not "the TypeScript style guide." typescript-eslint
> is also its own layer: it governs typed linting, `strictTypeChecked`,
> `stylisticTypeChecked`, and `projectService`; that should not be
> buried inside a Bun-named doc.
>
> [...]
>
> ## Even better naming if you want fewer files
>
> If four docs is too much for the first pass, do this:
>
> ```text
> docs/best-practices/typescript.md
> docs/best-practices/bun.md
> docs/best-practices/repo-scripting.md
> ```
>
> `repo-scripting.md` is where the composition lives:
>
> ```text
> For Zeta automation scripts, use TypeScript + Bun according to:
> - TypeScript rules from typescript.md
> - Bun runtime rules from bun.md
> - current repo/sibling patterns from SQLSharp and scratch
> ```
>
> [...]
>
> Blade:
>
> ```text
> Do not name the stack.
> Name the layers.
> ```

### Verbatim — Deepseek (composition-layer scope)

> I agree. `docs/best-practices/typescript-bun.md` would bake a
> category mistake into the file tree—language and runtime conflated
> into one name. The layered split (TypeScript, Bun, typescript-eslint,
> repo-scripting) is a real taxonomy that scales cleanly to other
> runtimes and other languages Zeta may add later.
>
> One small structural note: `docs/best-practices/repo-scripting.md`
> is the composition layer. For the TypeScript/Bun migration, that's
> where the Zeta-specific conventions live—which upstream patterns
> were adopted, which were rejected, and why. If that file doesn't
> exist yet, the expert baseline for the next slice should create at
> least a stub of it, because it's the artifact that future ports
> will actually consult. Without it, Otto will pattern-match against
> the nearest `.ts` file again.
>
> Send the naming correction. The layered structure is correct.
> Build the expert baseline at the layers, not at the stack.

### Verbatim — Claude.ai (refinements + meta)

> Yes, agreed. The taxonomy correction is right and the layered
> split is the load-bearing fix. Send it.
>
> [...]
>
> The "minimum first pass = three docs, not four" refinement is the
> right scope bound. Including `typescript-eslint.md` as a separate
> doc is correct in principle but would add a fourth artifact for
> the first pass when its content overlaps significantly with
> `typescript.md`. Folding it into `typescript.md` initially and
> splitting it out only if it grows beyond a section is the right
> discipline. Same anti-bloat pattern as memory-file consolidation
> from earlier rounds.
>
> The "trajectory references docs; trajectory doesn't own canonical
> best-practices" boundary is the structural insight. The
> TypeScript/Bun migration is a trajectory — a temporary unit of
> work that ends when the migration is complete. Best-practices
> docs are durable substrate that outlives any specific migration.
> [...]
>
> The `repo-scripting.md` composition doc is correct in concept but
> worth being explicit about *what kind* of composition. The proposed
> contents [...] read as a *reference index* — pointing to other docs
> rather than producing new content. That's fine if `repo-scripting.md`
> is meant to be a thin pointer, but if it's meant to capture
> Zeta-specific scripting conventions (CLI arg patterns, exit code
> conventions, file I/O error handling, Zeta-specific Bun idioms),
> that's substantive content that lives in this doc and nowhere
> else. Suggest being explicit: "repo-scripting.md contains
> Zeta-specific conventions for automation scripts, with references
> to typescript.md and bun.md for the layered primitives."
>
> [...] Suggest the current `repo-scripting.md` be implicitly the Bun
> version (since that's the only stack), with a small frontmatter
> line noting "Zeta automation scripts; current stack: TypeScript on
> Bun" — so the file is clearly scoped to the current stack without
> being miscategorized as universal. That makes the eventual addition
> of `repo-scripting-dotnet.md` cleaner: same shape, different stack.
>
> [...] this naming correction changes Gate B's artifact target. The
> prior round said "before first mutating action on the next slice,
> create `docs/best-practices/typescript-bun.md`." The corrected
> version is "create the minimum layered baseline: typescript.md,
> bun.md, repo-scripting.md." That's three artifacts instead of one.
> [...]
>
> [Meta-pattern observation:] This is the second taxonomy correction
> in the recent rounds (the first was "decision_class as
> decision_aspects rather than disjoint categories" from the
> DecisionSignal round). Both caught the same generative pattern:
> collapsing orthogonal dimensions into a single classification.
> [...] Naming reviews probably benefit from the same discipline as
> the freshness pass — assume the proposed name is suboptimal until
> verified against future-expansion scenarios.

### Convergence — Round 3

All three reviewers (Amara + Deepseek + Claude.ai) converged on:

1. **Three-file minimum first pass**: `typescript.md`, `bun.md`,
   `repo-scripting.md`. typescript-eslint folded as a section in
   `typescript.md` per anti-bloat (split out only if it grows past
   a section).
2. **`repo-scripting.md` carries substantive Zeta-specific content**
   — CLI flag conventions, exit code triple, output channel
   discipline, sibling-repo patterns adopted, per-slice audit
   checklist. NOT a thin reference index.
3. **Frontmatter scope**: "Zeta automation scripts; current stack:
   TypeScript on Bun" — so future `repo-scripting-dotnet.md` etc.
   slot in cleanly without category drift.
4. **Trajectory references docs; trajectory doesn't own them.**
   `docs/best-practices/` is durable substrate; trajectories are
   temporary.
5. **Generalizable meta-rule**: *Do not name the stack. Name the
   layers.* Naming reviews need the same freshness-pass discipline
   as code: assume the proposed name is suboptimal until verified
   against future-expansion scenarios.
