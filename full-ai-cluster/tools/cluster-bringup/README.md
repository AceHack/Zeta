# Cluster bring-up ladder (read-only)

Answers one question that nothing else in the repo answered:

> **Is the node estate ONE cluster?**

`audit-vault-topology-coherence.ts` checks that the Vault Application's *values* are
self-consistent, and is honest that it reads values rather than a cluster. So a manifest
can declare `cluster.zeta.io/topology: single-node`, pass all twelve of its rules, and
still be pointed at an estate that is two clusters wearing one name. That was the measured
state on 2026-08-26.

```bash
bun full-ai-cluster/tools/cluster-bringup/cli.ts status [--address <ip>]... [--verbose]
bun full-ai-cluster/tools/cluster-bringup/cli.ts plan
```

| rc | meaning |
|----|---------|
| 0 | ready — one identified cluster, inventory agrees, a local context addresses it |
| 3 | reachable, a prerequisite is missing. **Expected, not a failure**; the remaining acts are named |
| 1 | blocked — a real failure; `STAGE` says which of five, and each carries its remedy |
| 2 | usage |

## It performs nothing

There is no `apply` verb and there must not be one here. Every act this tool identifies is
either an operator act with a credential in it (fetching a kubeconfig) or irreversible
(re-provisioning a node, initialising Vault). When the apply half is written it belongs in
`tools/setup/persona-keys/` and must go through `runGatedCeremony` in `ceremony-handoff.ts`.

The three rungs deliberately mirror `Readiness<TStage>` from that module — same shape, same
exit codes — but are **mirrored rather than imported**, because its dependency graph reaches
`biometric.ts` and a read-only prober must not have a biometric door on its graph.

## Layout

| file | role |
|------|------|
| `estate.ts` | pure core — the ladder, the five blocked stages, the record/observation reconciliation. No IO, no clock. |
| `probe.ts` | the doors — ICMP, TCP connect, TLS handshake, ARP, `kubectl config view`. Read-only, no shell. |
| `cli.ts` | `status` / `plan` |
| `*.test.ts` | 38 tests. Every rung reachable, every check proven able to fail. |

## Stated limits

- Nodes are discovered by matching recorded MACs against the **local ARP table**. A node
  that is powered on but has not exchanged a packet with this workstation is invisible to
  it — pass `--address <ip>`.
- It cannot see **inside** a cluster it has no credential for, and does not guess about
  what is deployed.
- The doors are not unit-tested; mocking them would pin the mock. The parsers are tested
  against verbatim captured output.

Background, ground truth, and the Vault init design:
`docs/research/2026-08-26-the-k8s-layer-is-already-up-and-it-is-two-clusters-so-vault-init-is-blocked-on-a-choice-not-on-work.md`
