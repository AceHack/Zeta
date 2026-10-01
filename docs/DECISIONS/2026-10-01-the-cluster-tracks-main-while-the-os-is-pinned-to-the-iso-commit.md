# ADR: The cluster tracks `main`; only the OS layer is pinned to the ISO commit

Date: 2026-10-01
Status: Accepted as the *standing design*; recorded now because it had never been written down and an
audit (`docs/ops/INSTALL-TIME-CONFIG.md` row 22) mistook it for an oversight.
Authors: install-time-config audit (evidence below). Not a maintainer ratification of any CHANGE:
nothing here alters behaviour.

## The question

`zeta-install.sh` pins the **installed OS** to the commit the ISO was built from
(`ZETA_ISO_COMMIT` / `/zeta-repo-pin`, `installer/repo-pin.ts`). Every ArgoCD `Application`, including
the app-of-apps root `bootstrap/root-application.yaml`, says `repoURL: https://github.com/Lucent-Financial-Group/Zeta`
and `targetRevision: main`. So one node runs two trees: a NixOS closure at the ISO commit and a
cluster that follows `main` HEAD. Is that a defect to close, or the design?

## Decision: it is the design. Keep it. Say so, and make the skew visible

### Evidence it is deliberate

1. **The root says so in its own header** (`bootstrap/root-application.yaml`): *"Adding a workload to the
   cluster: ... 3. git commit + push to main 4. ArgoCD picks it up on the next sync (~3 min)"*. The
   delivery model for the cluster layer **is** "merge to main and nodes converge".
2. **`docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md`**
   (Accepted, ratified 2026-08-08): the fleet lands a commit on `main` every ~5-10 minutes, and
   correctness is restored by *reconciliation*, not by gating. A cluster pinned to a SHA could not be
   healed by a fix on `main` - it would have to be re-pinned per node by hand, which is the
   hand-editing this audit exists to remove.
3. **The repo-pin's own scope is the OS.** `installer/repo-pin.ts` states the defect it closes: *"a PR's
   NixOS-module changes could never be exercised by the real install path before merge"* and *"a USB
   flashed on day X installs whatever main is on day Y"* - both about the **NixOS tree cloned for
   `nixos-install`**. Nothing in it speaks to ArgoCD, and `ZETA_ALLOW_REPO_DRIFT` is likewise about the
   OS clone.
4. **The override point already exists and is deliberately the repo URL.** `cluster/ports.ts` builds the
   root from `gitRepoUrl` (`ZETA_ARGOCD_GIT_REPO_URL`) + `gitRef`, and `cluster/lane-tree-source.ts`
   points CI lanes at a *different tree* (a served lane tree) through exactly that parameter, with
   14 `repoURL` rewrites. So "sync something other than `main`" is a supported, tested operation for
   lanes - it is simply not the default for a real node.

### Why not pin the cluster to the ISO commit

- Every child Application carries its **own** `targetRevision: main`, so pinning means rewriting every
  Application at install time, not changing one value.
- It would freeze the node out of every fix that lands after the ISO was cut (see 2).
- The pin would have to be re-cut for every fix, for every node.

## Consequences (what the design costs, stated rather than discovered)

| situation | what happens |
|---|---|
| ISO built from commit X, `main` is now Y | OS closure = X; workloads = Y. Intended. |
| An ISO built from an UNMERGED branch (QEMU lanes, `--repo-pin`) whose Nix modules render an install-time Application (`platform-public-tls`, `cilium-lb-ipam-pool`) pointing at a `path:` that exists only on the branch | ArgoCD cannot find the path on `main` until the PR merges: the Application sits `ComparisonError`. A PR's cluster-side changes are exercised through the lane tree (`lane-tree-source.ts`), not through `targetRevision`. |
| No route to GitHub (air-gapped LAN, firewall, fork, private mirror) | Nothing syncs. `repoURL` is a literal in every Application; there is no install-time knob. **Open** - see below. |

## What this ADR does NOT settle (open, owner decisions)

- **Offline / fork / mirror installs.** A node that cannot reach `github.com` cannot sync. The honest fix is
  an install-time `repoURL` (the `ZETA_ARGOCD_GIT_REPO_URL` seam, applied to the real root rather than only
  the lane root) - a separate, larger change that also needs a mirror of the 49 Applications' `repoURL`s.
- **Pin-to-tag for a regulated deployment.** Possible later as an opt-in install value; not the default.

## Visibility (the only code change)

The installer's completion banner now states the asymmetry on every install - `OS pinned to <sha>;
cluster workloads follow github main HEAD` - so it is read, not discovered. Pinned by
`cluster/root-tracks-main.test.ts`, which also fails if the root or the install-time Applications stop
tracking `main` without this ADR being updated.
