---
id: 081M08VM385087G0R001DTM0K6
type: task
state: backlog
priority: P2
slug: compile-clis-verbs-fs-the-dogfood-verb-surface-no-compiler-h
title: "Compile clis/Verbs.fs — the dogfood verb surface no compiler has ever read"
created: 2026-08-17T21:56:40.837Z
depends_on: []
composes_with: []
---

# Compile clis/Verbs.fs — the dogfood verb surface no compiler has ever read

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08VM385087G0R001DTM0K6-*.md` glob. -->

## The finding

`clis/Verbs.fs` was referenced by **no `.fsproj` and no `.sln`** — verified by grep across every
`*.fsproj` / `*.sln` / `*.props` / `*.targets` in the tree: zero hits. No compiler had ever read it.

Aaron 2026-08-17: *"clis/Verbs.fs this is our ultimate dogfood surface plus our universal
interfaces"* — which settles
`docs/research/2026-08-17-sim-as-the-room-runner-*.md` §10 Q1 (*compile it, or retire it?*) as
**compile it**, and makes the finding worse rather than better: the interface surface everything
else is meant to conform to had never been type-checked, and **cannot compose as documented.**

The header documents the loop as `sim |> mea |> cut`. It does not typecheck, for two **independent**
reasons, both reproduced against the compiler rather than inferred:

- **BREAK A** — nothing produces the value `mea` consumes. `ISimVerb.Sim: ISeed * TimeSpan -> unit`;
  `IMeaVerb.Mea<'a>: IEffects * ISim<'a> -> IMeasurement`; no member anywhere returns an `ISim<'a>`.
  Measured: `error FS0001: The type 'unit' is not compatible with the type 'ISim<'a>'`.
- **BREAK B** *(not previously on file)* — `cut` does not consume what `mea` produces, **even given
  an `ISim` from elsewhere**: `ICutVerb.Cut<'a>: TimeSpan * ISim<'a> -> IDelta<'a> * ISeam` takes the
  sim, not the measurement. Measured: `error FS0001: The type 'IMeasurement' is not compatible with
  the type 'ISim<'a>'`. So fixing BREAK A alone would not make the documented pipe compose.

Stated mechanically: **the family declares eliminators for `ISim<'a>` and no introduction form.**
That is checked by reflection in the test file, so it is a falsifier rather than a description.

## What this item shipped

- `clis/Zeta.Clis.fsproj` (zero package/project references — the surface stays weight-free) and
  `clis` added to `Zeta.sln`, so CI's `dotnet build Zeta.sln -c Release` reads the file.
- `tests/Tests.FSharp/Clis/Verbs.Tests.fs` — the composition witness. Adding the file to a project
  proves little on its own (a file of `interface end` compiles trivially); *using* the members is
  what has bite. 7 tests, all mutation-checked.
- The neutral fact worth recording: the **braid sub-family composes end to end**
  (`braid |> weave |> bob`, a real `|>` pipe). The defect is local to the five-verb core, not to the
  pure-interface style — which is correct by
  `.claude/rules/interfaces-free-classes-earned-under-rules.md` and was not "fixed".

## Deliberately NOT done — needs Aaron

**What does `sim` return?** Deciding it fixes the semantics of the interface everything else must
conform to, and the docstring's *"produces NO output (void); identity comes from the void"* reads as
intent, not oversight. Three readings are stated in the test file; none is picked.

Aaron's stated preference (2026-08-17) is the **free-object** reading — *"make this mathematical …
one arena where they can all work together and be compared"*, i.e.
`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`. The declared shapes are
*consistent with* it (`Mea` has the arity of a catamorphism with the algebra injected — compare
`DynamicValueFold.cata: DvAlgebra<'r> -> DynamicValue -> 'r`), and under it BREAK B is not a defect
at all: `mea` and `cut` are two interpretations of one term, so the documented *pipe* is what is
wrong. **That is a shape correspondence, not an exhibited instance, and it is not promoted here** —
exhibiting it requires carrier types that decide what `'a` *is*, which silently answers the open
question. Promotion path (all three required): an introduction form for `ISim<'a>`; `mea`
instantiated by a real catamorphism; a law test showing `WSet.FourCornerTrace` (traced monoidal) or
`MenoBraided*` (braided monoidal) as an **instance** rather than a neighbour.

## Adjacent finding, not acted on

`src/Core.TypeScript/lint/lint-fsharp.ts` runs `dotnet format whitespace|style|analyzers` over
`Zeta.sln`. `dotnet format` **does not support F# projects at all** (`Could not format '<x>.fsproj'.
Format currently supports only C# and Visual Basic projects.`) and **exits 0** regardless. So the
three "F# formatting checks" cannot fail on any `.fs` file. `clis/**` was deliberately *not* added
to those globs: adding a surface to a check that cannot fail buys compliance, not signal. Wiring
Fantomas is separate work.
