---
id: 081M00S7Q8P087G0R00044ZN8Q
type: task
state: backlog
priority: P2
slug: propose-manifesto-1-scale-free-annotation-a-software-layer-g
title: "Propose manifesto §1 scale-free annotation: a software-layer guarantee that does not extend to firmware/attestation trust roots"
created: 2026-08-14T18:41:02.742Z
depends_on: []
composes_with: []
---

# Propose manifesto §1 scale-free annotation: a software-layer guarantee that does not extend to firmware/attestation trust roots

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00S7Q8P087G0R00044ZN8Q-*.md` glob. -->

## Why this is a proposal and not a landed edit

Work-item `081M00QP7FB087G0R00031BQ93` (name the vendor root in every attestation claim) scoped a third
item: *"where §1 scale-free is asserted, mark it as a software-layer guarantee that does not extend to
firmware trust roots."* That pass landed the qualification at every **applied** assertion site — the
sovereign-keys ladder, the secure-boot decentralization check, the custody design, the code-bound-key
ladder, the hardware buy list.

It did **not** touch `docs/governance/MANIFESTO.md` §1, which is the *canonical* assertion. Reason:
the manifesto is at **PARTIAL LOCK** and is named as "the canonical surface for any change," and §1 is
verbatim V1 prose rather than a `[RECONSTRUCTION NOTE]` section. Annotating a normative, locked
governance spec is **extending** authority, not inheriting it (`.claude/rules/no-directives.md` —
the shadow inherits standing authority, never extends it into a gated class). So it is filed here for
a human call rather than applied.

## The proposed annotation (for ratification, not yet applied)

§1 currently reads:

> We reject systems that contain central points of control, coordination, or failure. A system is only
> acceptable if its fundamental behavior and structure remain coherent whether it runs on one machine
> or across thousands.

The observation: **§1 holds at the software layer and cannot extend to the metal.** Every hardware
attestation Zeta can offer terminates in a silicon vendor's self-signed root (AMD ARK · Intel SGX Root
CA · NVIDIA's device CA · the TPM manufacturer's EK root · AWS Nitro's PKI), and every node's firmware
trust root is held by the OEM that shipped its board. A node that attests has a central point of
*trust* by construction, no matter how decentralized the software above it is.

Suggested shape (a scope clause, not a weakening):

> §1 is a guarantee about **the system we build**. It does not extend to firmware and silicon trust
> roots, which are vendor-held and have no vendor-independent alternative. Where a design depends on
> hardware attestation, name the root at the claim and prefer vendor diversity so that no single root
> is every node's.

## Boundary — do not overcorrect

This is a **cap**, not a refutation. Vendor-rooted attestation is far stronger than none and is what
every serious system uses; the ask is accuracy, not abandonment. An inflated denial would be as wrong
as an inflated claim.

## Also for the same call

`.claude/rules/manifesto-13-specifications.md` mirrors §1 in the auto-loaded rule set. If the manifesto
annotation is ratified, that rule's §1 line is the second site — and it is a cold-start-token surface,
so any addition there should be a clause, not a paragraph
(`.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`).

## Anchor

- `docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-…md` §5.4 (§1 capped by OEM Platform
  Keys and vendor attestation roots) — the finding.
- `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-…md` §"Vendor roots cap every
  attestation claim" — the landed treatment, including the CHECKED source list.
- `081M00QP7FB087G0R00031BQ93` — the parent naming pass.
