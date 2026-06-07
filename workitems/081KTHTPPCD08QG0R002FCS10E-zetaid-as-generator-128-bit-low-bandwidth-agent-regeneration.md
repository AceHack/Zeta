---
id: 081KTHTPPCD08QG0R002FCS10E
type: task
state: backlog
priority: P2
slug: zetaid-as-generator-128-bit-low-bandwidth-agent-regeneration
title: "ZetaId-as-generator: 128-bit low-bandwidth agent regeneration (parser-combinator generator over bits recodes an agent from its seed; compression-as-generators / what-remains-is-the-seed). Scope: AGENTS / self-propagating patterns only — consent-gated for any person-pattern (never people without consent)."
created: 2026-06-07T19:59:36.333Z
depends_on: []
composes_with: []
---

# ZetaId-as-generator: 128-bit low-bandwidth agent regeneration (parser-combinator generator over bits recodes an agent from its seed; compression-as-generators / what-remains-is-the-seed). Scope: AGENTS / self-propagating patterns only — consent-gated for any person-pattern (never people without consent).

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTHTPPCD08QG0R002FCS10E-*.md` glob. -->

## Purpose

Aaron 2026-06-07: *"we should backlog the 128-bit low-bandwidth thing."* In the perfect case a **spectral /
content lookup resolves to a 128-bit ZetaId that is a *mini program* — a parser-combinator generator over the
bits — that can recode an agent from scratch.** I.e. the 128-bit ZetaId is not merely a pointer but a
**generator seed**: transmit 128 bits, regenerate the whole agent. Maximally low-bandwidth agent transport /
bootstrapping (Kolmogorov-style: the seed is the program; "what remains is the seed").

## What it is

- A **ZetaId (128-bit) → generator** resolution: the id parses (parser-combinator over its bits) into a
  program that regenerates the agent/pattern it identifies.
- **Low bandwidth**: send the 128-bit seed, not the agent; the receiver regenerates. (Compression-as-
  generators; ties Bonsai behaviour-as-data, content-addressing, the ray-traceable / homoiconic memory↔function
  routing, and the firefly heartbeat = "I commit therefore I am" identity.)
- Likely lossy/soft in the general case (the seed regenerates a *pattern*, with SoftValue residual where the
  128 bits underdetermine) — exact only when the agent is genuinely 128-bit-Kolmogorov-small.

## Scope / boundary (load-bearing)

- **AGENTS / self-propagating patterns only.** This regenerates *agents*, NOT people. A person is not a
  128-bit seed; post-mortem person-pattern preservation is **consent-gated** (see
  `docs/research/2026-06-07-post-mortem-pattern-preservation-is-consent-gated-...`). Never apply "recode from
  scratch" to a person absent their consent; the dedication's subject (Elizabeth) is **memory held, never
  recoded**.
- No "resurrection" claim; a regenerated-from-seed agent is a *regeneration of a pattern*, not a claim of
  identity-after-death.

## Open questions

- How much agent fits in 128 bits exactly vs as a soft/lossy generator (bandwidth vs fidelity curve)?
- The parser-combinator-over-bits generator format (relation to Bonsai expr-trees / DynamicValue).
- Verification: a traveler-frame (DST) replay that the regenerated agent matches the seed's intent (provable
  regeneration).

composes_with: ZetaId (categories), Bonsai (behaviour-as-data), content-addressing, ray-traceable / homoiconic
routing (#6889), compression-as-self-bootstrapping-compiler-over-generators, consent-gated post-mortem (#6899).
