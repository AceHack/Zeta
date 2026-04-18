# Quality Rules

This doc makes the repo's quality bar explicit so it survives round
handoff and reviewer rotation.

## Core principle

Quality beats velocity when they conflict. Quality at this repo means:

- warnings fail the build,
- claims have tests or they aren't claims,
- hot paths are measured, not asserted,
- and architectural gaps don't hide behind vague prose.

Pre-v1 greenfield is not permission to ship loose code. It is permission
to rewrite an existing module when a better shape appears.

## Build gate

```bash
dotnet build -c Release      # 0 Warning(s), 0 Error(s)
dotnet test Zeta.sln -c Release   # all green
```

`TreatWarningsAsErrors` is on in `Directory.Build.props`. A warning is a
build break. Shared MSBuild wiring enforces it; no per-project
`-warnaserror` flag needed.

Do not "fix" a warning by making the code worse. Refactor, add a narrow
suppression with a one-line justification, or ask. Drive-by silencing is
a bug.

## Claims policy

- Every `/// <remarks>` or docstring claim has a falsifying test. The
  `claims-tester` skill enforces this; a claim without a test is a lie
  waiting to be found.
- Every `O(·)` complexity claim has a benchmark or a proof. If it's
  measured-under-conditions, the doc says so explicitly.
- Every performance or allocation win cites before/after evidence from
  `bench/Dbsp.Benchmarks/` or a focused allocation assertion test. Feel
  is not evidence.
- Every research-grade claim names its target venue (VLDB / PODS / PLDI
  / NSDI — see `docs/ROADMAP.md`).

## Testing order

1. **Public F# and C# surface first.** If the test can be written against
   what a consumer sees, it lives there.
2. **`InternalsVisibleTo` second,** when public APIs would make the test
   indirect or too coarse.
3. **Reflection-based tests last.** When one lands, it is explicitly
   called out in the test and the surrounding write-up. Refactoring
   options were considered first. LINQ-expression testing is not
   reflection-based testing.

For simulation and chaos work:

- Determinism is default. `IClock`, `ISimulationDriver`, and seeded
  chaos policies replace wall-clock sleeps and polling.
- Prefer `TaskCompletionSource`, barriers, awaited signals over polling
  loops in tests.
- Deterministic temp-path helpers over ad-hoc `Guid.NewGuid()` name noise
  when uniqueness-per-run is the only requirement.

## Performance policy

- Low-allocation hot paths. Measure with `MemoryDiagnoser`.
- `ValueTask` / `IAsyncEnumerable<T>` where the work is honestly async.
  Do not wrap sync I/O in `Task.Run` and call it async.
- `ArrayPool<T>.Shared` for scratch buffers; ownership contract explicit
  at every boundary.
- `Span<T>` / `ReadOnlySpan<T>` on hot loops for bounds-check elision
  and auto-vectorisation.
- `CollectionsMarshal.GetValueRefOrAddDefault` over the double-lookup
  pattern.
- Benchmarks gathered serially on a quiet machine. Parallel runs are not
  comparable evidence.
- Benchmark allocation drift is a regression signal equal to runtime.

## Async honesty

- Public async surfaces back real async I/O. If an external contract
  (`IQueryable`, `IEnumerable`) forces a sync member, implement it
  honestly and keep the seam narrow; don't grow sync parity APIs around
  it.
- `DisposeAsync` only when the type owns async cleanup. Keep `Dispose`
  sync; don't hide async work inside sync `.Wait()`.
- Analyzer coverage for blocking waits: no `Task.Result`,
  `.Wait()`, `GetAwaiter().GetResult()` in production code.
  Currently caught via F# review discipline; a Roslyn/FSharp analyzer
  for this class is P1 (`docs/BACKLOG.md`).

## Immutability policy

- Default to immutable. F# records, DUs, and `let`-bound values are the
  norm.
- When we cross into C# generic interfaces (`IBackingStore<out K>` etc.)
  the shim project declares variance explicitly.
- Mutable scratch state is acceptable for tight parser, spine, or
  merge-loop code when an immutable rewrite would materially harm
  clarity or perf. Justify in a comment.
- Materialization models may remain writable until constructor-binding
  becomes a first-class feature.

## Extension and package policy

- Keep the DI container out of hot loops. Composition happens once at
  pipeline build; runtime dispatches through concrete types.
- Prefer adding a project over growing `Zeta.Core` when a capability
  can evolve independently (Bayesian / Arrow wire / SQL front-end /
  learned plan).
- Current-state projection seams stay distinct from row-materialization
  seams so retraction semantics and CLR mapping evolve independently.
- No runtime network dependency inside the library. Library consumers
  must be able to run offline. We ship our own ~120-LoC `FeatureFlags`
  module rather than depend on a SaaS flag provider.

## Formal-verification policy

- TLA+ specs for liveness and concurrency invariants. `docs/*.tla` +
  `.cfg` files. TLC-validate them in a `dotnet test` (P1 — prevents
  drift).
- FsCheck properties for algebraic laws. Every new operator lands with
  at least one property that would falsify a buggy rewrite.
- Z3 for pointwise axioms.
- Lean 4 + Mathlib for proof-grade claims. `D ∘ I = id` and chain rule
  are the next 2-week push (P2).
- Alloy for structural invariants where TLA+ would be awkward
  (`tools/alloy/specs/Spine.als`).

See `docs/MATH-SPEC-TESTS.md` for the current spec inventory.

## Security posture

- `BinaryFormatter`, `NetDataContractSerializer`, `SoapFormatter`:
  banned. Semgrep rule #8 enforces. FsPickler (schema-bound) and Arrow
  IPC (typed) are the two approved ladders.
- Semgrep rules 8-12 cover: unchecked deserialization,
  `File.ReadAllBytes` on user path without size cap, `Process.Start`,
  `Activator.CreateInstance` from untrusted type string, `System.Random`
  in security context.
- CodeQL workflow is P0 (SDL practice #9).
- Threat model moves from Markdown-only to `pytm` (threats-as-code), P0.
- Never fetch known prompt-injection corpora (elder-plinius family).
  Pen-testing runs in an isolated single-turn sub-agent, coordinated by
  the Prompt Protector skill.

See `docs/security/` for the current SDL state.

## Reviewer skills

The `.claude/skills/` directory houses reviewer personas, each
representing a bug class to avoid. The full roster is in
`docs/REVIEW-AGENTS.md`. Key ones:

- **harsh-critic** — zero empathy, real bugs.
- **claims-tester** — every docstring claim has a test.
- **complexity-reviewer** — every `O(·)` claim has a bench or proof.
- **race-hunter** — concurrency correctness.
- **spec-zealot** — deletes code not covered by a spec, or writes the
  spec first.
- **threat-model-critic** — STRIDE + SDL.
- **paper-peer-reviewer** — conference-PC-grade on research claims.

A PR passes when the relevant reviewer skills would find nothing. It
does not have to please every reviewer.

## Documentation policy

- Docs read as **current state**, not history. Narrative lives in
  `docs/ROUND-HISTORY.md` and ADRs (`docs/DECISIONS/YYYY-MM-DD-*.md`).
- The one exception is `memory/persona/` (intentionally append-dated,
  git-visible self-modification artefacts).
- When a decision reverses, delete the `docs/WONT-DO.md` entry — don't
  leave "formerly declined" crud.
- Specs (`openspec/specs/**`, `docs/*.tla`, `proofs/lean/**`) are the
  source of truth. `docs/*.md` summarises; it does not bind.

## Language version policy

- F# and C# target .NET 10 (`global.json` pins the SDK).
- Language-level features land when they clearly improve clarity or
  runtime behaviour. No rush for bleeding-edge, no preservation of
  compat scaffolding once a feature is adopted.

## Analyzer posture

- F# static analysis: G-Research.FSharp.Analyzers + Ionide.Analyzers
  via the `AnalyzeFSharpProject` MSBuild target. Any warning they emit
  fails the build.
- C# analysis on the shim project: repo defaults (`AllEnabledByDefault`)
  plus any rule trims documented in `.editorconfig`.
- Mutation testing via Stryker.NET (trial, P1 promotion).
- Security scanning via Semgrep (12 rules, running externally; P1 wire
  into CI).

## Package management

- Central package version management via `Directory.Packages.props`.
- Shared build behaviour in `Directory.Build.props`.
- Tool version floor: `global.json` pins the .NET SDK with
  `rollForward=latestFeature`.

Generated outputs are never committed:

- `TestResults/`
- `BenchmarkDotNet.Artifacts/`
- `coverage-report/`
- `references/upstreams/` (if it appears)
