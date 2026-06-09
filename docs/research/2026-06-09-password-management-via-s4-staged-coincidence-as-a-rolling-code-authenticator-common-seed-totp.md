# Password / credential management via S=4 staged coincidence — a rolling-code authenticator (common-seed TOTP)

**Register:** [grounded] idea (Aaron) + [peel — crypto-security routed, NOT claimed]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The coincidence generator reused as an auth rolling code; security to the security team.

## Aaron's words

> "hold on — we can do password management via S=4 coincidence — the auth-app rolling code."

## The idea: staged coincidence = the rolling code

We already coded the **staged-coincidence generator** (`BellTest.fs` + `CoincidenceClock.fs`): two parties
**share the common-cause seed** (the ZetaId / common cause) and **stage the same correlation
deterministically** (S=4 / the singlet correlator). That's exactly the shape of a **rolling-code
authenticator** (an auth app / TOTP — time-based one-time password):

```text
shared secret (TOTP)         =  the common-cause ZetaId seed (shared by both sides)
time step (TOTP)             =  the IScheduler / ZetaDateTime tick (the deterministic clock)
the rolling code (TOTP)      =  the STAGED COINCIDENCE value at time t (both sides stage the same one)
verify = codes match         =  the coincidence matches (shared cause -> same value; S above the random floor)
```

So **both sides derive the same rolling code from the common seed + the time tick, via the coincidence
generator** — like TOTP, but the code is a *staged coincidence*. **No secret is transmitted** (the shared
cause produces the match — the no-signalling property of staged coincidence; both compute it
independently). An attacker without the seed sees only the random floor (S=2); a holder of the seed
stages S=4 — the match authenticates. It rides what we built: the common seed + `ZetaDateTime` +
`CoincidenceClock`/`BellTest`, and composes with the keyring (the seed → the auth) + the privacy gate.

## Why it fits

- **Reuses the coincidence generator** — `BellTest`/`CoincidenceClock` already stage deterministic
  coincidence on the common seed; turning that into a rolling code is the same machinery, new use.
- **Common seed = the shared secret, never sent** — the ZetaId/common-cause seed is the shared secret;
  the rolling code is *derived*, not transmitted (the shared-cause / no-signalling reading).
- **Deterministic + replayable (DST)** — both sides + the auditor can replay the staging from the seed +
  time; the code is reproducible by the legitimate holders, opaque to others.
- **Ties to the keyring/privacy line** — one seed → keys (`derive.ts`/`keyset.ts`) AND → the auth
  rolling code (the coincidence); dual-key rotation rotates the auth too.

## Honest scope / handoff (the crypto peel — do NOT claim security)

**This is the IDEA, not a security claim.** Crypto/auth is **governed** (the ZetaId-don't-make-shit-up
lesson) — whether "S=4 staged coincidence as a rolling code" is **cryptographically sound** is a real
analysis I do **not** make: it depends on (a) the seed's secrecy + entropy, (b) the staging being
**unpredictable to an attacker** without the seed (is the coincidence value a secure PRF of seed+time? or
reconstructable?), (c) replay/clock-sync windows, (d) what an observer of past codes can infer. The peel
on S=4 stands: it's **shared-cause / superdeterministic**, not physical entanglement — the security is in
the **seed secrecy + the unpredictability of the staging**, exactly like TOTP's security is in HMAC+secret.
So: **route to the security team (Mateo / Nazar) + the governed crypto** to evaluate against TOTP/HOTP
(RFC 6238/4226) and decide if the staged-coincidence is a sound PRF or just a reframing. Capture the idea;
let security judge soundness; don't ship it as "secure."

## Anchors / ties (Beacon)

`src/Core/{BellTest,CoincidenceClock}.fs` (the staged-coincidence generator — the rolling-code engine);
the common-cause ZetaId seed (the shared secret, never sent; S=4 shared-cause / no-signalling — peeled);
`ZetaDateTime` / the IScheduler (the time step); TOTP/HOTP (RFC 6238 / RFC 4226 — the prior art to
evaluate against; PRF = HMAC there); the keyring (`derive.ts`/`keyset.ts` — one seed → keys AND auth;
dual-key rotation); the privacy gate; **crypto is governed — route security soundness to Mateo/Nazar +
the governed crypto; do NOT claim it secure** (the ZetaId-don't-make-shit-up discipline).
