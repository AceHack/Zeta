---
id: 081KSNY2Z0008QG0R001FN4DDB
priority: P3
status: open
title: Side-channel scope boundary — bound 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0030V5ZVS to "encrypted-at-rest in git; no timing-observable deployment"; follow-up tracking for constant-time substrate
effort: S
ask: aaron 2026-05-28 (Q7 explanation deferred)
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0030V5ZVS
  - 081KSNY2Z0008QG0R0037X4DP4
tags:
  - side-channel-scope-boundary
  - bound-to-git-at-rest-threat-model
  - no-timing-observable-deployment
  - pure-js-noble-no-constant-time-guarantee
  - kyberslash-clangover-class-concerns
  - follow-up-tracking-when-scope-expands
  - operator-explanation-locked-2026-05-28
---

## Operator framing 2026-05-28 (Q7 explanation requested; scope-boundary recommendation)

Per the explanation: bound 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0030V5ZVS v1 scope explicitly to "encrypted-at-rest in git; no timing-observable deployment." Document the bound. File this row as follow-up tracking if/when scope expands.

## Side-channel threat model — three classes

1. **Timing side-channels** — operation duration depends on secret data; adversary observes wall-clock across runs → recovers key. E.g., KyberSlash (2024) — decapsulation time depended on secret-key bits via division latency.
2. **Memory side-channels** — memory access patterns depend on secret data; cache hits/misses leak. Adversary on same machine observes cache behavior.
3. **Power / EM side-channels** — physical hardware emissions; smartcard / IoT adversaries with physical access.

## 081KSNY2Z0008QG0R0030V5ZVS v1 threat model (in scope)

- Adversary: someone with read access to git repo → gets ciphertext blobs only
- Adversary does NOT have: timing observations (no one is timing Otto's decryption); memory access (Otto runs in its own process); physical access (Mac with Touch ID gating)
- **Side-channels DON'T APPLY at this threat model**

## Threat models OUT of scope (would require new substrate)

- Agent runs on shared host where attacker can observe timing of decryption operations
- Agent decryption happens in network-served context (TLS-like handshake exposing timing)
- Smartcard / hardware token deployment with physical access (power analysis)

## Why pure-JS @noble has no side-channel protection

V8 may emit data-dependent branches that source code doesn't have, even when source LOOKS constant-time. Clangover (May 2024) showed Clang versions could reintroduce timing variance via codegen — fundamental challenge for JS/TS implementations because we don't control V8/JIT codegen.

Constant-time guarantee requires assembly-level verification, which pure-JS cannot provide.

## What this row tracks

1. Document the scope boundary explicitly in 081KSNY2Z0008QG0R002JKH50A / 081KSNY2Z0008QG0R0030V5ZVS implementation (README + design docs + envelope spec)
2. Track when/if the threat model expands beyond git-at-rest
3. When scope expands, file follow-up B-NNNN that adds constant-time substrate (likely path: WASM bindings to liboqs constant-time C implementations; OR Rust/Go FFI subprocess; OR hardware-accelerated path)

## Acceptance criteria

- 081KSNY2Z0008QG0R002JKH50A README explicitly documents: "Scope: git-at-rest encryption only; not constant-time; not for timing-observable deployment"
- 081KSNY2Z0008QG0R0030V5ZVS design memo explicitly cites this scope boundary
- Threat-model section in `docs/security/THREAT-MODEL.md` (or sibling doc) names the bound + the activation triggers for expanding scope
- This row stays OPEN as a watch-list item; closes only when explicitly retired or activated

## Activation triggers (when this row's tracked work becomes load-bearing)

- Multi-tenant deployment (Otto's agent runs on shared host with adversarial neighbors)
- Network-exposed decryption (Otto's state served via API where attacker can time requests)
- Smartcard / hardware token deployment (operator wants TPM-bound keys with physical adversary considered)
- Operator explicit ask: "we now need constant-time guarantees because ___"

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate)
- **081KSNY2Z0008QG0R0030V5ZVS** (agent private encrypted state — beneficiary of scope clarity)
- **081KSNY2Z0008QG0R0037X4DP4** (library landscape audit — this row addresses Q7's locked decision)

## Substrate-honest framing

P3 — research-grade; tracking only; no implementation today. The boundary IS the substrate-honest move; not having constant-time crypto is acceptable WHEN scope is bounded to git-at-rest. The row exists so future-Otto sees this when scope discussion arises rather than re-deriving.

## Full reasoning

Operator 2026-05-28 requested deeper explanation of side-channel posture in response to 081KSNY2Z0008QG0R0037X4DP4 Q7. Explanation provided; recommendation: bound the scope explicitly. This row codifies the bound + the watch-list for future expansion.
