---
id: 081KWPHRNE008QG0R001D8CBP9
type: task
state: closed
priority: P1
slug: openssh-protocol-certkeys-encoder-frost-threshold-ca-emits-c
title: "OpenSSH PROTOCOL.certkeys encoder — frost threshold CA emits -cert.pub without ssh-keygen -s"
created: 2026-07-04T12:30:59.520Z
depends_on: []
composes_with: ["081KVP3GYW108QG0R003V7E6VT", "081KWPHRNFW08QG0R0031ZNXTD"]
---

# OpenSSH PROTOCOL.certkeys encoder — frost threshold CA emits -cert.pub

## Why

FROST slice 1–2 landed under `tools/setup/persona-keys/` (monorepo tools-over-trunks):

- `frost.ts` — threshold Schnorr without key reassembly
- `frost-ca-custody.ts` — local shares + Zeta-native device attestation JSON

`sshd` still consumes OpenSSH `-cert.pub` via `TrustedUserCAKeys`. Today that path uses
single-key `ssh-keygen -s` (`ca.ts`). Until we encode `PROTOCOL.certkeys` and sign the cert
blob with `frostThresholdSign`, threshold CA cannot replace the live OpenSSH cert path.

## Done

1. **✅ `openssh-cert.ts`** — PROTOCOL.certkeys encoder (signable prefix + finalize + pubkey line helpers)
2. **✅ frost sign** — `frost-ca-custody.signFrostDeviceAttestation` signs cert blob with `frostThresholdSign`
3. **✅ `ssh-keygen -L` accepts** frost-signed `-cert.pub` (tests)
4. **✅ `ca-cli.ts frost-cert`** — writes `machines/<host>-cert.pub` + attestation JSON
5. **✅ `frost-ca --commit-pub`** — writes OpenSSH-format `frost-ca.pub` for TrustedUserCAKeys

## Constraint

Monorepo tools-over-trunks: land under `tools/setup/persona-keys/`, not a sidecar service.

## Anchors

OpenSSH `PROTOCOL.certkeys`; `frost.ts` / `frost-ca-custody.ts`; agent-native-key-custody design.
