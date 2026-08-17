---
id: 081M00VJGAV087G0R00393F6X5
type: task
state: backlog
priority: P2
slug: self-fabricated-tkey-become-our-own-vendor-provisioning-path
title: "Self-fabricated TKey: become-our-own-vendor provisioning path (UDS + tkey-verification fork)"
created: 2026-08-14T19:21:53.243Z
depends_on: []
composes_with: []
---

# Self-fabricated TKey: become-our-own-vendor provisioning path (UDS + tkey-verification fork)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VJGAV087G0R00393F6X5-*.md` glob. -->

## What

Stand up the "we are the vendor" half of a self-provisioned Tillitis TKey, so a device we
flash (or fabricate) has a working **authenticity** root instead of only a self-rooted
**integrity** root.

Grounded in the survey
`docs/research/2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md` §1.

The design already anticipates this. `tkey-verification`'s README:

> "If your TKey wasn't provisioned by Tillitis, and instead by another 'vendor' like your IT
> department, you will need to run **their** version of the `tkey-verification` program
> instead of this one."

So the vendor role is a **parameter**, not a fixed party. Self-fabrication does not delete the
vendor root; it relocates it to us.

## Scope

1. Buy 2x TKey Unlocked + 1x TP1 programmer (~$238; see `docs/inventory/hardware-to-buy.md` Tier 2).
2. Build `application_fpga` from source with the open flow (yosys / nextpnr-ice40 / icestorm).
3. Generate our own UDS air-gapped; inject via NVCM (`pynvcm`) — **never printed, never logged**.
4. Run our own `tkey-verification` vendor instance; publish signatures to a transparency log
   (Tillitis uses Sigsum).
5. Document precisely what a third party can and cannot conclude from our attestation.

## Non-goals / guards

- **No agent holds a signing key.** The agent may execute setup; a human approves each sensitive
  gate via biometric ("nothing operator-run, only operator-approved").
- No key material printed or logged, at any verbosity.
- This does **not** replace the YubiKeys for attestation-gated relying parties (FIDO MDS requires
  certification: $6,000-$13,500 per implementation). Additive only.

## Done when

- A device we provisioned verifies against **our** vendor instance, and the doc states plainly
  that no stranger can verify it — that being the accepted, correct cost.

## Progress — 2026-08-17: the model landed, no hardware was touched

**State stays `backlog`.** Scope items 1–4 are physical and **entirely unexercised**: no TKey, no
TP-1 programmer, no fabricated board, no NVCM write, no signature, no transparency-log submission.
Nothing has been provisioned, attested, sealed, or signed.

What landed is the half that needs neither hardware nor an undecided policy:

- `src/Core.TypeScript/algebra/self-vendored-provisioning.ts` — the ceremony order and, more to the
  point, **its refusals**: out-of-order steps, unnamed approver on an irreversible step, undecided
  root custody at the signing gate, a missing or blank UDS commitment, a second NVCM burn, and a
  record carrying a field *named* like key material. Plus `deferenceReading`, which reports the
  oracle-vs-hub shape as a neutral fact, and a per-step honesty ledger marking every physical step
  unexercised.
- `src/Core.TypeScript/algebra/vendor-trust-root.ts` — `"self-vendored"` added as a **separate**
  authority. Before it, a root we hold ourselves came back as `"unlisted"`, which reads as
  *third-party provenance we did not check* when in fact **no third party exists**. Those are
  opposite epistemic situations and they no longer share a label.

Falsifiers: 19 mutations applied one at a time, **19/19 killed**, every restore re-verified green.

### Scope item 5 is partly answered, in code rather than prose

`describeSelfVendoredAssurance` is the sentence — it never says "genuine", and it carries Tillitis'
own ceiling (identity sameness is not proof of no tampering).

### Blocked on maintainer decisions — three, not chosen here

1. **Who holds the vendor root.** `VendorRootCustody` defaults to `"undecided"` and **fails closed**
   at the signing gate. `single-operator-held` / `threshold-shares` / `hardware-token-held` are
   listed as vocabulary, not as a recommendation.
2. **Single root or plural.** A self-vendored root that is the only thing able to answer
   "is this device ours?" is a **single mandatory trust authority** — a hub under the exit test, and
   it stays one because it is *ours*. The model reports this rather than arguing it away. Accepting
   it, or requiring k independently-held roots, is a decision this work does not make.
3. **The approval mechanism.** The model requires a *named approver* for irreversible and
   root-exercising steps; it deliberately does **not** name biometric or any other mechanism.
   The non-goal above says "biometric" — that is recorded as the maintainer's stated preference,
   not hardcoded, because choosing the mechanism would be extending authority rather than
   inheriting it.

### Named gap, not closed

The secret-shaped-field guard refuses a record whose *field name* looks like key material at one
boundary. It does **not** prove a UDS was never printed, logged, or written to disk by a
provisioning script. That end-to-end property has no check and is unclosed.
