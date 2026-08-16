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
