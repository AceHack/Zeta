# Operator verification — my-app + postgres variable flow (081KSGS9H0008QG0R00367G209)

Harness-truth steps for confirming that upstream `postgres.connection-url` reaches
downstream `my-app.database.url` without manual values wiring.

## Preconditions

- A Kubernetes cluster with either **Flux** or **ArgoCD** installed
- `kubectl` configured for the target cluster
- This repo checked out at the commit that ships the example graph

## 1. Generate manifests

```bash
OUT=/tmp/b0821-my-app-postgres
bun src/Core.TypeScript/cluster/deps-to-engine-config.ts \
  --graph examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml \
  --charts-dir examples/helm-dependency-graph/charts \
  --out-dir "$OUT" \
  --namespace staging
```

Expected files (minimum):

- `postgres-helmrelease.yaml` and/or `postgres-application.yaml`
- `my-app-helmrelease.yaml` and/or `my-app-application.yaml`

## 2. Inspect variable flow (no cluster required)

Flux binding:

```bash
grep -A6 'valuesFrom:' "$OUT/my-app-helmrelease.yaml"
```

Expect `postgres-outputs` / `connection-url` / `database.url`.

ArgoCD binding:

```bash
grep -A12 'valuesObject:' "$OUT/my-app-application.yaml"
```

Expect `configMapKeyRef.name: postgres-outputs` and `key: connection-url`.

## 3. Apply to cluster (Flux)

```bash
kubectl apply -f "$OUT/postgres-helmrelease.yaml"
kubectl apply -f "$OUT/my-app-helmrelease.yaml"
kubectl -n staging get helmrelease my-app -o yaml | grep -A6 valuesFrom
```

Confirm `my-app` HelmRelease still references `postgres-outputs` / `connection-url`.

## 4. Apply to cluster (ArgoCD)

```bash
kubectl apply -f "$OUT/postgres-application.yaml"
kubectl apply -f "$OUT/my-app-application.yaml"
kubectl -n argocd get application my-app -o yaml | grep -A12 valuesObject
```

## 5. Operator sign-off

After a successful homelab deploy, record confirmation here:

```text
Operator: Aaron
Date: YYYY-MM-DD
Cluster: <hostname / context>
Engine: Flux | ArgoCD
Manual step eliminated: copy-paste postgres connection URL into my-app values.yaml
Result: PASS | FAIL
Notes:
```

CI runs the automated acceptance test in
`tools/cluster/deps-to-engine-config.acceptance.test.ts` against the same graph;
cluster apply remains operator-owned per homelab policy.
