---
id: 081KSGS9H0008QG0R002BC2ZR7
priority: P1
status: open
title: iter-6.5 (capstone) — ALL nix-installed deps + ALL ArgoCD/Helm deps current-version audit + agent discipline encoding — Otto's training-data defaults to plausible-but-old versions; latest-deps-from-the-beginning principle requires search-first-authority on every pin
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R003GM7TYN
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R0034ZYYR8
tags: [iter-6, capstone, version-sweep, nix, argocd, helm, search-first-authority, training-data-stale, agent-discipline, full-ai-cluster, supply-chain-security]
---

## Problem

The maintainer 2026-05-26 caught the systemic pattern after seeing the nixpkgs 24.11 (EOL'd Jun 2025) → 25.11 jump in [081KSGS9H0008QG0R001EKTS5A](081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md):

> *"we need to do that same thing to all our nix installed deps and argocd deps casue you are not good at getting current version"*

The substrate-honest acknowledgement: Otto-CLI's training-data cutoff (January 2026) means default-generated version pins for nix inputs, NixOS module package references, ArgoCD app targetRevisions, Helm chart versions, and container image tags will skew toward plausible-but-stale defaults. Without an explicit search-first-authority step (per `.claude/rules/search-first-authority.md`), every Otto-authored dep pin is a candidate for being silently out-of-date.

The 081KSGS9H0008QG0R001EKTS5A nixpkgs bump is ONE instance of this systemic gap. The capstone is encoding both the audit AND the agent-side discipline so the gap doesn't re-open.

## Empirical evidence of the pattern

| Surface | Current Otto-default | Latest stable | Lag |
|---|---|---|---|
| `full-ai-cluster/flake.nix` nixpkgs | `nixos-24.11` (Nov 2024) | `nixos-25.11` (Nov 2025) | 1 year, past EOL |
| `full-ai-cluster/flake.nix` nix-darwin | `nix-darwin-24.11` | `nix-darwin-25.11` | 1 year, past EOL |
| ArgoCD apps under `full-ai-cluster/k8s/applications/` | TBD — audit needed | TBD | TBD |
| Helm chart targetRevisions in ArgoCD apps | TBD — audit needed | TBD | TBD |
| Container image tags in NixOS modules / K8s manifests | TBD — audit needed | TBD | TBD |
| `.mise.toml` runtimes (dotnet, python, java, bun, uv, node) | Existing pins | Need audit cadence | TBD |

The principle scope: anywhere we pin a version, the pin needs a periodic refresh + the agent authoring the pin needs search-first-authority discipline.

## Target

Three composing sub-targets:

### Sub-target 1 — full audit of current dep state

Author `tools/audit/audit-dep-currency.ts` (Bun script) that:

1. Reads `full-ai-cluster/flake.nix` + `full-ai-cluster/flake.lock` + enumerates pinned inputs
2. Reads `full-ai-cluster/k8s/applications/*.yaml` ArgoCD `Application` resources + extracts `spec.source.targetRevision` + `spec.source.helm.chart`
3. Reads NixOS modules under `full-ai-cluster/nixos/modules/` + extracts package references / version literals
4. For each pin, queries the upstream (GitHub releases API for nix, ArtifactHub for helm charts, Docker Hub / GHCR for images, mise registry for runtimes) and reports `current_pin → latest_stable → lag`
5. Outputs structured JSON + human-readable table; exit 0 on success, exit 1 on any pin > 90 days behind latest stable

Wire into `.github/workflows/` as a weekly cadence (non-blocking; opens an issue if drift detected).

### Sub-target 2 — bump everything currently out-of-date

After sub-target 1's first run, file sibling B-NNNN rows OR bundle bumps into a single iter-6.5.1 PR per category:

- iter-6.5.1: nix inputs (subsumes 081KSGS9H0008QG0R001EKTS5A)
- iter-6.5.2: ArgoCD app targetRevisions + helm chart versions
- iter-6.5.3: container image tags
- iter-6.5.4: mise runtime versions

Each gets canary-test discipline before cluster rollout.

### Sub-target 3 — agent-discipline rule

Add `.claude/rules/dep-pin-search-first-authority.md` extending the existing search-first-authority rule with the specific dep-pin scope:

> **Whenever authoring a version pin (nix input, helm chart targetRevision, container image tag, mise runtime, etc.), the agent MUST WebSearch for the current latest stable AND cite the search result inline in the commit message + PR description. Training-data defaults are not authoritative; the cost of stale-pin authoring is high (security exposure, EOL channels, downstream migration debt).**

This rule auto-loads at cold-boot per `.claude/rules/wake-time-substrate.md` so future-Otto + Alexa-Kiro + Riven-Cursor + Vera-Codex + Lior-Antigravity all inherit the discipline.

## Acceptance

- [ ] `tools/audit/audit-dep-currency.ts` exists + runs cleanly on the current cluster substrate
- [ ] Initial audit run reports all current pin/latest/lag for nix + argocd + helm + images + mise
- [ ] Weekly cadence workflow scheduled (opens issue on drift)
- [ ] All currently-stale pins bumped via sibling iter-6.5.N rows (or bundled PR if small)
- [ ] `.claude/rules/dep-pin-search-first-authority.md` landed + auto-loads
- [ ] Composes_with cross-references back-filled on 081KSGS9H0008QG0R001EKTS5A / 081KSGS9H0008QG0R002T6J6FS-04

## Out of scope

- Auto-bumping (renovate / dependabot equivalent for our flake substrate) — possible follow-up; for now we ship the AUDIT and the DISCIPLINE; humans review the bump PRs
- Pin-by-pin justification for EVERY pin's choice — sub-target 1's output IS the justification trail

## Why this is P1 not P2

The principle Aaron just sharpened ("don't start behind from the beginning") is constitutive for the cluster substrate's whole stance toward dep currency. Without iter-6.5 the dep-staleness gap re-opens every time a new module / app lands. The agent-discipline encoding is the load-bearing piece — without it, the audit tool is one-off; with it, every future PR self-checks.

## Composes with

- [081KSGS9H0008QG0R001EKTS5A](081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — the first concrete instance of the systemic pattern this row captures
- [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — system.autoUpgrade handles WITHIN-channel currency; this row handles cross-channel + non-nix deps
- [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) / [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — node-update orchestration; consumes this row's audit output
- `.claude/rules/search-first-authority.md` — Otto-364 foundational rule; this row extends to dep-pin scope
- `.claude/rules/wake-time-substrate.md` — landing surface for the new agent-discipline rule
