---
name: streaming-and-execution
description: Incremental & streaming computation and query execution — DBSP/delta-streams, dataflow, windows, operators, iteration models, and deterministic replay. Open this for any engine-level decision about how data moves and is computed over time.
---

# Streaming & Execution

Category skill (a "blueprint pack"). The description above is the **only**
thing the router sees — broad and generic on purpose. The detail lives in
the blueprints below; open the one that matches and read it in full (they
are fat by design).

This category carries Zeta's identity substrate: **streaming, incremental,
retraction-native**. Every other engine-type narrow layers over it.

## Blueprints

Read the blueprint whose scope matches the decision in front of you.

| Blueprint | Open it when… |
|---|---|
| [`streaming-incremental`](blueprints/streaming-incremental.md) ✅ | DBSP / Timely / Differential / IVM, retractions, standing queries, watermarks, frontiers — the base substrate |
| `streaming-window` ⏳ | tumbling/sliding/session windows, watermark policy, late data, allowed-lateness |
| `push-pull-dataflow` ⏳ | push vs pull scheduling, demand-driven vs data-driven operator wiring |
| `rx` ⏳ | Rx as algebra — Observable as categorical dual of Enumerable, merge-monoid, operator laws |
| `volcano-iterator` ⏳ | classic open/next/close iterator model, pipelining, blocking operators |
| `morsel-driven` ⏳ | morsel-driven parallelism, NUMA-aware scheduling, work-stealing execution |
| `vectorised-execution` ⏳ | batch/vectorised operators, columnar kernels, SIMD-friendly execution |
| `execution-model` ⏳ | overall execution-model choice and how the above compose into one engine |
| `deterministic-simulation-theory` ⏳ | DST — deterministic replay, seeded schedulers, simulation as the truth oracle |
| `algebra-owner` ⏳ | the Z-set / IndexedZSet operator algebra — D/I/z⁻¹/H, chain rule, nested fixpoints |

✅ migrated · ⏳ pending migration from the corresponding `*-expert` skill in `skills.bak/`

## How this category was built

- Router sees one broad carved sentence (the frontmatter `description`).
- Body is an index of pointers to fat blueprint md files under `blueprints/`.
- Each blueprint is a former standalone skill body, migrated near-verbatim
  with its routing frontmatter stripped (it is a doc now, not a router entry).
- The whole directory is an **independent shipping unit** — a self-contained
  package (`SKILL.md` + `blueprints/`) that could be installed from a skill
  store on its own.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
(same hub/satellite shape, applied to skills: carved sentence = hub, blueprint = satellite).
