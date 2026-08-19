---
id: 081M0DJQ79W087G0R001GNBTVP
type: task
state: backlog
priority: P1
slug: attestation-consumers-must-demand-proof-of-possession-a-yubi
title: "Attestation consumers must demand proof-of-possession: a YubiHSM attestation is replayable, never-expiring evidence"
created: 2026-08-19T17:57:18.268Z
depends_on: []
composes_with: []
---

# Attestation consumers must demand proof-of-possession: a YubiHSM attestation is replayable, never-expiring evidence

**Owner:** Aminata (threat class) → design routes to whoever builds
`zeta-self-register` attestation consumption (#12248).
**Class:** Spoofing. **Severity (SDL bug bar):** High — it is a local/insider
identity break against a control that does not exist yet, so the cost of fixing it
now is a paragraph and the cost of fixing it later is a re-issued fleet.

## The threat

A YubiHSM 2 attestation certificate (measured, fw 2.4.1) has three properties that
compose badly:

1. **`Not After: Dec 31 23:59:59 9999`**, and the device has no clock (METERED).
2. **No challenge, no nonce.** `Sign Attestation Certificate` takes two object IDs.
   The output is a function of device state, not of anything the *verifier* chose.
3. **Reset is cheap** — seconds, no disassembly, returns the device to a single
   factory credential (METERED).

Therefore: **the certificate bytes are replayable forever by anyone who has ever
seen them.** It is a description of a key that once existed on a device; it is not
evidence that the party presenting it holds that key, or that the key still exists,
or that the device was not wiped and re-provisioned in between.

Any consumer that reads "signature verifies, not expired" as "this peer is that
node" has converted checkable evidence back into a boolean verdict — which is the
exact failure the source note's anti-DVD-drive framing claims to have avoided. The
framing is right about the *artifact* and silent about the *consumer*, and the
consumer is where the Xbox 360 fell.

## Two attacks it enables

- **Attestation replay.** Any party that observed a node's attestation (it is not
  secret — it is published evidence by design) can present it as its own. Nothing
  in the artifact says who is speaking.
- **Reset-and-reintroduce.** An adversary with brief physical access resets a node's
  device and re-enrols it. The new keys are genuine, on-device, correctly attested.
  If self-registration accepts a fresh attestation from a serial it already knows,
  an evil-maid wipe is indistinguishable from a legitimate rotation. Note the
  dual-use shape (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`):
  the mechanism reports "same serial, unlinked key"; whether that reads as
  *replacement* or *attack* is caller policy — but it must be **reported**, and
  today nothing computes it.

## What to build

1. **Proof-of-possession is mandatory.** The attested key signs a verifier-chosen
   challenge. The attestation is consumed *only* as a capability descriptor for a
   key already proven live. Never as an authentication event on its own.
2. **Bind the verifier's own name into the challenge** so a PoP transcript captured
   from node A cannot be replayed to node B.
3. **Expiry comes from the cluster's phase-ordered fold, never the certificate.**
   `local-time-never-enters-the-shared-fold` applied to hardware: the device has no
   time, so the artifact's validity window must not filter evidence entering the
   fold. Treat `Not After 9999` as "no expiry information", not as "valid".
4. **Re-registration must chain to the previous key.** The three-key
   `previous/current/next` overlap already in the design is the mechanism: an
   attestation whose key has no link to the prior registration is a *new device
   claiming an old name* and must be surfaced, not welcomed.

## Falsifier

A dogfooded enrol → attest → replay loop: capture node A's attestation bytes,
present them from node B, and assert the verifier refuses. A verifier that accepts
is the bug. Second assertion: reset the device, re-enrol, assert the
"unlinked-key-on-known-serial" signal fires.
