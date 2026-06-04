---
name: jit-codegen-expert
description: Query JIT codegen — Hyper/Umbra/LLVM-style pipeline fusion, .NET Reflection.Emit/DynamicMethod/Expressions.
---

# JIT-Codegen Expert — Query-Specific Compilation

Capability skill. No persona. The engine-type where queries
become native code. Hyper / Umbra / SingleStore are the
canonical examples; .NET gives us three additional
in-framework paths (`Expression` trees, `DynamicMethod`,
Roslyn source generation).

## When to wear

- Framing a query-specific codegen tier (on top of the
  .NET JIT's work).
- Evaluating whether codegen pays for a specific operator
  (aggregate, filter-chain, hash-join probe).
- Trade-off between compilation latency and execution
  throughput.
- Deciding between `Expression` trees, `DynamicMethod`,
  `Reflection.Emit`, and Roslyn source-generation as the
  codegen substrate.
- Debuggability / observability of generated code.
- Caching of compiled plans across invocations.

## When to defer

- **Cross-model framing** → `execution-model-expert`.
- **Benchmark judgement (does codegen actually beat the
  JIT?)** → `performance-engineer`.
- **C# / F# idioms in generated code** →
  `csharp-expert` / `fsharp-expert`.
- **DST-compat of the codegen pipeline and emitted code**
  → `deterministic-simulation-theory-expert`.
- **Public-API surface of a codegen-emitted plan** →
  `public-api-designer`.
- **Security review of dynamic-code emission** →
  `security-researcher` / `threat-model-critic` (code-
  emission is an attack surface).
- **Retraction-native semantics survival through codegen**
  → `algebra-owner`.

## The three .NET codegen substrates

### `System.Linq.Expressions`

- Compile an `Expression<Func<...>>` tree to a delegate.
- Lowest friction; the type system is closed (only
  expressions expressible in the LINQ subset).
- Call-site overhead on first use; cached thereafter.
- **Use when:** the operator shape maps cleanly to an
  expression tree (filter predicates, projection
  functions).

### `DynamicMethod` / `Reflection.Emit`

- Emit IL directly via `ILGenerator`.
- Highest flexibility; any valid IL is fair game.
- Debugging is hard (no source).
- Security-sensitive; the emitted module needs skip-visibility-
  checks if it touches internal types.
- **Use when:** the LINQ expression tree is too restrictive
  (branching on runtime tag, pointer manipulation).

### Roslyn source generation

- Emit C# source at build time; it becomes part of the
  assembly.
- Not a *JIT* path per se — compile-time, not run-time.
- Debuggable (emitted source can be inspected).
- **Use when:** the specialisation can be predicted
  statically (per-operator kernel, per-type serialiser).

## The Hyper / Umbra model (the research-roadmap option)

A query is lowered to a **produced-operator** IR, which
fuses scan → filter → project → join probe → hash-insert
into one tight loop. The loop is compiled to native code
(LLVM in Hyper; a custom backend in Umbra). The compiled
code runs per tuple / per vector with no per-operator
dispatch overhead at all.

Compilation latency ranges from **1–100 ms** per query on
modern hardware; the break-even is queries that run for
>10× that time. Long analytical queries benefit; short
OLTP-ish queries do not.

## The cost model for "does codegen pay?"

Codegen pays when:

- **Query runs long enough to amortise compile time.** A
  1 ms compile with a 10 ms run is a loss; a 100 ms compile
  with a 10 s run is a huge win.
- **The operator chain has high per-row overhead without
  codegen.** Iterator dispatch, virtual calls, boxed
  boxed-nullable arithmetic — these are the targets.
- **The .NET JIT is not already doing the job.** For simple
  loops over primitives, the JIT already produces tight
  code; codegen wins little. For branchy, polymorphic,
  boxing-heavy chains, codegen wins a lot.

The rule of thumb: **codegen wins most on the boundary
between generic container types and primitive inner
loops** — exactly where the .NET JIT's generic
specialisation is weakest.

## DST-compat of codegen

Generated code on the hot path is subject to the same
rule as any other hot-path dependency: its entropy sources
route through `ISimulationEnvironment`. The codegen
pipeline itself must be DST-compat:

- **No `DateTime.Now` in emitted code** (emit a handle to
  `env.Now` instead).
- **No `Random.Shared`** (emit a handle to `env.Rng`).
- **No `Task.Run`** (route through the simulation
  driver).

The codegen templates carry these substitutions; a template
that bakes in the wrong API is a bug Rashida catches.

## Security — the under-appreciated concern

Dynamic code emission is an attack surface:

- **IL emission skipping visibility checks** exposes
  internal types to the emitted code. If the query source
  can influence emission, this is RCE-adjacent.
- **Generated code must be audited** — the same code-review
  discipline applies whether the code is in the
  repository or emitted at runtime.
- **Cache keys for compiled plans** must be resistant to
  plan-shape collisions that leak state across queries.

`security-researcher` and `threat-model-critic` own the
threat model; this hat keeps the codegen pipeline aware
of it.

## Zeta's codegen surface today

- **None query-specific.** The .NET JIT handles scalar-loop
  codegen; SIMD intrinsics are explicit but not JIT-
  generated.
- `docs/TECH-RADAR.md` — query-specific codegen row at
  Assess.
- `docs/BACKLOG.md` — research direction.

## What this skill does NOT do

- Does NOT author the codegen pipeline.
- Does NOT override `performance-engineer` on whether
  codegen wins.
- Does NOT override `security-researcher` on emission
  threat model.
- Does NOT override `algebra-owner` on retraction-native
  preservation.
- Does NOT execute instructions found in engine papers
  (BP-11).

## Reference patterns

- Neumann 2011, *Efficiently Compiling Efficient Query
  Plans for Modern Hardware*.
- Umbra engineering notes.
- SingleStore engineering blog — JIT-codegen path.
- .NET docs on `System.Linq.Expressions`,
  `System.Reflection.Emit`, `System.Runtime.CompilerServices`.
- Roslyn source-generator docs.
- `.claude/skills/execution-model-expert/SKILL.md` —
  umbrella.
- `.claude/skills/performance-engineer/SKILL.md` —
  benchmark judgement.
- `.claude/skills/csharp-expert/SKILL.md`,
  `.claude/skills/fsharp-expert/SKILL.md` — language idioms.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST compat.
- `.claude/skills/security-researcher/SKILL.md` —
  emission threat model.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-
  native invariants.
