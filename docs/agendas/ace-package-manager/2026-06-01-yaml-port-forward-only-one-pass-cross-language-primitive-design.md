# YAML port — forward-only one-pass parser + DOM-on-top, 4-oracle (design)

> Spec for the **YAML port** on the serializer roster (`docs/PRIMITIVE-REGISTRY.md`
> line 62, currently `⬜ YAML`). Own a YAML reader interface across all four languages
> (TypeScript / F# / C# / Rust): a **forward-only one-pass reader** at the base, a
> **DOM builder layered on top**, hand-rolled as the default, the vendor library wrapped
> as a differential-oracle adapter. Brainstormed + approved with the operator 2026-06-01
> (own-the-interface like the JSON port; safe-subset scope; forward-only one-pass, not a
> DOM parser). Detoured ahead of finishing slice 8 (SHA-256) so the SHA-256 .NET oracles
> consume the port from day one instead of depending on YamlDotNet directly.

## Goal

Flip the registry `⬜ YAML` to `✅ 4/4` by owning a YAML port whose **base layer is a
forward-only, single-pass reader** (emits a flat event stream; never materializes a tree)
and whose **DOM/value-tree is a thin layer built on top** of that event stream. The
hand-rolled reader is the production default in all four languages; the vendor library
(YamlDotNet for .NET, `Bun.YAML` for TS) is wrapped behind the same port as a test-side
differential oracle. The cross-verification fixture readers (zeta-id, sha256) then consume
our port instead of depending on a vendor parser directly.

## Why this exists (boundary doctrine)

Per `docs/PRIMITIVE-REGISTRY.md` line 62 and the `bcl-interface-boundary` rule: the wire
format is the de-facto-standard spec we depend on; the vendor library is an adapter we
wrap; a vendor import in the core is a lint failure; cross-language primitives are verified
4-way via golden vectors. YAML is the next `⬜` on that roster. Today YamlDotNet is used
directly in two test files (`tests/Tests.FSharp/ZetaId/CrossVerifyTests.fs`,
`tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs`) and `Bun.YAML` directly in the TS
cross-verify entries — this slice owns the interface so those direct dependencies route
through our port.

The JSON port (`ZetaJsonParser` zero-dep default + `serde_json` adapter behind a feature,
`src/Core.Rust.Observe/src/json.rs`) is the template. YAML differs in two ways the design
accounts for: (1) YAML is whitespace-significant and far harder to parse than JSON, so the
hand-rolled default targets a bounded **safe-subset**, not full YAML 1.2; (2) Rust's vendor
option `serde_yaml` is unmaintained, so Rust is hand-rolled-only with no vendor adapter
(it relies on cross-language agreement for its differential check).

## Decisions (this spec locks them; operator 2026-06-01)

1. **Forward-only one-pass reader is the base; DOM is built on top.** The core port is a
   pull reader that scans the text left-to-right exactly once and emits a flat stream of
   structural events. It never builds a tree. A small indent/context stack tracks block
   nesting (to emit container-end events on dedent) — structural bookkeeping, not a DOM.
   The value-tree (`YamlValue`) is a separate, optional layer that folds the event stream
   into a tree. This mirrors `Utf8JsonReader` (forward-only) vs `JsonDocument` (DOM).
2. **Safe-subset scope.** The hand-rolled reader parses the JSON-equivalent subset of YAML
   that real configs and fixtures use: block-style mappings + sequences + scalars, nesting,
   `#` comments, single/double-quoted + plain scalars, and core-schema type resolution
   (null / bool / int / float / str). Anchors/aliases, tags, multi-document streams, flow
   style (`{}` / `[]`), and block scalars (`|` / `>`) are **out of scope** for the
   hand-rolled default; the wrapped vendor adapter covers them when a use case needs them.
3. **Own the port; hand-rolled is the default; vendor is a wrapped adapter.** Per the
   boundary doctrine. The hand-rolled forward-only reader is the production default in all
   four languages. YamlDotNet (F#/C#) and `Bun.YAML` (TS) are wrapped behind the same port
   as test-side differential oracles. Rust has no maintained vendor (`serde_yaml`
   unmaintained) → hand-rolled-only, differential-checked by cross-language agreement.
   `Bun.YAML` is a Bun built-in (BCL-tier) so the TS adapter may call it directly.
4. **4-oracle byte-consensus (Tier 1).** A shared golden-vector fixture (YAML input docs →
   expected parsed structure) + an N-way `compare` harness assert that all four oracles
   parse to the same canonical structure. The `tests/cross-verification/zeta-id/` layout is
   the template.

## Architecture — two layers

### Layer 1 — `YamlReader` (the port core, forward-only one-pass)

A pull reader with a single advancing method. It scans the input once and emits events; it
holds only a current position + an indent/context stack (depth state, not a tree).

Pull surface (idiomatic per language; one common shape):

- `next() -> Result<YamlEvent, YamlFeedback>` — advance and return the next event; the
  terminal event is `StreamEnd`. (TS/Rust may expose an iterator/`Option` form; F#/C# a
  `TryRead`/sequence form — same semantics.)

Event taxonomy (`YamlEvent`):

- `StreamStart` / `StreamEnd`
- `MappingStart` / `MappingEnd`
- `SequenceStart` / `SequenceEnd`
- `Scalar { raw: string; kind: Null | Bool | Int | Float | Str; style: Plain | SingleQuoted | DoubleQuoted }`

In a mapping, events alternate key-scalar then value (a `Scalar`, or a nested
`MappingStart` / `SequenceStart`); the consumer pairs them by position. `kind` is the
YAML-core-schema type resolved from the raw scalar in the same pass (`null`/`~` → Null,
`true`/`false` → Bool, integer/float literals → Int/Float, else Str); `raw` is always the
verbatim text so a consumer can re-resolve if it wants.

`YamlFeedback` is the typed decline channel (Result over throw, per the `Codec` seam):
variants for `UnexpectedIndent`, `UnterminatedQuote`, `TabIndentation` (YAML forbids tab
indentation), `UnexpectedCharacter`, `UnsupportedConstruct` (an out-of-subset feature —
anchors/tags/flow/block-scalar — so the caller can fall back to the vendor adapter).

### Layer 2 — `YamlValue` DOM (built on top of the reader)

A thin builder that consumes the Layer-1 event stream and folds it into a value tree:

- `YamlValue = Null | Bool of bool | Int of int64 | Float of float | Str of string | Seq of YamlValue list | Map of (string * YamlValue) list`
- `parse(text) -> Result<YamlValue, YamlFeedback>` — runs the reader to exhaustion and folds.

Map preserves insertion order (a list of pairs, not a hash map) so round-trips and
golden-vector comparisons are deterministic.

### Consumers

The flat-fixture readers (zeta-id, sha256 cross-verify) can consume **either** layer: the
flat-scalar `vectors.yaml` schema is shallow enough to read straight off the Layer-1 event
stream (pairing key/value scalars under the `vectors:` sequence), which keeps the hot path
forward-only and proves the event API is sufficient on its own. A consumer that wants a
tree calls `parse` (Layer 2).

## Port boundary (per `bcl-interface-boundary`)

- Core depends only on our own `YamlReader` + `YamlValue` types. A vendor import in a core
  module is a lint failure.
- Hand-rolled forward-only reader is the default impl in all four languages.
- Vendor adapter (test-side differential oracle): YamlDotNet (F#/C#), `Bun.YAML` (TS). The
  adapter parses the same input and produces our `YamlValue`, so a differential test can
  assert ours ≡ vendor. Rust: no adapter (`serde_yaml` unmaintained); differential coverage
  comes from cross-language agreement.

## Layout (mirrors zeta-id / sha256 / observe)

```text
src/Core.TypeScript/yaml/
  reader.ts            Layer 1 — forward-only one-pass reader (YamlEvent stream)
  dom.ts               Layer 2 — YamlValue + parse(text) on top of reader
  reader.test.ts       unit tests (event stream over golden inputs)
  dom.test.ts          unit tests (value tree)
  cross-verify.ts      reads yaml/vectors fixture → writes ts-output.json
  package.json
src/Core.FSharp.Yaml/      Reader.fs + Dom.fs + Zeta.Core.FSharp.Yaml.fsproj (register via dotnet sln add)
src/Core.CSharp.Yaml/      YamlReader.cs + YamlValue.cs + Zeta.Core.CSharp.Yaml.csproj (BCL-clean; register via dotnet sln add)
src/Core.Rust.Yaml/        src/reader.rs + src/dom.rs + src/lib.rs + Cargo.toml + tests/cross_verify.rs (hand-rolled-only)

tests/cross-verification/yaml/
  vectors.yaml         shared YAML input docs + expected parsed structure (the oracle)
  ts-output.json       each oracle's parsed structure (canonical JSON of the value tree)
  fsharp-output.json
  cs-output.json
  rust-output.json
  compare.ts           N-way diff; key-set + per-key structural equality; non-zero on mismatch
```

The .NET differential-oracle tests live in the existing `tests/Tests.FSharp/Yaml/` and
`tests/Tests.CSharp/Yaml/` projects (which already reference YamlDotNet), each adding a
`ProjectReference` to the new `Core.*.Yaml` port project.

## Cross-verification (the Tier-1 gate)

- **`vectors.yaml`** — a set of YAML input documents (id → YAML text) chosen to exercise the
  safe-subset: flat scalars, nested maps, sequences, sequences-of-maps, each scalar kind
  (null/bool/int/float/str), quoted vs plain scalars, comments, and the existing flat
  fixture shape. Each carries the `expected` parsed structure as canonical JSON of the
  value tree (independently verifiable, not self-certified).
- Each oracle's `cross-verify` entry parses each input via Layer 1 → Layer 2 → canonical
  JSON, writes `<lang>-output.json` = `{ id: canonical_json }`, and asserts each equals the
  fixture's `expected` (non-zero exit on mismatch).
- **`compare.ts`** (copy the zeta-id / sha256 harness): every present oracle has exactly the
  TS key set AND per-key structural equality, plus each oracle's parse equals the canonical
  `expected`. Exits non-zero on any mismatch or key-set drift. Tolerates missing oracle
  files so it runs green incrementally as the four land.

## Testing

- **Per-language unit tests** — Layer 1 (event stream over representative inputs, including
  the decline paths: tab-indentation, unterminated quote, out-of-subset construct) and
  Layer 2 (value tree). Assert against hard-coded expected events/trees (assert-don't-skip:
  the expectations are written out, not derived from the parser under test).
- **Differential tests (where a vendor exists)** — F#/C# parse the cross-verify inputs with
  both our reader and YamlDotNet and assert the resulting `YamlValue` trees are equal; TS
  the same against `Bun.YAML`.
- **Cross-verification** — `compare.ts` over the four `*-output.json`; the Tier-1
  byte-consensus gate.
- Gates: each language's native test runner (bun:test / dotnet test / `cargo test`) green;
  `bun --bun tsc --noEmit -p tsconfig.json` exit 0; `dotnet build Zeta.sln -c Release`
  0-warning; markdownlint on this doc + the registry edit.

## Retrofit (remove direct vendor usage)

- `tests/Tests.FSharp/ZetaId/CrossVerifyTests.fs` and
  `tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs` — replace the direct
  `DeserializerBuilder().Deserialize<VectorEnvelope>(...)` with our port (or the wrapped
  YamlDotNet adapter behind it), so the only YamlDotNet reference is the adapter, not the
  test body.
- `src/Core.TypeScript/sha256/cross-verify.ts` and
  `src/Core.TypeScript/zeta-id/cross-verify.ts` — replace direct `Bun.YAML.parse` with our
  TS YAML port (which may call `Bun.YAML` internally as the BCL-tier adapter).

The retrofit is verified by the existing zeta-id (12-vector) and sha256 (5-vector)
cross-verify suites continuing to pass byte-identically after the swap.

## Scope / YAGNI

In scope: forward-only one-pass reader (safe-subset) + `YamlValue` DOM on top, in four
languages; shared golden-vector fixture; N-way compare; differential vendor checks where a
vendor exists; retrofit the existing direct-vendor usages; registry flip.

Out of scope (vendor-only, pull on demand): anchors/aliases, tags, multi-document streams,
flow style (`{}` / `[]`), block scalars (`|` / `>`); YAML **emit/serialize** (this slice is
parse-only — reading fixtures + config is the use case); other formats (XML, MessagePack,
protobuf) — already separate `⬜` rows on the roster.

## Files touched

- `src/Core.TypeScript/yaml/` — **new** (reader.ts, dom.ts, reader.test.ts, dom.test.ts, cross-verify.ts, package.json).
- `src/Core.FSharp.Yaml/` — **new** (Reader.fs, Dom.fs, .fsproj) + `dotnet sln add`.
- `src/Core.CSharp.Yaml/` — **new** (YamlReader.cs, YamlValue.cs, .csproj) + `dotnet sln add`.
- `src/Core.Rust.Yaml/` — **new** (src/lib.rs, src/reader.rs, src/dom.rs, tests/cross_verify.rs, Cargo.toml).
- `tests/cross-verification/yaml/` — **new** (vectors.yaml, compare.ts, four `*-output.json`).
- `tests/Tests.FSharp/Yaml/` + `tests/Tests.CSharp/Yaml/` — **new** differential + unit tests; `ProjectReference` to the new port projects.
- `tests/Tests.FSharp/ZetaId/CrossVerifyTests.fs` + `tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs` + `src/Core.TypeScript/{sha256,zeta-id}/cross-verify.ts` — retrofit to the port.
- `docs/PRIMITIVE-REGISTRY.md` — flip the YAML row `⬜ → ✅ 4/4`; note forward-only-reader + DOM-on-top + hand-rolled-default + vendor-adapter.

## Decomposition (5 tasks, mirrors the SHA-256 shape)

- **T1 — TS reference + shared fixture + compare.** Layer 1 reader + Layer 2 DOM + unit
  tests + `vectors.yaml` + cross-verify + `compare.ts`. TS is the reference the others diff
  against; defines the event taxonomy + fixture format + canonical-JSON output shape.
- **T2 — Rust oracle (hand-rolled, de-risk early).** New crate: forward-only reader + DOM +
  unit tests + `cross_verify.rs` (repo-root walk + writes `rust-output.json`). Hardest
  hand-roll — done early so the event model is proven before F#/C#.
- **T3 — F# oracle.** Port project (Reader.fs + Dom.fs) + sln register + Tests.FSharp unit +
  cross-verify + YamlDotNet differential.
- **T4 — C# oracle (BCL-clean).** Port project + sln register + Tests.CSharp unit +
  cross-verify + YamlDotNet differential.
- **T5 — 4-way compare green + retrofit + registry flip + PR.** Run the four-way compare;
  retrofit zeta-id + sha256 cross-verify to the port; flip the registry row; holistic
  review; open the impl PR + gate loop.
