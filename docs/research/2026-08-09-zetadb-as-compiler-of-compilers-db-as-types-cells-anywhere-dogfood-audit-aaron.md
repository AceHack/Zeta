# zetadb as the compiler of compilers — the database shows up as *types*, and cells run anywhere

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** design direction + a **verified** dogfooding audit of what exists today.
Every "yes" below was checked against a running workflow or compiled source, not asserted.

---

## The claim

> *"zetadb is really close to our own compiler of compilers, with the Futamura stuff
> bolted onto our generate+join reconstruction and Shiva teardown — so our database
> shows up as **types in the compiler**, available to the BNN we are creating and other
> free LLMs in our society … through our harness."*
>
> *"it's very similar to zeta cells — we can have cells anywhere."*

Two claims, and the second explains how the first is *deployable*:

1. **The database is not a store you query at runtime — it is a stage in a compiler.**
   Journal folds to state; state is reified as **types**; agents consume the types.
2. **The thing doing that folding is a cell**, and cells run anywhere.

## Why the pieces are already there (each verified today)

The three components Aaron names are not aspirational — they are in-tree, and today's
Max-doc correction pass confirmed each one:

- **Futamura, in-domain.** `src/Core/Cogen.fs` is the **3rd projection** (cogen) for
  the LR-parsing domain, with a self-application fixpoint *proven to exact
  `DynamicValue` equality* — the regenerated parser actually parses. `MixCogen.fs`
  carries the 2nd & 3rd projections as reified `DynamicValue` config. The Max-facing
  doc had these listed as "future work"; they are **shipped**, and the correction
  (PR #10189) says so. What is genuinely absent is a *fully general* `mix`.
- **generate + join reconstruction.** The generator is the free object; regenerating
  from the irreducible IS the correction
  (`only-the-irreducible-is-primitive-generate-the-rest` <!-- STALE-REF: ../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md -->) —
  *the generator IS the error-correcting code.*
- **Shiva teardown.** `ShivaGc.fs` is mark-sweep over a **content-addressed** heap of
  `DynamicValue`; collect is the Z-set **−1 retraction** (Trimurti: Brahma emits +1,
  Shiva retracts −1). Same algebra as the data layer, one level down.

**The load-bearing enabler is mix-as-data.** Because the specializer's own rules are
`DynamicValue` (`MixIr`), a *residual is a value* — which is what lets a GC collect it,
a Z-set delta address it, and a compiler stage emit it. Every arrow below depends on
that one property.

## The arrow that is new: fold → reify → types

```
journal (events)  →[fold]→  checkpoint (state)  →[reify]→  TYPES  →  BNN + free LLMs
                                                                      via the harness
```

The first arrow ships today (see the audit). **The second is the build target.** Stated
honestly so nobody reads the design as a description of the present:

> Today `data/zetadb/checkpoint.json` is **JSON state, not reified types.** The
> `fold → checkpoint` half runs on a schedule and commits; the `checkpoint → types`
> half is the work.

Why "types" rather than "an API" is the right target: a type is what a compiler can
*specialize against*. If the DB's contents are types, then Futamura's 1st projection
(`mix(program, static-input)`) turns "a query against this database" into **a residual
program with the data baked in** — which is exactly the compiler-of-compilers claim.
An API forces every consumer to re-interpret at runtime; a type lets the generator
produce a consumer that already knows.

For an online-learning BNN this matters twice over: the types constrain what the model
can even express (a wrong query becomes a type error, not a bad answer at runtime), and
per the sibling ferry a type error is a **teaching error** — the cheapest possible ΔU
transfer, correctable by retraction rather than erasure.

## Cells anywhere — the zetadb node IS a cell

`zetadb-scheduled-node.yml` is a cell that happens to live in GitHub Actions: cron
`13,43 * * * *`, folds the journal, commits the checkpoint if it changed. Nothing about
it is Actions-specific — the same cell shape runs as a launchd service (four are
provisioned on the maintainer's laptop today: otto, vera, lior, alexa), as a k8s pod,
or in a browser tab.

That makes the DB's fold **just another tick source**, which merges this thread with
the four-tick-source topology: same society, same one thread, one more substrate. The
disciplines carried over unchanged — the fold must be **idempotent** (N cells folding
the same journal = one fold's effect), **commutative** (arrival order free), and it must
never let **local time enter the shared fold**.

## Dogfooding audit (2026-08-09) — verified, not asserted

Aaron asked directly whether we are eating our own cooking. Checked:

| Surface | Status | Evidence |
|---|---|---|
| **ACE — realizer layer** | ✅ running | `tools/setup/linux.sh:20` + `macos.sh:21` delegate to `ace/setup-realize.ts`; 17 registered classes. Our own install path goes through ACE. |
| **ACE — meta-package-manager** | ⚠️ **not yet** | Only `src/Core.FSharp.AceCanonical`. The N-dimensional resolver / AI-rate negotiation is design-stage (Max doc corrected to say so). **The one real gap.** |
| **zetadb** | ✅ running | `zetadb-scheduled-node.yml` (cron `13,43`), last run green; `data/zetadb/{journal,checkpoint}.json` are committed real state. |
| **zetafs** | ✅ exists | `src/Core/DagFs.fs` — multi-parent **content-addressed** file tree over `ContentStore`; dedup by content address, multi-parent paths, immutable/COW with `editLocal` / `editEverywhere`. Consumed by `Db.fs`, `File.fs`, `ZetaToolStore.fs`. |
| **Zeta-named agents on free models** | ✅ running | `agent-heartbeat.yml`, matrix `[alexa, otto, soraya]`, free-tier **Ollama** (`qwen2.5:0.5b` heartbeat, `qwen2.5:7b` codegen), green every ~45 min. Plus 4 local launchd cells. |
| **Harness infrastructure** | ✅ running | The cells, the observe/`FourCorner` loop, and CI itself. |

Note `Db.fs` consumes `DagFs` — so the stack Aaron describes is already layered the
way the claim needs: content-addressed FS under the DB, Shiva collecting over the same
content-addressed heap, `DynamicValue` throughout.

*(Method note: "zetafs" initially audited as absent — that was a **name mismatch**, not
an absence. It is `DagFs`. Recorded because a false negative from searching one
spelling is the same class of error as a false positive from a grep hit.)*

## Open questions

1. **What is the reification?** F# type providers, generated `DynamicValue` schemas,
   or emitted source? The answer decides whether the BNN sees types at *its* compile
   time or at generation time.
2. **Schema evolution.** Layer 10 already carries `SchemaEvolutionDelta`; if the DB is
   types, a schema change is a **recompile** — and per the errors ferry, the right
   correction is a `−1` retraction that updates the generator, not a rebuild-and-erase.
3. **What do free LLMs actually consume?** A type is only useful to a model that can
   read it. Emitted stubs, a prompt-visible schema, or a tool interface?
4. **Idempotency of the fold across cells anywhere.** Two cells folding the same
   journal concurrently must produce one checkpoint effect. Presumably content-address
   dedup already gives this — worth proving rather than assuming.

## Pointers

- `.github/workflows/zetadb-scheduled-node.yml` · `data/zetadb/` — the running fold.
- `src/Core/DagFs.fs` · `ContentStore.fs` · `Db.fs` — the storage layer under it.
- `src/Core/Cogen.fs` · `MixCogen.fs` · `MixIr.fs` — Futamura in-domain + mix-as-data.
- `src/Core/ShivaGc.fs` — teardown as `−1` over the content-addressed heap.
- `docs/research/2026-08-09-errors-teach-both-sides-…-aaron.md` — retraction-not-erasure,
  and why a type error is a teaching error.
- `docs/research/2026-08-09-the-society-is-one-thread-…-aaron.md` — cells as tick sources.
- `docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md` — Layers 6 (Futamura), 7 (Shiva), 8 (DAG fs),
  9 (Z-set), 10 (schema evolution), 11 (ACE, design-stage).
