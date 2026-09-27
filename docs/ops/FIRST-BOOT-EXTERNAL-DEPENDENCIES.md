# First-boot external dependencies — what an operator gets when each is unavailable

Work item `081M3BWJ96T087G0R0028WT3S3`. Trajectory:
[`docs/trajectories/usb-installer-first-boot-reliability/RESUME.md`](../trajectories/usb-installer-first-boot-reliability/RESUME.md).

Every row answers one question: **when this dependency is unreachable, what does the
operator see?** Line numbers are as of the commit that added this page.

## Verdicts

| verdict | meaning |
|---|---|
| **named refusal** | it stops (before damage where it matters), names the dependency, and says what to do |
| **degrades** | it continues, part of the install is missing, and something names what |
| **hangs** | it waits or retries with no bound, or with nothing on the operator's console |
| **silent** | it continues and nothing records that a step did not happen |
| **unnamed stop** | it stops, after the wipe, with the raw tool error and a generic `Install failed (rc=N)` — fits none of the four above |

## Evidence register

| tag | meaning |
|---|---|
| **MEASURED** | observed on a real run; the run id or work item carrying it is cited |
| **source** | read from source, **not measured** — nobody has made this dependency unreachable and watched |
| **fixed here** | the disposition changed in the PR that added this page, with a test; the new disposition is read from source, not measured on an ISO |

## Installer phase (live USB: `zeta-first-boot.sh` → `zeta-install.sh`)

| # | dependency | where | when unavailable | verdict | evidence |
|---|---|---|---|---|---|
| 1 | Network presence wait (ICMP to `1.1.1.1` / `github.com`, **then HTTPS to `github.com`**) | `zeta-first-boot.sh:509` `has_internet`; waits `:427` (30s), `:435` (90s); nmtui loop `:610` | Offline: bounded wait, then either nmtui (wifi hardware; operator-interactive by design) or `Still offline; proceeding` (`:578`) into row 2's refusal. **Before this PR** the probe was ICMP-only, so a network that drops ping but passes HTTPS read as offline forever — on a box with wifi hardware, an nmtui loop no operator asked for. | named refusal (via row 2); was **hangs** | fixed here — `first-boot-network-waits-are-bounded.test.ts` |
| 2 | `git ls-remote $REPO_URL` preflight — exercises DNS, route, TLS, repo readability | `zeta-install.sh:2133` | Refuses **before any disk is wiped**, with remedy (`nmtui`) and "Nothing has been wiped". The message now also prints the machine's UTC clock, because a skewed clock fails TLS and reads as "network". | named refusal | source; ordering pinned by `preflights-precede-the-wipe.test.ts` B4 |
| 3 | Nix binary cache `cache.nixos.org` | substituters `nixos/modules/common.nix:248`; `nixos-install --option fallback true` `zeta-install.sh:3968` | **Before this PR:** no probe; `fallback true` turns an unreachable cache into a from-source build of the whole closure — each download bounded (`connect-timeout 10`, `stalled-download-timeout 60`, `download-attempts 3`) but the total not — on a disk already wiped. **Now:** probed before the wipe (`:2156`); refuses by name, escape hatch `ZETA_ALLOW_NO_BINARY_CACHE=1` (logged). A missing `curl` is reported as "probe DID NOT RUN", never a pass. | named refusal; was **hangs** | fixed here — `preflights-precede-the-wipe.test.ts` B6 |
| 4 | Second substituter `nix-community.cachix.org` | `common.nix:248` | Not probed. With `cache.nixos.org` up, Nix skips an unreachable substituter per path and falls back to building; slower, not stopped. | degrades | source |
| 5 | Flake inputs — `nixpkgs`, `disko`, `nixos-hardware`, `flake-utils`, `nix-darwin`, `systems`, all `type: github` in `full-ai-cluster/flake.lock` | fetched by `nixos-install --flake` `:3968`; not baked into the ISO (no `storeContents` in `usb-nixos-installer/nixos/installer/configuration.nix`) | GitHub was reachable seconds earlier (row 2), but the tarball endpoint and its rate-limit class are not established. On failure `set -e` (`:48`) exits and `zeta-first-boot.sh:928` prints `Install failed (rc=N)` over Nix's own error — **after the wipe**. | unnamed stop | source |
| 6 | `git clone $REPO_URL /mnt/etc/zeta` | `zeta-install.sh:2360` | Covered by row 2's preflight seconds earlier, but has **no timeout**: a stall mid-clone after the wipe waits forever. Not touched here (adjacent to the repo-pin block owned elsewhere). | hangs | source — `081M3HPNSY5087G0R002QAVCEJ` |
| 7 | `git fetch` of the pinned ISO commit | `zeta-install.sh:2387` | `timeout 60`, refuses by name; escape hatch `ZETA_ALLOW_REPO_DRIFT=1` is recorded. | named refusal | source (item's "reviewed") |
| 8 | Pre-clone to `~zeta/Zeta` | `zeta-install.sh:4122` | **Before this PR:** no timeout (git has none), so a black-holed route stalled the install with nothing on screen. **Now:** `timeout 600`, `GIT_TERMINAL_PROMPT=0`; on failure a WARN naming the repo and "retry post-reboot"; install continues without the runtime bootstrap. | degrades; was **hangs** | fixed here — `first-boot-network-waits-are-bounded.test.ts` |
| 9 | `tools/setup/install.sh` → mise → **GitHub attestation API, 60/h unauthenticated per source IP** | loop `:4245` (3 attempts); diagnosis `zeta_install_failure_cause` `:4198`; marker `PARTIAL PROVISION` `:4292` | Continues half-provisioned. The rate-limit case is now named with the reset time and remedies (`:4201`). | degrades | **MEASURED** — run `36110246885`, `081M3BVERK0087G0R001GVH1QP` |
| 10 | `install.sh`'s other download hosts (runtimes, agent CLIs) | same loop | DNS / connection-refused / disk-full signatures are named (`:4225` ff.); anything else prints the generic error tail. Per-attempt wall time is not bounded by the installer (mise's own HTTP timeouts apply; not verified). | degrades | source |
| 11 | GitHub API for `gh auth` + self-registration PR | prompt `:3455` (skipped when non-interactive); `gh api /user` `:3679` | Interactive only. Failure prints `WARN ... skipping` and continues without SSH-key copy / registration PR. | degrades | source |
| 12 | DNS (NetworkManager DHCP, `common.nix:267`; installer `configuration.nix:73`; no `systemd-resolved` config) | — | Surfaces as row 2's refusal, which names reachability, not DNS. `install.sh`'s diagnosis names DNS explicitly (`:4225`). | named refusal (not DNS-specific) | source |
| 13 | NTP / clock (no timesync config in repo → NixOS default `systemd-timesyncd`) | — | A skewed clock fails TLS everywhere; surfaces as row 2's refusal, which now prints the clock. | named refusal (misattributable) | source |
| 14 | Bootstrap-or-join discovery (avahi mDNS; local, but a first-boot dependency) | `nixos/cluster-discovery/probe.ts:83`; consumer `zeta-first-boot.sh:746`–`:755` | `DISCOVERY DID NOT RUN ... a check that did not run, NOT a check that passed`, then falls back to the ISO default role. **Correcting the item's draft ("silent skip"):** the console output is named; what is silent is that discovery has never once executed (`--no-db-lookup` is rejected). `ZETA_DISCOVERY_REQUIRED=1` turns it into a refusal. | degrades | **MEASURED** — run `35985197702`, `081M39K8ND1087G0R000G4EN4N` (not touched here) |

## First-boot cluster phase (installed disk)

**Read this first:** on a real install there is **no operator-facing first-boot
verdict**. `zeta-first-boot-k3s-verify` is gated by `ConditionPathExists` on a
QEMU-only marker (`nixos/modules/zeta-first-boot-k3s-verify.nix:30`), so every row
below surfaces only to someone running `kubectl` or `journalctl`. Filed as
`081M3HPNSW7087G0R001W2Z6YX`.

| # | dependency | where | when unavailable | verdict | evidence |
|---|---|---|---|---|---|
| 15 | Bootstrap images — **26** refs behind the seven `services.k3s.manifests` charts: quay.io 12, ghcr.io 5, docker.io-family 5, registry.k8s.io 2, cgr.dev 1, public ECR 1 | `full-ai-cluster/k8s/bootstrap-preload-images.json`; staged by `zeta-install.sh:4013`; status `k3s-bootstrap-image-preload.nix:169`/`:172` | **Archive present:** not a dependency — k3s imports it before pulling. **Archive absent:** named `ABSENT` in `/run/zeta-bootstrap-image-preload.status` and the journal, then ordinary pulls; a spent rate limit is `ImagePullBackOff`. | degrades (only when the archive is absent) | **MEASURED** — `bootstrap-preload-blackhole.ts` positive + negative control (RESUME §3). Covers **images only** |
| 16 | k3s built-in images — `rancher/mirrored-pause`, coredns, metrics-server, `klipper-helm`, `klipper-lb` | **deliberately not preloaded** (`k3s-bootstrap-image-preload.nix:60`); docker.io → `mirror.gcr.io` (`k8s/registry-mirrors.json:5`) | With both the mirror and docker.io unreachable, no pod sandbox (pause) and no `helm-install` Job (klipper-helm) can start; the kubelet retries indefinitely. So the "cluster comes UP offline" line printed by `zeta-install.sh` holds only while the docker.io path works. | hangs | source — `081M3HPNST9087G0R001X410AE` |
| 17 | Helm chart repos — `argoproj.github.io`, `charts.jetstack.io` (×2), `helm.cilium.io`, `charts.external-secrets.io`, `spiffe.github.io` (×2) | `k8s/bootstrap/{argocd,cert-manager,trust-manager,cilium,external-secrets,spire}-install.yaml` (`repo:` lines) | Charts are fetched by the `helm-install-<chart>` Job at run time and are **not preloaded**. Unreachable repo → the Job fails and helm-controller retries; nothing on the console. The WP11 lane's verdict 4 would read `complete=false`, but that lane is test-only (above). | hangs | source — `081M3HPNST9087G0R001X410AE` |
| 18 | ArgoCD repo-server clone/render of `github.com/Lucent-Financial-Group/Zeta`, ~49 Applications, every 180s | `k8s/bootstrap/root-application.yaml:30` | Applications sit at `sync=Unknown` / `DeadlineExceeded`; the node is up and the apps never arrive. | degrades | **MEASURED** — `081M3BPJNRS087G0R0008WFXBZ` (not touched here) |
| 19 | ArgoCD catalog images — ~109 of the 134 in `full-ai-cluster/k8s/image-resolvability.json` | 134 entries: docker.io 48 (mirrored), quay.io 34, ghcr.io 31, registry.gitlab.com 14, registry.k8s.io 4, cgr.dev 1, code.forgejo.org 1, public ECR 1 | Per-Application `ImagePullBackOff`; the rest of the roster proceeds. Only docker.io (36%) has a pull-through cache. | degrades | partly **MEASURED** (counts recomputed from the JSON; pull failures not induced here) |
| 20 | GitHub API for `zeta-self-register.service` | `nixos/modules/zeta-self-register.nix:186` (`Restart=on-failure`, 30s, start-limit capped) | Retries a bounded number of times, then stops; journal only. | degrades | source |
| 21 | NTP on the installed node (default `systemd-timesyncd`) | — | Not established: a clock far enough off would break TLS to every row above, and k3s certificate validity is clock-sensitive. | **unknown** | unverified |

`k3s-wait-for-address.nix:99` (no global IPv4 after 120s → proceeds, k3s restarts
every 5s) is local, not external, and is named in the journal; listed for
completeness, not counted.

## Summary

| verdict | before this PR | after this PR |
|---|---|---|
| named refusal | 4 (rows 2, 7, 12, 13) | **6** (+1, +3) |
| degrades | 9 | **10** (+8) |
| hangs | **6** (rows 1, 3, 6, 8, 16, 17) | **3** (6, 16, 17) |
| silent | 0 | 0 |
| unnamed stop | 1 (row 5) | 1 |
| unknown | 1 (row 21) | 1 |

**No silent row was found.** The honest caveat is the paragraph above the cluster
table: with no operator-facing verdict on real installs, rows 15–21 are console-silent
even where the cluster records them in events or the journal.

## Not verified (say so, do not round up)

- Every **source** row. None of rows 3–8, 10–13, 16, 17, 20, 21 has been made
  unreachable on a real ISO and watched; the three fixes are pinned by unit tests
  against the scripts, not by an ISO lane.
- Which HTTPS endpoint Nix uses for `github:` flake inputs, and whether it shares the
  60/h unauthenticated API budget with row 9.
- The helm-controller retry schedule for row 17 (count, backoff) — upstream k3s
  behaviour, not measured here.
- Whether containerd falls back from `mirror.gcr.io` to `registry-1.docker.io` for row
  16 on this k3s version.

## Follow-ups minted

- `081M3HPNST9087G0R001X410AE` — bootstrap chart repos (row 17) and k3s built-in images
  (row 16) are the remaining offline gap in the preload.
- `081M3HPNSW7087G0R001W2Z6YX` — no operator-facing first-boot verdict on real installs.
- `081M3HPNSY5087G0R002QAVCEJ` — no overall time bound on the post-wipe clone (row 6) and
  `nixos-install` (row 5).
