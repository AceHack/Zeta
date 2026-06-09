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

## Develop

```bash
bun install
bun test          # 23 tests: engine genericity + reconcile resolution
bun run typecheck # tsc --noEmit, strict
bun run start     # runs in-cluster (needs the service-account mount)
```

## Add a new deployable type

Append a `Blueprint` to `../k8s/applications/platform/blueprints.yaml` (or create a
Blueprint CR in a tenant namespace). No controller change. That is the whole point.
