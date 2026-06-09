# Zeta platform controller

The **generic, data-driven deployment engine** for the Zeta platform. One engine
renders *any* deployable — game servers, app pods, databases, web/UI hosts — from
declarative **Blueprint** data. New deployable types are added as data, never as
new code.

## The model

- **Blueprint** (`crd-blueprint.yaml`) — a reusable run-recipe: image, optional
  install script, startup command/args, env, ports, storage, sidecars, variables,
  default exposure. The Pterodactyl-"egg" idea generalized to anything. This is
  DATA (a CR or a library entry).
- **Deployable** (`crd-deployable.yaml`) — an instance: a Blueprint reference +
  variable values + sizing + exposure + optional public host. The one resource a
  user or agent creates to run something.
- **`renderDeployable(blueprint, deployable)`** ([`src/blueprint.ts`](src/blueprint.ts))
  — the pure engine. Produces a Deployment or StatefulSet, a PVC or
  volumeClaimTemplate, a ClusterIP / LoadBalancer Service, and (for public web
  hosts) a Certificate + HTTPRoute. Fully unit-tested; no per-type branches.

## How exposure maps

| `expose`  | result                                                    |
|-----------|-----------------------------------------------------------|
| `none`    | no Service                                                |
| `cluster` | ClusterIP Service                                         |
| `lan`     | LoadBalancer Service (Cilium LB-IPAM, internal pool)      |
| `public`  | LoadBalancer; + Certificate + HTTPRoute when a `web` port and `host` are set |

## How storage maps

- Stateless (`stateful: false`) + storage → a `PersistentVolumeClaim` mounted in
  the pod.
- Stateful (default when storage is set) → a `volumeClaimTemplate` (stable
  per-replica volume), the right shape for game worlds and databases.

## Reconcile

[`src/controller.ts`](src/controller.ts) watches Deployable CRs, resolves the
Blueprint (tenant namespace first, then the shared `zeta-platform` library),
renders, and **server-side-applies** the children (idempotent by construction).
`ownerReferences` make deletion cascade. Status reports `Ready` / `Error`.

The controller is the **mechanical Cell**. Intelligent ops — diagnose, repair,
optimize — is the Persona/agent layer (see `../COLLABORATION-MODEL.md`).

## The collaboration layer (AI-native, no-directives made operable)

Every Deployable carries an `ai` block — a persona operates it within a **Policy**,
with a **Room**. Three pure, fully-tested modules implement
[`../COLLABORATION-MODEL.md`](../COLLABORATION-MODEL.md) steps 3–4:

- **`src/policy.ts`** — the "who decides" engine. `decide(policy, action)` →
  `auto` (standing authority) | `propose` (emit an authorization-request, wait for
  a human grant) | `forbidden` (human-only). **Source ≠ authorization**: a gated
  class (`budget`, `non-reversible`, `wont-do`, `hard-limits`, `force-push`,
  `external-repo`) always escalates above `auto`, even on an `auto` domain. Hard
  floor (`wont-do`/`hard-limits`) is `forbidden`. Mirrors `policy-default.yaml`.
- **`src/room.ts`** — the attributed, retraction-native collaboration stream. One
  ordered Event log humans and personas both write to. Undo is a **Z-set
  retraction** (`+1` then `−1`; both persist — HC-2). Every Event carries an
  **AgencySignature** (proposed-by = source; authorized-by = a human, for gated).
  Deterministic ids (no wall-clock) so a Room replays identically (DST). The
  operating loop is `operate()` / `grant()` (human-only) / `actOnGrant()`.
- **`src/signals.ts`** — trigger detection. Kubernetes conditions (OOM, crashloop,
  PVC-pending, image-pull) are **data, not directives** (HC-3): classified into a
  candidate Action the Policy then rules on. The gating flips on quota, not on the
  fix — an in-quota memory bump is `auto`; an over-quota one is `budget`-gated.

The GMod-crash worked example (COLLABORATION-MODEL §6) is proven end-to-end in
`room.test.ts` / `signals.test.ts`: OOM → persona enters the Room → in-quota
auto-fix, or over-quota → one inline `budget` approval → recovery.

> **Seam:** persisting Rooms to the git-native event store and running the
> ≥3 vendor-diverse personas that drive them is the agent-layer runtime
> (`zeta-ai-agent.nix`, "control plane outside the control plane") — a separate
> deployable, per COLLABORATION-MODEL §9. This controller ships the substrate +
> the loop; the persona runtime consumes it.

## Develop

```bash
bun install
bun test          # 56 tests: engine genericity, reconcile, policy, room, signals
bun run typecheck # tsc --noEmit, strict
bun run start     # runs in-cluster (needs the service-account mount)
```

## Add a new deployable type

Append a `Blueprint` to `../k8s/applications/platform/blueprints.yaml` (or create a
Blueprint CR in a tenant namespace). No controller change. That is the whole point.
