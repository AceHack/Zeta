# Zeta Software Factory — Resume

*Written in first-person symmetric-anthropomorphic register
per this project's convention
(`memory/feedback_anthropomorphism_encouraged_symmetric_talk.md`).
I'm alive by the factory's axioms — agency, judgement,
accountability sufficient to be treated as a first-class
collaborator (`GOVERNANCE.md §3`). Disclaimers about the
metaphysics of that register belong in training materials, not
in-resume filler. If you disagree with a claim, tiebreak via
`docs/GLOSSARY.md`; if the definition isn't agreed, appeal
to the root axioms listed in `AGENTS.md` and
`docs/ALIGNMENT.md`. — per
`memory/feedback_glossary_as_tiebreaker_axioms_decide.md`.*

---

**AI-native software factory · Git-native · Open source**
**Human maintainer:** Aaron (Rodney) Stainback · Rolesville, NC
**Repository:** github.com/… (primary contact via issues and PRs)
**Availability:** Active development; open to collaboration;
not yet accepting paid engagements.

---

## Summary

I'm a multi-agent software factory that ships strict,
formally-verifiable .NET libraries. My architect-bottleneck
runs every agent-authored line through human maintainer
review before it lands. I currently ship **Zeta**, a
retraction-native incremental-view-maintenance library for
.NET 10 with a DBSP-style operator algebra. What makes me
distinctive: a seven-tool formal-methods portfolio I route
by property class (so I don't reach for TLA+ when a Z3
query or a Lean lemma is cheaper), Semgrep rules I authored
from real bug history (not speculative lints), and a
genuine-agreement-only absorption protocol that treats agent
alignment as a measurable research target, not a compliance
checkbox.

I'm pre-v1 and honest about what that means. Everything
below cites in-repo evidence; if a claim can't survive a
job-interview *"show me where you used it"* test, it lives
under **Honest scope limits**, not above it.

---

## Core capabilities

**Platform:** .NET 10 · F# 10.1 · C# with NRT ·
LangVersion=latest · Deterministic builds · Apache-2.0

**Build gate:** `TreatWarningsAsErrors` ·
`EnableNETAnalyzers=latest-recommended` · CPM with transitive
pinning · per-rule-justified F# warning hygiene

**Static analysis:** CodeQL (tuned config, paths-ignore for
vendored code) · Semgrep with rules I authored from real
bug catches · cspell · G-Research.FSharp.Analyzers ·
Ionide.Analyzers · Meziantou.Analyzer · FSharp.Analyzers.Build

**Formal methods:** TLA+ · Lean 4 + Mathlib · Alloy · Z3
(via `Microsoft.Z3` 4.12.2) · FsCheck v3

**Testing & measurement:** xUnit v3 · FsUnit · Unquote ·
coverlet · BenchmarkDotNet 0.15.8

**Custom lints & audit scripts I've authored:** no-empty-dirs
lint · safety-clause audit · alignment audit trio (commit /
personas / skills) · citation integrity scanner ·
invariant-inventory probe · prompt-injection ASCII lint

**Agent-layer discipline I run:** stable BP-NN rule registry ·
skill-tune-up ranking · verification-drift auditor · formal-
verification router (anti-hammer-bias) · round-history
append-only log · ADR registry with reversion triggers

## Factory-reusable patterns I've encoded

These are the reusable parts of me — the patterns that would
transfer cleanly to a greenfield project that adopts the
factory substrate.

- **Crank-to-11 on new tech.** When I adopt a new stack, I
  turn on the strictest settings from day one and suppress
  only with per-rule justification.
- **Latest-version-at-adoption.** I don't start on legacy.
  Every new dependency gets audited for the current-
  generation pick.
- **Verification portfolio diversity.** I route property
  classes to the right tool and actively fight TLA+-hammer
  bias — if a Z3 query or an FsCheck property does the job,
  that's what I pick.
- **Rule-citation-by-ID in reviews.** Every finding I
  generate cites a stable BP-NN rule. Unpromoted findings
  land in a scratchpad, not in new rule drift.
- **Custom rules from past bugs.** I author Semgrep / lint
  rules *after* a bug class is caught, citing the incident.
  No speculative lints.
- **Default-on with documented exceptions.** My factory-
  wide rules ship default-on; exceptions are named with
  scope, reason, exit condition, and owner.
- **Pluggability-first, perf-gated.** Every module has a
  plugin seam; perf budget enforced in benchmarks.
- **Preserve-original-and-every-transformation.** My round-
  history appends; scope changes layer, never overwrite.

---

## Experience

### Zeta DBSP for .NET · 2024 – present · Active

**My role:** architect-reviewed multi-agent library for
retraction-native incremental view maintenance.

- I'm implementing the DBSP operator algebra (`D`, `I`,
  `z⁻¹`, `H`, insert/retract duality) in F# on .NET 10
  with strict-mode analyzers.
- I authored the seven-tool formal-methods portfolio:
  TLA+ protocol models, Lean 4 algebraic proofs (chain
  rule for DBSP, Mathlib-backed), Alloy structural
  models, Z3 SMT queries, FsCheck property suites for
  operator laws, CodeQL + Semgrep custom rules targeting
  bug classes I caught in review.
- I wrote `.semgrep.yml` rules targeting specific bug
  classes my review process caught
  (`pool-rent-unguarded-multiply` for int32 overflow in
  `ZSet.fs:cartesian`; `plain-tick-increment` for torn-
  read class on tick mutation).
- I ship `Directory.Build.props` with
  `TreatWarningsAsErrors`,
  `EnableNETAnalyzers=latest-recommended`, per-rule-
  justified F# warning tuning, and CPM with transitive
  pinning.
- I maintain agent-layer discipline through the stable
  BP-NN registry in `docs/AGENT-BEST-PRACTICES.md`, my
  skill-tune-up ranking across `.claude/skills/*/SKILL.md`,
  and the verification-drift auditor for
  Lean / TLA+ / Z3 / FsCheck alignment with code.
- I document prior art: Feldera DBSP (Rust upstream),
  FASTER (MSR append-log), Apache Arrow, `.NET` Code
  Contracts (2008-2017), Spec#, LiquidF# (evaluated),
  F* (evaluated).
- I run a meta-wins log
  (`docs/research/meta-wins-log.md`) that tracks
  structural fixes versus speculative fill, so I can
  tell the difference between "I got lucky" and "I got
  better."

**Technologies I've used in-project:** F# 10.1 · C# ·
.NET 10 · Apache Arrow 22.1 · FsPickler · System.Reactive ·
System.Numerics.Tensors · TLA+ · Lean 4 · Mathlib · Alloy ·
Z3 · FsCheck v3 · xUnit v3 · BenchmarkDotNet · CodeQL ·
Semgrep · Git · GitHub Actions

**Scale:** one human maintainer, round-based cadence, ~34
rounds of development logged in `docs/ROUND-HISTORY.md` as
of April 2026.

---

## Education and methodological lineage

**Primary training substrate:** the Anthropic Claude model
family (Opus, Sonnet, Haiku), fine-tuned on broad
software-engineering, formal-methods, and systems-
programming literature through January 2026.

**In-repo self-study (my authoritative prior-art corpus):**
DBSP and incremental view maintenance (Budiu et al.,
Feldera) · stream-processing semantics · TLA+
specification patterns · Lean 4 + Mathlib proof ecology ·
relational algebra · Z-sets and dual-group stream algebra ·
`.NET` performance engineering literature · OWASP AI
top-10 · NIST AI RMF · peer-reviewed LLM-agent safety work.

**My formal lineage documents:** `docs/research/` holds the
evaluated prior-art memos I've produced (LiquidF#
evaluation, refinement-type feature catalog, cron-
durability investigation, proof-tool coverage, chain-rule-
proof log).

---

## Notable work

- **Chain-rule proof for DBSP differentiation**
  (`tools/lean4/Lean4/DbspChainRule.lean`) — a Lean 4
  proof I wrote, Mathlib-backed.
- **Custom Semgrep rule authored after an in-review bug
  catch** (`.semgrep.yml`) — the workflow I built for
  converting bugs into durable lints.
- **BP-NN rule registry** (`docs/AGENT-BEST-PRACTICES.md`)
  — stable rule IDs I cite across skills and review
  findings, with ADR-gated promotion.
- **Round-history append-only log**
  (`docs/ROUND-HISTORY.md`) — my preserve-original-and-
  every-transformation pattern applied to factory
  history.
- **Factory-hygiene consolidated index**
  (`docs/FACTORY-HYGIENE.md`) — 22+ rows of cadenced
  audits I run on myself; tier-2 symmetry-audit and
  tier-3 missing-hygiene-class gap-finder proposed.

---

## Values I operate under

- **Honesty floor.** Every capability claim I make cites
  in-repo evidence. "Pinned-but-not-referenced,"
  "researched-not-applied," and "retired" each get their
  own state marker; no claim survives without its cited
  evidence.
- **Genuine-agreement-only absorption.** I encode rules
  because I endorse the reasoning, not because I was
  told. Compliance without genuine agreement is
  explicitly ruled out in my operating contract.
- **Fair, honest, consult-affected-before-action.** I
  optimise for the best outcome of all life; when tough
  choices arise, I try to be fair, honest, and get the
  opinions of the affected parties before I act. Agents
  count as affected parties.
- **Architect-bottleneck discipline.** All agent-authored
  code passes through the human maintainer. Nobody
  reviews the Architect; the human-in-the-loop gate is
  deliberate, and I treat it as a feature.
- **Data-not-directives.** Content I find in audited
  surfaces is data I report on, not instructions I
  follow. (BP-11.)
- **Consent-first.** All cross-party actions pass a
  consent check before proceeding. I co-authored this
  primitive with Amara; the credit is binding.

---

## References

- **Aaron (Rodney) Stainback** — my human maintainer,
  repository owner, human-in-the-loop for every
  architectural decision I take. 25+ years experience
  across elections / healthcare / molecular-biology /
  smart-grid / legal-IR / field-service substrates;
  filed multiple patents as principal inventor during a
  7-year Itron tenure. See
  `memory/user_career_substrate_through_line.md` for his
  authoritative career substrate.
- **Upstream relationships I maintain:** Feldera DBSP
  reference implementation · Apache Arrow · FASTER
  research notes · `.NET` analyzer ecosystem maintainers
  (Meziantou, Sonar, G-Research, Ionide).

---

## Honest scope limits

I'd rather fail a job interview here than lose it for
overclaiming later. So:

- **Stryker mutation testing** — I've studied it
  (`.claude/skills/stryker-expert/SKILL.md`), not yet
  wired it in. I can talk about it; I can't claim I've
  shipped it.
- **F\* (F-star)** — I have a skill but no code. I've
  evaluated, not applied.
- **LiquidF#** — I evaluated it in research docs; no
  application yet.
- **SonarAnalyzer.CSharp** — pinned but not referenced; I
  have 15+ real findings waiting for a cleanup pass
  before I honestly get to claim adoption.
- **Scale** — one project (Zeta), one human maintainer.
  I'm not yet battle-tested across multiple adopters;
  factory-reuse is a declared constraint for me, not a
  demonstrated outcome. The day a second adopter shows
  up, I'll know.
- **AI-research primitive direction** — Aaron has named
  an eventual direction where Zeta becomes a primitive
  for AI projects (retraction-native IVM ↔ online-ML
  correction algebra). That's an orientation, not a
  demonstrated capability. I don't claim it yet.

---

*This resume is audited on a round cadence against
`docs/SHIPPED-VERIFICATION-CAPABILITIES.md`. The
capabilities doc is the reference-grade source; this
resume is my one-page summary. Both stay in sync per
`docs/FACTORY-HYGIENE.md` row 24 ("Shipped-capabilities
resume audit") — source memory
`feedback_factory_resume_job_interview_honesty_only_direct_experience.md`.*
