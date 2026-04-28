---
name: SEED-LOCK POLICY — environment-dependent DST default; in PROD seed-locks are DISCOURAGED by default (security — predictable randomness enables attackers); in DEV/TEST seed-locks are ENCOURAGED by default and "really should never NOT be used" (reproducibility — every failing test replayable at failing seed); requires dependency-injected IRandom abstraction with prod-binding (crypto-random, no seed) and test-binding (seed-locked deterministic); exceptions: prod seed-lock ONLY when proven safe (non-security-bearing randomness like A/B test bucket assignment); dev/test non-seed-lock basically never; refines Otto-248 DST + Otto-272 DST-everywhere with environment-aware seed-lock rule; Aaron Otto-273 2026-04-24 "for security reason in prod seed locks are discouraged by default unless proven safe, dev/test is the opposite, seed locks are encouraged by default and really should never be no used lol"
description: Aaron Otto-273 security-vs-reproducibility refinement on DST. Seed-locking is a different discipline from DST overall — prod wants true crypto randomness (unpredictable), dev/test wants deterministic randomness (replayable). Environment-aware defaults with narrow carve-outs. Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Seed-lock defaults are environment-dependent:**

- **PROD**: seed-locks DISCOURAGED by default.
  Security concern — predictable randomness enables
  attackers. Exception only when proven safe.
- **DEV/TEST**: seed-locks ENCOURAGED by default.
  Reproducibility concern — every failing test must
  be replayable at the failing seed. Non-seed-lock
  basically never legitimate.

Direct Aaron quote 2026-04-24:

> *"for security reason in prod seed locks are
> discouraged by default unless proven safe, dev/test
> is the opposite, seed locks are encouraged by
> default and really should never be no used lol."*

## Why prod discourages seed-locks

**Security surface from predictable randomness**:

- **Cryptographic keys** (key derivation, IV/nonce
  generation) — seed-locked = brute-force trivial
- **Session tokens** — predictable tokens = session
  hijacking
- **Random identifiers** (request IDs, customer IDs,
  entity IDs) — collision risk if predictable +
  information disclosure
- **Password salts** — predictable salts defeat
  rainbow-table resistance
- **Timing jitter / anti-replay nonces** — predictable
  timing = targeted attack windows
- **Load-balancer backend selection** — predictable
  = attackers can target specific backends for
  cache-poisoning / fault-injection
- **Cache eviction order** — predictable evictions
  leak information about access patterns
- **TLS ECDHE ephemeral keys** — MUST be
  cryptographically unpredictable
- **CSRF tokens** — predictable = trivially bypass
  CSRF protection

**Narrow exception** (prod seed-lock proven safe):

- A/B-test bucket assignment (user-ID hash-based,
  stable per user — intended predictability)
- Feature-flag consistent assignment per user
- Deterministic sharding (same key → same shard)
- Diagnostic reproducibility toggles gated behind
  admin auth + feature flag
- Any random source that is **NOT** security-bearing
  AND WHOSE PREDICTABILITY IS A FEATURE

Each prod seed-lock exception requires:

- Inline code comment explaining why predictability
  is safe here
- Threat model review (Aminata) confirming the
  randomness surface is non-security-bearing
- Test coverage confirming the seeded behavior is
  stable across releases

## Why dev/test encourages seed-locks

**Reproducibility is the entire POINT of DST**:

- Every failing test can be replayed at the exact
  seed that caused the failure (Otto-248)
- CI stability — same code produces same test
  outcomes
- Debugging — non-reproducible flakes are
  anti-productive (Otto-248 never-ignore-flakes)
- Coverage quantification — seeded property tests
  give measurable coverage of randomness-conditioned
  branches

**Non-seed-lock in test = basically never
legitimate**. Exception is essentially only:

- Tests that are explicitly testing the randomness
  source itself (e.g. chi-square test on CSPRNG
  output) — AND these have their own DST discipline
  (bounded statistical assertions, not "flakes")

## The abstraction pattern

Both disciplines compose via **dependency-injected
`IRandom`** (or F# equivalent, `IRandomProvider`):

```fsharp
type IRandom =
    abstract Next: unit -> int64
    abstract NextBytes: byte[] -> unit

// Prod binding: wraps System.Security.Cryptography.RandomNumberGenerator
// No seed; per-call cryptographic randomness
let prodRandom : IRandom = ...

// Test binding: wraps System.Random with explicit seed
// Seed provided per-test / per-fixture for reproducibility
let testRandom (seed: int) : IRandom = ...
```

Every code path that needs randomness takes
`IRandom` as a dependency. Prod wires
`prodRandom`; tests wire `testRandom seed`.

This pattern is **mature and well-understood**; most
production codebases already use it. The Otto-273
discipline formalizes the defaults at the POLICY
layer, not the implementation layer.

## Composition with prior memory

- **Otto-248** DST discipline — Otto-273 refines
  the DST seed-lock dimension with environment
  defaults. DST applies to BOTH environments;
  seed-lock default flips.
- **Otto-272** DST everywhere — Otto-273 says
  "DST yes; seed-lock default depends on
  environment". Seed-locking is a DST implementation
  detail; not every DST-conformant system uses
  seed-locks in every environment.
- **Otto-268** word-discipline — be careful to
  distinguish "DST" (reproducibility discipline)
  from "seed-locking" (one mechanism for DST).
  Conflating them causes drift.
- **Aminata threat-model review** — prod seed-lock
  exceptions need threat-model sign-off.
- **Nazar security-ops** — prod seed-lock runtime
  controls (key rotation, CSPRNG health checks).
- **Greenfield (Otto-266)** — we can set these
  defaults now without backwards-compat concerns.

## Backlog-owed

- **P1**: `docs/DST-BALANCE.md` (Otto-272) gets a
  section on seed-lock policy per Otto-273.
- **P1**: Audit existing Zeta codebase for
  randomness sources; classify each as
  security-bearing vs non-security-bearing;
  ensure each is DI'd through `IRandom`.
- **P2**: Lint rule catching `System.Random` direct
  usage in prod-binding code paths (forces DI
  pattern).
- **P2**: Aminata threat-model template for
  prod-seed-lock-exception reviews.

## What Otto-273 does NOT say

- Does NOT forbid ALL prod predictability. Some
  predictability IS a feature (sharding,
  bucket assignment). The carve-out is narrow and
  named.
- Does NOT require FIPS-certified CSPRNG
  everywhere in prod. `System.Security.Cryptography.
  RandomNumberGenerator` is sufficient for most
  use cases; FIPS is a specific compliance layer.
- Does NOT make dev/test identical to prod.
  Dev/test wires seeded `IRandom`; prod wires
  crypto `IRandom`. Different binding, same
  interface.
- Does NOT override Otto-248 "never ignore flakes".
  Seed-locking in tests is how you make flake
  investigation possible — it's the mechanism,
  not the replacement, for DST.
- Does NOT create a new permission surface. Within
  existing authorities: agents can propose changes
  to randomness plumbing; Aminata reviews
  security-bearing seed-lock exceptions; Architect
  integrates.

## Direct Aaron quote to preserve

> *"for security reason in prod seed locks are
> discouraged by default unless proven safe, dev/test
> is the opposite, seed locks are encouraged by
> default and really should never be no used lol."*

Future Otto: when a randomness source appears,
ask TWO questions: (1) is this security-bearing?
(2) what environment(s) does it run in? Cross-
product gives the default. Prod + security-bearing
= NEVER seed-lock. Prod + non-security + stable-by-
design = seed-lock OK with Aminata threat-model
sign-off. Dev/test + anything = seed-lock
(basically always). Codify via `IRandom` DI with
per-environment bindings.
