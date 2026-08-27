---
id: 081M10ZG62W087G0R002X76P1D
type: task
state: backlog
priority: P2
slug: no-second-control-plane-host-exists-the-multi-server-path-ha
title: "No SECOND control-plane host exists: the multi-server path has never been expressed in the product"
created: 2026-08-27T06:46:13.340Z
depends_on: []
composes_with: ["081M10ZG61D087G0R001A70F0P", "081M10ZG624087G0R003JW3K8E"]
---

# No SECOND control-plane host exists: the multi-server path has never been expressed in the product

## The observation

```
full-ai-cluster/nixos/hosts/
    control-plane/       <- exactly one
    worker-gpu/
    worker-template/
```

There is **one** control-plane host directory. Every artefact for a second
control plane — the one that JOINS rather than founds — exists only in
`nixos/modules/injected-server-join.nix` and in the VM test that drives it over
fixtures. Nothing in `hosts/` has ever been a joining server.

## Why this is plausibly the ROOT of its two siblings

Both 081M10ZG61D087G0R001A70F0P (etcd ports closed, no override written) and
081M10ZG624087G0R003JW3K8E (no `--node-ip` pin) are, stated plainly, *"a thing a
second control plane would need that nobody has had to write down yet."*

- The firewall item's prescribed fix is literally *"add 2379/2380 to a
  **host-specific override**"* — and there is no second host to put one in.
- The `--node-ip` item needs a per-host answer to *"which interface owns the
  cluster segment"* — also a host-level fact with nowhere to live.

Filing them separately is still right: each has its own falsifier and either can
be fixed without the other. But an implementer should read this one first,
because expressing a joining control plane is likely to **surface** both rather
than require them as prerequisites — and may surface others not yet found.

## What this is NOT

Not a request to provision hardware, and not a request to open the etcd ports
(see 081M10ZG61D087G0R001A70F0P — that is a gated decision). This is about the
**declarative expression** of the role existing in `hosts/` at all, so the
role-conditional substrate has a consumer outside a test fixture.

## Falsifier that closes this

A second control-plane host builds (`nixos-rebuild build` / the flake's host
output evaluates) with the join substrate active — `clusterInit = false`,
`serverAddr` set, `tokenFile` pointed at the staged path — and the resulting
config satisfies whatever assertions 081M10ZG61D087G0R001A70F0P and
081M10ZG624087G0R003JW3K8E land. Mutation check: it must FAIL today, before those
two are fixed, and the failure messages are the deliverable — they are what tells
an operator what a joining control plane actually requires.

## Note on `--impure`

`injected-server-join.nix` reads its endpoint with `builtins.pathExists`, which
returns FALSE under pure evaluation, silently reverting a joining server to a
founding one. Any build recipe for this host must carry `--impure`
(`lint-nixos-rebuild-needs-impure.ts` enforces this for documented rebuild
strings). A host that evaluates green without it has quietly founded a second
sovereign cluster — the exact defect the module family was written to prevent.

## Lineage

- #15673 · #15746 · #15792 · #15810 — the four PRs that built and greened the two-control-plane VM test
- 081M10ZG61D087G0R001A70F0P — the firewall override that has no host to live in
- 081M10ZG624087G0R003JW3K8E — the `--node-ip` answer that has no host to live in
