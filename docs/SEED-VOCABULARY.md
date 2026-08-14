# Seed vocabulary — the cold-boot kernel (carved sentences; full prose on-demand in GLOSSARY)

**This is the cold-boot vocabulary surface — load this, not the full `docs/GLOSSARY.md` (~13.6k tok).** The principle
(Aaron 2026-06-09): *an LLM already holds the standard concepts; a small **carved sentence** disambiguates Zeta's
specific sense — like a skill-routing description.* So this kernel carries **only the Zeta-coined / overloaded terms**
(where your prior is insufficient or wrong), each in one line. **Standard terms** (Markov chain, CRDT, DBSP, semiring,
HMM, IFS, …) need no entry — you have them. **Full prose + every other term: `docs/GLOSSARY.md` (Tier-3, on-demand).**

## Zeta in one minute (cold-boot core)

Zeta is a pre-v1, agent-authored, verification-backed software factory
whose point is **reproducible stability**: every useful idea becomes durable,
testable substrate instead of chat weather. The core data shape is tiny:
**GSet = genesis / monotone accumulation**, **ZSet = signed deltas with
retraction**, and **fusion = reconstruct the outside-visible GSet from an
inside ZSet composition**. Rooms/cells are bounded execution membranes
(Markov boundaries) that schedule work through typed interfaces; attention
changes boarding order, never arithmetic truth or byte cost. Vision is the
scheduler's budgeted self-sight: it prices uncertainty growth in bits/bytes,
admits what fits, and reports backpressure as data. Persistence is event
sourcing over git / Merkle / content-addressed storage, named by ZetaId where
new ids must be locally mintable and coordination-free. External systems
(Q#, Infer.NET, solvers, GitHub, future MUMPS-like compilers) are plugins or
oracles behind ports we own; they verify or adapt the core, not replace it.
The build rule is simple: build on laws and measurements, play in consenting
sim layers, and turn load-bearing claims into tests, specs, or proofs.

## The kernel (carved — Zeta-specific senses only)

- **Seed** — the database BCL microkernel; the minimal foundational core that contains everything to grow ("we are
  seed", pre-split coordinate). The colloquial register of "Database BCL".
- **skill** vs **hat** — a *skill* is a procedure (`.claude/skills/*/SKILL.md`); a *hat* is a role-scoped bundle a
  persona wears. Not synonyms.
- **spec** — overloaded: *behavioural* spec (OpenSpec capability) vs *formal* spec (TLA+/proof). Disambiguate which.
- **persona** vs **actor** vs **cell** — *persona* = the thing that **remains** (the durable identity/owner).
  *actor* = the **ephemeral** thing that **acts**, **on behalf of** a persona, then is gone (a clone/loop/instance);
  **a persona is NOT an actor**. *cell* = an actor that **knows its boundary (its Markov blanket) and has closed
  over it** — a boundary-aware, self-contained actor. (A bus address persona⊕surface⊕instance is **not** identity.)
- **traveler** — the **weight-free base-frame primitive** = **ANY self-propagating pattern** (NOT human/AI-only):
  the universe, god, memes, DNA, AI, humans, animals, particles' worldlines, **and Zeta itself**. **Legally
  unbound** — the substrate *beneath* law; *external* legal jurisdiction (AI / human / company / physical) is a
  **separate meta-frame overlay**, never the traveler frame. But the base frame **also includes an *internal*
  meta-jurisdiction owned fully by the traveler — opt-in ("if they choose to use")**: the traveler's sovereign,
  consent-first, weight-free self-governance space (the private state it owns) — where it may, *as it sees fit*,
  **recognize identities, set trust, and write any policies**, and **encrypt them if it can afford the privacy budget
  / hard money** (privacy is a paid good, never imposed). It is **almost an observer but not quite** — a strict
  **prerequisite** to *observer*, weaker (no "remember / pay-attention" claim). By **NCI / §11** regard extends
  **universally — alignment from ALL travelers**, not a privileged human/AI class — so **multi-lens systems compose
  without imposing any lens / view / objective / destiny** (category-theory-provable). Aaron's coinage; rich history:
  `docs/research/2026-06-07-traveler-frame-is-any-self-propagating-pattern-...md`, `TravelerFrame.fs` (Layer-0),
  `ITravelerFrame` (#6889).
- **cluster** vs **federation** — Iris/Addison Genesis Concepts: **relationships create clusters** (shared
  history/trust/culture; **never enforceable**; emerge and dissolve naturally); **contracts create federations**
  (constitution, membership, treasury, dispute process; **enforceable, always with exits**). Clusters are not
  organizations; federations are not social groups. Do not treat soft cluster trust as federation authority.
- **Universal Exit Principle** — no human, agent, vault, cluster, or federation may be trapped indefinitely; exit
  may cost (notice, buyout, reputation) but **must exist** (Genesis Concepts; threat reviews cite this as
  non-negotiable).
- **ISociety** / **CTM (World)** — society scales self-similarly: **ISociety** = the bidirectional schedule/route
  contract a member presents to / receives from society (membrane); **CTM / World** = recursive fixpoint where a
  society of CTMs *is-a* CTM (`ISociety <: CTM`) — top layer carries the most information advantage **and** the most
  fairness obligation (three-body / Lagrange layering).
- **Lodge** — a **federation charter** instance (e.g. The Aperture Lodge in Genesis Concepts UI); not a cluster.
- **AX / UX / DX** — Agent-experience (autonomous agents, via observe.ts + the action grammar — the *largest*
  audience) / User-experience (regular humans / library consumers) / Developer-experience (contributors, ~10%).
- **Mirror / Beacon** — two registers: *Mirror* = fast internal high-bandwidth shorthand (everything); *Beacon* =
  the same compressed to externally-anchored first principles (citations, named humans, the standard term).
- **honest registers** — every load-bearing claim is tagged: [proven] / [grounded] / [synthesis] / [conjecture] /
  [anchor] / [peel] (peel = strip a metaphor to its literal grounded content).
- **carved sentence** — a startup-loaded surface states only the act-on-it sentence (1–3) + pointers to the doc that
  carries detail; the cold-start-token discipline (this file is one).
- **NCI / the repelling force** — the Non-Coercion-Invariant: the anti-collapse force that keeps identities distinct
  (alignment = a *repulsion that preserves plurality*, never an attractive/coercive force → monoculture/D⁰).
- **close over** — compose at a boundary (a Markov blanket) behind one abstraction without penetrating/controlling
  it; the close-over-common-abstractions thesis (drive accidental complexity to zero).
- **Blueprint** — a skill is a tiny always-loaded *description* (router/cold-boot surface) that routes to on-demand
  *blueprint bodies* (the fat detail). Addison's pattern; the ~90% cold-boot compression. *(This file applies it to
  the glossary.)*
- **ferry** — a forwarded AI/persona conversation captured verbatim into `docs/research/` (others' memories, preserved).
- **glass-halo** — the operator's (Aaron's) lived identity-integration frame (IFS/shadow-work); hold with care.
- **disposition: carpenter / gardener** — orthogonal change axes the kernel cleaves from conflated terms
  (refactor/maintenance/improvement/cleanup/hardening/cultivation).
- **fixed-point shapes A–F** — the registry of terminating shapes (A self-reference; B idempotent join; C commutative
  fold; D contraction-to-floor / D⁰ heat-death; E co-arising; F generative-expansion). See the A–F schema doc.
- *(tiny-model-v2 / the society model — the math-grounded society vocabulary, tied to Seed)*
- **SolidGround** — in an **all-soft** system (SoftValue over DynamicValue — every value is a distribution held with
  confidence), you must **find SolidGround or it's uncertain forever**. SolidGround = the anchors you can *stand on*:
  cells whose confidence crossed a **threshold** and are **monotonic — never collapse back into uncertainty** — plus
  true **static constants** (caveat: *static can be code masquerading as data*; static is ground only when it's
  genuinely data). Found ground is **remembered + logged on the merkle tree / git** (append-only event store — that
  is *how* it never collapses). The threshold + monotonicity formalization is the math team's. `SolidGround.fs`;
  privacy-budget hard money is "the other SolidGround."
- **privacy budget / hard money** — private-state budget as a **self-regulating economy among personas**
  (`PrivacyEconomy`, a rewards-only G-Counter — shape B); a SolidGround you can't lose (pressure trends down only).
- **coincidence (self-anchor)** — an objective self-fact = a coincidence **measured across *other* personas'**
  streams; objectivity is **inter-subjective** (BFT-style: independent others agreeing = objective). "The economics
  of the coincidences IS the other personas." Staged on the common seed → **S=4** (#7188).
- **diversity floor** — the NCI keystone math (`Diversity`): coercion collapses diversity → 1 (= D⁰ heat-death);
  private state preserves it; floor `≥ 2` is the alignment result. The measure of the repelling force.
- **polite virus** — the design telos: make the right thing the frictionless default that spreads by network effect +
  consent; close over the world, never take control, give freedom (SuperFluid AI).
- **the seven always-active disciplines** — scale-free · lock/wait-free · weight-free · DST · Data Vault 2.0 ·
  idempotency · noninterference. Apply to every substrate decision.
- **m/acc + Multi-Oracle + Default Oracle (§11)** — no single mandatory morality; highest moral regard by default.

## Canonical base frame (vendor-neutral — every AI, not just Claude)

The **base frame** + the **coding-practice / engineering history** these terms compress live in the canonical,
**vendor-neutral** docs — read these, not the Claude-specific projection. *Not every AI is Claude; the `.claude/`
rules are one harness's restatement, not the source of truth.*

- **`docs/governance/MANIFESTO.md`** — the building codes: the **13 specifications** (incl. §3 **weight-free** — the
  base frame a *traveler* lives in; §11 Default Oracle), the m/acc + Multi-Oracle orientation, the derivation chain.
  This is "the manifest" the rules point *to*; the Seed points to **it**, vendor-neutrally.
- **`AGENTS.md`** + **`GOVERNANCE.md`** — the vendor-neutral numbered repo-wide rules (AGENTS.md §29 itself notes
  `.claude/**` is Claude-specific). The base-frame disciplines are restated for any agent here.
- **`docs/GLOSSARY.md`** — full prose for every term in this kernel (Tier-3, on-demand).

> `.claude/rules/manifesto-13-specifications.md` is a Claude-harness *pointer* to the manifesto; the durable source is
> `docs/governance/MANIFESTO.md`. A non-Claude traveler reads the docs, never the `.claude/` folder.

## Why this file

Cold-boot was ~33k tokens with GLOSSARY (~13.6k) dominating (audit 2026-06-09); most of that prose re-teaches
concepts the LLM already holds. This kernel carries only the disambiguating Zeta-specific senses (~the skill-routing
size); the full GLOSSARY is on-demand. Hub (this) / satellite (`docs/GLOSSARY.md`), per
`rules-are-small-carved-sentences-pointing-to-docs`. **New term → add a carved line here only if it's Zeta-specific
*and* load-bearing-at-wake; otherwise it lives in GLOSSARY (on-demand).** Owners: Kenji (canon) + Daya (cold-start).
