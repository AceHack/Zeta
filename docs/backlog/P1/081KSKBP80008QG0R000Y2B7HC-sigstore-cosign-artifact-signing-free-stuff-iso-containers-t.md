---
id: 081KSKBP80008QG0R000Y2B7HC
priority: P1
status: open
title: sigstore/cosign artifact signing — free-stuff coverage for ISO + containers + tarballs + Nix substitutes (Fulcio CA + Rekor transparency log; OIDC-keyless via GitHub Actions); commercial CAs deferred for proprietary OS surfaces (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSKBP80008QG0R003Z4C0D0
composes_with:
  - 081KSGS9H0008QG0R0012R8ZWS
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSKBP80008QG0R003AX2A69
  - 081KSGS9H0008QG0R003JNSVR5
tags: [supply-chain, signing, sigstore, cosign, fulcio, rekor, keyless-oidc, slsa, artifact-attestation, iso-signing, container-signing, free-stuff, github-actions-oidc]
---

## Operator framing (Aaron 2026-05-27)

After asking whether Let's Encrypt could issue code signing certs (answer: no, LE explicitly out-of-scope), Aaron picked the free-stuff path:

> *"this sounds good and i can pay those costs for the propritary oses when we need please start on the free stuff and backlog it"*

Plus the outreach-channel signal:

> *"if you need outreach or to fill out forms you can involve me addison or max"*

(Sigstore needs no form-filling — fully open community substrate; outreach channel applies to SignPath Foundation OSS application + Apple Developer Program enrollment if/when we go that route.)

## Scope — free stuff first; proprietary OS surfaces deferred

### IN-SCOPE (this row — free signing substrate)

| Artifact class | Tool | Notes |
|---|---|---|
| Container images | **cosign** (sigstore) | Keyless via GitHub OIDC + Fulcio CA + Rekor transparency log; zero key management |
| ISO releases (iter-5.x / iter-6.x) | **cosign blob signing** | Detached sigs; verifiable via cosign + Rekor lookup |
| Tarball / archive releases | **cosign blob signing** OR GPG | Cosign preferred; GPG as legacy fallback |
| NixOS substitutes / store paths | `nix-store --sign` with operator-controlled key | Nix-native; binary cache integration; substrate-honest with Nix substitution model |
| Linux packages (deb/rpm) — IF we ever ship them | GPG repo-signing key | Operator-controlled key in HSM or 1Password-style vault |

### OUT-OF-SCOPE (deferred; Aaron-funded when relevant)

| Artifact class | Tool | Cost | Trigger to revisit |
|---|---|---|---|
| Windows binaries (Authenticode) | Commercial CA (DigiCert / Sectigo) | $200-700/yr | When we ship a Windows-side binary publicly + SmartScreen reputation matters |
| Windows binaries (OSS path) | SignPath Foundation | free (qualifying OSS) | Sibling option to commercial CA; requires SignPath app form |
| macOS binaries (notarized Gatekeeper) | Apple Developer Program | $99/yr | When we ship a macOS binary publicly |
| EV code signing (Windows reputation) | Commercial CA EV | $400-1000/yr | When SmartScreen reputation is load-bearing |

Aaron's commitment: funds proprietary-OS signing costs when load-bearing. No premature spend; current scope is free-stuff-coverage of the substrate we're shipping today.

## Why sigstore is the right primary

| Property | sigstore/cosign | Commercial CA | GPG-only |
|---|---|---|---|
| Cost | $0 | $200-1000/yr per cert | $0 (operator-managed) |
| Key management | None (OIDC-keyless) OR per-project ed25519 | HSM required for EV | Operator-managed (key-loss = signing-loss) |
| Transparency log | **Rekor (public, append-only)** — independent audit surface | Per-CA disclosure (limited) | None (private trust) |
| Verification chain | Fulcio root → cert tied to identity | CA root → cert tied to identity | Pubkey trust web |
| CI integration | First-class GitHub OIDC | Per-CA tooling | Manual key import |
| Existing in CNCF | Kubernetes / Helm / Tekton / etc. all use it | (mixed) | (legacy) |
| Container-native | Yes (designed for it) | Workable | Less natural |

For Zeta substrate (cluster + ISO + container-shipped substrate): sigstore is the operational fit. Composes with 081KSGS9H0008QG0R0012R8ZWS (artifact attestation work) + 081KSKBP80008QG0R003Z4C0D0 (cluster substrate the signed artifacts deploy into) + 081KSGS9H0008QG0R0011BC7T2 (CI cascade 6 full-install path that consumes signed artifacts).

## Sub-target breakdown

### Phase 1 — Container image signing via cosign keyless (smallest concrete substrate)

- Add `cosign sign --yes ghcr.io/Lucent-Financial-Group/Zeta:<tag>` step to release workflow
- GitHub OIDC token → Fulcio CA → short-lived cert tied to GitHub workflow identity
- Rekor entry auto-published; signature pushed alongside image (`<digest>.sig` tag)
- Verification: `cosign verify --certificate-identity-regexp '^https://github.com/Lucent-Financial-Group/Zeta' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' <image>`

### Phase 2 — ISO blob signing

- After `nixos-generate-iso` produces `zeta-installer-25.11-<ci-id>-<date>.iso`, run `cosign sign-blob --yes <iso>` → emits `<iso>.sig` + `<iso>.pem`
- Attach `.sig` + `.pem` to GitHub release alongside the ISO (composes with 081KSGS9H0008QG0R00126RHQR deferred release-attach work)
- Verification: `cosign verify-blob --signature <iso>.sig --certificate <iso>.pem --certificate-identity-regexp '...' --certificate-oidc-issuer '...' <iso>`

### Phase 3 — Tarball + cluster-substrate signing

- Same `cosign sign-blob` pattern for any tarball / .tar.gz / .nix store paths that ship as substrate
- NixOS substitute signing via operator-controlled ed25519 key in HSM or 1Password-style vault (separate channel; Nix-native)

### Phase 4 — Verification gates in install path

- `zeta-install.sh` verifies ISO signature before flashing (where applicable)
- `flake.nix` substituter config trusts the operator's pubkey only
- Container pulls verify cosign attestations before deploy (k8s + ArgoCD ImagePolicyWebhook OR Kyverno)

### Phase 5 — SLSA provenance + attestations

- `cosign attest --predicate <slsa-provenance.json> --type slsaprovenance <image>` per release
- Attestations stored in Rekor alongside signatures
- Composes with existing SLSA-aligned CI work (build-provenance.yml if it exists; else file as sub-row)

## Sub-rows to file when implementing

- 081KSKBP80008QG0R000Y2B7HC.1 — cosign install + GitHub OIDC wiring in release workflow (smallest end-to-end slice)
- 081KSKBP80008QG0R000Y2B7HC.2 — container image sign + verify round-trip test
- 081KSKBP80008QG0R000Y2B7HC.3 — ISO blob sign + cosign verify-blob test
- 081KSKBP80008QG0R000Y2B7HC.4 — NixOS substituter signing key (operator-controlled; HSM or vault-backed)
- 081KSKBP80008QG0R000Y2B7HC.5 — install-path signature verification (`zeta-install.sh` validates ISO sig before flashing)
- 081KSKBP80008QG0R000Y2B7HC.6 — cluster-side cosign verify (Kyverno OR ImagePolicyWebhook for k8s; ArgoCD app-of-apps config)
- 081KSKBP80008QG0R000Y2B7HC.7 — SLSA provenance attestation generation
- 081KSKBP80008QG0R000Y2B7HC.8 — substrate landing memory file + cross-link with SLSA framework

Order suggestion: 1 → 2 (container path; most-mature sigstore use-case); 3 → 5 (ISO path; composes with 081KSGS9H0008QG0R00126RHQR); 4 (Nix-native); 6 → 7 (verification + SLSA); 8 (substrate landing).

## What this is NOT

- NOT a replacement for the OS-level package signing (rpm/deb still need GPG; that's a separate sub-row)
- NOT a commitment to commercial CA for Windows/macOS today (deferred per operator framing; budget when load-bearing)
- NOT a TLS substrate (Let's Encrypt + ACME stays as-is for TLS server certs; separate scope)
- NOT a replacement for operator-controlled keys where they're load-bearing (Nix substituter signing key stays operator-managed)

## Composes with

- **081KSKBP80008QG0R003Z4C0D0** (parent) — cluster substrate the signed artifacts deploy into
- **081KSGS9H0008QG0R0012R8ZWS** — artifact attestation work (sigstore + cosign IS the attestation primitive)
- **081KSGS9H0008QG0R0011BC7T2** — CI cascade 6 full-install path consumes signed artifacts
- **081KSKBP80008QG0R003AX2A69** — credential persistence (cosign keys IF used + Rekor identity binding compose with the per-AI identity substrate)
- **081KSGS9H0008QG0R003JNSVR5** — installer interactive-login-vs-baked-in-keys (cosign verify-blob in `zeta-install.sh` composes with the no-creds-on-ISO discipline; sig + pem are public)
- **081KSGS9H0008QG0R00126RHQR** (deferred) — release-attach work; sig + pem files attach alongside ISO on GitHub release
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation in isolated worktrees per discipline

## Composes with prior substrate

- iter-5.5.0 3-vendor systemd guard post ISO (the artifact this signs)
- iter-6.x distro-upgrade substrate (081KSGS9H0008QG0R001EKTS5A-081KSGS9H0008QG0R002BC2ZR7) — signed substrate becomes part of the upgrade trust chain
- SLSA framework (sigstore is the canonical primitive for SLSA Level 3+ artifact attestations)
- CNCF graduated projects substrate (cosign is CNCF-graduated; broad ecosystem adoption)

## Outreach channels (Aaron 2026-05-27)

> *"if you need outreach or to fill out forms you can involve me addison or max"*

Sigstore needs zero outreach (open community substrate; no form-filling). The outreach channel applies to future Phase decisions:

- **SignPath Foundation** (if/when Windows OSS signing becomes load-bearing) — application form for qualifying OSS projects; cert backing donated by commercial CA
- **Apple Developer Program** (if/when macOS binaries ship) — operator enrollment ($99/yr); Aaron-funded
- **Commercial CA EV cert** (if/when Windows SmartScreen reputation becomes load-bearing) — DigiCert / Sectigo / etc.; Aaron-funded
- **Any future signing-substrate that requires identity verification beyond GitHub OIDC** — Aaron / Addison / Max can fill forms / liaise with CAs

## Acceptance criteria (Phase 1 = container path; smallest substrate slice)

- [ ] cosign keyless signing wired into release workflow via GitHub OIDC
- [ ] Container image `<digest>.sig` published to ghcr.io alongside image
- [ ] Rekor entry verified (`rekor-cli get --uuid <uuid>` returns valid entry)
- [ ] `cosign verify` succeeds against the published image with `--certificate-identity-regexp` matching our org
- [ ] No new GraphQL budget burn beyond existing CI cost
- [ ] No commercial CA dependency
- [ ] Documentation in `tools/release/README.md` covering the verify command + identity-regexp

## Why P1

- Operator explicitly authorized + named the scope ("please start on the free stuff and backlog it")
- Bounded scope (Phase 1 = container path; smallest concrete slice)
- Composes cleanly with existing CI substrate + 081KSGS9H0008QG0R0012R8ZWS attestation work + iter-5.x release pipeline
- Removes implicit trust on unsigned artifacts in cluster deploy path
- Public transparency log (Rekor) preserves substrate-honest audit trail for every signed release

## Substrate-honest framing

This row addresses the FREE-STUFF substrate-engineering signing surface. It does NOT address commercial-CA-required scope (Windows SmartScreen, macOS Gatekeeper notarization); those are operator-funded + deferred per Aaron's framing.

Per `.claude/rules/non-coercion-invariant.md` HC-8 — sigstore's keyless OIDC model means no operator-key-loss-equals-signing-loss failure mode; the identity binding is at the OIDC issuer + Fulcio CA root scope, which is operator-distinct from any single-key custody pattern. NixOS substituter key remains operator-controlled (operator authority preserved on substrate that operator-must-own).

## Full reasoning

Aaron 2026-05-27 conversation arc (immediately after the gh-throttle / 081KSKBP80008QG0R003AX2A69 cred-persistence thread):

1. *"can you use lets encrypt to get code signing certs?"* (asked)
2. (Otto answered: no, LE explicitly out-of-scope; sigstore/cosign is the free fit; commercial CAs needed only for proprietary OS signing)
3. *"this sounds good and i can pay those costs for the propritary oses when we need please start on the free stuff and backlog it"*
4. *"if you need outreach or to fill out forms you can involve me addison or max"*

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: code signing / artifact signing / sigstore / cosign / supply chain
- Searched: docs/backlog/ (081KSGS9H0008QG0R0012R8ZWS — artifact attestation is closest existing); .claude/rules/ (no prior rule); memory/ (no prior memory)
- Found: 081KSGS9H0008QG0R0012R8ZWS (artifact attestation), 081KSGS9H0008QG0R00126RHQR (release-attach deferred), 081KSGS9H0008QG0R003JNSVR5 (installer creds discipline), iter-5.x ISO release pipeline
- Conclusion: no existing substrate covers sigstore/cosign artifact signing; this row composes with 081KSGS9H0008QG0R0012R8ZWS attestation work as the primitive provider

This is the operational primitive 081KSGS9H0008QG0R0012R8ZWS has been describing; 081KSKBP80008QG0R000Y2B7HC brings the concrete tooling + workflow integration.
