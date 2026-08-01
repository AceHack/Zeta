---
id: 081KYXQ3SZN08QG0R002X3DTQM
type: task
state: backlog
priority: P2
slug: git-native-spiffe-identity-trust-plane-as-a-z-set-event-fold
title: "git-native SPIFFE: identity/trust plane as a Z-set event fold (grant +1 / revoke -1 retraction), rung 2 of removing the central authority — repo/commit-DAG as attestation substrate, then zetadb-native with no host at all"
created: 2026-08-01T03:50:32.181Z
depends_on: []
composes_with: []
---

# git-native SPIFFE: identity/trust plane as a Z-set event fold (grant +1 / revoke -1 retraction), rung 2 of removing the central authority — repo/commit-DAG as attestation substrate, then zetadb-native with no host at all

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYXQ3SZN08QG0R002X3DTQM-*.md` glob. -->

Aaron 2026-08-01: *"SPIFFE/SPIRE is our long term — i'm trying to make a git-native version of this
and a zetadb-native version that does not need any central authority eventually."*

## The ladder (each rung removes a borrowed authority)

0. **TODAY — GitHub-bootstrapped** (`tools/setup/persona-keys/ca.ts`, `resolveCaDisposition`): every
   node is its own CA; a CA becomes usable when its PUBLIC key is committed as
   `maintainers/<ca>/ssh-ca.pub`. Control of the GitHub account + repo history IS the bootstrap
   channel. There is **no single trust root** — the fault mode is an **UNATTESTED** CA, not a "split
   root" (see the corrected doc block in `ca.ts`).
1. **git-native** — the repo is the attestation substrate: signed commits, `allowed_signers`, the
   commit DAG as the append-only ledger. Still borrows a host for ACCOUNT control, but the trust DATA
   is in git and replicable from any clone.
2. **zetadb-native — no central authority.** The identity/trust plane is a **Z-set event fold**:
   grant = +1, revoke = −1 (a RETRACTION); current trust = the consolidated fold; never a
   hand-authored desired-state map.

## Why rung 2 is already half-built

The primitive exists. `SchemaLog` (work-item `081KYWE8Q4008QG0R000H558SH`) proved exactly these laws on
a ±1 Z-set event log: **order-independence** (any shuffle folds equal — two writers merge either way),
**prefix-replay**, **retraction-cancels** (revoked ⇒ weight 0, row gone, not tombstoned), and honest
idempotency (redelivery idempotent; duplicate INTENT surfaced as a named conflict). Order-independence
is precisely the property that lets the plane converge **with no coordinator** — which is what removes
the central authority. Same discipline as the standing rule that config/secrets topology emerges from
events (revoke ≡ Z-set retract), never a static map.

## Design constraint to hold now

Keep the disposition logic a **pure function of (local private key, attested anchors)** so the anchor
SOURCE can be swapped underneath it — GitHub-committed keys → git-native ledger → Z-set fold. Do NOT
harden anything against GitHub specifically. (`resolveCaDisposition` already satisfies this: it never
names GitHub.)

## Anchors

SPIFFE/SPIRE (workload identity, SVIDs, trust bundles — the target shape); Sigstore/Fulcio (OIDC ⇒
short-lived certs — the rung-0 pattern); git `allowed_signers` + signed commits (rung 1); TOFU / PGP
web-of-trust; Zooko's triangle (the tradeoff each rung renegotiates).

Composes-with: `081KYWE8Q4008QG0R000H558SH` (SchemaLog — the fold primitive), and the `ca.ts` trajectory
note landed alongside this item.
