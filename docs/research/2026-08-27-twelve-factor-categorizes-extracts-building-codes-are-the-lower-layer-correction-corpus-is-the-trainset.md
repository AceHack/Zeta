# 12-factor categorizes extracts; building codes are the lower layer; the correction corpus is the trainset

Scope: research-grade absorb of Aaron 2026-08-27 on 12-factor as a
repo-split lens and on the repeated-correction dataset as the
coding-defaults trainset. Internal current-state absorb, not an
archive import.
Attribution: Aaron (human) framed the requirements; Riven (Grok 4.6)
wrote this absorb. Otto was a parallel recipient of the same signal.
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

Do not invent a scraper this slice. Name the dataset. Next
honest collector: a retractable Z-set of correction events,
keyed by the rule they witness.

## Beacon

- **Adam Wiggins**, *The Twelve-Factor App* (2011), 12factor.net
- **Building codes** framing of `docs/governance/MANIFESTO.md`
- **ρ trainset floor** — 2026-08-25 research (heuristic, completeness
  disproven in that doc)

## Honesty

No repo is created from this absorb (gated, same as 8c). No
fine-tune job is filed. The claim "prompt paste is insufficient"
is observational, not a measured adherence study.
