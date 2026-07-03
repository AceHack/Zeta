---
id: 081KVP2M1QS08QG0R000JSXE1E
type: task
state: closed
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
- **✅ DONE: KRL revocation primitive.** `tools/setup/persona-keys/revoke.{ts,-cli.ts,.test.ts}` —
  OpenSSH KRL via `ssh-keygen -k`; stages `maintainers/<ca>/revoked-keys.krl` for PR; dry-run
  default; `--confirm` + one biometric for real revoke. The `−1` retraction for compromised device
  certs (surgical — CA + other machines keep working).
- **✅ DONE: cluster-scoped teardown.** `tools/setup/persona-keys/teardown-cluster.{ts,-cli.ts,.test.ts}`
  — inverse of `setup-cluster` (CA private wipe + repo unregister of CA pubkey + trusted-user-ca-keys).
- **SecretStore (1Password) rotate/teardown** — runbook prose + print-only note (intentional;
  operator deletes durable backups). Overlap-window Active↔Standby swap deferred to runbook.

## Done already (the harness proves)

setup (generate) ✅ + rotate ✅ + teardown ✅ + cluster teardown ✅ + KRL revoke ✅ — round-trip-tested
(sandbox, N=3 convergence, N+M-correct, real keys untouched — #9016).

## Composes / anchors

Round-trip harness `tools/setup/persona-keys/onboarding-roundtrip.{test,cli}.ts` (#9016). Itron
KeyState rotation (`docs/research/2026-06-21-zero-downtime-key-rotation-itron-keystate-skms-…`).
Lifecycle-triad + reconciler doc (2026-06-21). Blast-radius no-orphan proof
(`…-smart-cascading-teardown-…`). Composes: identity+crypto unify (081KVNXBR4S0), vault-separation
(081KVNTNTDQ0). Anchors: OpenSSH KRL/`RevokedKeys`; the overlap-window dual-key (2026-06-15 decision).

## Deferred (named, not in scope)

- Threshold/Shamir k-of-n (081KVP3GYW1)
- Org-vs-user-CA conflict (081KVP3GYWS0)
- Unified cluster-trust-root rotate (single command spanning cluster + machine scopes)
