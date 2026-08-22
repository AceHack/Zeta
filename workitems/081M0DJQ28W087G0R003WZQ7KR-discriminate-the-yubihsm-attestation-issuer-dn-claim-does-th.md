---
id: 081M0DJQ28W087G0R003WZQ7KR
type: task
state: backlog
priority: P1
slug: discriminate-the-yubihsm-attestation-issuer-dn-claim-does-th
title: "Discriminate the YubiHSM attestation issuer-DN claim: does the firmware COPY the template subject DN or SYNTHESIZE it"
created: 2026-08-19T17:57:13.116Z
depends_on: []
composes_with: []
---

# Discriminate the YubiHSM attestation issuer-DN claim: does the firmware COPY the template subject DN or SYNTHESIZE it

**Owner:** Aminata (`threat-model-critic`) files it; the probe is Nazar's
(`security-operations-engineer`) — it needs the device.
**Class:** metering gap. **Severity (SDL bug bar):** Medium as a defect;
**High as a threat-model input**, because a whole STRIDE row depends on the answer.

## The claim under audit

`docs/research/2026-08-19-what-the-yubihsm-2-firmware-parses-measured-parsing-surfaces-usb-channel-and-key-custody-without-a-ca.md`
§1b states, tagged **METERED**:

> the firmware parses a caller-supplied DER X.509 and copies fields from it …
> The emitted certificate's issuer became `CN=YubiHSM Attestation id:<that-ID>` —
> **the subject DN of my template, parsed by the firmware and copied into the output.**

## Why this is not yet discharged

The observation is consistent with **two different mechanisms**, and the experiment
run cannot separate them:

1. **COPY** — the firmware reads the template's subject DN and writes those bytes
   into the emitted issuer. Caller controls the issuer string.
2. **SYNTHESIZE** — the firmware formats `"YubiHSM Attestation id:%d"` from the
   object ID it already holds, and never reads the template's DN at all.

`yubihsm-shell` generates the self-signed template with exactly that subject, so
both mechanisms produce the observed bytes. A matching string is not an
identification (`.claude/rules/numerology-vs-number-theory.md`): name the
competitor and the invariant that excludes it, or say "consistent with".

This matters because the two readings have different threat models. Under COPY the
issuer field is an **attacker-chosen string inside a signed artifact** (a spoofing
primitive — see threat AM-1 in `docs/security/THREAT-MODEL.md`). Under SYNTHESIZE
the DER parser still runs (the object must be a valid certificate to be stored as
`opaque-x509-certificate`, and §1b's parse is real either way), but the issuer is
firmware-authored and AM-1 collapses to a much smaller finding.

## Falsifier (the whole task)

Store a template whose subject DN is **distinctive and non-conforming** — e.g.
`CN=ZZ-DISCRIMINATOR-DO-NOT-TRUST, O=Aminata Probe` — at a custom attestation key's
object ID, attest a second key with it, and read the emitted issuer.

- Emitted issuer contains `ZZ-DISCRIMINATOR` ⇒ **COPY confirmed.** AM-1 stands;
  promote it to a metered Spoofing row and land the key-pinning guidance.
- Emitted issuer is `CN=YubiHSM Attestation id:<N>` regardless ⇒ **SYNTHESIZE.**
  Downgrade §1b's copy clause to "the firmware parses the template; the issuer is
  firmware-authored", and downgrade AM-1 accordingly.

Extend the same run with the S3-negative probe already named in the source doc
(structured DER mutation of the stored template; assert the device response per
mutation, distinguishing clean rejection from fault).

## Done when

- The probe is run on a throwaway device, no production keys, no secret values in
  the writeup.
- §1b of the source note carries the discriminated claim, with the competitor
  named and excluded.
- The AM-1 row in `docs/security/THREAT-MODEL.md` and the Seal Forger entry in
  `docs/security/THREAT-MODEL-SPACE-OPERA.md` are updated to whichever mechanism
  is real. Both currently carry an explicit "mechanism not yet discriminated" note;
  that note is deleted, not silently dropped.
