# Derivation B — threshold signature verification (N-version, clean room)

**Branch:** `derivation-b/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`
**Wall honoured:** I did not open `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party / prior-employer implementation of threshold
signature verification. I read only the spec plus in-repo house conventions
(`src/Core/Crypto.fs` for the hexagonal-port style, `tests/Tests.FSharp/Asn1Der.Tests.fs` for
test style, the two `.fsproj` files). I am not aware of having seen a prior implementation of
this functionality.

**Artifacts:**

- `src/Core/ThresholdSignatureVerification.fs` — data model, port, config validation, verifier
- `src/Core/ThresholdSignatureSchemes.fs` — three port implementations (2 platform, 1 labelled toy)
- `tests/Tests.FSharp/ThresholdSignatureVerification.Tests.fs` — acceptance + unit tests

Status: **IN PROGRESS** — this file is written incrementally as each requirement resolves.

---

## 1. Spec defects / ambiguities surfaced

*(the highest-value section; filled in as found — each entry names both honest readings and
the one I chose)*

---

## 2. Coverage per requirement

*(filled in as each requirement resolves)*

---

## 3. Could not verify

*(filled in at the end)*
