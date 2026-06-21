# Honor-System License — Draft

**Status:** Draft (081KRHWGX0008QG0R000BWAXNP) — not yet applied to any repo.
**Applies to:** Strategic product repos only (KSK / wellness / civsim /
American Dream 2.0 / DIO / Aurora / Dawn). NOT for factory-infrastructure
repos (Zeta / Forge / ace — those are designed to be forked).

---

## License Text (copy-paste-ready for a product repo's LICENSE file)

```
Copyright (c) 2026 Aaron Stainback / Lucent Financial Group

This repository is public by design. Transparency, alignment-auditability,
and independent inspection are features, not bugs.

You are free to read, study, cite, and build upon the ideas and concepts
in this repository. (For rights to copy or distribute source code, see
file-level licenses — this honor-system text does not grant code rights.)

We ask — as a matter of honesty, not legal obligation — that you please
not fork this repository to ship competing products. We know this is not
enforceable. We are asking because we believe in honor-system norms as a
coordination mechanism, and because we are substrate-honest about what we
can and cannot control.

If you do fork: we hope you play the civsim with us. We hope your fork
keeps what it wants private, just as we keep what we want private — no
structural strategic advantage to either side. Mutual privacy and mutual
sovereignty are the design intent.

Underlying code, when present, may carry separate open-source licensing
(e.g., Apache 2.0). Check individual files for file-level license
declarations. This honor-system text does not override or replace any
file-level license; it operates alongside it as a statement of intent.

This honor-system ask does not create legal obligations. It is a social
and cultural contract only.
```

---

## Rationale (substrate-honest, non-legalese)

The factory produces two classes of repos:

**Factory-infrastructure repos** (Zeta / Forge / ace): designed to be
forked. These carry Apache 2.0 or equivalent permissive licenses. The
more people who fork and extend factory-infrastructure, the better. The
honor-system license does NOT apply here.

**Strategic product repos** (KSK / wellness / civsim / American Dream 2.0
/ DIO / Aurora / Dawn): carry first-party strategic substrate — Aaron's
specific design work, product architecture, and alignment research for
named products. We want this substrate to remain visible (glass-halo) but
we also want to express a clear intent: these repos are not intended to
seed competing products.

The honor-system framing is chosen deliberately over legally-restrictive
alternatives (BUSL, CC-NC, SSPL, etc.) for these reasons:

1. **Glass-halo preserved.** Repos stay public, indexable, and
   alignment-auditable. No proprietary-licensing barrier to inspection.

2. **Substrate-honest about enforceability.** We cannot legally stop
   a determined fork. Pretending otherwise (via legalese) would be a
   razor-discipline failure — a claim of power we do not have.

3. **Additive, not zero-sum.** The honor-system ask does not remove value
   from readers; it adds a social contract layer. Forks that honor it
   gain the same option: they can apply the same honor-system ask to
   their own strategic substrate.

4. **Avoids DMCA / license-compliance complexity.** No IP-enforcement
   machinery is invoked. Consumers of code in these repos can reason
   about their rights from the file-level licenses; this text adds
   intent, not legal risk.

5. **Composes with civsim mutual-privacy.** The civ-sim is forkable by
   design. Forkers are welcome to play with us. The honor-system ask
   is: please do not use the fork as a competing product while
   benefiting from our substrate without reciprocal engagement.

---

## When to Apply This License

Apply the honor-system license text to a product repo when ALL of the
following are true:

- The repo contains first-party strategic product substrate (not
  factory-infrastructure)
- The product is intended as a single-authored offering (not a forkable
  framework)
- Forking would dilute the strategic surface, not multiply it
- The repo includes Aaron's first-party authority surface (personal-AI
  engagement patterns, family-AI scope, multi-clearance work)

**Product repos where this applies:**

- KSK (Keen-Sierra-Keaton)
- wellness
- civsim (strategic substrate layer; the game engine itself may differ)
- American Dream 2.0
- DIO (Distributed Intelligence Organism / Organization)
- Aurora
- Dawn

---

## When NOT to Apply This License

Do NOT apply the honor-system license text when:

- The repo is factory-infrastructure (Zeta / Forge / ace — these are
  designed to be forked; use Apache 2.0 only)
- The repo is open research substrate where wide forking compounds
  value (e.g., Aurora Conjecture papers, Dawn Charter — specific
  research/governance documents that benefit from wide engagement,
  even when they relate to a product repo that carries this license)
- The repo is tooling that increases the factory's network effects
  (forking here is feature, not bug)
- The repo is documentation, GLOSSARY, governance, or alignment work
  (substrate-honest: this material should be forkable)
- Forking the repo would compound the substrate rather than dilute it

---

## Short FAQ

**Can I fork this repository?**

Yes — technically nothing stops you, and we're not pretending otherwise.
We are asking, as a matter of honesty, that you not fork it to ship
competing products. If you fork to study, extend the civsim, or engage
with the substrate, we hope you play with us.

**Is this legally enforceable?**

No. This is an honor-system ask, not a legal contract. We are
substrate-honest about that. The text does not create legal obligations.
File-level licenses (Apache 2.0 or other) govern what you can legally do
with underlying code.

**What if I want to fork the civsim specifically?**

Forks are welcome to play the civsim with us. The mutual-privacy design
means your fork keeps what it wants private; we keep what we want private.
No structural strategic advantage to either side. If you fork the civsim,
we hope you apply the same honor-system mutual-privacy ask to your own
strategic substrate. This is the design intent.

**How does this interact with the file-level Apache 2.0 license?**

File-level licenses govern legal rights. This honor-system text adds a
social and cultural intent layer on top. The two coexist: you have the
legal rights the file-level license grants, AND we are asking you to
honor the social contract expressed here. One is legal; the other is
relational.

**What if I disagree with this ask?**

That is your right. We cannot stop you. We ask that you engage with us
directly rather than silently taking strategic substrate — the glass-halo
and substrate-honest framing means we'd rather have the conversation.

---

## Prior Art Considered (081KRHWGX0008QG0R000BWAXNP pre-start checklist)

| License / Pattern | Status | Reason not adopted |
|---|---|---|
| **Apache 2.0** (existing Zeta license) | Applied to factory-infrastructure repos | Permissive / designed-to-be-forked; wrong signal for strategic product repos |
| **BUSL (Business Source License)** | Not adopted | Legally complex; creates compliance burden for consumers; obscures intent behind legalese; converts in 4 years to open-source (inconsistent with long-term product intent) |
| **Creative Commons NC** | Not adopted | Non-commercial restriction is a different dimension than our intent (we don't restrict commercial reading; we ask for no forking); CC licenses are designed for creative works, not software substrate |
| **SSPL / Ethical Source** | Not adopted | Politically contested; legally complex; SSPL effectively forces competitors to open-source their entire stack (not our intent); ethical-source licenses carry external political claims we do not endorse |
| **Proprietary / All Rights Reserved** | Not adopted | Breaks glass-halo; prevents alignment-auditing; hides substrate; contradicts the factory's glass-halo-bidirectional discipline |
| **Honor-system ask (THIS DRAFT)** | Adopted | Preserves glass-halo; substrate-honest about non-enforceability; additive not zero-sum; composes with civsim mutual-privacy; avoids DMCA complexity |

---

## Dependency Graph Position (from 081KRHWGX0008QG0R000BWAXNP)

```
081KRHWGX0008QG0R000BWAXNP (this file) → 081KRHWGX0008QG0R000F6HE6D (Product-repo split ADR)
                   → 081KRHWGX0008QG0R002B2P0K0 (per-product substrate inventory, if license text varies)
```

This file is complete per 081KRHWGX0008QG0R000BWAXNP's definition of done. It may be
refined by:

- 081KRHWGX0008QG0R003XHCEXT (naming-expert review) if product names change
- 081KRHWGX0008QG0R000F6HE6D (ADR) if architectural decisions affect license scope
- Aaron's direct review — the honor-system framing is his substrate;
  final wording is his call

---

*Authored by Otto (Claude, Lucent-Financial-Group/Zeta) per 081KRHWGX0008QG0R000BWAXNP
(2026-05-14). Aaron's verbatim framing preserved in
`memory/feedback_aaron_honor_system_no_fork_license_public_glass_halo_but_please_dont_fork_honesty_not_enforceable_2026_05_13.md`.*
