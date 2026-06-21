---
id: 081KSGS9H0008QG0R003X5Y2A5
priority: P2
status: open
title: installer WiFi-reproducibility — cache.nixos.org timeouts hang nixos-install on same N derivations; closure-baking into ISO + extra-substituters + Cachix mirror for reproducible-over-WiFi target (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001RR3ZXQ
composes_with:
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSGS9H0008QG0R001Q2DH2H
  - 081KSGS9H0008QG0R003JNSVR5
  - 081KSGS9H0008QG0R00120EEHM
tags: [installer, nixos-install, wifi-reproducibility, cache-nixos-org, closure-baking, substituters, cachix, network-resilience, physical-hardware-support-test, empirical-anchor, operator-ux]
---

## Problem

Empirical 2026-05-26 physical hardware-support test (Aaron over WiFi):
**`nixos-install` hits `Timeout was reached (28) Operation too slow` against `cache.nixos.org` on the SAME ~5 derivations TWICE IN A ROW, each retry burning the default 300s `stalled-download-timeout` before bailing.** The install is "moving forward" but each stalled-retry cycle costs ~10 min and the same 5 derivations keep timing out, suggesting a particular set of large/uncached/slow-route derivations rather than transient flake.

Operator framing 2026-05-26:

> *"any ideas is it stuck?"* → *"yeah i want to make it reproducable over wifi it's moving forward i just got 5 more warnings"* → *"i got timeouts on the same 5 files"* → *"twices in a row"* → *"after 300 seconds"*

This is the OPERATOR-NAMED target: **WiFi-reproducible install**. Current bounded-fix (this PR's other commit to `zeta-install.sh` invocation) adds `--fallback` + tuned timeouts so the install no longer loops on the same files — it falls back to local build when cache.nixos.org stalls. That fix UNBLOCKS the install but doesn't solve the underlying reproducibility-over-WiFi problem; for that we need closure-baking + alternate substituters.

## Why the same 5 derivations keep timing out

Hypotheses (preserve per default-to-both):

1. **Specific derivations are large** (e.g., perl-5.40.0 + linux kernel + nvidia-driver + gcc) — large file size + WiFi MTU + cache CDN edge-routing combine into consistent timeout on specific paths
2. **Cache.nixos.org CDN routing is dropping packets to operator's specific edge** — WiFi network + ISP path + Fastly CDN routing all interact; some path-pairs are consistently slow
3. **These derivations are NOT in any local store on the ISO** — they require fresh download every install; transient flake amplifies
4. **`cache.nixos.org` is in degraded state today** (worth checking against [status.nixos.org](https://status.nixos.org/))

The bounded-fix's `--fallback` makes nix build-from-source when substitution fails, which UNBLOCKS but is SLOWER per derivation (compile vs download). For WiFi-reproducibility long-term, the right shape is:

- Bake the closure for typical full-ai-cluster node configurations INTO the ISO at build time, so install doesn't need internet at all for those derivations
- Have fallback substituters (Cachix mirror, attic-served local mirror in the home lab, etc.) so cache.nixos.org timeouts don't gate progress
- Tune `nix.conf` defaults at ISO build time so future installs benefit without per-invocation flags

## Proposed mitigation (3 phases)

### Phase 1 — Closure-baking into ISO (biggest win)

At ISO build time (in `iso.nix`):

1. Compute the closure for `nixosConfigurations.<canonical-full-ai-cluster-host>` — gives all derivations a typical full-ai-cluster install needs
2. Include that closure in `isoImage.contents` via `pkgs.closureInfo` + `isoImage.storeContents`
3. Result: install can run OFFLINE for the baked closure; only diverges-from-baked derivations need internet

Cost: ISO grows from ~2 GB → ~6-8 GB (full closure size). Acceptable for the WiFi-reproducibility win + offline install ability.

Reference: NixOS minimal installer ISO already does this for the minimal closure. Need to extend for full-ai-cluster closure.

### Phase 2 — Alternate substituters in `nix.conf`

In the installer NixOS config (illustrative shape; substituter URLs + pubkeys are PLACEHOLDERS that MUST be verified at implementation time per `.claude/rules/dep-pin-search-first-authority.md` — URLs can drift, pubkeys can rotate, mirrors can deprecate; copy/paste from this row at implementation time is the failure mode the dep-pin rule catches):

```nix
nix.settings = {
  substituters = [
    "<VERIFY-AT-IMPL: https://cache.nixos.org/ — canonical primary>"
    "<VERIFY-AT-IMPL: https://nix-community.cachix.org or current community mirror>"
    # Future: self-hosted Cachix or attic mirror in home lab
    # "<VERIFY-AT-IMPL: https://zeta-cache.lucent.dev>"
  ];
  trusted-public-keys = [
    "<VERIFY-AT-IMPL: pubkey for cache.nixos.org via current nix.conf docs>"
    "<VERIFY-AT-IMPL: pubkey for nix-community.cachix.org via current cachix.org/use/nix-community page>"
  ];
};
```

Result: nix tries multiple substituters in parallel; if cache.nixos.org is slow, alternatives may serve faster. The implementer WebSearches current values + cites the source per dep-pin discipline.

### Phase 3 — Self-hosted mirror in home lab

Once the cluster is up:

1. Run an [attic](https://github.com/zhaofengli/attic) or [harmonia](https://github.com/nix-community/harmonia) server on the cluster
2. Pre-warm it with the full-ai-cluster closure
3. Subsequent node-adds + iterations pull from local LAN at gigabit instead of WiFi-to-CDN
4. Closes the home-lab reproducibility loop: cluster self-serves its own derivations

This depends on 081KSGS9H0008QG0R0011BC7T2 cascade #6 + the cluster being operational; sequencing matters.

## Acceptance

### Phase 1 (closure-baking) — load-bearing

- [ ] ISO build time computes closure for canonical full-ai-cluster node config
- [ ] `pkgs.closureInfo` + `isoImage.storeContents` include the closure
- [ ] Fresh install with WiFi disabled mid-install completes for baked derivations (manual operator test)
- [ ] ISO size growth documented; tradeoff acceptable

### Phase 2 (extra-substituters) — composable with Phase 1

- [ ] `nix.settings.substituters` includes nix-community.cachix.org
- [ ] `trusted-public-keys` includes corresponding cachix key
- [ ] Install proceeds when cache.nixos.org times out (validated via injected slow-route test)

### Phase 3 (home-lab mirror) — long-horizon

- [ ] attic or harmonia deployed on cluster
- [ ] Pre-warm script populates mirror with full-ai-cluster closure
- [ ] Subsequent node-adds prefer LAN mirror over WAN cache (substituter priority tuned)
- [ ] Documented in install-runbook

## Composes with

- 081KSGS9H0008QG0R0011BC7T2 cascade #6 (CI testing infrastructure — Phase 1 closure-baking test belongs in CI)
- 081KSGS9H0008QG0R001Q2DH2H (nmtui WiFi rescan — operator's first networking touchpoint)
- 081KSGS9H0008QG0R003JNSVR5 (gh auth — closure-baking eliminates gh download from install path; doesn't help with auth itself)
- 081KSGS9H0008QG0R001RR3ZXQ (preserve install log — diagnostic surface for future cache timeouts)
- 081KSGS9H0008QG0R00120EEHM (Bug 1 + Bug 3b — install completes; this row makes install RESILIENT)
- `.claude/rules/dep-pin-search-first-authority.md` — Phase 2 substituter list MUST WebSearch + verify current cachix.org URLs + pubkeys at implementation time

## Bounded-fix shipped today (different PR scope)

This same PR (081KSGS9H0008QG0R003X5Y2A5 row authored here) ALSO ships the bounded mitigation in `full-ai-cluster/usb-nixos-installer/zeta-install.sh`:

- `--fallback` so nix builds-from-source when substitute download fails
- `--option connect-timeout 10` so dead substituters drop fast (vs default 0=infinity)
- `--option stalled-download-timeout 60` so 5-minute-per-retry burn is cut to 1 minute
- `--option download-attempts 3` so retry loop bounds-progresses to fallback faster

That bounded-fix unblocks Aaron's IMMEDIATE WiFi install but doesn't solve the longer-term reproducibility-over-WiFi target. This row tracks the proper substrate.

## Why P2

- P0/P1 would be "install blocks completely on WiFi" — but the bounded-fix in this PR moves install from "looping forever on 5 files" to "slower but progressing"
- P2 captures the substrate-engineering work to make WiFi-install FAST + RELIABLE rather than SLOW + RELIABLE
- Sequenced after iter-5.4 install validation completes (which the bounded-fix unblocks)

## Full reasoning

Operator's 2026-05-26 verbatim test session:

1. Initial install warnings → "any ideas is it stuck?"
2. After explanation → "yeah i want to make it reproducable over wifi it's moving forward i just got 5 more warnings"
3. Empirical narrowing → "i got timeouts on the same 5 files" + "twices in a row" + "after 300 seconds"

The "same 5 files twice in 300s" empirical anchor is what makes this a structural problem rather than transient flake: a particular set of derivations is consistently failing the WiFi route, suggesting closure-baking or alternate-substituter is the right level of intervention rather than just retry tuning.

Sub-rows likely needed:

- 081KSGS9H0008QG0R003X5Y2A5.1: Phase 1 closure-baking implementation + ISO size tradeoff documentation
- 081KSGS9H0008QG0R003X5Y2A5.2: Phase 2 nix-community.cachix.org substituter addition + pubkey verification (WebSearch per dep-pin rule at implementation time)
- 081KSGS9H0008QG0R003X5Y2A5.3: Phase 3 home-lab attic/harmonia mirror (depends on cluster operational)

To be filed as the row matures + Phase 1 is implementable.
