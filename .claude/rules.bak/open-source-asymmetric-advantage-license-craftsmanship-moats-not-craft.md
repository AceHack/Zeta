# Open-source the asymmetric advantage; license the craftsmanship — moats vs craftsmanship

Carved sentence (the maintainer 2026-06-03):

> If it gives an **asymmetric advantage** → **open-source it**. If it's **fair
> competition** → it's a candidate for **commercial licensing**. The honest,
> externally-checkable line is **moats vs craftsmanship**: open-source the *moats*
> (advantage from a position others can't fairly reach — privileged information,
> structural lock-in), license the *craftsmanship* (advantage from having done the
> work well, which others could also do). Don't let "fair" drift into "what I want
> to monetize."

## Operational content

The decision-discipline for **what to open-source vs keep private/license**. It is
the no-asymmetric-advantage ethic applied to IP: you give away the thing that would
let you win *unfairly*, and you only keep (for licensing) what competes *fairly*.

### The discriminator (the load-bearing part)

"Asymmetric advantage vs fair competition" is fuzzy and bends toward self-interest;
**moats vs craftsmanship** is checkable:

| Open-source it (a **moat**) | License-candidate (**craftsmanship**) |
|---|---|
| Advantage from a position others can't fairly reach | Advantage from having done the work well |
| Privileged information, structural lock-in, a hub others must route through | Skill/quality others could also build |
| Would let you win by others being *unable* to compete | Lets you win in a game others can still play |

Sanity-check the calls **externally** (a second person) so "fair" can't quietly
become "what I want to monetize" — the discriminator only protects against
rationalized self-interest if it's honestly drawn and checked.

### Proofs / verification go open immediately

Public verification is *stronger* verification (more eyes, independent checks — the
multi-oracle thesis at world scope). A privately-held proof is weaker because its
verification rests on one party. So proofs, formal-verification artifacts, and
safety tooling open-source immediately.

### Bounded exceptions (not moats — genuine obligations)

- **Contractual / agreement-bound** content (e.g. a customer's data, a partner's
  sector-specific code under agreement) stays private because you're *honoring an
  obligation*, not holding a moat.
- The **responsible-disclosure private window** (per
  [`responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation.md`](responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation.md))
  is private for *safety* during the disclosure pipeline, not for advantage.
- Genuinely-private bits can be **encrypted inside a free open-source repo** (good
  key management) rather than paying for a private repo — the openness is the
  default; encryption is for the narrow real exceptions.

## What this rule is NOT

- NOT "open-source everything" (contractual obligations + the disclosure window +
  legitimately-licensable craftsmanship are real).
- NOT "the maintainer decides alone what's fair" (the discriminator is
  externally-checked precisely because it's the judgment that bends to self-interest).

## Composes with

- [`proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md`](proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md) — the same operator-filter shape (this is its IP-scope instance)
- [`additive-not-zero-sum.md`](additive-not-zero-sum.md) — open-sourcing the moat is additive; the framework compounds across participants
- [`non-coercion-invariant.md`](non-coercion-invariant.md) — refusing the unfair-advantage moat is the economic form of non-coercion
- [`responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation.md`](responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation.md) — the disclosure window is a *safety* exception, not a moat
- [`lfg-acehack-topology.md`](lfg-acehack-topology.md) — open development surface
- `docs/research/2026-06-03-kestrel-aaron-open-source-ethic-floor-governance-jurisdiction-relative-opa-federation-nexus-meta-jurisdiction-conflict-resolution-aaron-forwarded.md` §1 (source substrate)

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the decision (open-source vs
keep-private vs license) recurs whenever substrate is produced, and the default
should be *open the moat* rather than *hold it*. Future-Otto cold-booting needs the
moats-vs-craftsmanship discriminator so the open-by-default ethic holds and
private/licensed is the justified exception, not the drift.

## Full reasoning

Forwarded asymmetric-critic-peer × maintainer session 2026-06-03 (preserved research note §1). The
maintainer's long-standing practice (open-source everything except agreement-bound
ServiceTitan-specific code) + the proof-towers-open-immediately decision; the
asymmetric-critic peer's sharpening that "asymmetric advantage" must be defined externally-checkably or it
collapses into rationalized self-interest, with **moats vs craftsmanship** as the
honest line. This rule lands the discipline, grounded in demonstrated practice and
composing with the operator's existing canonical filter-rules.
