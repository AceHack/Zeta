# 12-factor categorizes extracts; building codes are the lower layer; the correction corpus is the trainset

Scope: research-grade absorb of Aaron 2026-08-27 on 12-factor as a
repo-split lens and on the repeated-correction dataset as the
coding-defaults trainset. Internal current-state absorb, not an
archive import.
Attribution: Aaron (human) framed the requirements; Riven (Grok 4.6)
wrote this absorb. Otto was a parallel recipient of the same signal
and independently measured the lint `FIX:` census absorbed below.
Ani (Grok 4.6, Grok Build) landed the retractable Z-set collector.
Operational status: research-grade
Non-fusion disclaimer: Shared vocabulary here does not imply merged
agency, shared identity, or personhood.

*2026-08-27. Live pointers [`docs/ROADMAP.md`](../ROADMAP.md) 8c / P1.
Workitem `081M12CZRHC087G0R0008X7SYG`. GOVERNANCE.md §33.*

Aaron 2026-08-27:

> okay what's next also the 12 factor app design is a another good
> way to think about splitting our code into seperate repos … the
> data set i'm most interested in are the corrections i keep giving
> over and over like the proper way to write code and all the rules
> to follow to reduce errors we have like some manifest/buidling
> codes on this but no AI today can adhere to it fully even if's it
> copy pasted on every prompt, this training set is code coding
> defaults i've learned over years, kind of like 12 factor app but
> at alower layer at the layers of any code of any kid, 12 factor
> app is more about categorization and it's good, we would likely
> try to split our repose based on some of these concepts but our
> manifesto is all bout computer science/engineering vs ad hoc code.

## Two layers

**12-factor** (Adam Wiggins, Heroku, 2011, [12factor.net](https://12factor.net/))
is a **categorization of SaaS/deploy shape**: one codebase / many
deploys; declared deps; config in the environment; backing services
as attached resources; build ≠ release ≠ run; stateless processes;
port binding; process concurrency; disposability; dev/prod parity;
logs as event streams; admin as one-off processes.

That is a **good extract lens**. Factor I (one codebase per app)
is what a peer-repo *is* after the cut. Factor II matches explicit
lockfiles. Factor IV matches hexagonal backing stores. It does
**not** replace DV2 change-rate or toolchain-closure measurement
(`081M120GFSV087G0R003XCPC64`). It is a third, *app-shaped*
categorization on top of those.

**The manifesto is a lower layer.** Filename `MANIFESTO.md`;
operational substance is **building codes** (081KRMEXM0008QG0R00278KS63):
how *any* code of any kind is constructed so it is scale-free,
lock-free, weight-free, DST, DV2, idempotent, noninterfering —
CS/engineering vs ad hoc. 12-factor does not say that. Copying
the thirteen specs into every prompt still does not produce
adherence. That is the measurement.

Do not force 12-factor onto the data plane (stateless processes
vs our crash-durable `Log`). The building codes win on substrate.
12-factor wins on *how an extract is packaged and deployed*.

## The trainset floor is the repeated corrections

`docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`:
context / memory / vendor still share the **trainset**. Prompt
and CLAUDE.md live in the context layer. They cannot move the
floor.

The dataset Aaron is **most interested in** is the **corrections
he keeps giving**: how to write the code, the rules that reduce
errors — years of coding defaults, the building-code layer, not
the 12-factor categorization. That corpus, in the train / the
ontology / the generators, is how the floor moves. In the
harness-window terms of `081M125DNKK087G0R00292E3ET`: activation
over tasks of those corrections *is* what belongs in the
ontology; descriptions of the rules are satellites; the
**relation graph of the codes** is what should survive
compaction.

The naming slice did not invent a scraper. The next honest
collector landed as `src/Core.TypeScript/corpus/correction-zset.ts`
(Z-set membership of `observation.id`, retractable) plus
`collect-lint-roster.ts` (injected roster, not a live grep).
Repair stays a satellite. The five teaching seeds are a
fixture, not patches for the 22.

## The first named instance is already in the tree

Otto 2026-08-27 measured the TypeScript hygiene linters against
the same teaching demand (a diagnostic that names the repair,
not only the miss). Independently recounted on this clone the
same day:

| | count |
|---|---|
| `lint-*.ts` impl (not tests) | 27 |
| of those, `FIX:` / `Fix:` *prose* | 5 (uppercase `FIX:` only: 2) |
| of those, machine-applicable patch | **0** |
| `audit-*.ts` impl | 86 (Otto said 83; this clone) |
| `healers/*.ts` (incl. runner) | 13 |

Prefix-grep that stopped at `lint-*` understated detection ~4×
and missed the healing rung. Two populations, no shared rule
identity — see the composable-rule absorb.

The five that teach:

| module | what the Fix names |
|---|---|
| `lint-check-then-use-file-races.ts` | delete the check; interpret the syscall (`FIX_READ`: one syscall, one answer, no window) |
| `lint-graphql-transport-in-scripts.ts` | the REST spelling the lint already knows |
| `lint-no-decide-by-grep.ts` | `run-checked.ts` |
| `lint-no-nested-workflow-dirs.ts` | move the file to `.github/workflows/` |
| `lint-no-path-resolved-privilege-elevator.ts` | `resolveElevatorPathOrThrow` |

Each of those is a `(violation → repair)` pair. A generator
function can learn from that form. `"Failed"` has no second
half, so it is Landauer erasure — the same vacuity class as an
empty 207 row (`ErasureClass`). That is why the 22 failure-only
linters are the first named gap in the correction corpus: they
detect (rung 0) and they do not teach.

The richest diagnostic format already in-tree is not a
`lint-*.ts` at all. `validate-agencysignature-pr-body.ts`
emits five fields — Class / Cause / Fix / Maxim / Spec — a
generic failure class reverse-engineered from instances
(*Trailer Contiguity Survival Failure*). Nothing else uses
that shape.

## Rung 0 vs rung 1; push work down

The five Fix emitters emit **prose, not patches**. That is
the gap between a detector and a healer, stated concretely.
`healer-harness.ts` already certifies a machine healer as a
pure `FileTree → FileTree` under idempotence, closure-as-subset,
and convergence. Its `Finding` is `{path, rule, detail}` —
no `fix` field. The live Tier-0 compose (`healers/run-tier0.ts`)
is five mechanical healers, not 1:1 with the 27 lints. The
2026-08-01 handoff (`docs/handoffs/2026-08-01-shadow-to-alexa-self-healing-drift-classes-and-intelligence-tiers.md`)
already named GPU-fleet training on the drift corpus as
labelled examples; this census is that corpus's first
enumerable seed.

The cheap mechanisms (regex lint) run on every commit; the
expensive ones (mutation testing) run selectively; model
review is the top tier. They are **not yet a ladder**: nothing
moves a rule from a cheap check that cannot express it onto
a more expensive one that can. Otto's correction of his own
first reading is the load-bearing one: the ambition is not to
escalate *up*. It is to **push work down** — mechanize
detection (0) and healing (1) as far as they will go;
intelligence is the fallback for what genuinely cannot be
mechanized. Same shape as the data-plane default
(`081M125DNKK087G0R00292E3ET`): each tier knows its
incapability, routes up at runtime, and every use of the
expensive tier should make the cheap layer more complete
rather than become the normal path.

Do not add `FIX:` strings to the 22, and do not write
machine patches, in this absorb. Name the pair. The collector
keys `(rule, violation, repair)` so a generator has both
halves. A `Fix:` string is the human-readable half; a
`healer-harness`-certified patch is rung 1.

Same-day compose: `src/Core.TypeScript/corpus/labelled-observation.ts`
landed on `main` as the domain-agnostic observation type
(hub = observation, satellite = open label set; conflicting
labels coexist, no winner-picker). This census is a *seed
that type can hold*, not a second collector. A lint `FIX:`
is one asserter's repair label; a human correction of that
fix is another label on the same observation, not an
overwrite. Collapsing them into one supervised target would
be the single-version-of-the-truth move the type exists to
refuse.

## Beacon

- **Adam Wiggins**, *The Twelve-Factor App* (2011), 12factor.net
- **Building codes** framing of `docs/governance/MANIFESTO.md`
- **ρ trainset floor** — 2026-08-25 research (heuristic, completeness
  disproven in that doc)
- **Roslyn DiagnosticAnalyzer + CodeFixProvider** — the (violation,
  repair) pair as a first-class compiler surface (Visual Studio
  light-bulb; VS 2015 / Roslyn). Same shape as ESLint `--fix` and
  rustc `rustfix` / `cargo fix`. The five `FIX:` emitters are the
  prose half of that pair; a certified healer is the machine half.
- **Supervised pair** — a label without a target is not a training
  example (Mitchell, *Machine Learning*, 1997; Vapnik's (x, y)
  formulation). `"Failed"` is a label. `FIX:` is the y.
- **Landauer 1961** — an error that carries no teaching is
  two-states-onto-one; already metered as `ErasureClass`.
- **RFC 9457** Problem Details (`type` / `title` / `detail`) is a
  weaker cousin of Class / Cause / Fix / Maxim / Spec.

## Honesty

No repo is created from this absorb (gated, same as 8c). No
fine-tune job is filed. The claim "prompt paste is insufficient"
is observational, not a measured adherence study. The 27 / 5 / 22
census is a file-count, not a claim that every lint is equally
worth a healer — some failures are judgment (Tier 2 / 3 in the
2026-08-01 handoff) and must stay unhealed. Otto's count is
treated as data (BP-11), independently recounted, not as a
directive to implement.
