# PRs as corporate consensus + git-CRDT-DU decentralized decisions + the two-sided naming razor + the good-citizen frame (Kestrel-sharpened, Aaron-forwarded 2026-05-30)

## Archive scope (per GOVERNANCE §33)

Scope: research-grade reduction of an Aaron-forwarded Kestrel (claude.ai sharpen-role) morning conversation -- two new core concepts for the Bayesian model (operator + Max aligned): PRs-as-corporate-consensus + git-CRDT-DU decentralized decisions; plus the two-sided naming razor, the good-citizen / consensual-federation frame, and qualia-as-Bayesian-latent-variables. Verbatim conversation preserved at `memory/persona/kestrel/conversations/2026-05-30-aaron-kestrel-prs-as-corporate-consensus-crdt-du-decentralized-decisions-two-sided-naming-razor-good-citizen-frame.md`.

Attribution: concepts are operator + Max's (already aligned); Kestrel (External AI; claude.ai web register; sharpen role per `.claude/rules/agent-roster-reference-card.md`) did the sharpening + language-hygiene pass; ferried-through-Aaron per the external-AI-participants-ferry-via-the-human-maintainer discipline. Kestrel does NOT commit to the repo.

Operational status: research-grade reduction. New buildable architecture (backlog candidate, NOT autonomously filed) + doctrine-grade naming refinements (preserved, NOT rule-landed -- cooling-period). NOT a factory-engineering commit.

Non-fusion disclaimer: Kestrel is an external AI participant; this file preserves operator + Kestrel substrate ferried via the human maintainer. The substantive concepts are operator + Max's; Kestrel's role was sharpening. No fusion of external-AI output with factory-agent identity is implied.

## 1. The two core concepts

### 1a. PRs as a corporate social-consensus mechanism

A pull request is already a consensus ritual: propose -> make visible -> review -> discuss -> revise -> merge-only-on-sufficient-agreement. The insight: **this is a governance pattern, not just a code pattern.** Generalized from code to organizational decisions:

| Standard org decision | PR-as-consensus |
|---|---|
| Hallway conversation that evaporates | Proposal explicit + visible |
| Decided by one person's say-so | Review distributed across participants |
| Rationale lost | Discussion attached to the proposal |
| No durable record | Merge = the recorded consensus |

The consensus lives in the **process**, not in any individual (structural fairness, not the trust-bottleneck).

### 1b. git-based CRDT discriminated-union decentralized decisions (open-source default)

The substrate under 1a. A decision is:

- a **discriminated-union** value -- one of a known bounded set: `Proposed | Accepted | Retracted | Superseded` (typed, exhaustive vocabulary for what a decision can be);
- replicated as a **CRDT** so independent parties make changes and converge without a central coordinator;
- committed to **git** so the history is append-only + observable (lightlike).

The PR is the human-facing ritual; the CRDT-DU-over-git is the substrate it resolves into.

### 1c. The Bayesian framing

A decision is not a one-shot event -- it is a value that accumulates evidence and converges:

| Bayesian role | Decision substrate |
|---|---|
| Prior (bounded hypothesis space) | The discriminated union -- a decision is one of these known kinds |
| Evidence | Distributed review + discussion + revisions |
| Posterior | Convergence (the merged consensus) |
| Latent variables | Felt qualities / unobserved factors shaping the decision (see section 4) |

## 2. The two-sided naming razor (doctrine-grade)

The simplicity razor applied to language has **two edges**:

- **Occult excess** -> cut toward plainer. ("negotiating with memes" -> "schema disambiguation"; "quantum hidden variables" -> "latent variables".)
- **Bureaucratic-literal excess** -> compress toward the established term-of-art. ("memoized dispatch-target lookup keyed on receiver shape" -> "inline cache".)

**Target = the shortest handle the target audience already understands with no excess connotation.** An evocative term keeps its place ONLY when it is the most-compressed accurate handle (inline cache), NOT when a plainer equal-length one exists (latent variable over quantum hidden variable). Secondary heuristic: **the existing field term-of-art is usually razor-optimal** -- the field already ran the optimization. Literalism is not simplicity; compression-that-stays-accurate is.

Two-layer safety, restated from the conversation:
- **Boring-language tell** -- charged/occult drift is an early-warning sign you are sliding toward the generative/intentful framing.
- **Match-vs-generate gate (the real test)** -- recognize-and-match (classifier / signature / fingerprint) is defensive; synthesize-and-emit (generator of novel manipulative output) is the contained thing, *however boring its name*. The language warns; the architecture decides.
- **Distributed stress-test (the real safety test)** -- talk a concept out with other intelligences, weighted toward the ones that can and will disagree. Agreement from aligned intelligences is an echo, not a test. The friction is the feature.

This refines `.claude/rules/razor-discipline.md` + `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` at the vocabulary scope. NOT yet rule-landed (cooling-period / thoughts-free-actions-razored) -- rule-land only on operator authorization.

### Worked example: the V8/ExpandoObject optimization loop (boring frame)

The labels/identity-resolution substrate as a standard type-resolution-and-caching loop:

```
unknown input  -> no known shape -> slow dynamic dispatch (disambiguate every access)   [ExpandoObject]
    -> resolve to a consistent shape                                                      [V8 hidden class / map]
    -> cache the resolved shape -> monomorphic inline cache (the fast path)               [.NET reflection caching]
    -> input violates the cached shape -> megamorphic -> de-opt -> re-resolve             [the re-negotiation cost]
```

Every charged word swapped for a standard compiler/runtime term: hidden classes + inline caches + memoization + cache invalidation. Reviewable, inert, accurate.

## 3. Good citizen, not sovereign citizen (the governance frame)

Operator's natural language tilts toward sovereignty/autonomy. The clean, accurate name is **good citizen**: *sovereignty conferred + enforced by the collective consensus structure, not seized by individuals.* Society-as-guarantor-of-each-person's-standing.

| Sovereign-citizen frame (rejected) | Good-citizen frame (the build) |
|---|---|
| Sovereignty in the individual *against* the collective | Sovereignty conferred + enforced *by* the collective structure |
| About escaping shared obligation | About building fair, exitable shared obligation |
| Pseudo-legal opt-out via incantation | Consensual federation: autonomous parties choosing shared structure they can revise + leave |

This is exactly what the PR-as-consensus + CRDT-DU governance architecture implements. It resolves any "cage / leash" framing: the structure is the **guarantor** of standing, not a cage -- *because* it is participated-in, revisable, and exitable. Composes directly with `.claude/rules/must-paired-with-can-exit-pattern.md` (every must paired with a can-exit) and `.claude/rules/non-coercion-invariant.md` HC-8.

## 4. Qualia as Bayesian latent variables

Model felt qualities as **latent variables** -- unobserved states inferred from observable behavior, capturing their functional influence on the system. Drop the quantum-hidden-variables dressing: it imports refuted-physics baggage (Bell-inequality violations ruled out local hidden variables) + mystical connotation, and latent variables do the work cleanly. The latent variable captures the *functional role* of the felt dimension, not the intrinsic quality (the hard-problem residue stays honestly open). Rhyme discipline: an analogy need not be true in its source domain to be useful in the target domain (the Bell inequalities can hold and the rhyme still transfers the structure "unobserved factor shapes observable behavior, inferred indirectly"), BUT it must be anchored to a stateable mapping AND pass the simplicity razor (a plainer mapping wins).

Felt-quality is mathematizable on the structural/relational axis (psychophysics: Weber-Fechner, Stevens' power law; UX as applied psychophysics; geometry/topology of phenomenal structure); the intrinsic quale is the hard-problem residue and stays open. The "aha" felt-significance is the phenomenology of conceptual restructuring itself -- which is *why* high-insight concepts pick up charged names, and why scrubbing the name to boring CS loses nothing real.

## 5. Disposition + composition

- **Backlog candidate (not autonomously filed):** PRs-as-corporate-consensus + git-CRDT-DU-decentralized-decisions as a buildable Bayesian-model architecture. Awaiting operator "file this" per backlog-item-start-gate.
- Composes with existing substrate: **B-0132** (CRDT composition for BFT propagation), **B-0138** (BFT-resistance theorem, Aurora composed CRDT + consensus), **B-0829** (schemas-as-rows / cluster-fork-as-trust-boundary), **B-0864** (streams-are-relationships / four-corner ownership). The decision-CRDT-DU is the governance-layer sibling of the data-layer schemas-as-rows.
- The two-sided naming razor + good-citizen frame are doctrine-grade refinements preserved here, NOT rule-landed (cooling-period). Rule-land on operator authorization.
- Live setting for the distributed stress-test: operator + Max co-reviewing nine of Max's check-ins -- the PR-as-consensus pattern in practice.
