---
id: 081M0QS0ET7087G0R000YBRKNT
type: task
state: backlog
priority: P2
slug: op-on-a-cluster-node-is-an-interim-appointed-hub-for-shared
title: "op on a cluster node is an interim appointed hub for shared secrets"
created: 2026-08-23T16:59:36.647Z
depends_on: []
composes_with: []
---

# op on a cluster node is an interim appointed hub for shared secrets

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QS0ET7087G0R000YBRKNT-*.md` glob. -->

## The dependency, stated plainly

A Zeta cluster node currently reaches shared secrets through **1Password**
(`op`, pinned `1password-cli = "2.34.1"` at `.mise.toml:114`). PR
"fix(cluster-node): `op` did not resolve outside the checkout" made that
dependency *work* on a node by putting mise's shims dir on PATH and pointing
`MISE_GLOBAL_CONFIG_FILE` at the node's own checkout. **Making it work is not
the same as endorsing it**, and this row exists so the dependency is not
silently normalised.

## Why it is a hub, not an oracle

A node that must route through one vendor in order to boot **has no exit**.
Under `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` the
discriminator is exit, not degree: *"Can you defer elsewhere? Then it is an
oracle. Must you route through it? Then it is a hub."* Secret distribution on a
node is currently the second case, so it is an **appointed hub** and a
manifesto §1 (scale-free — no central point of control) violation on the
provisioning path.

## Aaron named it as interim himself

> *"well for the linux real hardware we might need it global for op — not sure
> if that's how we are going to share shared secrets **until we have a
> decentralized way of doing it**."* (2026-08-22)

That clause is the whole reason this row exists. **A dependency nobody labelled
as temporary is one nobody removes.**

## Registers (honest)

| claim | register |
|---|---|
| the node routes shared secrets through 1Password today | **measured** — `.mise.toml:114`, and `op` is declared in no cluster nix surface |
| this is an appointed hub with no exit | **anchored** — the exit discriminator, Hirschman 1970 |
| a decentralized replacement should exist | **proposed** — nothing more; not designed, not scheduled |

## Explicitly NOT settled here

The decentralized replacement is **not designed in this row**. It is tied to the
decentralized-identity-server lane (every node its own identity provider; local
policy; hubs negotiate rather than command) and to the existing `sops`/`age` and
OpenBao/TPM2-seal machinery already present in `full-ai-cluster/`. Whoever picks
this up should start by asking whether node secrets can ride the **sops-nix +
age** path that `flake.nix` already declares, since that is git-native and
per-host keyed — i.e. it has an exit — rather than inventing a new mechanism.

## Pointers

- `full-ai-cluster/nixos/modules/common.nix` — the profile.d snippet carrying the interim measure, labelled inline
- `full-ai-cluster/nixos/modules/mise-node-path-wiring.test.ts` — the falsifier that pins it
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — appointed vs emergent; exit as the discriminator
- `full-ai-cluster/nixos/modules/tpm2-seal-prereqs.nix`, `flake.nix` (`age sops ssh-to-age`) — the exit-carrying mechanisms already in tree

