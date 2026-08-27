---
id: 081M10ZG624087G0R003JW3K8E
type: bug
state: backlog
priority: P2
slug: k3s-server-nix-pins-no-node-ip-so-a-multi-homed-control-plan
title: "k3s-server.nix pins no --node-ip, so a multi-homed control plane can advertise etcd on an interface its peers do not share"
created: 2026-08-27T06:46:13.316Z
depends_on: []
composes_with: ["081M10ZG61D087G0R001A70F0P", "081M10ZG62W087G0R002X76P1D"]
---

# k3s-server.nix pins no `--node-ip`, so a multi-homed control plane can advertise etcd on an interface its peers do not share

## The gap

`full-ai-cluster/nixos/modules/k3s-server.nix` sets `services.k3s.extraFlags`
(`--tls-san=control-plane`, `--cluster-cidr=...`) but **never pins
`--node-ip`**. k3s derives its node IP from the default route. On a host with one
NIC that is correct. On a **multi-homed** host — which is what real cluster
hardware is — the default-route interface may not be the interface the cluster
segment lives on, and k3s will then advertise its **etcd peer URL** on an address
its peers cannot reach.

## This was NAMED, not missed

#15746 pinned `--node-ip` in the VM harness and said explicitly what it was not
fixing (`full-ai-cluster/nixos/tests/k3s-server-join.nix`, the joiner `--node-ip` comment):

> *"Real hardware has no shared 10.0.2.15 — each machine's default route carries
> its own LAN address. What real hardware DOES have is more than one NIC, and
> `k3s-server.nix` pins no `--node-ip`, so a multi-homed control plane can still
> advertise etcd on an interface its peers do not share. That is a product
> question about which interface the cluster segment owns, it belongs with
> `injected-cluster-address.nix`, and it is NOT decided here — naming it rather
> than quietly fixing it in a test that cannot see it."*

This item is that named gap, filed so it survives the transcript.

## Why the VM test cannot catch it

The harness pins `--node-ip` on **both** nodes
(`full-ai-cluster/nixos/tests/k3s-server-join.nix:184,271`, `lib.mkAfter` so it merges with the
module's flags rather than replacing them). That pin is what makes the two guests
distinguishable at all — without it both advertise QEMU's SLIRP address
`10.0.2.15`, an address meaning "me" on every guest, which is the defect #15746
fixed (measured: run 33020639794, `etcd cluster join failed: dial tcp
127.0.0.1:2379: connection refused` — the joiner dialled the founder's advertised
peer and arrived at itself). So the harness must pin it, and therefore the
harness can never exercise the unpinned product default. **A green
`k3s-server-join` says nothing about this.**

## Shared unresolved question with 081M10ZG61D087G0R001A70F0P

Both this and the closed-etcd-ports item reduce to the same undecided thing:
**which interface owns the cluster segment?** `--node-ip` needs it to pick an
advertise address; the firewall override needs it to scope
`interfacesIn`/source-IP. Deciding it once resolves the addressing half of both.
It belongs with `injected-cluster-address.nix`, which already owns the
injected-address family and its all-or-none discipline.

## Falsifier that closes this

A test with a **multi-homed** guest whose default route is NOT the cluster
segment, asserting the advertised etcd peer URL is on the cluster interface.
Mutation check: remove the product `--node-ip` derivation and it must go red.
Note this specifically requires a harness that does NOT pre-pin `--node-ip` on
the node under test, or the assertion is vacuous — the current harness pin would
satisfy it while proving nothing.

## Lineage

- #15746 — pinned `--node-ip` in the harness; named this gap and deliberately left it
- #15673 — introduced the two-control-plane test
- #15810 — got the lane green end-to-end; confirmed this is NOT what was failing
- 081M10ZG61D087G0R001A70F0P — shares the "which interface owns the segment" question
- 081M10ZG62W087G0R002X76P1D — a second control-plane host is where a per-host answer would live
