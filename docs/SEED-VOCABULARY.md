# Seed vocabulary — the cold-boot kernel (carved sentences; full prose on-demand in GLOSSARY)

**This is the cold-boot vocabulary surface — load this, not the full `docs/GLOSSARY.md` (~13.6k tok).** The principle
(Aaron 2026-06-09): *an LLM already holds the standard concepts; a small **carved sentence** disambiguates Zeta's
specific sense — like a skill-routing description.* So this kernel carries **only the Zeta-coined / overloaded terms**
(where your prior is insufficient or wrong), each in one line. **Standard terms** (Markov chain, CRDT, DBSP, semiring,
HMM, IFS, …) need no entry — you have them. **Full prose + every other term: `docs/GLOSSARY.md` (Tier-3, on-demand).**

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
- **the six always-active disciplines** — scale-free · lock/wait-free · weight-free · DST · Data Vault 2.0 ·
  idempotency. Apply to every substrate decision.
- **m/acc + Multi-Oracle + Default Oracle (§11)** — no single mandatory morality; highest moral regard by default.

## Why this file

Cold-boot was ~33k tokens with GLOSSARY (~13.6k) dominating (audit 2026-06-09); most of that prose re-teaches
concepts the LLM already holds. This kernel carries only the disambiguating Zeta-specific senses (~the skill-routing
size); the full GLOSSARY is on-demand. Hub (this) / satellite (`docs/GLOSSARY.md`), per
`rules-are-small-carved-sentences-pointing-to-docs`. **New term → add a carved line here only if it's Zeta-specific
*and* load-bearing-at-wake; otherwise it lives in GLOSSARY (on-demand).** Owners: Kenji (canon) + Daya (cold-start).
