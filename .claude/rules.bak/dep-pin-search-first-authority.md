# Dep-pin search-first authority — never assert version/path/name pins from training-data default

Carved sentence:

> Whenever authoring a version pin (nix input, helm chart
> targetRevision, container image tag, mise runtime, NixOS-substrate
> path, ArgoCD app), the agent MUST WebSearch for the current latest
> stable AND cite the search result inline in the commit message + PR
> description. Training-data defaults are not authoritative; the cost
> of stale-pin authoring is high (security exposure, EOL channels,
> downstream migration debt, false-positive CI assertions that block
> the artifact pipeline).

## Operational content

This rule extends [`search-first-authority.md`](search-first-authority.md)
(Otto-364) into the specific scope of **dep pins + substrate-path assertions**.
The Otto-364 rule already says: for load-bearing claims about tools / standards
/ APIs / language runtimes / libraries / CI services / security policy, WebSearch
the current upstream documentation BEFORE asserting.

The dep-pin scope tightens this further: even small-looking pins (a single
nixpkgs channel reference, a single chart targetRevision, a single path in
an "expected files" list) carry the same training-data-staleness risk and
deserve the same WebSearch discipline.

### What counts as a dep-pin authoring action

| Authoring surface | Examples |
|---|---|
| **Nix flake inputs** | `nixpkgs.url`, `nix-darwin.url`, third-party-flake URLs |
| **NixOS module package references** | package versions in `environment.systemPackages`, helm-chart-sourced apps |
| **ArgoCD `Application` resources** | `spec.source.targetRevision`, `spec.source.helm.chart`, `spec.source.repoURL` |
| **Helm chart targetRevisions** | chart version strings |
| **Container image tags** | image:tag literals in NixOS modules / K8s manifests |
| **mise runtimes** | `.mise.toml` runtime versions |
| **Substrate-path assertions in audit/lint tools** | REQUIRED_FILES lists, EXPECTED_PATHS, golden-output paths |
| **GitHub Actions runners + uses pins** | runner image (`ubuntu-24.04`), action SHA pins + version comments |
| **External-API endpoint references** | OpenAI/Anthropic/etc. API version strings |
| **Project / framework version references** | NixOS release names, K8s versions, etc. |

### Required process per dep-pin authoring action

1. **WebSearch for current latest stable** with explicit year in query (current year is 2026; use it). Example queries:
   - `"NixOS latest stable release 2026"` → confirms channel name
   - `"kured helm chart latest version 2026"` → confirms chart version
   - `"NixOS installer ISO directory layout boot grub isolinux 2026"` → confirms expected substrate paths
2. **Cite the WebSearch result inline** in the commit message body AND PR description. Format:
   ```
   Per WebSearch <YYYY-MM-DD>:
     [source title](URL) — current latest stable: <version>
   ```
3. **If the WebSearch result conflicts with training-data default**, the WebSearch ALWAYS WINS. Do not "average" them; do not infer "probably both correct."
4. **If WebSearch surfaces no current-stable evidence**, the substrate-honest move is to surface uncertainty to the operator + propose alternatives, NOT pick the training-data default as a fallback.
5. **For substrate-path assertions** (REQUIRED_FILES lists, expected paths), the same discipline applies but with empirical verification (download a recent artifact + inspect, OR cite the upstream layout docs). Don't author the assertion list from training-data assumptions about how the upstream ships files.

### When this rule fires

- ANY new flake input addition
- ANY `nix flake update` that bumps a pin
- ANY helm chart application opened
- ANY container image referenced
- ANY audit/lint tool with a REQUIRED list of file paths from an upstream-shipped artifact
- ANY ArgoCD Application authored
- ANY mise runtime added

### When this rule does NOT fire

- Internal-repo-only paths (your own substrate; you're the source of truth)
- Theoretical / illustrative version strings in documentation (mark as `<example>` or `<latest-stable>` placeholder)
- Re-references to a pin that another file in the SAME PR already verified per this rule (cite the sibling verification, no duplicate WebSearch needed)
- Direct user instruction to use a specific version that the operator already named (operator authority overrides; cite the operator's quote)

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the operational
failure mode this rule catches is highest at WRITE-TIME, when the agent is
about to emit a version string. Memory-file-only encoding doesn't intercept
the in-progress write. Auto-load at cold-boot makes the discipline available
at the moment the next-token decision is being made.

## Empirical anchors

### Anchor 1 — NixOS 24.11 pinned past EOL (081KSGS9H0008QG0R001EKTS5A / 2026-05-26)

`full-ai-cluster/flake.nix` shipped initially with `nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11"`. The maintainer 2026-05-26 asked: *"is there a 25 we should go ahead and distro upgrade we don't want to be behind"*. WebSearch surfaced: NixOS 25.11 "Xantusia" current stable (released 2025-11-30; EOL 2026-06-30); 24.11 EOL'd 2025-06-30 — past EOL when our flake was authored. Substrate-honest finding: the training-data default for "latest NixOS channel" had drifted stale by 1 year + 2 channel releases. Backlogged as [081KSGS9H0008QG0R001EKTS5A](../../docs/backlog/P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md).

### Anchor 2 — cascade #4 ISO audit asserted wrong NixOS layout (P0 fix-fwd / 2026-05-26)

`tools/ci/audit-installer-iso-content.ts` (shipped in PR #5119) authored `REQUIRED_ISO_PATHS = [..., "boot/grub/grub.cfg", ...]` from training-data assumptions about legacy GRUB layouts. NixOS installer ISOs as of 24.11 use **isolinux** (`isolinux/isolinux.cfg`) for BIOS boot and **refind** (`EFI/BOOT/refind_x64.efi`) for UEFI boot — NOT legacy GRUB at the asserted path. Result: the audit blocked EVERY ISO build for 4 consecutive commits (`35fd3aeef`, `848467588`, `5d9f8605a`, `ed6a7b8b9`) because the false-positive assertion fired on every run. The last successful ISO build was `17523e4fb` (iter-5.2.1 era); the maintainer was about to re-flash a USB expecting current iter-5.x substrate but would have gotten stale content. Fixed in PR #5125 by replacing the single-path assertion with a bootloader-any-of family check across multiple NixOS-version layouts (isolinux + refind + EFI + legacy grub).

The substrate-honest implication: this rule's exact discipline would have prevented the cascade #4 false-positive. The author (the agent) should have WebSearched / verified the NixOS-actual installer ISO directory layout before authoring the REQUIRED_ISO_PATHS list. Skipping that step let the training-data-default leak through into a load-bearing assertion that gates the artifact pipeline.

### Anchor 3 — kured chart targetRevision marker in 081KSGS9H0008QG0R003GM7TYN (2026-05-26)

The 081KSGS9H0008QG0R003GM7TYN backlog row authoring intentionally used the placeholder `targetRevision: <latest-stable-VERIFIED-via-WebSearch>  # per 081KSGS9H0008QG0R002BC2ZR7 discipline` rather than a training-data default. This is the SHAPE this rule encourages: when you don't yet know the current version + you're authoring a backlog row that will be implemented later, mark the placeholder explicitly + name the rule the implementer must follow. The implementation PR then does the WebSearch + replaces the placeholder.

## Composes with

- [`search-first-authority.md`](search-first-authority.md) (Otto-364) — the foundational rule this row narrows to dep-pin scope
- [`wake-time-substrate.md`](wake-time-substrate.md) — why this rule auto-loads
- [`fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`](fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md) — companion at agent-coordination scope; same root cause class ("Otto-defaults-to-plausible-but-unverified" applied to two different surfaces)
- [`razor-discipline.md`](razor-discipline.md) — operational claims only; version pins ARE operational claims (you're stating "this version is current"); unverified version pins fail the razor
- [`grep-substrate-anchors-before-razor-as-metaphysical.md`](grep-substrate-anchors-before-razor-as-metaphysical.md) — sibling discipline: verify substrate anchors before razor-flagging; verify version pins before asserting
- [`refresh-before-decide.md`](refresh-before-decide.md) — refresh applies at the per-version-pin scope, not just per-tick
- [`additive-not-zero-sum.md`](additive-not-zero-sum.md) — WebSearch verification is bandwidth-engineering input that compounds (verified pins land cleanly + survive review; unverified pins burn round-trips with reviewers + ops time)

## Composes with substrate

- [081KSGS9H0008QG0R001EKTS5A](../../docs/backlog/P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — empirical anchor 1
- [081KSGS9H0008QG0R002BC2ZR7](../../docs/backlog/P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — the capstone backlog row this rule was named in as sub-target 3
- [081KSGS9H0008QG0R002T6J6FS](../../docs/backlog/P2/081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md), [081KSGS9H0008QG0R003GM7TYN](../../docs/backlog/P2/081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md), [081KSGS9H0008QG0R00280HHA7](../../docs/backlog/P2/081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md), [081KSGS9H0008QG0R0034ZYYR8](../../docs/backlog/P2/081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md) — sibling cluster-update rows that consume this rule's discipline
- PR #5125 (the cascade #4 fix-fwd) — the empirical fix that surfaced the rule-landing trigger

## Substrate-honest framing

This rule does NOT:

- Make WebSearch mandatory for every commit (only for dep-pin / path-assertion authoring actions)
- Require WebSearch for re-runs that don't change a pin (the bump is the event; idempotent edits don't re-trigger)
- Override operator authority (if the maintainer names a specific version, that wins)
- Solve the lag between WebSearch cache + latest release (cache may be hours stale; that's acceptable bandwidth-engineering tradeoff)

This rule DOES:

- Force the WebSearch step at the moment of authoring a load-bearing version assertion
- Encode the cite-the-source discipline in commit messages + PR descriptions
- Provide the empirical anchors so future-Otto sees the cost of skipping the discipline
- Compose with the agent-coordination companion rule so both "Otto-defaults-to-plausible-but-unverified" failure modes are surfaced together

## Full reasoning

The maintainer 2026-05-26 substrate-honest catch:

> *"we need to do that same thing to all our nix installed deps and argocd deps casue you are not good at getting current version"*

That sentence names BOTH the systemic gap (training-data version-pin staleness across nix + argocd + downstream) AND the agent-discipline failure mode (Otto-defaults-to-plausible-but-unverified). [081KSGS9H0008QG0R002BC2ZR7](../../docs/backlog/P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) names both at backlog scope as a capstone; this rule lands the agent-discipline half at wake-time substrate scope so the gap doesn't re-open in every future authoring action.
