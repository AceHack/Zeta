# Helm dependency-graph example (081KSGS9H0008QG0R00367G209)

Canonical **my-app → postgres** chart pair demonstrating Maven-for-Helm variable flow.

| Path | Role |
|------|------|
| `my-app-postgres/zeta-deps.yaml` | Source-of-truth `AppDependencyGraph` |
| `charts/postgres/` | Upstream chart + `zeta-chart-outputs.yaml` contract |
| `charts/my-app/` | Consumer chart (values injected by resolver) |

## Quick start

Validate the graph (cycle + output-contract checks):

```bash
bun src/Core.TypeScript/ace/ace.ts deps validate \
  --graph examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml \
  --charts-dir examples/helm-dependency-graph/charts
```

Emit Flux + ArgoCD manifests (build-time / CI path):

```bash
bun tools/cluster/deps-to-engine-config.ts \
  --graph examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml \
  --charts-dir examples/helm-dependency-graph/charts \
  --out-dir /tmp/my-app-postgres-manifests
```

Equivalent Ace CLI:

```bash
bun src/Core.TypeScript/ace/ace.ts deps resolve \
  --graph examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml \
  --charts-dir examples/helm-dependency-graph/charts \
  --out-dir /tmp/my-app-postgres-manifests
```

## What gets wired automatically

The graph declares that `postgres` output `connection-url` is consumed at
`my-app.values.database.url`. The resolver emits:

- **Flux**: `my-app` HelmRelease `spec.dependsOn: [{ name: postgres }]` plus
  `valuesFrom` pointing at `postgres-outputs` ConfigMap key `connection-url` →
  `database.url`.
- **ArgoCD**: sync-wave ordering (postgres wave 0, my-app wave 1) plus
  `valuesObject.database.url.valueFrom.configMapKeyRef` for the same binding.

No manual copy-paste of connection strings between charts.

## Further reading

- Spec: [`docs/APP-DEPENDENCY-GRAPH.md`](../../docs/APP-DEPENDENCY-GRAPH.md)
- Operator cluster deploy: [`OPERATOR-VERIFY.md`](OPERATOR-VERIFY.md)
- Strategic framing: [`docs/POSITIONING.md`](../../docs/POSITIONING.md)
