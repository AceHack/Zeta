# Git-native, fork-aware trust: forks use their OWN credentials (never upstream's), identity derived from `origin` — one-repo-now vs split-later, and the full-network-map tradeoff

*Captured 2026-06-09 from Aaron. Trust/identity for Zeta should be **git-native**, **fork-safe** (a fork must not
accidentally use upstream's credentials), **one-repo for now** (eventual repo-split), and there's a real benefit to
weigh: forks staying in/near the one repo get a **full network map**. Registers: [design — Aaron], [grounded — the
fork-blindness finding], [tradeoff].*

## The statement

Aaron: *"we should have a **git-native** way of doing this for Zeta, but also **support forks so they don't
accidentally use our credentials**. Eventually we can **split out repos**, but we've got to **make it work in one for
now**. It'll also be nice to have a **full network map for them even in the fork** — so there are benefits to weigh."*

## Git-native trust — resolve from the repo's OWN owner, not a hardcoded upstream

Trust is already heading git-native: `maintainers/<account>/ssh-pubkeys.txt` (per-operator subtrees) +
`operator-ssh-keys.txt` + (planned) repo-owner `<owner>.keys` fetch (#7251). The fork-safety fix is to **derive
identity + trust roots from the build's actual `origin` remote**, never from a constant:

- **Today's hazard (Bodhi, file:line):** `zflash.ts:150` hardcodes `ZETA_REPO_GH = "Lucent-Financial-Group/Zeta"`;
  the installer asserts `gh auth` == `Lucent-Financial-Group` (runbook:168). A **forker's** build would pull ISOs from
  **upstream** CI and could **silently bake upstream's trust roots** into their cluster — i.e., *accidentally use our
  credentials*, exactly what Aaron wants to prevent.
- **The git-native fix:** read the repo + owner from the **checkout's `origin`** (`git remote get-url origin` →
  owner/repo); trust roots = **that** repo's `maintainers/*/ssh-pubkeys.txt` + **that** owner's `<owner>.keys`. A
  fork flashes as **the fork's identity, with the fork's keys** — never upstream's. Pair with the **provenance
  banner** (flash-time + boot): `Building from <fork>/<repo>@<sha>; trust roots: <key-set>` so the fork's identity is
  legible before any destructive step.

## Fork credential-isolation (the must)

A fork's nodes must trust **the fork's** owners/maintainers, and **never** Lucent-Financial-Group's, unless the fork
*explicitly* opts in. The asymmetry from the test-key design generalizes: **you only trust keys from your own
subtree / your own owner** — origin-derived, not inherited-by-accident. (Composes with the `--test` asymmetry: trust
is always *opt-in and scoped to your own identity*, never silently inherited.)

## The tradeoff to weigh — one repo now vs split repos later

| | **One repo (now)** | **Split repos (eventual)** |
|---|---|---|
| **Network map** | forks get the **full network map** for free — every `maintainers/*/cluster-nodes/` is visible; the federation/DNS map (#7245) is one `git pull` away | each fork sees only its own; the full map needs cross-repo federation to reconstruct |
| **Credential isolation** | shared repo → the **accident risk** (mitigated by origin-derived trust + provenance) | clean per-org sovereignty (DV2.0 repo-split; the natural change-rate boundary) |
| **Adoption / network effect** | being in the one repo **connects** you (the polite-virus benefit — the map is the incentive) | more isolated; weaker default network effect |
| **Simplicity** | one substrate to make work **now** | more moving parts |

**Decision (Aaron):** **make it work in one repo for now**; split out repos **eventually** when isolation/scale
demands it (the DV2.0 repo-split smell will signal when). The **full-network-map for forks is a real one-repo
benefit** — a fork, by living in/near the one repo, sees the whole federation; that visibility is itself an adoption
draw (the polite virus: connection gives you the map). The benefit to weigh is exactly **network-map-visibility
(favors one repo) vs credential-isolation (favors split)** — and origin-derived trust lets one repo capture most of
the isolation benefit *now*, deferring the split.

## Honest scope

[design — Aaron]: git-native trust, fork-safe (own credentials, never upstream's, origin-derived), one-repo-now /
split-later, full-network-map as a one-repo fork benefit. [grounded]: the fork-blindness hazard is real
(`zflash.ts:150` hardcoded repo; Bodhi DX review); `maintainers/<account>/` subtrees + #7245 federation already
git-native. [tradeoff]: network-map-visibility (one repo) vs credential-isolation (split) — origin-derived trust +
provenance banner capture most isolation now, defer the split. No code; refines the trust model (#7251) +
federation (#7245) with the fork-safety + the repo-topology tradeoff.

## Pointers

- Trust/federation: #7251 (trust model — owner keys ∪ maintainer keys) · #7245 (self-registration → DNS →
  Aaron⊗Max federation / network map) · `maintainers/*/ssh-pubkeys.txt` (#7249/#7250) · the `--test` asymmetric trust
  (#7259).
- Fork hazard: `full-ai-cluster/tools/zflash.ts:150` (hardcoded `Lucent-Financial-Group/Zeta`) · the DX review's
  maintainer/forker findings + provenance banner.
- Topology: DV2.0 repo-split smell (`dv2-data-split-discipline-activated.md`) · the polite-virus network effect
  (#7255) · the close-over-order social/federation rungs (#7258).
