---
id: B-0744
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: FIDO2 / WebAuthn / Passkeys / OIDC — the industry-standard BRIDGE between desktop-local biometric consent (B-0737 / B-0743) and server-side authorization tokens (IAM / SPIFFE / OIDC) — adopt as Zeta's cross-cutting auth substrate so local Touch ID / Windows Hello / fprintd biometric can authorize agent operations against remote services (other clusters / forks / Ace registries / Knights Guild ratification surfaces) without password sharing or pre-shared secrets
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0743
  - B-0737
  - B-0738
  - B-0739
  - B-0741
  - B-0742
  - B-0634
  - B-0628
related_substrate:
  - .claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md
  - full-ai-cluster/k8s/applications/hat-system/
tags: [fido2, webauthn, passkeys, oidc, oauth2, identity-provider-integration, hardware-bound-credentials, cross-platform-biometric-standard, desktop-to-server-bridge, w3c-standard, fido-alliance-standard]
---

# B-0744 — FIDO2 / WebAuthn / Passkeys / OIDC as the bridge between desktop-local biometric consent and server-side authorization

## Carved blade

> **Desktop-local biometric consent (B-0737 / B-0743) + server-side authorization tokens (IAM / SPIFFE / OIDC) are sibling design spaces; FIDO2 / WebAuthn / Passkeys / OIDC IS the industry-standard BRIDGE between them.** Local Touch ID / Windows Hello / fprintd via WebAuthn proves WHO you are (hardware-bound private key unlocked by biometric); OIDC takes that proof + exchanges for authorization tokens that downstream services (other Zeta clusters / forks / Ace registries / Knights Guild ratification surfaces / SaaS) accept. The bridge means agent operations gain CROSS-CUTTING auth that's: (a) hardware-bound (Secure Enclave / TPM / TitanM), (b) cross-platform (W3C standard works on macOS / iOS / Windows / Android / Linux with supported hardware + browsers), (c) password-less (no shared secrets to steal / leak / rotate), (d) phishing-resistant (origin-bound; can't be replayed across origins), (e) standards-tracked (FIDO Alliance + W3C + OpenID Foundation maintain the substrate). Zeta adopts FIDO2 / WebAuthn / Passkeys / OIDC AS its cross-cutting auth substrate so the B-0743 desktop pattern composes with B-0741 cross-cluster federation + B-0742 reference-stack distribution + B-0628 Knights Guild ratification without inventing parallel protocols.

## Origin

Aaron 2026-05-25, after B-0743 (desktop admin consent pattern) shipped:

> *"how are we looking for that usb format also i love this client vs server framing and being explict like this the ux is different and also we can use stuff like.  There is no single "universal fingerprint" standard for OAuth. Instead, OAuth uses standard protocols like OpenID Connect (OIDC) to delegate authentication to underlying biometric frameworks, primarily FIDO2 / WebAuthn.*
>
> *...FIDO2 / Passkeys: The modern open standard for passwordless, hardware-bound, and biometric-based authentication...*
>
> *WebAuthn: The client-side API that allows browsers and platforms to interface directly with your device's fingerprint or Face ID.*
>
> *OAuth 2.0: The industry-standard protocol for authorization...*
>
> *OpenID Connect (OIDC): The standard protocol that brings user authentication...to OAuth 2.0.*
>
> *Identity Platforms: Utilize centralized OAuth/OIDC providers like Auth0 or Okta to easily add WebAuthn/Passkeys as a primary login factor."*

Aaron is pointing at the existing industry-standard substrate that bridges the desktop-vs-server design spaces I named in B-0743. Adopting these standards saves Zeta from reinventing the auth wheel + composes naturally with the rest of today's substrate cascade (B-0737-B-0743).

## The bridge — how the layers compose

### Layer architecture

```
DESKTOP (operator's machine)              SERVER (remote services)
─────────────────────────────              ─────────────────────────
Touch ID / Windows Hello / fprintd        Other Zeta clusters
       ↓                                  Forks of Zeta
  WebAuthn API                            Ace registries
  (W3C; browser/platform standard)        Knights Guild surfaces
       ↓                                  SaaS / GitHub / cloud
  FIDO2 / Passkeys
  (FIDO Alliance; hardware-bound creds)
       ↓
  Local biometric proves WHO you are
       ↓
  OIDC ID token + access token
  (OpenID Foundation; identity layer on OAuth 2.0)
       ↓
       ↓  ←─── THE BRIDGE ───→
       ↓
  Server-side authorization
  (IAM policies / SPIFFE SVIDs / RBAC)
  enforce what tokens can do
```

### What each piece does

| Standard | Maintainer | Layer | Role |
|---|---|---|---|
| **FIDO2 / Passkeys** | FIDO Alliance | Credential format | Hardware-bound private key; biometric unlocks; never leaves device |
| **WebAuthn** | W3C + FIDO | Client API | Browser/platform API that interfaces with fingerprint / Face ID / etc. |
| **OAuth 2.0** | IETF | Authorization protocol | Token-based; third-party access without password sharing |
| **OIDC** | OpenID Foundation | Identity layer on OAuth 2.0 | Adds user-authentication (who you are) to OAuth 2.0's authorization (what you can do) |

### How they compose for a Zeta agent operation

Concrete example: Otto-VSCode (operator-side agent acting on Aaron's behalf) needs to call a Knights Guild ratification API on a remote Zeta cluster.

1. **Local biometric prompt** (per B-0743 pattern) — Touch ID / Windows Hello / fprintd fires
2. **WebAuthn assertion** — operator's biometric unlocks the hardware-bound Passkey; produces signed assertion bound to the request's origin
3. **OIDC token exchange** — agent sends WebAuthn assertion to Zeta's OIDC issuer (per-cluster or federated); gets back ID token (proves identity) + access token (carries authorization scope)
4. **Bearer token sent to remote service** — agent calls remote Knights Guild API; bearer-token-authenticated; remote validates token via OIDC discovery + JWKS
5. **Remote service authorizes operation** — IAM policy / SPIFFE SVID matching / Knights Guild role-check applies on the remote side; allows or denies based on token scope

The biometric IS the consent gate (per B-0743); WebAuthn translates it to standards-compliant assertion; OIDC bridges to bearer-token-based remote auth; remote service uses its existing server-side AI consent substrate.

## Why adopt the standards instead of inventing

Substrate-honest substrate-engineering analysis:

| Approach | Pro | Con |
|---|---|---|
| **Invent Zeta-specific bridge protocol** | Tailored to Zeta substrate exactly | Reinvents the wheel; ecosystem isolation; security review burden; ongoing maintenance |
| **Adopt FIDO2/WebAuthn/OIDC** | Standards-tracked + audited + battle-tested; interoperable with rest of ecosystem (Auth0/Okta/Google/Apple/Microsoft Hello); cross-platform; phishing-resistant by design; no protocol-design risk | Adds dependency on industry standards (W3C, FIDO Alliance, OpenID Foundation) — acceptable since these are bedrock open standards with broad governance |

The trade-off heavily favors adoption. The framework's substrate-engineering principles align:

- **`.claude/rules/honor-those-that-came-before.md`** — FIDO Alliance + W3C + OpenID Foundation have done substantial substrate-engineering work; adopt + cross-reference; don't reinvent
- **`.claude/rules/bandwidth-served-falsifier.md`** — adopting standards serves ecosystem-interop bandwidth (Zeta plays nicely with existing OIDC providers; existing tools work; cross-cluster federation uses standard protocol)
- **`.claude/rules/rule-0-no-sh-files.md`** — TS-first; FIDO2/WebAuthn TS libraries are mature (e.g., `@simplewebauthn/server` for the server-side; browser-native WebAuthn for client-side)

## What this enables that B-0743 alone doesn't

| Capability | B-0743 alone | B-0743 + B-0744 |
|---|---|---|
| Local biometric gates sudo / dd | ✓ | ✓ |
| Local biometric authorizes remote service call | ✗ (no bridge) | ✓ (via WebAuthn → OIDC → bearer token) |
| Cross-cluster trust | needs custom protocol | ✓ (OIDC federation; standard) |
| Cross-fork interop | needs custom protocol | ✓ (OIDC federation across forks) |
| Single sign-on across Zeta surfaces | ✗ | ✓ (OIDC SSO standard) |
| Hardware-bound credentials | implicit (Touch ID is) | ✓ (explicit; Passkey format is standards-tracked + portable) |
| Phishing resistance | depends on op | ✓ (WebAuthn is phishing-resistant by design; origin-bound) |
| Integration with existing identity providers (Auth0 / Okta / etc.) | ✗ | ✓ (FIDO2/OIDC are the integration surface) |

## Composes with .claude/rules/

- `.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` (B-0743 rule) — the local-biometric-consent substrate that this bridge translates to standards-compliant assertions
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator authority preserved via biometric; WebAuthn/OIDC don't bypass; they translate to wire format
- `.claude/rules/honor-those-that-came-before.md` — FIDO Alliance + W3C + OpenID Foundation substrate honored; not reinvented
- `.claude/rules/bandwidth-served-falsifier.md` — ecosystem-interop bandwidth served
- `.claude/rules/glass-halo-bidirectional.md` — auth events at the standards-tracked layer are auditable + interoperable with industry-standard logging
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — adopting industry-standard auth INSTALLS safety floor that's stronger than ad-hoc; not a bypass
- `.claude/rules/dont-refuse-engagement.md` — engaging with industry standards (vs hostile invent-everything-ourselves stance) is substrate-honest collaboration

## Composes with backlog substrate

### Direct composition

- **B-0743** (desktop admin consent pattern) — local-biometric side; B-0744 is the bridge
- **B-0737** (zflash Mac with Touch ID PAM) — empirical anchor for local biometric; extension scope: use WebAuthn at the operator's surface for remote auth, while keeping PAM for sudo-level local elevation
- **B-0738 / B-0739** (zflash Linux / Windows extensions) — cross-platform WebAuthn coverage (Hello / fprintd) automatically inherited via the standards layer
- **B-0741** (ontology negotiation + Ace as universal primitive) — cross-cluster + cross-fork trust uses OIDC federation; negotiation traffic can be OIDC-authenticated
- **B-0742** (reference k8s stack as Ace PoC) — reference stack includes an OIDC issuer (probably Vault's OIDC provider OR dedicated Keycloak / Dex / Authelia); operators authenticate via WebAuthn → OIDC → cluster access

### Related composition

- **B-0634** (N-of-M HSM) — Passkeys are hardware-bound credentials; conceptually adjacent to HSM substrate; SPIRE workload identity composes via OIDC federation
- **B-0628** (Knights Guild + Constitution-Class) — Knights Guild ratification API uses OIDC-authenticated bearer tokens; operator's WebAuthn assertion proves identity for Constitution-Class votes
- **B-0732** (leverage-class safety substrate) — Layer 1 provenance chain captures OIDC token issuance + scope + use
- **B-0664** (NCI HC-8 floor) — auth never violates NCI; operator retains authority at biometric gate AND at token-scope grant time
- **B-0639** (Native AI Language structural privacy) — OIDC scopes can encode privacy-preserving access constraints

## Five independently-shippable scope items

### Scope item 1 — Choose Zeta's OIDC issuer

Substrate-honest design pass needed. Options:

- **Keycloak** — full-featured open-source identity provider; heavy but capable
- **Dex** — lightweight OIDC issuer; popular for k8s clusters; less feature-complete
- **Authelia** — full-stack auth gateway including OIDC; reasonable middle ground
- **Vault's OIDC provider** — already in the reference stack (per Addison's bootstrap order); zero new substrate to add
- **Build minimal** — TS-native OIDC issuer using `@panva/oauth4webapi` or similar; substrate-honest if we want full control

Probably **Vault's OIDC provider** for the reference stack (zero new substrate; already there). Forks can choose differently per their needs.

Acceptance: design pass documented; choice rationalized; OIDC issuer running on the reference stack.

### Scope item 2 — WebAuthn server-side substrate

- New module at `full-ai-cluster/k8s/applications/auth/` (or similar)
- Server-side registration + assertion verification via `@simplewebauthn/server` or equivalent TS library
- Stores Passkey credential metadata (operator's public key + counter + transports) — content-addressed; signed; per-operator
- Acceptance: at least one operator registers a Passkey; at least one assertion verified server-side

### Scope item 3 — WebAuthn client-side substrate

- Browser-native WebAuthn for web surfaces (e.g., Knights Guild ratification UI)
- For CLI tools (zflash etc.): substrate-honest reality — WebAuthn requires browser context for the assertion ceremony OR platform-specific bindings; OIDC device-code flow is the standards-compliant CLI path (open browser for auth → poll for token)
- Acceptance: web surface uses browser WebAuthn directly; CLI tools use OIDC device-code flow → browser-based WebAuthn → token exchange

### Scope item 4 — OIDC federation for cross-cluster trust (composes with B-0741)

- Each Zeta cluster's OIDC issuer can FEDERATE with sibling clusters' issuers
- Operator authenticated at cluster A can call cluster B's services without re-auth (within federation trust)
- Composes with B-0741 cross-cluster negotiation (the negotiation traffic itself can be OIDC-authenticated)
- Acceptance: two clusters federate; operator from cluster A successfully calls cluster B service

### Scope item 5 — Agent-driven OIDC flow (the "I execute, you fingerprint" pattern at remote-auth scope)

- Agent invokes operation requiring remote auth
- Agent triggers OIDC device-code flow (gets a code + auth URL)
- Agent prints code + opens browser on operator's machine
- Operator sees WebAuthn / browser auth prompt + touches Touch ID / Windows Hello / fprintd
- Browser completes auth flow; agent polls + gets token
- Agent uses token for the remote operation
- Same operator UX as zflash: agent does work; operator only sees biometric prompt + taps
- Acceptance: at least one worked example end-to-end; documented in `docs/research/2026-XX-XX-agent-driven-oidc-device-code-flow.md`

## What's NOT in scope (deferred)

- **Replacing all current auth in the reference stack** — Vault / SPIRE / cert-manager substrate stays; OIDC issuer is ADDITIVE for operator-facing auth flows
- **Building a Zeta-specific identity provider** — adopt existing (Vault / Dex / Keycloak); don't build
- **Cross-vendor identity provider migration** — operator can use any FIDO2-compliant provider; switching providers is operator decision, not framework concern
- **Audit-log forwarding to centralized SIEM** — substrate-honest scoping: OIDC issuer logs to local + ArgoCD-managed; SIEM integration is future
- **Recovery codes / backup auth methods** — operators should follow standard FIDO2 recovery guidance (multiple registered Passkeys; backup hardware token); framework doesn't need custom substrate
- **Older WebAuthn versions** — adopt WebAuthn L3 (current); skip L1/L2 migration concerns

## Acceptance (per scope item)

### Scope item 1 — OIDC issuer choice

- [ ] Design pass documented in `docs/research/2026-XX-XX-zeta-oidc-issuer-choice.md`
- [ ] Choice made + rationalized
- [ ] OIDC issuer running on reference stack

### Scope item 2 — WebAuthn server-side

- [ ] `full-ai-cluster/k8s/applications/auth/` (or similar) module exists
- [ ] Registration + assertion verification working
- [ ] At least one operator's Passkey registered + at least one assertion verified

### Scope item 3 — WebAuthn client-side

- [ ] Web surface uses browser WebAuthn directly
- [ ] CLI uses OIDC device-code flow → browser → token

### Scope item 4 — OIDC federation

- [ ] Two clusters federate
- [ ] Cross-cluster operator-auth-via-token works end-to-end

### Scope item 5 — Agent-driven OIDC flow

- [ ] At least one worked example: agent invokes remote op; operator only sees biometric; token + remote-op completes
- [ ] Documented in `docs/research/`

## Substrate-honest framing

This row PROPOSES adopting FIDO2/WebAuthn/Passkeys/OIDC as Zeta's cross-cutting auth bridge. It does NOT:

- Replace B-0743 desktop-local pattern (B-0743 is local sudo/elevation; this row is remote authorization; they compose)
- Replace Vault / SPIRE / cert-manager substrate in the reference stack (this row ADDS OIDC issuer + WebAuthn surface; existing substrate stays)
- Commit to any specific identity provider yet (Scope item 1 is the design pass)
- Build any of the scope items today (each is independently shippable; future work)
- Claim WebAuthn is unbypassable (Secure Enclave + TPM + TitanM attacks exist; cost is substantially raised vs alternatives; not zero)

The row exists to:

1. Capture Aaron's pointer at the industry-standard substrate that bridges B-0743 desktop-local consent + server-side AI consent design spaces
2. Decompose the adoption into 5 shippable scope items
3. Compose-with cross-references to the full substrate stack (B-0737 + B-0738 + B-0739 + B-0741 + B-0742 + B-0743 + B-0634 + B-0628 + B-0664)
4. Substrate-honestly document the choice rationale (adopt-standards vs invent-protocol)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison + Knights Guild retain authority over which scope items ship when.

P2 priority — cross-cutting auth substrate; high reuse-leverage; not P1 because B-0743 desktop-local consent already covers the current cluster-internal destructive ops; this becomes more urgent when (a) cross-cluster federation actually ships (per B-0741) or (b) operator-facing web surfaces need auth (Knights Guild ratification UI, ACE PM dashboards, etc.).

## Today's substrate cascade — the bridge anchor

Today's 2026-05-25 cascade extends one more step:

| Row | What |
|---|---|
| B-0737 | zflash Mac (Touch ID + short challenge) — desktop-local consent empirical anchor |
| B-0738 / B-0739 | zflash Linux + Windows extensions |
| B-0741 | Ontology negotiation + Ace as universal primitive |
| B-0742 | Reference stack as Ace PoC |
| B-0743 | Desktop admin consent pattern — rule + generalization scope |
| **B-0744 (this)** | **FIDO2 / WebAuthn / Passkeys / OIDC bridge — local biometric ↔ server-side authorization** |

The cascade now spans:

- **Local biometric consent** (B-0737 + B-0743 + rule)
- **Cross-platform local pattern** (B-0738 + B-0739)
- **Cross-cluster federation primitive** (B-0741)
- **Reference-stack PoC** (B-0742)
- **Local-to-remote auth bridge** (B-0744 — THIS)

Complete substrate-engineering arc from "Aaron taps Touch ID to authorize a USB flash" → "operator's Touch ID authorizes cross-cluster Knights Guild ratification vote via OIDC + WebAuthn" with no protocol invention; all industry-standards-tracked.
