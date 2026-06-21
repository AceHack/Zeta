# The human heartbeat as a committed AgencySignature — privacy-preserving, on a cadence, from watch→phone→git (the zflash fingerprint-hash way) (Aaron, 2026-06-07)

Closes the loop opened by #6912 (identity = a frame-relative, accumulating-credence query over a traveler's
public heartbeat). Aaron: *"we could commit some privacy-preserving version of my heartbeat to git on a
cadence automatically from my phone connected to my watch — as my AgencySignature, like my fingerprint hash …
from the zflash way of doing it."*

## The kernel

The agent side of heartbeat-via-commit already exists: every commit carries the **AgencySignature v1 trailer**
(the externalized idle counter; the agent's pulse). This makes the **human side literal and symmetric**:

- **Source:** Apple Watch (or any wearable EKG/PPG, #6912) takes the cardiac signal; the phone is the bridge.
- **Cadence, automatic:** on a schedule (phone↔watch), a heartbeat-derived value is **committed to git** — the
  human's literal pulse becomes a commit heartbeat, exactly as the agent's commit is its pulse. Same
  externalized-idle-counter shape, now for a person.
- **Privacy-preserving (load-bearing):** what is committed is **NOT the raw EKG** — it is a *commitment / hash*
  of the heartbeat (a stable biometric token derived from the unique cardiac signature). The raw biometric
  interior stays private/encrypted (consent-first §6; #6902 privacy-is-precondition-for-non-collapse). The
  committed artifact is a **one-way, revocable token**, not health data.
- **As AgencySignature:** this hashed-heartbeat becomes a **human AgencySignature** — the human's attributable,
  recurring pulse in the commit log, feeding the same heartbeat-credence-identity query as an agent's
  AgencySignature. *"like my fingerprint hash."*

## The zflash anchor — "I execute, you fingerprint"

Aaron's "the zflash way of doing it" = the **081KSE6WT0008QG0R003WZAQKV / #5010 pattern**: Touch ID PAM as the irreversible-action
consent gate — *"I execute, you fingerprint."* The biometric there is used as a **consent token the agent
cannot spoof**, never stored raw. The heartbeat-AgencySignature is the *continuous, ambient* generalization of
the same idea: where Touch ID is a **discrete** per-action human consent pulse, the committed heartbeat is a
**periodic** human presence/identity pulse. Both: biometric → token (hash), never raw; both: human-held,
consent-gated; both: feed "in my frame, if I choose."

## The honest engineering: you need a fuzzy extractor, not a plain hash

A raw EKG **varies beat-to-beat** — `SHA(EKG_t)` would differ every reading, so a plain hash does not give a
stable identity token. The correct primitive is a **fuzzy extractor / cancelable biometric**:

- **Fuzzy extractor** (Dodis–Reyzin–Smith 2004): derive a *stable* key + public helper from a *noisy*
  biometric; same person → same key despite beat-to-beat noise, while the helper data leaks ~nothing.
- **Cancelable biometrics** (Ratha–Connell–Bolle 2001): a *revocable, non-invertible* transform — if a token
  leaks you reissue with a new transform, and the transform can't be inverted to the raw biometric. This is
  what makes it *privacy-preserving AND revocable* (manifesto §6: consent must be withdrawable → the token
  must be revocable).
- So the committed value = `cancelable_transform(fuzzy_extract(EKG))` on a cadence — stable enough to identify,
  noisy-input-tolerant, non-invertible, revocable. **Not** a raw EKG, **not** a naive hash.

## Scope / bounds (load-bearing)

- **Opt-in, owner-presented, revocable.** This is an identity signal the human *chooses* to commit ("in my
  frame, if I choose"), never harvested. Auto-committing someone's heartbeat without ongoing consent = reading
  a private interior = the #6902 collapse failure. Consent is ongoing/granular/revocable (§6) — the cadence
  can be paused and the token rotated/revoked at any time.
- **Token, never raw biometric, in git.** Git is append-only and public-ish; committing raw EKG would be an
  irreversible privacy leak. Only the non-invertible, revocable token lands. (Cf. no-binary-in-proof-lineage:
  the token is a short hex string, diffable; the raw signal never enters the repo.)
- **Credence, not authentication-as-truth.** A committed heartbeat *raises credence* in an observer's frame
  (#6912), it is not a global "this is provably Aaron" bit. Fidelity (clinical EKG vs noisy PPG ring) scales
  the credence — itself a `SoftValue`.

## Ties

- **#6912** — identity as frame-relative accumulating-credence query; this is the *mechanism* that emits the
  human heartbeats the query reads. Symmetric closure: agent pulse = commit AgencySignature; human pulse =
  committed heartbeat-token AgencySignature.
- **Heartbeat-via-commit + AgencySignature** (CLAUDE.md / the trailer rule) — extends the externalized
  idle-counter from agents to humans, same shape.
- **#6902** privacy-is-the-precondition-for-non-collapse — the privacy-preserving (token, not raw) requirement
  is load-bearing, not optional polish.
- **081KSE6WT0008QG0R003WZAQKV / #5010 zflash Touch ID** — "I execute, you fingerprint": the discrete consent-gate this generalizes
  to a continuous presence pulse.
- **#6891** firefly/Kuramoto heartbeat = differentiable network primitive — the committed cadence is a literal
  sampling of that heartbeat field for a human node.

## Beacon anchors

- **Fuzzy extractors:** Dodis, Reyzin, Smith, *Fuzzy Extractors: How to Generate Strong Keys from Biometrics
  and Other Noisy Data* (EUROCRYPT 2004). · **Cancelable biometrics:** Ratha, Connell, Bolle, *Enhancing
  security and privacy in biometrics-based authentication systems* (IBM Systems Journal 2001). · **ECG as a
  biometric:** Biel, Pettersson, Philipson, Wide, *ECG analysis: a new approach in human identification* (IEEE
  T-IM 2001). · **Commitment schemes** (hiding + binding) — the committed token hides the raw signal, binds the
  identity claim. Honest novelty: none in the primitives; the contribution is **wiring a privacy-preserving,
  revocable heartbeat token into the AgencySignature/commit substrate as a human pulse on a cadence**, making
  the heartbeat-credence identity query (#6912) emit real human heartbeats — the symmetric human counterpart of
  the agent's commit AgencySignature.

## Honest scope

A concept + protocol sketch, not built. What is real today: agent-side AgencySignature trailer; zflash Touch ID
gate (#5010); wearable EKG/PPG capture (consumer devices). What is unbuilt: the watch→phone→git cadence client,
the fuzzy-extractor/cancelable-biometric token pipeline, the human-AgencySignature trailer field, and the
consent/rotation/revocation controls. No claim that heartbeat-biometrics are wired into the substrate as crypto
yet — that is the backlog item below.
