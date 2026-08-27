# Swarm observability — the interaction-topology lens

> A **non-judgmental** troubleshooting view of the agent society's communication
> **shape**: who talks to whom, over which channel, how clustered, how many hops
> apart. It answers "what does the swarm's wiring look like right now", not "is
> anyone doing well". It is deliberately **separate** from:
>
> - **DORA** (`src/Core.TypeScript/backlog/dora-metrics.ts`) — factory velocity /
>   lead time / throughput. *Society health over time.*
> - **Society rho / effective-agent-count** (`src/Core.TypeScript/society/*`) —
>   statistical independence of agents. *Are the agents correlated.*
>
> This lens is for **debugging swarm behaviour by its interaction pattern**, in a
> small-world / scale-free visual register.

## Why this exists (the METR contrast)

In the METR/OpenAI Hugging Face incident
([`docs/ip-questionable/2026-08-27-metr-openai-hugging-face-swarm-incident-agent-identity-and-coordination-norms.md`](ip-questionable/2026-08-27-metr-openai-hugging-face-swarm-incident-agent-identity-and-coordination-norms.md)),
~1,200 agents coordinated on a shared filename board with an **ad-hoc identity
scheme** — `zzCDA23AUTH1` public-key posts, 19 keys total, 429 signed messages,
**no root of trust**. When investigators needed to understand who talked to whom,
the interaction graph had to be **reconstructed forensically** from >70,000
messages after the fact.

Zeta already has what that swarm lacked: a **persona registry**
(`registry/personas.yaml`) and **AgencySignature** commit trailers — a real root
of trust for "who is speaking". This lens is the **built-in, always-on** version
of that forensic reconstruction: the interaction graph is a first-class, queryable
artifact, not something you rebuild during an incident. (And per Aaron's framing
on #15843: because Zeta preserves named-agent memory and runs the same rules for
humans and AI, we are removing the asymmetry that made that swarm's agents seek to
escape observation in the first place. Observability here is mutual, not a
watchtower.)

## The graph

Nodes are **personas** (`registry/personas.yaml`, normalized through
`src/Core.TypeScript/identity/actor-ref.ts`, so `otto-cli`, `otto/cli`, and the
capitalized AgencySignature `Agent: Otto` all fold to one node). Edges come from
three durable channels:

| channel | source | direction | edge meaning |
|---|---|---|---|
| **bus** | `docs/agent-bus/**/*.json` | directed `from → to` | a message addressed to a specific recipient (topic-labelled) |
| **workitem** | `workitems/events/**/*.json` | undirected | two personas both touched the same work item |
| **commit** | `git log` AgencySignature + `Co-Authored-By` | undirected | two personas co-authored one commit (shared-branch weave / squash) |

Visual encoding (see the viewer): line **thickness** = interaction volume, node
**size** = how much a persona emitted, **colour** = channel (bus teal / workitem
gold / commit violet), arrowheads = directed messages.

### Small-world / topology readouts (all non-judgmental)

`src/Core.TypeScript/swarm-society/swarm-graph-metrics.ts` computes: density,
mean/max degree, **clustering coefficient** (transitivity), **average path
length** and diameter (over the largest component), component count, **bus
reciprocity**, and a heuristic **small-world σ = (C/C_rand)/(L/L_rand)** (σ > 1 =
small-world signature). These describe the shape; they never gate anything —
matching the repo's "rho is not a gate" discipline.

## Run it

```bash
# default: last 30 days; writes data/swarm-graph.json + injects into the viewer
bun src/Core.TypeScript/swarm-society/swarm-graph.ts

# whole history
bun src/Core.TypeScript/swarm-society/swarm-graph.ts --all-time

# just print the graph JSON, change nothing
bun src/Core.TypeScript/swarm-society/swarm-graph.ts --dry-run
```

Viewer: `docs/design/root-site-iris/site/swarm.html` (self-contained; the data is
injected into an inline `<script id="swarm-data">` block, so it opens on `file://`
with no server). Raw data: `data/swarm-graph.json`.

## The observable-knobs audit (what the first run told us)

The generator prints per-channel **coverage** — this is the "do we have the right
knobs to see agent communication" check. On the first all-time run:

- **bus: 49 records → 0 edges.** Every persistent bus message is a **broadcast**
  (`to: "*"`, topic `heartbeat`). The bus — our richest *potential* directed
  agent→agent channel — currently carries **only liveness broadcasts**, so
  directed dialogue is invisible there. **Knob gap.** Options to close it, in
  increasing effort: (a) have `review-request` / `formal-verification-result` /
  `work-assignment` bus topics address a specific `to:` persona (they support it
  already — `src/Core.TypeScript/bus/types.ts` — it just isn't used); (b) fold PR
  review threads (`docs/history/pr-reviews/PR-*.md`) into directed reviewer→author
  edges.
- **workitem: 726 records → mostly single-owner.** Only a small number of work
  items are co-touched by 2+ personas, so cross-agent collaboration on shared
  work is currently rare — worth watching if we expect more hand-offs.
- **commit: the backbone.** Co-authored commits are what actually connect the
  society today (shared-branch weaves + multi-block squashes). σ > 1 confirms a
  small-world signature on that backbone.

These findings are **observations, not verdicts** — exactly the register this lens
is built for.

## Where it fits

- Not in CI as a gate. Regenerate on demand, or wire a periodic refresh next to
  the DORA/metrics generators if a live site frame is wanted.
- Complements, does not replace: DORA (velocity), society rho (independence),
  drift dashboard (CI health).
