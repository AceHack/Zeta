# REST is the default transport; GraphQL is the one contested budget

Carved sentence:

> In a **script, workflow, or agent loop**, reach GitHub over **REST** —
> `gh api repos/{owner}/{repo}/…` — because `gh pr view` / `gh pr list` /
> `gh pr checks` / `gh run view` are **GraphQL**, they are the *ergonomic*
> default, and GraphQL is the one of the two 5000/hour budgets this fleet
> actually exhausts (measured: REST 33/5000 while GraphQL hit **0/5000 twice in
> one hour**; the drain is **observation**, not action). Spend GraphQL only on
> the operation that has **no REST form** — `gh pr merge --auto`
> (`enablePullRequestAutoMerge`) — which is rare and cheap. And **never probe a
> goal over the transport you are draining**: a retry loop stops when the
> **GOAL** is met *however it was met*, never when its own attempt succeeds, and
> a failed probe is **`unknown`** — never a negative result.

**Interactive `gh` at a human prompt is not the target.** `gh pr view 15673` is
the right command for a person: one call, rendered, not repeated four hundred
times an hour. This governs the committed, repeated, unattended call.

## Why it needed carving

The knowledge existed — correct, dated, and buried in one module's docstring.
On 2026-08-25/26 **four agents independently hit the same wall in one evening**,
and a runaway loop drained the quota for ~40 minutes because its `state=MERGED`
stop condition was read over `gh pr view` — *the same transport it was
saturating* — with `api-unavailable) : ;` as the failure branch. Self-blinding by
construction: under load it could never observe that it was finished.

Trap worth one line: **`rate_limit` showing 5000/5000 while calls are refused
means a SECONDARY (burst) limit**, which those counters never reflect.

## Pointers

- `docs/research/2026-08-26-graphql-is-the-contested-budget-rest-is-the-default-transport-and-a-probe-must-not-share-the-channel-it-drains.md`
  — the detail: the **REST substitution table**, every measurement, the three
  loop disciplines, the Beacon anchors (Chandra–Toueg failure detectors,
  Knight–Leveson correlated redundancy, Jacobson–Karels backoff).
- `src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts` — the
  falsifier; its refusal **prints the REST replacement**. Drift tier, not in
  `gate (required)`. First run: 2505 files, **39 sites in 19 files**, 34 of them
  the argv spelling `["pr", "view", …]` that a `gh pr view` grep cannot see.
- `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` — the
  original docstring (2026-08-14: GraphQL 1147/5000 vs REST 33/5000).
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md)
  §7 noninterference — an exhaustible shared channel nobody declared is an
  ambient one; this rule is that discipline applied to API transport.
- [`toy-is-free-metered-must-be-earned.md`](toy-is-free-metered-must-be-earned.md)
  — `api-unavailable) : ;` is the vacuity class: a handler that cannot fail.
