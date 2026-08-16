# Zeta positioning — dependency graph on Helm (081KSGS9H0008QG0R00367G209)

**Status:** operational (internal). Complements the broader draft at
[`docs/marketing/positioning-draft-2026-04-21.md`](marketing/positioning-draft-2026-04-21.md).

## The empty slot

| Layer | Leader | Zeta role |
|-------|--------|-----------|
| Container packaging | OCI / Dockerfile | — |
| App templating | Helm | Charts are artifacts (like `.jar`) |
| **Dependency graph + variable-passing** | **— empty —** | **Ace claims this slot** |
| Sync engine | ArgoCD / Flux | Derived projections from the graph |
| Progressive delivery | Rollouts / Flagger | — |

Helm is **not** Maven for Kubernetes. Helm charts are jars. **Ace is Maven for Helm:**
declared cross-chart dependencies, transitive topo-sort, and automatic output → input flow.

## Why Zeta

Three in-flight substrates compose:

1. **Helm-as-convergence-point (081KSGS9H0008QG0R003A37Z65)** — one chart shape; both engines consume it.
2. **Derivability asymmetry (081KSGS9H0008QG0R00352WW0V)** — named `dependsOn` graph is source of truth;
   sync-waves and `valuesFrom` are computed, not authored by hand.
3. **Ontology-shaped DX (081KSGS9H0008QG0R0005P83AP)** — operators declare *what* depends on *what*; tools
   materialize engine YAML.

## Operator surface

| Intent | Command |
|--------|---------|
| Validate graph | `ace deps validate --graph <path>` |
| Resolve to manifests | `ace deps resolve --graph <path> --out-dir <dir>` |
| CI / GitOps build step | `bun src/Core.TypeScript/cluster/deps-to-engine-config.ts --graph … --out-dir …` |

Spec: [`APP-DEPENDENCY-GRAPH.md`](APP-DEPENDENCY-GRAPH.md)

Example: [`examples/helm-dependency-graph/`](../examples/helm-dependency-graph/README.md)

## What this eliminates

Today operators manually:

- Copy connection strings between chart `values.yaml` files
- Pick sync-wave numbers by hand
- Re-wire the same postgres → app binding for every umbrella chart

With `AppDependencyGraph`, the resolver emits Flux `dependsOn` + `valuesFrom` and ArgoCD
sync-waves + `valuesObject` bindings from one graph.

## Out of scope (initial slice)

- Cross-cluster / multi-tenant variable flow (081KSGS9H0008QG0R00352WW0V extension)
- Diamond-resolution / chart ownership (081KSGS9H0008QG0R0018ES3R4)
- `ace deps effective-chart` (future; mirrors `mvn help:effective-pom`)
