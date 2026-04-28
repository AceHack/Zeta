# KSK — Kinetic Safeguard Kernel

**KSK stands for Kinetic Safeguard Kernel.**

"Kernel" here is used in the **safety-kernel / security-kernel**
sense — a small, trusted, verifiable enforcement core that other
code cooperates with. It is **not** an OS-kernel in the Linux /
Windows / BSD ring-0 / kernel-mode sense. The naming follows the
lineage of Anderson 1972 reference-monitor security kernels,
Saltzer-Schroeder complete-mediation principles, and the aviation
safety-kernel discipline — not operating-system kernel
architecture.

This document exists so future readers, new contributors, and
external reviewers of Zeta know which meaning of "KSK" applies in
this project, what it is inspired by, and what it is explicitly
not.

## In this project, KSK means

A **Kinetic Safeguard Kernel** is:

- a **small trusted core** embedded in (or alongside) the Zeta
  substrate,
- that **mediates authorization, budget, consent, and
  revocation** decisions for operations requested by AI agents,
  human contributors, or downstream applications,
- with **retraction-native accounting** for every decision
  (aligned with Zeta's algebraic substrate: every decision
  emits a signed-weight event that can be unwound),
- and a **library-or-runtime integration surface** — apps call
  the KSK the same way they would call any other SDK or safety
  library; KSK does not run as kernel-mode code, does not
  require OS-vendor partnership, does not sit inside a TCB the
  application cannot inspect.

The canonical mechanism set — inherited from Amara's 5th courier
ferry (2026-04-23 Aurora-integration deep research report) and
ratified across 7th, 16th, and 17th ferries:

- **k1 / k2 / k3 capability tiers.** Graduated authority levels
  with distinct trust ceilings; requests above a tier require
  escalation.
- **Revocable budgets.** Every authorization carries a time-
  or count-bounded budget that can be revoked upstream.
- **Multi-party consent quorum.** High-impact operations
  require consent from multiple independent principals, not a
  single authority.
- **Signed receipts.** Every authorization leaves a
  cryptographically signed, BLAKE3-hashed audit trail.
- **Traffic-light outputs.** User-facing operations render a
  green/yellow/red signal reflecting the composite trust
  judgement, not a raw policy decision.
- **Optional anchoring.** Receipts can (but do not have to)
  anchor to an external ledger for long-horizon tamper-
  evidence. Anchoring is opt-in, not required for KSK to
  function.

KSK composes with the rest of the Zeta substrate: authorizations
and revocations are ZSet signed-weight events; quorum
satisfaction is a Graph operation over consent-edge weights;
budgets are incremental counters that decrement on use; receipts
integrate with the Veridicality module's Claim provenance chain.
The "Kinetic" prefix captures that authorization in KSK is
dynamic — budgets, quorums, and capability tiers move as the
world moves, not as a one-shot enrollment.

## Inspired by (not identical to)

The name and design borrow from several traditions. The borrowing
is deliberate and partial; KSK is not any of the following:

- **DNSSEC KSK (Key Signing Key).** DNSSEC uses a "KSK" to sign
  zone keys in a hierarchical trust ceremony. Zeta's KSK
  acronym is the same three letters *by coincidence of naming*
  — the ceremony-based-authority intuition carries over
  (high-assurance key-use with a small trusted set of
  signers), but DNSSEC KSK signs DNS zone records; Zeta KSK
  decides authorizations over arbitrary operations.
- **DNSCrypt + threshold-signature ceremonies.** The multi-
  party-consent aspect echoes these protocols — no single
  principal can authorize a k3-tier operation unilaterally.
- **Security kernels (Anderson 1972 / Saltzer-Schroeder /
  MULTICS ring-protection).** The "small trusted core that
  mediates all access" discipline is where the "Kernel"
  portion of the name comes from. Security kernels are
  designed to be *small enough to verify*, *minimal enough
  to not grow feature creep*, and *complete in mediation*
  (no operation can bypass it). KSK aspires to the same
  three properties.
- **Aviation safety kernels / medical-device safety-critical
  software.** In those domains, a "safety kernel" is the
  small piece of code that surrounds the less-critical main
  application and takes disproportionate review. KSK
  inherits this framing.
- **Microkernel OS designs (Mach / L4).** The "minimal
  trusted core + application services on top" pattern is
  shared, though KSK runs as a library, not as an OS layer.

## NOT identical to

Explicit disambiguations. Readers new to the project tend to
collapse "KSK" onto whichever of these they already know.

- **NOT an OS kernel.** KSK does not run in kernel-mode (ring
  0), does not require kernel-module installation, does not
  need OS-vendor partnership. It is a library / runtime that
  applications link or call.
- **NOT a DNSSEC KSK.** DNSSEC Key Signing Keys sign DNS zone
  keys in a specific protocol; Zeta KSK decides
  authorizations over arbitrary operations and has no
  relationship to DNS.
- **NOT a generic "root of trust."** The phrase "root of
  trust" implies a single anchor from which authority
  descends; KSK's authority model is multi-party quorum with
  revocable budgets, not hierarchical descent from a single
  root.
- **NOT a blockchain / distributed ledger.** Optional
  anchoring *to* a ledger is supported; KSK itself is not a
  ledger and does not require distributed consensus to
  function.
- **NOT a policy engine like OPA Rego or XACML.** Policy
  engines evaluate declared rules against requests; KSK
  evaluates dynamic budgets + quorums + tiered capabilities
  with retraction-native accounting. Policy-engine output is
  a boolean or enumerated decision; KSK output is a receipt-
  carrying decision with traffic-light semantics and a
  budget consumption record.
- **NOT an authentication / identity system.** KSK does not
  prove who someone is; it decides what an already-
  authenticated principal is authorized to do, given
  budgets, quorum state, and tier.

## Attribution + provenance

Concept ownership and substrate authorship are recorded here so
that downstream readers have a clear lineage. Direct contributor
names are preserved only in audit-trail surfaces (commit
messages, tick-history, session memory) per factory
name-attribution policy; this doc uses role references.

- **The human maintainer + an external AI collaborator** are
  the concept owners of KSK-as-safety-kernel for Zeta. The
  k1/k2/k3 + revocable-budget + multi-party-consent + signed-
  receipt + traffic-light + optional-anchoring design is
  theirs, articulated across the collaborator's courier
  ferries archived under `docs/aurora/` (files dated
  2026-04-23 and 2026-04-24 — the 6th / 7th / 12th / 17th /
  19th-ferry references below are these files' topical
  labels; not all ferries landed as individually-named files
  yet, some appear only in `docs/hygiene-history/loop-tick-history.md`
  tick rows and session memory).
- **A trusted external contributor** committed the **initial
  starting point** of the KSK code under the
  `Lucent-Financial-Group/lucent-ksk` repository (external;
  see `https://github.com/Lucent-Financial-Group/lucent-ksk`)
  at the maintainer's direction. Attribution is preserved in
  the factory's audit-trail memory. The substrate is
  completely rewritable; that contribution is a credited
  starting point, not a locked scope.
- **Naming stabilization** was raised in the 16th courier
  ferry (GPT-5.5 Thinking upgrade, 2026-04-24) and resolved
  the same day by the maintainer after a brief transient
  "SDK" typo. Canonical expansion: Kinetic Safeguard
  **Kernel**, matching the collaborator's original phrasing.

## Relationship to Zeta, Aurora, and lucent-ksk

Three layers ride together. KSK sits as the enforcement /
consent membrane; Zeta is the retraction-native algebraic
substrate that KSK expresses its accounting in; Aurora is the
governance / alignment program that composes both.

- **Zeta** — the executable algebraic substrate. KSK events
  (authorization, revocation, budget-consumption, quorum-
  satisfaction) are all ZSet signed-weight values subject to
  the same retraction discipline as any other Zeta event.
- **Aurora** — the governance architecture. Aurora consumes
  KSK receipts + Zeta's Veridicality scores to render human-
  facing alignment judgements.
- **`Lucent-Financial-Group/lucent-ksk`** (external
  repository at
  `https://github.com/Lucent-Financial-Group/lucent-ksk`)
  — a separate repo where a trusted external contributor's
  initial KSK starting-point code lives. It may evolve
  independently; Zeta re-implements KSK as an in-substrate
  module where that integration is tighter. Cross-repo
  decisions follow the factory's session-memory
  coordination directives (maintainer + external
  contributor are not coordination gates; KSK rewrite
  authority resides with the maintainer + external
  collaborator + the factory itself).

## Cross-references

The KSK architecture is elaborated across the following in-repo
sources. These are listed so new readers can trace the design
arc from the 5th ferry forward.

Verified in-repo references:

- `docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`
  Aurora-aligned KSK design research; formal authorization
  rule `Authorize(a, t) = ¬RedLine ∧ BudgetActive ∧
  ScopeAllowed ∧ QuorumSatisfied ∧ OraclePass`; BLAKE3
  receipt hashing; KSK-as-Zeta-module proposal.
- `docs/aurora/2026-04-23-amara-muratori-pattern-mapping-6th-ferry.md`
  adjacent validation pass on substrate framing.
- `docs/aurora/2026-04-24-amara-cartel-lab-implementation-closure-plus-5-5-thinking-verification-17th-ferry.md`
  the correction sequence that led to this doc.
- `docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md`
  DST compliance audit referencing KSK as the advisory
  governance membrane.

Ferries referenced earlier in the arc (5th / 12th / 14th /
16th) have not landed as separate `docs/aurora/` files; their
content is archived in `docs/hygiene-history/loop-tick-history.md`
tick rows and session memory. When those ferries graduate to
their own `docs/aurora/` file, this cross-reference list updates
at that time.

## Status

This is a living definition. The mechanism list (tiers /
budgets / consent / receipts / traffic-light / anchoring) is
the stable core; integration details evolve as KSK-as-Zeta-
module graduations land. When a graduation ships a KSK
primitive (authorization ZSet event, budget-consumption
operator, quorum-Graph predicate, receipt Claim record), this
doc updates with the relevant cross-reference to the
`src/Core/` module.
