---
id: 081M0DJQ7AS087G0R001EDAAWN
type: task
state: backlog
priority: P1
slug: put-opaque-is-transitively-attestation-issuer-write-split-th
title: "put-opaque is transitively attestation-issuer-write: split the capability or pin the template"
created: 2026-08-19T17:57:18.297Z
depends_on: []
composes_with: []
---

# put-opaque is transitively attestation-issuer-write: split the capability or pin the template

**Owner:** Aminata (finding) → HSM provisioning design.
**Class:** Elevation of privilege / least privilege.
**Severity (SDL bug bar):** High if the issuer-DN discriminator (work item
`081M0DJQ28W087G0R003WZQ7KR`) returns COPY; Medium if it returns SYNTHESIZE — the
capability composition is real either way, only its payload changes.

## The finding

Three measured facts from
`docs/research/2026-08-19-what-the-yubihsm-2-firmware-parses-*.md`:

- The object namespace is **`(id, type)`, not `id`** — an `asymmetric-key` and an
  `opaque` object coexist at the same ID (METERED, §1e).
- Custom attestation reads the `opaque-x509-certificate` **stored at the same
  object ID** as the attesting key and uses it as a template (METERED, §1b).
- Storing an opaque object requires `put-opaque`. Issuing an attestation requires
  `sign-attestation-certificate`. **They are different capabilities on different
  objects, and nothing in the model connects them.**

Compose them: **a holder of `put-opaque` writes state that the firmware later
interprets on behalf of a holder of `sign-attestation-certificate`.** The template
is persistent, attacker-shaped input parked below the USB repair boundary, and it
outlives its author's authorization — a tenant whose credential is revoked today
leaves behind a template that shapes attestations issued next year. That is
time-of-check/time-of-use across a revocation, and a confused deputy: the
attestation is signed by the *attesting key's* authority over content the
*opaque-writer* chose.

The least-privilege model reads as two narrow capabilities; the effective privilege
is one wide one. Saltzer & Schroeder's least privilege is violated by a composition
neither capability's name discloses.

## What to do

1. **Provisioning rule:** the object ID of any attestation key is reserved. Nothing
   but the provisioning ceremony may hold `put-opaque` on a domain containing an
   attestation key. Write it down as a rule, not as a habit.
2. **Pin the template.** Record the template object's digest at provisioning time
   and re-read/compare before trusting attestations from that key. If the firmware
   will not let us bind them, the *host* must — a mismatch is an incident.
3. **Verifier-side (the durable fix):** consumers pin the attestation **key**, never
   the issuer **name**. A pinned key makes the whole class inert regardless of what
   the template says — which is why work item `081M0DJQ79W087G0R001GNBTVP` and this
   one share a mitigation.
4. **Model it as a capability *graph*, not a capability *list*.** The generalisation
   is the deliverable: enumerate every YubiHSM capability pair where one writes
   state a second later interprets. `put-opaque` × `sign-attestation-certificate` is
   the instance we found; `put-template` × `sign-ssh-certificate` (S4) is the same
   shape and is the higher-value one, because that template carries the principal
   white-list and the validity offsets the fleet's SSH trust depends on.

## Falsifier

With two separate sessions holding disjoint capabilities, have session A (holding
only `put-opaque`) place a template at the ID of an attestation key session A cannot
use, then have session B (holding only `sign-attestation-certificate`) attest. If
the emitted certificate reflects A's object, the composition is confirmed on
hardware. Run it on the throwaway device, in the same sitting as
`081M0DJQ28W087G0R003WZQ7KR`.
