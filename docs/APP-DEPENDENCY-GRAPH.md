# AppDependencyGraph — named dependency graph spec (081KSGS9H0008QG0R00367G209)

**Status:** operational (Ace + `tools/cluster/deps-to-engine-config.ts`)

Zeta's **Maven-for-Helm** layer: a single engine-agnostic YAML graph sits above Helm
charts and below Flux / ArgoCD. The graph is the source of truth; sync-engine configs
are derived projections.

## Kind and API version

```yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
```

## Top-level shape

| Field | Required | Description |
|-------|----------|-------------|
| `metadata.name` | yes | Root application / umbrella chart name |
| `metadata.namespace` | no | Default namespace for generated manifests |
| `spec.dependsOn` | yes | Array of dependency nodes |

## Dependency node (`spec.dependsOn[]`)

| Field | Required | Description |
|-------|----------|-------------|
| `chart` | yes | Chart name (Helm release / Application name) |
| `version` | no | Chart version pin (passed to HelmRelease / Application) |
| `dependsOn` | no | Explicit chart-level edges (topo-sort input) |
| `outputs` | no | Typed output surface + consumer bindings |

### Output binding

Each `outputs[]` entry:

| Field | Description |
|-------|-------------|
| `name` | Output key (must appear in upstream `zeta-chart-outputs.yaml` when `--charts-dir` is set) |
| `source` | Helm values path on the producer chart (documentation / contract mirror) |
| `consumes` | List of `{ target: "<consumer>.values.<path>" }` bindings |

Example (from the shipped canonical pair):

```yaml
spec:
  dependsOn:
    - chart: postgres
      version: "15.2.0"
      outputs:
        - name: connection-url
          source: ".Values.postgres.connectionUrl"
          consumes:
            - target: my-app.values.database.url
```

## Chart output contract (`zeta-chart-outputs.yaml`)

Portable charts (Bitnami, upstream OSS) do not carry Zeta extensions. Declare the
typed output surface in a sidecar file next to `Chart.yaml`:

```yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: ChartOutputs
metadata:
  name: postgres
outputs:
  - name: connection-url
    type: string
    value: ".Values.postgres.connectionUrl"
```

When `--charts-dir` is provided, validation rejects outputs not declared in the contract.

## Validation (build time)

`ace deps validate` and `deps-to-engine-config --validate-only` check:

1. **DAG** — no cycles in explicit or implicit (variable-flow) edges
2. **Unknown charts** — every `dependsOn` / `consumes.target` references a known node
3. **Contract** — declared outputs exist in `zeta-chart-outputs.yaml` (when charts dir set)

## Resolution (engine projections)

`ace deps resolve` and `tools/cluster/deps-to-engine-config.ts` emit:

| Engine | Ordering | Variable flow |
|--------|----------|---------------|
| Flux | `spec.dependsOn` on HelmRelease | `spec.valuesFrom` → ConfigMap keys |
| ArgoCD | `argocd.argoproj.io/sync-wave` | `spec.source.helm.valuesObject` with `valueFrom` |

## Canonical example

See [`examples/helm-dependency-graph/`](../examples/helm-dependency-graph/README.md).

## Related

- Backlog: [081KSGS9H0008QG0R00367G209](backlog/P1/081KSGS9H0008QG0R00367G209-zeta-as-dependency-graph-and-variable-passing-layer-on-top-o.md)
- Positioning: [POSITIONING.md](POSITIONING.md)
- Implementation: `src/Core.TypeScript/ace/deps.ts`
