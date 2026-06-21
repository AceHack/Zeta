---
id: 081KVP2M1QS08QG0R000JSXE1E
type: task
state: backlog
priority: P1
slug: complete-the-lifecycle-triad-unified-per-port-rotate-command
title: "Complete the lifecycle triad: unified per-port rotate command (machine/CA/cert/cluster) + revocation (KRL) + cluster-scoped teardown — gaps surfaced by the onboarding round-trip harness (Aaron 2026-06-21)"
created: 2026-06-21T21:50:37.817Z
depends_on: []
composes_with: ["081KVNXBR4S08QG0R0015DHBBN", "081KVNTNTDQ08QG0R0017NBBWB"]
---

# Complete the lifecycle triad: unified per-port rotate command (machine/CA/cert/cluster) + revocation (KRL) + cluster-scoped teardown — gaps surfaced by the onboarding round-trip harness (Aaron 2026-06-21)

<!-- Work-item body. ZetaId-keyed. -->

## Carved sentence

> Complete the per-port lifecycle triad (generate · **rotate** · teardown): build the **unified
> per-port `rotate`** that's currently missing, so every port has all three and the round-trip
> harness can test setup→rotate→teardown→re-setup end-to-end. Gaps surfaced (asserted, not faked)
> by the onboarding round-trip harness (#9016).

## Gaps the harness named (the build list)

- **✅ DONE (#9022): unified per-port `rotate` command.** `tools/setup/persona-keys/rotate.{ts,
  -cli.ts,.test.ts}` — rotate for the **machine key**, **device cert** (re-sign, N+M preserved),
  and **CA key** (overlap: BOTH CA pubkeys in `TrustedUserCAKeys` during the window so existing
  certs still verify) on the Itron `KeyState` overlap-window lifecycle. ∅-blast-radius **proven**
  (a pre-rotation cert's signing-CA fingerprint stays in the trusted set after rotation, real
  `ssh-keygen -L`); one-fingerprint (1 biometric covers all ports); round-trip harness extended
  (setup→rotate→teardown→re-setup converges, N=3). Sandbox-only verified (real keys untouched).
  **The lifecycle triad is now complete: generate ✅ · rotate ✅ · teardown ✅.** Remaining below.
- **No revocation primitive** — OpenSSH **KRL** / `RevokedKeys` (revoke a compromised key/cert,
  distributed via the directory; the `−1` retraction + cascade-with-warnings).
- **No cluster-scoped teardown** — the inverse of `setup-cluster` (teardown #9000 covers machine/
  CA/keyring local + repo; add the cluster trust-root teardown).
- **SecretStore (1Password) rotate/teardown** are runbook prose + print-only note — intentional
  (operator's call to delete durable backups), but wire the rotate (Active↔Standby swap) as the
  overlap.

## Done already (the harness proves)

setup (generate) ✅ + teardown ✅ exist + round-trip-tested (sandbox, N=3 convergence, N+M-correct,
real keys untouched — #9016). This item closes the **rotate** corner + revocation + cluster teardown.

## Composes / anchors

Round-trip harness `tools/setup/persona-keys/onboarding-roundtrip.{test,cli}.ts` (#9016). Itron
KeyState rotation (`docs/research/2026-06-21-zero-downtime-key-rotation-itron-keystate-skms-…`).
Lifecycle-triad + reconciler doc (2026-06-21). Blast-radius no-orphan proof
(`…-smart-cascading-teardown-…`). Composes: identity+crypto unify (081KVNXBR4S0), vault-separation
(081KVNTNTDQ0). Anchors: OpenSSH KRL/`RevokedKeys`; the overlap-window dual-key (2026-06-15 decision).
