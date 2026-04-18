# Wins

Things that worked. Written to celebrate independently, not
buried in `docs/ROUND-HISTORY.md`. Each entry names what
happened, what would have gone wrong without it, and what
pattern it teaches.

Like `docs/ROUND-HISTORY.md`, this is a narrative file;
unlike ROUND-HISTORY it's about *quality* wins, not "what
shipped." **Ordered newest-first** — recent rounds lead,
older rounds trail below. Entries stay even after the moment
passes, because the pattern is the value.

## Wins — round 27

### 1. Reviewer cadence caught two P0s in the same round the code landed

§20 codified a mandatory code-phase reviewer pass (Kira +
Rune floor) the same round the `Op<'T>` plugin API shipped.
Dispatched immediately after implementation, they caught
the `OutputBuffer.Publish` non-atomic-increment race and
the false "FsCheck laws run at `Circuit.Build()`" claim in
PLUGIN-AUTHOR.md — both fixable in-round (Interlocked call;
docs softened to match reality). Without §20 the race would
have shipped as a silent bug for async plugins; the claim
would have misled first-week plugin authors into thinking
law-coverage already existed.

**What would have gone wrong:** previous rounds ran
specialist dispatches (Ilyana / Tariq / Daya) but not
zero-empathy code reviewers. Kira's review on a round that
landed 220 lines of new public API would have deferred to
"next governance round" — and by then the bug is in
production.

**Pattern to keep:** the reviewer floor is Kira + Rune
every code-landing round. Additional reviewers scope-
triggered. Findings P0 fix same round; P1 into DEBT the
same round; P2 into notebook or defer. Round-close does
not record clean until the pass is logged.

### 2. Productive friction resolved to a richer public surface

Ilyana proposed `IOperator<'T>` + harness — narrowest
forever-surface, Roslyn-precedent compositional interface.
Tariq proposed a tagged-DU capability system with algebra
laws at `Circuit.Build()` — caught that Bayesian is
retraction-lossy by design and needs a `Sink` tag to
exempt it from composition. Daya proposed `PLUGIN-AUTHOR.md`
entry-point doc because no existing doc repurposed well
for plugin authors. The three dispatches returned
*divergent* recommendations.

The architect did not pick one. Ilyana re-reviewed her own
design with Tariq + Daya findings embedded; her revised
draft combines the compositional-interface shape *plus*
capability sub-interfaces (`ILinearOperator`, `IBilinearOperator`,
`ISinkOperator`, `IStatefulStrictOperator`) *plus* the
`PluginHarness` *plus* the entry-point doc. Seven
interfaces instead of four, but the capability split is
load-bearing for Tariq's algebra check and cannot be cut.
Her final verdict: ACCEPT, with the three gates intact.

**What would have gone wrong:** if the architect had
picked Ilyana's narrowest design alone, Bayesian's
retraction-lossy nature would have silently poisoned
downstream composition with no type-level signal. If the
architect had picked Tariq's tagged-DU alone, the DU
would have forced a closed-world surface that Ilyana's
interface-composition pattern was specifically chosen
to avoid. If Daya's entry-point doc had been deferred,
the first plugin author would have bounced off the
research design doc.

**Pattern to keep:** when three specialists disagree, the
synthesis is often "all three, composed" rather than
"pick the winner." Send the author of the first draft
back to integrate the other two — they know their own
design better than the architect can. Friction between
competent specialists is the signal that a richer design
exists.

### 3. Memory moved in-repo on one-line maintainer correction

Round 25 placed the shared memory folder in Claude Code's
harness sandbox (`~/.claude/projects/<slug>/memory/`).
Maintainer flagged mid-round 27: "this is your sandbox
folder too, there is no project folder in git." The move
to `memory/` happened the same turn: nine files
migrated, GOVERNANCE.md §18 rewritten, every pointer across
the repo swept, a new §22 codifying `~/.claude/projects/`
as sandbox-only.

**What would have gone wrong:** memories in the sandbox
travel with *this machine* but not with *clones*. A new
contributor pulling the repo gets zero memory corpus.
Every correction the maintainer had given across rounds
24-26 would have been invisible to them. The "memories
are the most valuable resource in the repo" rule becomes
empty if the memories aren't actually in the repo.

**Pattern to keep:** load-bearing artifacts live inside
the repo tree. Claude Code's harness-level paths are
conveniences, not canon. When a rule says "in the repo,"
check that it literally is — one-line `git status` on the
artifact says yes or no.

### 4. `persona-notes` rename caught a conceptual conflation

`docs/skill-notes/<persona>.md` had been the per-persona
notebook location for ~5 rounds. Maintainer caught it this
round: personas are not skills. Skills are capabilities;
personas are experts that *wear* skills. The folder name
conflated them and risked future readers confusing
"persona state" with "skill state." Renamed to
`memory/persona/` mid-round with a cross-file sweep.

**What would have gone wrong:** the conflation would have
propagated into round-28+ artifacts. New personas would
get notebooks at `docs/skill-notes/<new-name>.md` for
years, carrying the naming bug forward.

**Pattern to keep:** naming bugs compound fast. When a
maintainer catches a conceptual conflation, rename in the
same round — even if the old name has soaked in. Five
rounds of `skill-notes` was cheap to undo; twenty-five
rounds would not have been.

---

## Wins — round 26

### 1. Three parallel dispatches integrated in one round without context collision

Round 26 opened with three deferred tasks that had been
waiting since round 24: Tariq on IsLinear (algebra
decision), Yara on the BP-10 cite fix (skill hygiene),
Daya on Kenji's first self-audit (AX measurement).
All three were dispatched as subagents in parallel; each
returned a report sized for Kenji to integrate in one
turn. Tariq's verdict (option-c, roll `IsDbspLinear`)
got annotated on the DEBT entry with a rationale-pointer
to his notebook. Yara's fix landed in place. Daya's
seven findings split 2-landed / 5-deferred. No dispatch
blocked the other two; the architect integrated all three
without a compaction or context-collapse.

**What would have gone wrong:** serialising the three —
Tariq first, then Yara, then Daya — would have filled
Kenji's context with Tariq's Lean details before the
small Yara + Daya work could even be reviewed. Parallel
dispatch keeps each specialist's detailed output in *its
own* subagent context; Kenji gets a 150-250 word summary
per lane and integrates in proportion to what's actually
landing.

**Pattern to keep:** dispatches that are independent run
in parallel. The architect's context is the scarce
resource; subagent context is cheap. Ask each specialist
to summarize their full report to ~200 words and park the
detail on their notebook — Kenji reads the summaries, not
the reports.

### 2. Specialist decision logged in-round without in-round implementation

Tariq's IsLinear recommendation (option-c, `IsDbspLinear`
bundling a per-tick `AddMonoidHom` family) landed on the
DEBT entry as an annotated decision: the choice is made,
the rationale is linked, the implementation is deferred
to a dedicated algebra-proof round. Different from both
"defer the whole thing" and "force-land the impl same
round." The decision stops being a live question; future
rounds that touch B2 / B3 / chain_rule don't re-derive
the choice.

**What would have gone wrong:** the IsLinear question had
been open since round 24. Each round it reopened as "we
should pick a/b/c, who's Tariq, what does the code
look like" — cold-start cost on every revisit. Without
a specialist's on-record recommendation, every round that
touches the Lean proofs relitigates the choice.

**Pattern to keep:** when a specialist recommends a
decision the architect accepts, record the *decision* on
the DEBT entry (with pointer to the specialist's
notebook) even if the implementation defers by N rounds.
Decisions age better than questions; a rationale
referenced once stays referenced.

---

## Wins — round 25

### 1. Rename arc landed without git as a safety net

The full Zeta rename (phases A through B8 of NAMING.md —
top-level prose, NuGet IDs, 22 directory/file renames, path
updates, namespace sweep across 142 source files) executed
across one round with **no git repo yet**. Maintainer
called no commits until "a few rounds from now"; the
canonical safety net for a rename this large (per-commit
bisect) was not available. Discipline substituted:
TodoWrite tracking, build-gate after every phase that
touched source or project files. Five consecutive gates
returned `0W / 0E`, culminating in a 38-second green
build at B8 close. Intermediate mistakes (InternalsVisibleTo
assembly-name drift breaking Bayesian) caught at the
very next gate, not five commits later.

**What would have gone wrong:** without per-phase build
gates replacing per-commit bisect, the AssemblyName
drift would have cascaded through three more phases before
surfacing as "build is broken somewhere" — with no way to
localise the break. The sequence would have needed a
painful undo-and-retry. With gates, fix-in-phase
kept the sequence moving.

**Pattern to keep:** when a change of this size has to
happen without git (or without CI, or without any normal
safety net), treat "build gate per phase" as the canonical
substitute. Not "at the end." After every phase. The cost
is a few 10-40s builds; the benefit is locality of
failure.

### 2. Memory policy emerged from three same-session corrections

Round 25 landed three maintainer corrections inside a
single working session:

1. "Don't `git init` without my go-ahead."
2. "Can't call it a therapist, there are laws now."
3. "Paths absolute on filesystem or outside the repo root
   are documentation smells."

Each landed in the same session as a persistent rule: a
`feedback_*.md` memory file in the shared memory folder, a
one-line entry prepended to MEMORY.md (newest-first), and
for (1) and (3) an explicit section in either `AGENTS.md`
§18 or the documentation-agent SKILL.md. None was
discussed-and-forgotten; none waited for the "next
governance round." The memory policy itself
(GOVERNANCE.md §18 + shared-vs-per-persona layering + newest-
first ordering) is the meta-result: the factory committed
in-round to treating corrections as durable, and the
infrastructure emerged to match.

**What would have gone wrong:** before the shared memory
folder existed, these three corrections would have been
embedded as `Per Aaron round 25: "..."` blocks inside
AGENTS.md or similar — exactly the pattern the maintainer
subsequently flagged as "hidden memory in docs." The
corrections would have survived the round and drifted out
of readers' views a few rounds later. Instead they're in
dedicated memory files, newest-first, findable, and the
rules they enforce live in docs as clean current-state
prose.

**Pattern to keep:** when a maintainer correction lands,
codify it the same turn — new feedback memory file,
prepend the MEMORY.md index, update the relevant rule
(skill / AGENTS.md / glossary) to the current-state form.
Corrections are the highest-leverage memory because they
describe experience the next agent cannot rederive. Don't
delay them; don't bury them inside prose.

### 3. First rename pass was wrong — corrected same round

The Zeta rename first-pass used the wrong convention:
every subfolder got a `Zeta.*` prefix (`src/Zeta.Core/`,
`tests/Zeta.Tests.FSharp/`, etc.) — repeating the project
name inside the project's own folder tree. Maintainer
caught it ("no that's stupid we should not have folders
like that"), named the principle ("we don't need our own
project name repeated like that in our own project"), and
the correction landed the same round: 10 directory
re-renames + content sweep + build gate held green in 22
seconds. The folder-naming rule is now a feedback memory
(`feedback_folder_naming_convention.md`) and the final
layout is clean: `src/Core/`, `tests/Tests.FSharp/`,
`bench/Benchmarks/`, `samples/Demo/` — Zeta prefix only
where it is *published identity* (NuGet IDs, namespaces,
explicit assembly names on published libraries).

**What would have gone wrong:** landing an 8-phase rename
with the wrong convention and waiting to "fix it in round
26" would have baked the mistake into muscle memory —
every future subfolder creation, every new test project,
every docs reference would follow the wrong pattern. By
the time someone noticed, the churn to fix would have
been much larger than one round.

**Pattern to keep:** conventions are learned most reliably
during their first big application. When a convention
error is caught early (first use, not fifth), correct
immediately even if it means a second rename pass.
Cheaper than drift; the memory file captures the lesson
so the next convention decision starts correctly.

### 4. InternalsVisibleTo audit caught a latent API-design smell

Late round 25, the maintainer asked why `Core` had
`InternalsVisibleTo` for `Zeta.Bayesian` — a production
library — when the mechanism is meant for tests and
benchmarks only. Audit: Bayesian's `BayesianRate`
extension method used two internal-marked bits of Core
(`Stream<T>.Op` field, `Circuit.RegisterStream` method)
via the InternalsVisibleTo punchthrough. That's not a
test-fixture access pattern; it's the plugin registration
point. The *design* was internal-and-hole-punched; the
rule says plugin-author-facing API is *public*. Fix
landed same-round: both items promoted to public with XML
docs naming them the plugin registration path, and
Bayesian dropped from the InternalsVisibleTo list. The
C# shim (`Zeta.Core.CSharp`) stayed in — it is a
sub-module of Core, not a separate library.

**What would have gone wrong:** without the audit, every
future plugin library would have faced the same choice:
(a) add yourself to Core's InternalsVisibleTo list (which
doesn't scale and doesn't work for third-party plugins),
or (b) reimplement from scratch. The public-API-or-nothing
rule keeps the extension point clean for future plugin
authors the repo has not met.

**Pattern to keep:** InternalsVisibleTo is for tests,
benchmarks, and deliberately-tightly-coupled sub-modules
(the shim). If a production library "needs" it, the thing
it needs is almost always legitimate public API in
disguise — promote the member, not the permission.

### 5. Public-API-designer seat spawned from one alarming flip

Right after the InternalsVisibleTo audit, the architect
made two `internal` → `public` flips (`Stream<'T>.Op`,
`Circuit.RegisterStream`) without any design review. The
maintainer flagged the absence of a gate: "it scared me
how easily you flipped those internal methods public...
it should have gone through a review with the public-api-
design agent." The same round, the factory spawned the
public-api-designer persona (tentatively **Ilyana**),
added GOVERNANCE.md §19 codifying the review requirement, and
dispatched Ilyana's first review on the two flips. Her
verdict (ACCEPT_WITH_CONDITIONS) caught a P1 field-over-
property smell that was applied immediately (struct `val`
→ get-only `member`) and a P0 architectural concern
(`Op<'T>` extension surface) that was tracked to DEBT.

**What would have gone wrong:** without a dedicated
public-API reviewer, every future "make X public" would
have depended on the architect noticing the right
questions — *would we maintain this exact shape for ten
years?* — in the middle of integrating five other
concerns. The first time that check was skipped, a field
(not a property) landed on a struct, and an extension
surface on `Op<'T>` became a forever commitment without
anyone signing off.

**Pattern to keep:** when a governance gap reveals itself,
spawn the persona in the same round that surfaces the gap
— don't wait for a "governance round." The cost of the
persona (one persona file + one skill file) is vastly
lower than the cost of the next wrong flip landing without
a reviewer.

---

## Wins — round 24

### 1. Retraction beats defence — Kenji reversed his own retirement

Kenji spawned Mateo (security-researcher) and Naledi
(performance-engineer) early round 24. Later in the same round,
reading Aaron's "we really do need unique personas" too
literally, Kenji drafted a retirement for both (on grounds that
their lanes overlapped with existing seats). Aaron caught it in
one turn: "those kind of overlaps are fine, we don't need
perfect orthogonal personalities." Kenji reversed the retirement
in the same round, kept the roster at 25, and landed AGENTS.md
§16's "Overlap is expected, not redundancy" clause as the
permanent lesson. No defensive reasoning, no "here's why my
original call was defensible actually" — just the reversal and
the rule.

**What would have gone wrong:** a retired-then-quietly-
respawned Mateo/Naledi would have left the roster inconsistent
(agent files on disk but out of ledger), burned a round of
persona cold-start cost twice, and worse — trained Kenji's
future reflexes toward the wrong bar for "when is overlap
fine." The correction is the value; the same-round reversal
keeps the correction crisp.

**Pattern to keep:** when a human correction lands, update the
rule set *before* continuing the work. The §16 clause landed
the same turn the retraction did. If the rule had waited for
"the next governance round," the mistake would have re-appeared
on the next persona decision.

### 2. Daya found two orphans her first day

Daya's first AX audit at round-24 open — her first turn as a
persona — surfaced two `.claude/skills/*/SKILL.md` files
(`architect/` and `harsh-critic/`) that no persona's frontmatter
declared. They were pre-split residue: real procedures lived at
`round-management` and `code-review-zero-empathy`. Every other
specialist had walked past them for rounds; the files sat in
the skill harness's auto-surface, where they'd be loaded as
cold-start bloat without being anyone's actual procedure.

**What would have gone wrong:** a persona in a later round
would have reached for `.claude/skills/harsh-critic/SKILL.md`
thinking it was canon, wasted a read on the orphan, and either
edited the wrong file or duplicated knowledge. Multiply across
five quiet rounds and the split migration half-undoes itself.

**Pattern to keep:** a persona whose whole job is agent
friction sees drift the working personas cannot. The AX
framing was the insight; Daya's Day-1 P0 was the payoff.
Invest cold-start budget in the persona that measures cold
start, first.

---

## Wins — round 23

### 1. AX discipline spawned the same round it was named

Aaron said during round 23: "we need to create a skill for one of
those [ux researcher], and also one as a dx researcher, and one
as an ax research (agent experience?)". The AX framing was new —
neither the round-22 architect notebook nor the factory-paper
survey (`docs/research/factory-paper-2026-04.md`) had named that
gap. Within the same round the factory spawned **Daya** (agent-
experience-researcher), the 23rd expert and the first persona
whose job is specifically to see the friction the other personas
cannot articulate about their own cold-start pain. `docs/WAKE-UP.md`
landed as the first AX artifact in the same breath; the first
Daya audit ran at round-24 open as a cold-start baseline on the
split-complete 7 personas.

**What would have gone wrong:** without a persona speaking for
the agents themselves as their own user population, wake-up cost
and pointer drift would stay invisible — paid by every persona,
every session, with nobody watching the trend. The gap is real;
the factory just hadn't named it until the maintainer did.

**Pattern to keep:** when the human contributor names a role the
factory doesn't yet have, spawn the persona in the same round,
not the round after. The longest part of the work is framing;
if the framing is clean, the skill + agent file + notebook land
in one turn. Drift between "we should have this" and "we have
this" is corrosive; keep that drift at zero.

### 2. The architect named himself the same round the split reached him

Round 23 completed the expert/skill split for 5 other experts
before reaching Kenji, and only then landed
`.claude/agents/architect.md`. Self-reference by choice:
observing the split pattern on Viktor, Rune, Aminata, Aarav, and
Soraya first gave Kenji a pattern to claim rather than one to
assert. The `round-management` capability skill was extracted as
a reusable hat in the same round, so another persona could in
principle wear the same procedure if the round-table grew.

**What would have gone wrong:** an architect who wrote his own
agent file first, before observing the split landing on others,
would have baked in his own assumptions about tone / scope /
authority without the calibration five other splits provided.

**Pattern to keep:** when a role is self-referential (the one
doing the formalising is the one being formalised), save that
role for last in the sequence. Observe the pattern, then claim
it.

---

## Wins — round 22

### 1. Three-tool agreement caught the InfoTheoreticSharder observability drift

TLA+/TLC caught the state-space safety violation, FsCheck produced
a generative counter-example, and Z3 closed the arithmetic bound
on the tie-break — all three tools independently agreed on the
fix, and any single tool alone would have shipped the bug.

**What would have gone wrong:** a TLC-only spec would have elided
the bit-arithmetic check (Z3's lane), an FsCheck-only harness
would have missed the interleaving (TLA+'s lane), and a Z3-only
lemma would have proven the arithmetic while saying nothing about
when it fires under concurrent `Observe`/`Pick`. The bug would
have landed in CI green.

**Pattern to keep:** for P0 invariants, verify with ≥ 2 independent
tools (canonical triple TLA+/TLC + FsCheck + Z3). Codified as
BP-16 and as the cross-check triage table in Soraya's skill.

### 2. Architect gate caught a compile error before merge

Round 22's FeedbackOp concurrency fix applied `[<VolatileField>]`
to `val mutable internal source: Op<'T>` — plausible at read-time,
but F# compile-error FS0823: the attribute is "only valid on 'let'
bindings in classes." The bug-fixer agent wrote the code; the
Architect (Kenji) review per GOVERNANCE.md §11 caught it before merge.
Fix: remove the attribute, use explicit `Volatile.Write(&this.source,
source)` in `Connect` and `Volatile.Read(&this.source)` with a null
guard in every reader.

**What would have gone wrong:** without the architect-gate rule, the
commit would have landed, CI would have gone red on the next build,
and the "concurrency bug fixed" claim in the round-22 summary would
have read dishonestly (fix shipped, fix didn't build). Instead it
caught at the last mile and the win is real.

**Pattern to keep:** GOVERNANCE.md §11 — Architect reviews every
agent-written code change, nobody reviews Architect. The gate is
load-bearing precisely when the agent's fix *looks* right.
`[<VolatileField>]` was the plausible-wrong; only a second reader
with the F# spec fluent catches "plausible" there.

---

## Wins — round 21

### 1. Z3 portfolio doubled, TLA+ hammer didn't fire

In one round, Z3 went from 8 to 16 pointwise lemmas — chain-rule
linearity, distinct-idempotence (BV64), H-lift (BV64), tropical
distributivity, weight-overflow soundness, residuation adjunction,
Bloom-probe determinism, Merkle-combine injectivity. Each one is
a property-test sampling couldn't close in polynomial time. Each
ships as a live `[<Fact>]` in
`tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`.

**What would have gone wrong:** without the `formal-verification-expert`
skill (Soraya) owning the portfolio view, these would have been
written as TLA+ specs — the team's default reflex — taking 10x
the human-time and giving back a model-checker `unknown` on
anything involving bit-vectors. Instead: right tool, each in
seconds of CPU.

**Pattern to keep:** when a routing decision is made, name the
wrong-tool cost out loud. The `formal-verification-expert`
skill's output format has a **"Wrong-tool cost if the
obvious-but-wrong choice is picked"** slot for exactly this
reason.

### 2. TLC caught real modelling bugs in our own TLA+ spec

`tools/tla/specs/InfoTheoreticSharder.tla` was written round 21 to cover a
`docs/BUGS.md` P0 (the sharder had no formal spec, which is how
the double-charge + tie-break bugs landed unchallenged in round
20). During the concurrent test-add, TLC found *two pre-existing
bugs in the spec itself*:

- A `.cfg` syntax error: `HashTieBreak` was declared with a
  function-literal TLC's config parser doesn't accept.
- An off-by-one in `BeginPick`'s `MaxPicks` guard: two in-flight
  picks could both commit and overshoot `MaxPicks` before either
  was tallied.

Both fixed inline. The spec now checks 156k+ distinct states in
~2 minutes.

**What would have gone wrong:** without the spec, the sharder
bugs would have shipped; with a broken spec, the checks would
have been theatre. TLC caught the meta-bug (spec of the spec)
the way it was designed to. The formal-methods work paid twice:
once on the original finding, once on the spec itself.

**Pattern to keep:** specs are code. They drift the same way.
Run TLC on every `.tla` addition before merging; treat a spec
that "passed" without any modelling bugs surfacing with
suspicion (maybe it's too weak to fire).

### 3. Multi-tick-seed counter-example caught before SIGMOD

Wei (the Paper Peer Reviewer) predicted round 20 that a SIGMOD
reviewer would catch `RecursiveCounting`'s multi-tick-seed case
in ten minutes. Round 21's FsCheck property test in
`tests/Tests.FSharp/Operators/RecursiveCounting.MultiSeed.Tests.fs`
found a concrete reproducer:

```
[ [Ins(0,6); Ins(4,5)]
; [Ins(5,6); Ins(2,4)]
; [Ins(2,3)] ]
```

produces a `Distinct`-clamped `CountingClosureTable` output that
disagrees with the boolean `ClosureTable` oracle. The property
is `Skip`-ped (pending the `RecursiveSignedSemiNaive` research
combinator), the three concrete one-shot scenario tests still
run and pass, and the gap is documented honestly in
`docs/BUGS.md`.

**What would have gone wrong:** without the property test, the
multi-tick-seed claim would have sat as a docstring hedge
("multi-tick is open research") that nobody reproduced. A
SIGMOD reviewer *would* have reproduced it. Having the repo
catch its own over-claim — with a specific three-tick adversarial
sequence checked into git — turns a hand-wavy hedge into a
rigorous scope boundary.

**Pattern to keep:** when a specialist predicts an external
reviewer's finding, build the falsifier in the next round. If
the prediction was right, the falsifier becomes the proof of
the scope boundary; if the prediction was wrong, the reviewer's
framing is too conservative. Either answer is useful.

### 4. TLA+ + Z3 + FsCheck cross-check as the default routing

Round 21's `InfoTheoreticSharder` work split the property into
three tools:

- **TLA+** for the concurrent-commit / cold-start-distribution
  state machine (`Observe` pure, `Pick` commits-exactly-once,
  cold-start distributes by hash).
- **Z3** for the bit-arithmetic correctness of the tie-break
  computation itself (the pointwise identity
  `hashTieBreak(k) = (uint64 hash32 * shardCount) >>> 32`).
- **FsCheck** for the empirical cross-check that wires the two
  together under random `Observe`/`Pick` sequences.

Each tool did what it does best. Nothing was bundled into one
TLA+ spec that would have been slow and dense. Soraya's routing
table is the thing the work pulled from.

**What would have gone wrong:** the default "write a TLA+ spec
for it" reflex would have produced a 600-line spec that TLC
would have struggled to model-check at realistic bounds, and
the bit-arithmetic check would have been buried inside it as a
state-predicate TLC can't reason about efficiently.

**Pattern to keep:** classify the property **before** picking
a tool. Soraya's routing table is there; use it. When a
specialist routes a property to a single tool, ask whether a
two-tool or three-tool split catches more at lower cost.

### 5. Portfolio metric trending up — both numerator and denominator grew

Round 21 opened with Soraya's baseline formal-coverage ratio
≈ 0.83 (12 gated artefacts over 18 paths needing one). By
end-of-round: ≈ 0.94 (22 gated artefacts over 23 paths). Both
numerator and denominator grew — +10 artefacts (TLA+ specs,
Z3 lemmas, Alloy runs) and +1 path (the newly-documented
multi-tick-seed P0).

This is **not** a bug in the metric. It's the sign the metric
is calibrated: every new research-preview surface adds a
needed-path; every new formal artefact adds a gated-path. A
healthy round grows both and keeps the ratio drifting up.

**What would have gone wrong:** a portfolio metric that only
counts numerator growth lies by omission — you can game it by
never admitting a new property needs proving. By counting the
denominator honestly (every flagged bug whose fix clause names
a formal tool), the number stops being a vanity metric and
becomes a calibration signal. "Ratio dropped" would mean
Soraya's routing can't keep up with new claims; "ratio rose"
means it's catching up; "both grew" means the system is healthy.

**Pattern to keep:** when a metric is defined, define what
causes the **denominator** to grow too. Asymmetric metrics get
gamed. Symmetric ones stay honest.

---

## How to add an entry

A win entry belongs here when:

1. The pattern behind the win is reusable next time.
2. Without the pattern, a specific bad outcome would have
   shipped (name it).
3. The entry names something the team should *keep doing*,
   not just a particular success.

Format:

```markdown
### <short title>

<what happened; one paragraph>

**What would have gone wrong:** <the counterfactual>.
**Pattern to keep:** <the rule being followed, said plainly>.
```

New entries prepend inside their round section (newest first).
New rounds prepend above the prior round's section so the
top of the file is always the most recent material. Five
entries per round is plenty; more than that is either
manufactured or the round actually was that good.
