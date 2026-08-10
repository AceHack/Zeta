# Derivation A — threshold signature verification (N-version, clean room)

**Branch:** `derivation-a/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`
**Wall honoured:** I did not open `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party threshold-signature implementation. I have not
knowingly read a prior implementation of this functionality. (I did read
`src/Core/AntiSybil.fs` and `tests/Tests.FSharp/AntiSybil.Tests.fs` for house style only —
unrelated functionality, permitted by the handoff.)

**Artifacts:**
- `src/Core/ThresholdSignatureVerification.fs` — the module
- `tests/Tests.FSharp/ThresholdSignatureVerification.Tests.fs` — the tests

> This report is written incrementally. Sections below are filled in as each requirement is
> resolved; the coverage table is the binding statement, not the prose.

---

## Status log

- [x] spec read
- [ ] module drafted
- [ ] build green at 0 warnings
- [ ] tests green
- [ ] coverage table final
