---
id: 081M10ZG63M087G0R000SG5KV6
type: task
state: backlog
priority: P2
slug: refuse-harness-network-posture-that-exceeds-the-product-a-ni
title: "Refuse harness network posture that exceeds the product: a nixosTest may not open a port the shipped module closes"
created: 2026-08-27T06:46:13.364Z
depends_on: []
composes_with: ["081M10ZG61D087G0R001A70F0P"]
---

# Refuse harness network posture that exceeds the product: a nixosTest may not open a port the shipped module closes

## The invariant

> **A test harness may not grant the system under test any network reachability
> the product does not grant.**

Formally: for every nixosTest node importing a product role module, the node's
effective open-port set must be a **SUBSET** of what that module opens on its own.

## Subset, NOT equality — and the distinction is the whole design

Harnesses legitimately differ from the product in ways that do not manufacture
false greens, and a naive equality check would refuse all of them:

```nix
systemd.services.k3s.wantedBy = lib.mkForce [ ];   # test-local start sequencing
services.k3s.manifests        = lib.mkForce { };   # no CNI in a hermetic VM
virtualisation.memorySize     = 2560;              # harness sizing
```

None of those make the test prove something untrue about a real host. An **extra
open port** does: it makes the test exercise a network posture no shipped machine
has. So the rule constrains reachability only, in one direction.

## Why it is worth building — the false-green asymmetry

The argv oracle fixed in #15810 produced a **false red** and everyone noticed
within four hours. 081M10ZG61D087G0R001A70F0P produces a **false green**, and
nobody would notice until real hardware refused to join. A red gate advertises
itself; a green one that proves nothing is silent by construction. This check is
the mechanical detector for the silent class.

## Feasibility — no new machinery needed

This is **pure evaluation**, seconds, no VM. The repo already has the exact
pattern: `flake.checks.k3s-server-join-model` and
`flake.checks.cluster-cidr-derivation` are eval-only checks that import a
`nixos/tests/*-eval-test.nix`, produce a `report` carrying a `status`, and are
wrapped in `pkgs.runCommand`. `build-ai-cluster-iso.yml` already runs them in a
dedicated *"Nix eval checks — cluster CIDR derivation + server-join model (were
unrun)"* step. A `harness-network-posture-subset` check drops straight in there.

## Measured blast radius (2026-08-27)

`git grep 'allowedTCPPorts\|allowedUDPPorts\|firewall.enable' -- 'full-ai-cluster/nixos/tests/**'`
returns three sites:

| site | verdict |
|---|---|
| `k3s-server-join.nix:190` (founder) | **VIOLATION** — opens 2379/2380 the product closes |
| `k3s-server-join.nix:277` (joiner)  | **VIOLATION** — same |
| `k3s-control-plane-platform-fixes.nix:80` `firewall.enable = true` | fine — *tightens*, and matches `common.nix:223` |

So the check flags exactly one test today, and it is the one that matters. The
third site is worth noting for the opposite reason: it confirms subset is the
natural direction, since a harness restating a product default is harmless.

## THE CAVEAT THAT MAKES THIS A JOINT DECISION

**This check goes RED the moment it lands**, because the violation above is real
and unfixed. That is correct behaviour — it is reporting the false green — but it
means **landing this check and fixing 081M10ZG61D087G0R001A70F0P are one change,
not two.**

Landing it alone leaves a red lane whose only cheap remedy is an exception entry
for `k3s-server-join.nix`, and an exception list that absorbs the one violation
it was built to detect has recreated the problem while looking like a solution.
If an escape hatch is unavoidable, it must be a per-port, per-test, **expiring**
declaration that names the work-item unblocking it — never a filename allowlist.

Note also that opening the product's etcd ports is a **firewall default on the
hardware path** and therefore a maintainer decision. This item should not be
started until that call is made.

## Falsifier that closes this

The check fails on a harness that opens a port its imported product module does
not, and passes once the product opens it. Mutation checks, both required:
adding a spurious port to any test node must go red; removing the check's
comparison must not leave it silently passing (assert the product port set it
compares against is non-empty, or the subset test is vacuous — an empty
expectation makes every subset check succeed).

Design note inherited from 081M10ZG61D087G0R001A70F0P: reading
`networking.firewall.allowedTCPPorts` alone is **not** the effective port set.
`trustedInterfaces` (`k3s-server.nix:335`) and
`networking.firewall.interfaces.<name>.allowedTCPPorts` also admit traffic. A
check ignoring them will both miss violations and refuse correctly-scoped
overrides.

## Lineage

- 081M10ZG61D087G0R001A70F0P — the violation this detects; fix them together
- #15792 — added the harness ports; correct for the harness, and the moment the divergence appeared
- #15810 — the false-RED sibling, and where the asymmetry argument comes from
