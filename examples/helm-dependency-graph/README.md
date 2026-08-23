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
bun src/Core.TypeScript/cluster/deps-to-engine-config.ts \
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

## How these charts are tested — and what is NOT tested

Run locally:

```bash
bun src/Core.TypeScript/hygiene/audit-local-helm-charts.ts        # offline: no helm needed
bun src/Core.TypeScript/hygiene/audit-local-helm-charts.ts --helm # adds helm lint + template + kubeconform
bun test src/Core.TypeScript/hygiene/audit-local-helm-charts.test.ts # proves it can go red
```

In CI both halves run from `.github/workflows/helm-validate.yml` — the offline
half plus its mutation suite in the base-tier `structural` job, the `--helm`
half in the full-tier `charts` job.

**Checked**

| Check | Catches |
|---|---|
| `Chart.yaml` parses | tabs, unterminated quotes, unclosed sequences |
| `apiVersion` is `v1`/`v2` | a chart Helm will refuse to load |
| `name` present, matches its directory | **`helm lint` does not catch this** — verified 2026-08-23 |
| `version` present, string, valid SemVer 2 | `version: 1.0` (a YAML float), `version: notasemver` |
| `zeta-deps.yaml` pin agrees with `Chart.yaml` | a chart bump that leaves the graph behind, in **both** directions |
| `helm lint` | Helm's own metadata rules |
| `helm template` | a chart that cannot render |
| `kubeconform` over the render | manifests that violate the k8s API schema |

**NOT checked, stated plainly**

- **Nothing here is schema-validated by kubeconform today.** Both charts are
  *metadata-only*: no `templates/` directory, no `values.yaml`. `helm template`
  renders **zero** documents, so kubeconform has nothing to check. The validator
  prints `Schema-validated manifests: 0` and lists each chart under
  `NOT SCHEMA-VALIDATED (stated, not silent)` on every run, precisely so a green
  tick is never mistaken for a schema check that did not happen. Add a
  `templates/` directory and the render count rises with no change to the
  workflow.
- **No values-overlay matrix.** There are no `values-*.yaml` variants in this
  example, so the "renders under defaults but explodes under a real overlay"
  case has nothing to exercise. The validator renders defaults only.
- **No cluster behaviour.** Whether Flux/ArgoCD actually propagates
  `connection-url` into `database.url` needs a live cluster and is the manual
  procedure in [`OPERATOR-VERIFY.md`](OPERATOR-VERIFY.md), not this lane.
- **Third-party charts pinned by ArgoCD `Application` manifests** are a
  different lane entirely, with its own validator.

## Further reading

- Spec: [`docs/APP-DEPENDENCY-GRAPH.md`](../../docs/APP-DEPENDENCY-GRAPH.md)
- Operator cluster deploy: [`OPERATOR-VERIFY.md`](OPERATOR-VERIFY.md)
- Strategic framing: [`docs/POSITIONING.md`](../../docs/POSITIONING.md)
