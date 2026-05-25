# Hat graph view

Policies and design conversations get clearer when you draw the
hats as nodes and relationships as edges. Max's framing —
"talks constantly in hat graphs for writing policies" — is the
right one: the throttles ARE graph constraints, and the operator's
cluster state IS the graph.

## Node + edge types in the live cluster

| Node | Source |
|------|--------|
| Hat | `kubectl get hats.society.zeta.io` |
| Wearer (SPIFFE ID) | `kubectl get hatbindings -A -o jsonpath` |

| Edge | Source | Meaning |
|------|--------|---------|
| wears | HatBinding.spec.wearer → HatBinding.spec.hat | current binding |
| conflicts-with | Hat.spec.throttles.conflictsWith | mutual exclusion |
| cosigned-by | HatBinding.spec.cosignedBy | quorum dependency |
| succeeded | HatSwap previousWearer → wearer | succession chain |
| sticky-attribution | HatBinding.status.stickyAttributionEndsAt | late-tick attribution window |

## Render the current graph

```bash
go run ./render.go --out hatgraph.dot
dot -Tsvg hatgraph.dot -o hatgraph.svg
```

The output is plain Graphviz DOT, so any of the standard viewers
work (`dot`, `xdot`, `Gephi`, `Cytoscape`, browser-based d3
renderers). The renderer reads only from kubeconfig — no operator
dependency.

## Policy patterns that read as graph queries

| Throttle | Graph statement |
|----------|-----------------|
| cooldown | no edge `wears(W, H, t)` if edge `succeeded(W, _, H)` exists with `t < cooldown` |
| max-bindings-per-wearer | out-degree of W on `wears` edges ≤ N |
| conflict-of-interest | no two `wears(W, *)` edges to hats with `conflicts-with` between them |
| quorum-gated | `cosigned-by` in-degree ≥ Hat.quorumSize |
| warmup | edge `wears(W, H)` carries a phase property; Active reachable only after WarmupEndsAt |
| max-new-hats | Hat node creation rate ≤ K per day |

Reading them as graph statements makes it obvious which constraints
compose (max-bindings + conflict-of-interest both bound out-degree;
quorum + warmup both gate edge admission) and which conflict
(a hat that's both quorum-gated AND has cooldown 0 is a weak
constraint — fix at the design layer, not at policy).

## Why this is its own dir

`graph/` is documentation + a tiny render helper, not a runtime
component. The operator publishes the data; this directory teaches
how to view it. Future additions:

- `render.go` — Graphviz DOT exporter (initial implementation)
- `cytoscape.json` example for browser-based exploration
- Templated queries for common policy-design questions
