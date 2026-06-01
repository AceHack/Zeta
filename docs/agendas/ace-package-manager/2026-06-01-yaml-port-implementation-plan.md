# YAML port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Full behavior in `2026-06-01-yaml-port-forward-only-one-pass-cross-language-primitive-design.md`.

**Goal:** Land a YAML port across TS/F#/C#/Rust — a **forward-only one-pass reader**
(`YamlReader`, emits a flat `YamlEvent` stream, never builds a tree) with a **DOM builder
on top** (`YamlValue` + `parse`), hand-rolled default + vendor differential-oracle, 4-way
golden-vector verified — flipping registry `⬜ YAML` → `✅ 4/4`.

**Architecture:** L1 reader scans the text once with an indent/context stack and emits
events; L2 folds events into a value tree. Each oracle's cross-verify runs L1 over the
shared fixture, serializes the **event stream** to JSON, and `compare.ts` deep-equals all
four against each other + the fixture's `expected`. Per-lang unit tests cover L2 (the tree)
plus the vendor differential.

**Tech stack:** TS on Bun; F#/C# in `Zeta.sln` (register via `dotnet sln add`, never
hand-edit the .sln); Rust standalone crate. Gates: `bun test` + `tsc` (TS),
`dotnet build Zeta.sln -c Release` 0-warn + `dotnet test` (F#/C#), `cargo test` (Rust), the
4-way `compare.ts` exit 0, markdownlint on the registry edit. Harness: NO Edit tool — new
files via Write, edits via Python patch-scripts (exact-occurrence asserts; `rm` before
commit; never commit `_patch_*`). Pure LF — verify CR=0 with Python
(`open(f,'rb').read().count(b'\r')`), NOT grep. Canary `git ls-tree HEAD | wc -l` = 67 (new
dirs live under existing `src/`, `tests/` top-level entries). Commit trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## LOCKED cross-language contracts (identical in all four languages)

These are the cross-language treaty. Every oracle MUST match these exactly or the 4-way
compare fails. T1 (TS) is the reference; T2–T4 conform.

### Event taxonomy (`YamlEvent`)

- `StreamStart`, `StreamEnd`
- `MappingStart`, `MappingEnd`
- `SequenceStart`, `SequenceEnd`
- `Scalar { raw: string; kind: ScalarKind; style: ScalarStyle }`
  - `ScalarKind = "Null" | "Bool" | "Int" | "Float" | "Str"`
  - `ScalarStyle = "Plain" | "SingleQuoted" | "DoubleQuoted"`

A document emits exactly one `StreamStart` first and one `StreamEnd` last. In a mapping,
events are key-scalar then value (a `Scalar`, or a nested `MappingStart`/`SequenceStart`
block), repeating. Map keys are always emitted as `Scalar` with `kind="Str"` (key text is
never type-resolved).

### `raw` (the decoded scalar value)

- **Plain**: the value text after stripping leading/trailing spaces and any trailing
  comment (a `#` outside the value). A missing value (e.g. `key:` at EOL) → `raw=""`.
- **SingleQuoted**: inner content with `''` → `'`. No other escapes.
- **DoubleQuoted**: inner content with escapes decoded — support exactly `\\` `\"` `\n`
  `\t` `\r` `\0` `\/`; an unknown escape is `UnexpectedCharacter`.

### `kind` resolution (applied to PLAIN scalars only)

Quoted scalars (single or double) are **always** `kind="Str"`. Plain scalars resolve, in
order:

1. `raw` ∈ { `""`, `~`, `null`, `Null`, `NULL` } → `Null`
2. `raw` ∈ { `true`, `True`, `TRUE`, `false`, `False`, `FALSE` } → `Bool`
3. `raw` matches `^-?[0-9]+$` → `Int`
4. `raw` matches `^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$` → `Float`
5. else → `Str`

### `YamlValue` (L2 DOM)

`Null | Bool of bool | Int of int64 | Float of float | Str of string | Seq of YamlValue
list | Map of (string * YamlValue) list`. `Map` preserves insertion order (list of pairs).
`Int`/`Float` parse from `raw`; `Bool` from the matched literal; `Str` is `raw`.

### `YamlFeedback` (typed decline channel — Result over throw)

`TabIndentation` (a tab in indentation) · `UnterminatedQuote` · `UnexpectedCharacter`
(bad escape / stray char) · `UnexpectedIndent` (dedent to a non-matching level) ·
`UnsupportedConstruct` (out-of-subset: a value beginning `&` `*` `!` `{` `[` `|` `>`, or a
line `---` / `...`) — so a caller can fall back to the vendor adapter.

### Cross-verify output shape (reformatting-free)

Each oracle's cross-verify writes `<lang>-output.json` = `{ [id]: YamlEvent[] }`, where each
event is a plain JSON object: `{"e":"MappingStart"}`, `{"e":"Scalar","raw":"...",
"kind":"...","style":"..."}`, etc. Because every value is a string or an enum name, there
is **zero number-reformatting hazard** — the four event arrays are structurally identical
iff the readers agree. (This verifies L1, the load-bearing primitive, end to end. L2/DOM is
unit-tested per language.)

### Fixture is JSON, not YAML (bootstrap-avoidance)

`tests/cross-verification/yaml/vectors.json` (JSON — do **not** use YAML to test YAML, and
avoid YAML-in-YAML quoting). Schema:

```json
{
  "version": 1,
  "description": "Canonical YAML reader vectors (TS/F#/C#/Rust). Inputs as JSON strings; expected = L1 event stream.",
  "vectors": [
    { "id": "flat-scalars", "yaml": "name: zeta\ncount: 42\n", "expected": [ {"e":"StreamStart"}, {"e":"MappingStart"}, {"e":"Scalar","raw":"name","kind":"Str","style":"Plain"}, {"e":"Scalar","raw":"zeta","kind":"Str","style":"Plain"}, {"e":"Scalar","raw":"count","kind":"Str","style":"Plain"}, {"e":"Scalar","raw":"42","kind":"Int","style":"Plain"}, {"e":"MappingEnd"}, {"e":"StreamEnd"} ] }
  ]
}
```

Each lang reads `vectors.json` with its JSON facility (TS native; F#/C# `System.Text.Json`;
Rust the existing `ZetaJsonParser` or `serde_json` — implementer's choice, JSON is already
owned), runs `YamlReader` over each `yaml` string, collects events, asserts they equal
`expected`, and writes `{ id: events }` to `<lang>-output.json`.

### The 10 canonical vectors (fixture content + unit-test cases)

Author all ten in `vectors.json`. `\n` = newline in the JSON string. Expected event arrays
follow the contracts above (every array starts `StreamStart`, ends `StreamEnd`).

1. **empty-map-value** — `a:\n` → Map{ `a`(Str) : `""`(Null) }
2. **flat-scalars** — `name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n` →
   keys all Str; values: `zeta`(Str) `42`(Int) `3.14`(Float) `true`(Bool) `null`(Null).
3. **quoted-forces-string** — `a: "42"\nb: '3.14'\n` → `42`(Str,DoubleQuoted)
   `3.14`(Str,SingleQuoted).
4. **double-quote-escapes** — `msg: "he said \\"hi\\"\\nbye"\n` (JSON-escaped) → one value
   `raw=` `he said "hi"\nbye` (a real newline), Str, DoubleQuoted.
5. **single-quote-escape** — `a: 'it''s'\n` → value `raw=it's`, Str, SingleQuoted.
6. **nested-map** — `outer:\n  inner: 1\n` → Map{ outer : Map{ inner : 1(Int) } }.
7. **sequence** — `- a\n- b\n` → Seq[ a(Str), b(Str) ].
8. **sequence-of-maps** — `items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n` →
   Map{ items : Seq[ Map{id:x, n:1}, Map{id:y, n:2} ] }.
9. **comments** — `# top\na: 1  # trail\nb: 2\n` → Map{ a:1(Int), b:2(Int) } (comments
   dropped).
10. **null-forms-and-strings** — `a: ~\nb:\nc: 12abc\nd: -2.5\n` → `~`(Null) `""`(Null)
    `12abc`(Str) `-2.5`(Float).

T1 authors these and runs its reader to confirm the expected arrays (independently
reviewable by reading the contracts). T2–T4 must reproduce byte-identically.

### Parser algorithm (forward-only one-pass block reader — all langs)

Line-oriented single pass; no backtracking, no tree:

1. Split input into lines on `\n` (tolerate a trailing `\r` defensively, though input is
   LF). Track a stack of `(indent: int, kind: Mapping | Sequence)`.
2. Skip blank lines and full-line comments (`#` after optional leading spaces).
3. For each content line: count leading spaces as `indent` (a `\t` in the indentation →
   `TabIndentation`). Strip a trailing `#` comment that is outside quotes.
4. Classify: a line whose first non-space token is a `-` followed by a space (or `-` at EOL) is a **sequence
   item**; otherwise expect `key:` (a `:` followed by a space or EOL) → **mapping entry**.
   First char ∈ `& * ! { [ | >` at a value position, or a line `---`/`...` →
   `UnsupportedConstruct`.
5. Indent management: when `indent` exceeds the stack top, the current entry opened a
   block — push the appropriate container and emit `MappingStart`/`SequenceStart` before
   its first child. When `indent` is below the top, pop + emit `MappingEnd`/`SequenceEnd`
   until the top matches (no matching level → `UnexpectedIndent`).
6. Emit `Scalar` events for keys and inline values; a `key:` with no inline value but a
   more-indented block following opens a nested container; a `key:` with nothing following
   (or a less/equal-indented next line) emits a `""`/Null value scalar.
7. At EOF, pop all open containers (emit their `End` events), then `StreamEnd`.

A sequence item `- key: val` (compact) MAY be treated as: SequenceStart already open, then
the item is a single-entry (or multi-entry) mapping at the item's content indent — handle
the `-` marker then parse the remainder as a mapping line at `indent + 2`. (vector 8 exercises
this.)

Reference for the repo-root walk + flat-file conventions: the existing
`src/Core.Rust.ZetaId/tests/cross_verify.rs` (repo-root sentinel `Zeta.sln`) and
`tests/cross-verification/zeta-id/compare.ts`.

---

## Task 1: TS reference (reader + DOM + fixture + compare)

**Files (new):** `src/Core.TypeScript/yaml/{reader.ts, dom.ts, reader.test.ts, dom.test.ts,
cross-verify.ts, package.json}`; `tests/cross-verification/yaml/{vectors.json, compare.ts,
ts-output.json}`.

- [ ] **Step 1 — `vectors.json`**: author all 10 canonical vectors per the contracts above
  (inputs as JSON strings; expected = full L1 event arrays). This is the shared fixture +
  the reference for every other task; get it exactly right.
- [ ] **Step 2 — `reader.ts` (L1)**: implement the forward-only one-pass `YamlReader` per
  the algorithm. Export the `YamlEvent` / `ScalarKind` / `ScalarStyle` types + a function
  `readEvents(text: string): YamlEvent[]` (eager-collect built on a `next()` pull core is
  fine; the contract is the event sequence) and a `YamlFeedback`-returning variant
  `tryReadEvents(text): { ok: true; events } | { ok: false; feedback }`. RED first
  (`reader.test.ts`), GREEN after.
- [ ] **Step 3 — `reader.test.ts`**: a `bun:test` case per canonical vector asserting
  `readEvents(input)` deep-equals the expected array; plus decline-path cases
  (`\tx: 1` → TabIndentation; `a: "unterminated` → UnterminatedQuote; `a: &anchor` →
  UnsupportedConstruct). Write tests FIRST; confirm RED; implement to GREEN.
- [ ] **Step 4 — `dom.ts` (L2)**: `YamlValue` type + `parse(text): { ok; value } | { ok:
  false; feedback }` folding the event stream into the tree (Map = ordered pairs).
- [ ] **Step 5 — `dom.test.ts`**: assert `parse` on vectors 2/6/7/8 yields the expected
  trees (Int/Float/Bool/Null typed; Map order preserved).
- [ ] **Step 6 — `cross-verify.ts`**: read `vectors.json` from CWD (run from
  `tests/cross-verification/yaml/`), run `readEvents` on each `yaml`, assert equals
  `expected`, write `{ id: events }` to `ts-output.json`; non-zero exit on any mismatch.
  Import the reader by sibling path from the src file.
- [ ] **Step 7 — `compare.ts`**: copy `tests/cross-verification/zeta-id/compare.ts`; adapt
  to read `{ts,fsharp,cs,rust}-output.json`; per-id use `Bun.deepEquals` (events are
  arrays/objects, not flat strings); also deep-equal each present oracle's events against
  the fixture's `expected` (read `vectors.json`). Key-set equality + per-id deep-equal;
  tolerate missing oracle files; exit non-zero on mismatch.
- [ ] **Step 8 — `package.json`**: mirror `src/Core.TypeScript/zeta-id/package.json`
  (`@zeta/yaml`, type module, Apache-2.0, bun peer).
- [ ] **Step 9 — verify + commit**: `bun test src/Core.TypeScript/yaml/` green;
  `bun --bun tsc --noEmit -p tsconfig.json` exit 0; from the yaml tests dir run the
  cross-verify (writes `ts-output.json`) then `bun run compare.ts` green (TS-only). CR=0;
  canary 67. Commit.

---

## Task 2: Rust oracle (hand-rolled, de-risk early)

**Files (new):** `src/Core.Rust.Yaml/{Cargo.toml, Cargo.lock, src/lib.rs, src/reader.rs,
src/dom.rs, tests/cross_verify.rs}`.

- [ ] **Step 1 — `Cargo.toml`**: mirror `src/Core.Rust.ZetaId/Cargo.toml` — `name =
  "zeta-core-yaml"`, edition 2024, `publish = false`, **zero `[dependencies]`**,
  `[lints.rust] unsafe_code = "forbid"`.
- [ ] **Step 2 — `src/reader.rs` (L1)**: `pub enum YamlEvent` / `ScalarKind` /
  `ScalarStyle` / `YamlFeedback`; `pub fn read_events(text: &str) -> Result<Vec<YamlEvent>,
  YamlFeedback>` per the algorithm. `#![forbid(unsafe_code)]` at crate root.
- [ ] **Step 3 — unit tests (in `src/reader.rs` `#[cfg(test)]` or `tests/`)**: a case per
  canonical vector (hard-coded expected `Vec<YamlEvent>`); decline-path cases. RED → GREEN.
- [ ] **Step 4 — `src/dom.rs` (L2)**: `pub enum YamlValue` + `pub fn parse(text: &str) ->
  Result<YamlValue, YamlFeedback>` folding events; `IndexMap`-free ordered map = `Vec<(String,
  YamlValue)>`.
- [ ] **Step 5 — `tests/cross_verify.rs`**: repo-root walk to `Zeta.sln`; read
  `tests/cross-verification/yaml/vectors.json` (hand-rolled minimal JSON read OR reuse the
  ZetaId crate's reader pattern — zero-dep); for each vector run `read_events`, assert ==
  `expected` (compare by serializing events to the same JSON object shape), write
  `{ id: events }` to `rust-output.json`. Keeping it zero-dep: emit the events JSON by hand
  (each event is a tiny fixed-shape object) exactly like `ZetaId`'s `cross_verify.rs` writes
  its output by hand.
- [ ] **Step 6 — verify + commit**: `cargo test` green (unit + cross_verify);
  `rust-output.json` matches `ts-output.json` (run `compare.ts` → TS≡Rust). CR=0; canary 67.
  Commit. (`cargo` is installed — `rust-gnu` 1.96.0 on PATH.)

---

## Task 3: F# oracle (+ YamlDotNet differential)

**Files (new):** `src/Core.FSharp.Yaml/{Reader.fs, Dom.fs, Zeta.Core.FSharp.Yaml.fsproj}`;
`tests/Tests.FSharp/Yaml/{ReaderTests.fs, CrossVerifyTests.fs}`.

- [ ] **Step 1 — `.fsproj`**: mirror `src/Core.FSharp.ZetaId/Zeta.Core.FSharp.ZetaId.fsproj`
  (net10.0, RootNamespace/AssemblyName `Zeta.Core.FSharp.Yaml`, TreatWarningsAsErrors, zero
  deps); `<Compile Include="Reader.fs" />` then `Dom.fs`.
- [ ] **Step 2 — register**: `dotnet sln add src/Core.FSharp.Yaml/Zeta.Core.FSharp.Yaml.fsproj`.
- [ ] **Step 3 — `Reader.fs` (L1)**: module `Zeta.Core.FSharp.Yaml` — DU `YamlEvent` /
  `ScalarKind` / `ScalarStyle` / `YamlFeedback`; `readEvents : string -> Result<YamlEvent
  list, YamlFeedback>` per the algorithm.
- [ ] **Step 4 — `Dom.fs` (L2)**: `YamlValue` DU + `parse : string -> Result<YamlValue,
  YamlFeedback>`.
- [ ] **Step 5 — `tests/Tests.FSharp/Yaml/ReaderTests.fs`**: xUnit `[<Fact>]` per canonical
  vector (hard-coded expected `YamlEvent list`) + decline paths.
- [ ] **Step 6 — `tests/Tests.FSharp/Yaml/CrossVerifyTests.fs`**: mirror the ZetaId
  CrossVerifyTests pattern — repo-root walk; read `vectors.json` via `System.Text.Json`
  (NOT YamlDotNet — the fixture is JSON); for each vector run `readEvents`, assert ==
  `expected`, serialize `{ id: events }` to `fsharp-output.json` via `System.Text.Json`.
  **Plus a differential `[<Fact>]`**: parse each vector's `yaml` with both `readEvents`→DOM
  and YamlDotNet's `DeserializerBuilder`, assert the resulting structures agree (the
  YamlDotNet differential oracle).
- [ ] **Step 7 — wire Tests.FSharp.fsproj** (patch-script, exact-occurrence): add
  `<ProjectReference Include="..\..\src\Core.FSharp.Yaml\Zeta.Core.FSharp.Yaml.fsproj" />`
  after the `Core.FSharp.Observe` ProjectReference; add `<Compile Include="Yaml/ReaderTests.fs" />`
  then `<Compile Include="Yaml/CrossVerifyTests.fs" />` after the `ZetaId/CrossVerifyTests.fs`
  Compile line.
- [ ] **Step 8 — verify + commit**: `dotnet build Zeta.sln -c Release` 0-warn;
  `dotnet test tests/Tests.FSharp` (Yaml facts green); run `compare.ts` (TS≡F#). CR=0;
  canary 67. Commit.

---

## Task 4: C# oracle (BCL-clean, + YamlDotNet differential)

**Files (new):** `src/Core.CSharp.Yaml/{YamlReader.cs, YamlValue.cs,
Zeta.Core.CSharp.Yaml.csproj}`; `tests/Tests.CSharp/Yaml/{ReaderTests.cs,
CrossVerifyTests.cs}`.

- [ ] **Step 1 — `.csproj`**: mirror `src/Core.CSharp.ZetaId/Zeta.Core.CSharp.ZetaId.csproj`
  (net10.0, RootNamespace/AssemblyName `Zeta.Core.CSharp.Yaml`, TreatWarningsAsErrors,
  Nullable enable; **no FSharp.Core**); `.cs` globs automatically.
- [ ] **Step 2 — register**: `dotnet sln add src/Core.CSharp.Yaml/Zeta.Core.CSharp.Yaml.csproj`.
- [ ] **Step 3 — `YamlReader.cs` (L1)**: namespace `Zeta.Core.CSharp.Yaml` — records/enums
  `YamlEvent` (a sealed-hierarchy or a struct with an `EventKind` tag), `ScalarKind`,
  `ScalarStyle`, `YamlFeedback`; `static Result<...>`-shaped `ReadEvents(string)` (use a
  small result struct/tuple; BCL-clean). Per the algorithm.
- [ ] **Step 4 — `YamlValue.cs` (L2)**: `YamlValue` sealed hierarchy + `static Parse(string)`.
- [ ] **Step 5 — `tests/Tests.CSharp/Yaml/ReaderTests.cs`**: xUnit `[Fact]` per canonical
  vector + decline paths.
- [ ] **Step 6 — `tests/Tests.CSharp/Yaml/CrossVerifyTests.cs`**: mirror ZetaId pattern —
  repo-root walk; read `vectors.json` via `System.Text.Json`; run `ReadEvents`, assert ==
  `expected`, write `{ id: events }` to `cs-output.json`. Plus a YamlDotNet differential
  `[Fact]`.
- [ ] **Step 7 — wire Tests.CSharp.csproj** (patch-script if explicit refs; else glob): add
  `<ProjectReference Include="..\..\src\Core.CSharp.Yaml\Zeta.Core.CSharp.Yaml.csproj" />`
  (YamlDotNet PackageReference already present in Tests.CSharp).
- [ ] **Step 8 — verify + commit**: `dotnet build Zeta.sln -c Release` 0-warn;
  `dotnet test tests/Tests.CSharp` (Yaml facts green); run `compare.ts` (now TS≡F#≡C#).
  CR=0; canary 67. Commit.

---

## Task 5: 4-way green + retrofit + registry flip + PR

**Files (modified):** `docs/PRIMITIVE-REGISTRY.md`;
`tests/Tests.FSharp/ZetaId/CrossVerifyTests.fs`; `tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs`;
`src/Core.TypeScript/{zeta-id,sha256}/cross-verify.ts` (sha256 only if its branch is in
scope — see note).

- [ ] **Step 1 — 4-way compare**: from `tests/cross-verification/yaml/` run all four
  cross-verify entries (regenerate the four `*-output.json`) then `bun run compare.ts` →
  `All implementations agree on 10 vectors.` exit 0.
- [ ] **Step 2 — retrofit zeta-id (F#/C#)**: replace the direct
  `DeserializerBuilder().Deserialize<VectorEnvelope>(...)` in the two ZetaId CrossVerifyTests
  with our port (or the wrapped YamlDotNet adapter behind it) — the only remaining YamlDotNet
  reference should be the adapter, not the test body. Re-run `dotnet test` — the 12-vector
  zeta-id suite stays green byte-identically.
- [ ] **Step 3 — retrofit TS zeta-id cross-verify**: replace direct `Bun.YAML.parse` in
  `src/Core.TypeScript/zeta-id/cross-verify.ts` with our TS YAML port (the port may call
  `Bun.YAML` internally as the BCL-tier adapter). Re-run; zeta-id stays green. (The sha256
  TS cross-verify lives on the paused slice-8 branch, not main — note it for the slice-8
  resume rather than retrofitting here.)
- [ ] **Step 4 — registry flip** (patch-script): in `docs/PRIMITIVE-REGISTRY.md` line 62
  flip the YAML row from `⬜ **YAML** (text; config-friendly)` to `✅ **YAML** (4/4)`
  and update its prose to note: forward-only one-pass `YamlReader` + `YamlValue`
  DOM-on-top; hand-rolled default; YamlDotNet / `Bun.YAML` differential adapter; Rust
  hand-rolled-only. markdownlint clean.
- [ ] **Step 5 — final holistic review**: dispatch a final reviewer over
  `git diff origin/main..HEAD`; confirm contracts identical across langs, no vendor import
  in any core module, all gates green.
- [ ] **Step 6 — open impl PR + gate loop**: open the PR (base main), arm
  `gh pr merge <N> --auto --squash`, poll the gate, resolve any review threads
  (verify-against-source first), re-arm. Bookkeeping after merge.

**Note (slice-8 dependency):** the SHA-256 slice is paused on its own branch
(`otto-windows/ace-slice8-sha256-impl-2026-06-01`). When it resumes, its TS/F#/C# oracles
consume this port for fixture reading instead of `Bun.YAML`/YamlDotNet — folded into the
slice-8 build, not this PR.
