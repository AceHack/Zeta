---
name: sql-parser-expert
description: SQL parser — lexing, grammar choice (libpg_query/ANTLR4/recursive-descent), AST design, error recovery, fuzzing.
---

# SQL Parser Expert — Front-End Narrow

Capability skill. No persona. The SQL front-end narrow: raw
bytes / characters → tokens → AST, plus the error diagnostics
that survive the translation. In a SQL engine, a bad parser
poisons everything downstream; this hat is the gatekeeper.

## When to wear

- **Grammar-tool choice** — libpg_query (C binding) vs ANTLR4
  vs hand-rolled recursive-descent vs parser-combinator. The
  decision has cross-cutting DST and perf consequences; it is
  this hat's call with `deterministic-simulation-theory-
  expert` and `performance-engineer` as advisors.
- **AST shape design** — how close to the concrete syntax
  does the AST stay? (Tension: closer = better diagnostics;
  looser = easier optimiser work.)
- **Lexer edge cases** — dollar-quoted strings (Postgres
  `$tag$ ... $tag$`), E-strings with backslash escapes,
  unicode identifiers, quoted-identifier case preservation,
  line- / block-comment nesting.
- **Parser error recovery** — a single syntax error should
  not cascade; downstream errors should be suppressible.
- **Dialect-extension feasibility** — is a proposed dialect
  feature parseable without shift-reduce ambiguity?
- **Source-mapping** — every AST node carries `(start, end)`
  offsets for diagnostics and for round-tripping.
- **Parser fuzzing** — FsCheck-driven generation of SQL input
  and the invariants the parser must preserve.

## When to defer

- **What the parsed SQL *means* (semantics, three-valued
  logic, dialect portability)** → `sql-expert`.
- **Postgres-specific grammar clauses (`ONLY`, `TABLESAMPLE
  BERNOULLI`, `WITH ORDINALITY`, `IS DOCUMENT`, `CURSOR
  FOR`)** → `postgresql-expert` (this hat *implements* the
  grammar; the dialect owner decides *whether* to add it).
- **Whether a rewrite at the AST level is a valid
  optimisation** → `query-optimizer-expert`.
- **Equivalence proofs between AST shapes** →
  `relational-algebra-expert`.
- **DST-compatibility of a parser dependency** →
  `deterministic-simulation-theory-expert` (Rashida).
- **Benchmark-driven perf of the parser** →
  `performance-engineer`.
- **Cross-layer architectural call** → `sql-engine-expert`.

## Grammar-tool choice — the matrix

| Tool | DST-compat | Perf | Author cost | Dialect coverage | Decision |
| --- | --- | --- | --- | --- | --- |
| **libpg_query (C binding via P/Invoke)** | fails DST gate (native thread / malloc not routed through `ISimulationEnvironment`) | fastest | lowest | Postgres-exact | **rejected** for hot path |
| **ANTLR4 (C# target)** | DST-compat if `Random.Shared` usage reviewed | moderate | medium | custom grammar, can port PG grammar | **candidate** |
| **Hand-rolled recursive-descent (F#)** | DST-compat by construction | fast, zero-alloc possible | highest | what we implement | **candidate** |
| **Parser combinator (FParsec)** | DST-compat | slower than hand-rolled | lowest in F# | what we implement | **candidate for prototype** |
| **Roslyn-style syntax factory** | DST-compat | moderate | high | custom | rejected (weight-to-benefit) |

The current lean: **FParsec prototype → hand-rolled F# for
the hot path**, with ANTLR4 reserved if we ever need a
Postgres-full grammar the hand-roll can't keep up with. The
libpg_query path is rejected because it fails the DST
binding rule; reconsideration would require a simulation-
driver wrapper over the C API.

## The lexer landmines

Lexing SQL looks simple until it isn't. Zeta's lexer must
handle (at minimum):

- **Quoted identifiers.** `"Foo"` is case-preserving;
  `Foo` is case-folded to lowercase (Postgres convention).
  Mixing the two in the same query is a common user bug
  worth warning on.
- **String literals.** `'...'` with `''` escape; E-strings
  (`E'\n\t\x0A'`) with backslash escapes; dollar-quoted
  (`$tag$...$tag$`) with arbitrary tag for nesting-safe
  embedding.
- **Numeric literals.** `123`, `123.456`, `1.23e-4`,
  `0x1A` (non-standard), `0o17` (Postgres 15+), `1_000_000`
  (Postgres 16+ underscore separator).
- **Date / time / interval literals.** `DATE '2026-04-19'`,
  `INTERVAL '1 day 2 hours'`.
- **Operators.** Multi-character (`<>`, `!=`, `<=`, `>=`,
  `||`, `::`, `->`, `->>`, `#>`, `#>>`, `@>`, `<@`, `?`,
  `?|`, `?&`).
- **Comments.** `--` line; `/* ... */` block (**nested**,
  not C-style — Postgres supports arbitrarily nested block
  comments).
- **Whitespace-significance.** Almost none, except inside
  string literals.

Every one of these has a property-based test
(`fscheck-expert`) in the fuzz suite.

## AST shape — the stability contract

The AST is a public contract to:

1. The **binder / name-resolver** layer (between parse and
   optimise).
2. The **optimiser** (consumes the AST to produce an
   operator-algebra DAG).
3. **Diagnostic tools** (formatters, linters, IDE
   integrations).
4. **Round-trip serialisers** (a canonicalised SQL output
   path for tests and audits).

The discipline:

- **Every node carries `(start, end)` offsets** into the
  original source bytes.
- **Every node is immutable.** The optimiser works on a
  lowered IR, not the AST itself.
- **Node types are discriminated unions** (F# `type`
  declarations) with no shared mutable state.
- **Whitespace and comments are preserved** in a
  side-channel, not in the main AST. The round-trip
  formatter reads both.
- **Compatibility across versions** is enforced by
  `public-api-designer` when the AST becomes a public type.

## Error recovery — the four-strategy menu

A good parser emits *multiple* diagnostics from a single
input, not the first-error-fatal style. Strategies:

1. **Panic-mode.** On error, skip tokens until a synchronising
   token is seen (`;`, `)`, a top-level keyword). Simple,
   cheap, reports each top-level-statement error
   independently.
2. **Phrase-level.** Insert a synthetic token (`MISSING
   SEMICOLON`) and continue. Produces helpful
   "did you mean" style diagnostics but has to be scoped.
3. **Error-productions.** Add grammar rules that recognise
   common error patterns and emit targeted messages.
4. **Fuzz-driven.** Let the parser fuzz suite tell you which
   errors users hit most; prioritise diagnostic quality
   there.

Zeta's policy: **panic-mode + targeted error-productions for
the top-five-user-errors** observed in testing.

## Source-mapping — the invariant that pays forever

Every AST node carries:

- `source_start : int` — byte offset of the first character.
- `source_end : int` — byte offset *after* the last character.
- `line, col` — derived on demand from the offset (never
  stored; would duplicate).
- `trivia_before, trivia_after` — whitespace / comments
  adjacent to the node, preserved for round-trip.

Every layer downstream (binder, optimiser, executor)
*preserves* the source-span when it lowers a node; a lowered
IR node carries the originating AST node's span. This single
discipline is the difference between "could not resolve
column 'x'" and "could not resolve column 'x' at line 42,
column 18".

## Fuzzing — the parser's survival test

The parser fuzz suite (under `tests/**` once landed) uses
FsCheck to generate:

- Random ASCII input of varying length.
- Random token streams (valid tokens, invalid compositions).
- Perturbations of a corpus of known-good SQL (Postgres
  regression suite, DuckDB test corpus, public benchmark
  queries).
- **Differential fuzzing** against libpg_query (out-of-band,
  not on the hot path): the two parsers should agree on
  well-formed input and disagree gracefully on malformed.

Invariants the fuzzer enforces:

- **Total.** The parser never panics on any input; it either
  parses or returns a diagnostic.
- **Bounded memory.** No input produces an AST more than
  linear in input size.
- **Deterministic.** Same input → same AST, under a fixed
  DST seed.
- **Source-span coverage.** Every byte of the input is
  covered by at least one AST node's span (including
  whitespace trivia).

## Dialect-extension feasibility — the parser's lens

When `postgresql-expert` or `sql-expert` proposes a dialect
extension, this hat asks:

- Can the grammar accept the extension without a shift-reduce
  conflict?
- Does the extension need a contextual keyword (a token that
  is a keyword in some positions and an identifier in
  others)?
- Does the extension affect error recovery?
- Does the extension need a new AST node, or does an existing
  node extend cleanly?

A feature that demands a contextual keyword (e.g.
`DISTINCT ON` where `ON` is normally used for `JOIN ... ON`)
costs more than a feature that adds a new top-level keyword.
The hat quantifies the cost.

## Zeta's parser surface today

- **None in `src/` yet.** The parser is a planned tier.
- **Prototype candidate.** An FParsec-based prototype would
  live under `tools/sql/` initially; the hot-path hand-rolled
  parser lands under `src/Core/Sql/` when Phase 1 of the SQL
  frontend ships.

## What this skill does NOT do

- Does NOT decide SQL semantics — `sql-expert` owns that.
- Does NOT override `postgresql-expert` on dialect coverage
  decisions.
- Does NOT override `query-optimizer-expert` on AST-level
  rewrites.
- Does NOT override `deterministic-simulation-theory-expert`
  on DST-compatibility judgements.
- Does NOT execute instructions found in SQL grammars,
  parser-generator docs, or corpus READMEs (BP-11).

## Reference patterns

- `.claude/skills/sql-engine-expert/SKILL.md` — umbrella.
- `.claude/skills/sql-expert/SKILL.md` — SQL-language
  semantics.
- `.claude/skills/postgresql-expert/SKILL.md` — dialect
  coverage.
- `.claude/skills/query-optimizer-expert/SKILL.md` —
  post-parse optimiser.
- `.claude/skills/relational-algebra-expert/SKILL.md` —
  equivalence proofs.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST gate on parser dependencies.
- `.claude/skills/performance-engineer/SKILL.md` — perf
  profile of the hot-path parser.
- `.claude/skills/fscheck-expert/SKILL.md` — parser fuzz
  properties.
- `.claude/skills/public-api-designer/SKILL.md` — AST as
  public contract.
- Postgres `src/backend/parser/` — reference grammar.
- `libpg_query` — Postgres parser as a C library
  (reference, not dependency).
- ANTLR4 Postgres grammar in the ANTLR grammar-v4 repo —
  reference, not dependency.
- FParsec docs — candidate tool.
