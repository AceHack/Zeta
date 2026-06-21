---
id: 081KSXN940008QG0R003ZJN0DH
title: Forward-only streaming JSON reader (Utf8JsonReader model) — zero-copy, ASP.NET-grade; DOM built on it, trusted-only
status: open
priority: P2
created: 2026-05-31
last_updated: 2026-05-31
attribution: aaron-2026-05-31
depends_on:
  - 081KSXN940008QG0R0033T2BQT
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSV2WD0008QG0R00051XS0N
  - 081KSXN940008QG0R0002287MP
tags:
  - workflow-engine
  - json-parser
  - streaming
  - zero-copy
  - performance
  - security
  - hexagonal
  - rust
---

# 081KSXN940008QG0R003ZJN0DH — Forward-only streaming JSON reader (Utf8JsonReader model)

## The observations (operator 2026-05-31)

A sequence of operator observations (per `.claude/rules/no-directives.md` — these
are observations the implementer acts on as an accountable peer, not directives):

> *"our json parser needs to not require full json parsing it needs to be like
> dotnet and be capable of one pass forward only json that never needs the whole
> object at once capable of deserialize infinite json streams"*

> *"think aspnet json speed requirements"*

> *"we can have a dom model version too but that is susceptible to DOS attacks and
> many other bad actor patterns we can only use it in trusted situations"*

> *"and the dom one can be built on the forward pass only one"*

The target is the .NET `System.Text.Json` / `Utf8JsonReader` model: forward-only,
single-pass, UTF-8, zero-copy, low/no allocation, never materializes the whole
document, streams unbounded JSON in constant memory, ASP.NET-grade throughput. The
DOM is a convenience layer built ON the forward-only reader, used only for trusted
input (whole-tree materialization is a DoS vector).

## Why — the SOAP/XML DOM lesson (operator lived experience 2026-05-31)

> *"i learned my lesson in the soap / xml days about DOM parser issues"*

The DoS/trusted-only stance is not theoretical — it is the hard-won SOAP/XML-era
lesson, re-applied to JSON. The XML world's DOM scars map directly:

- **Unbounded DOM memory** — `XmlDocument` (whole-tree) blown up by large/expanded
  payloads (billion-laughs / entity expansion). JSON has no entities, but a huge or
  deeply-nested payload exhausts a DOM the same way. → forward-only reader, constant
  memory.
- **Deep-nesting stack overflow** — recursive DOM build over hostile nesting. →
  iterative forward-only reader; max-depth guard on the DOM layer (roadmap).
- **XXE (external entities)** — a JSON safety win (no entities), but the general
  lesson "untrusted structured input + naive full-parse = attack surface" holds.

The .NET lineage IS this lesson carried forward: `XmlReader` (forward-only pull) →
`Utf8JsonReader` (forward-only pull). "Be like dotnet ... one pass forward only" is
literally that lineage. Hence: forward-only reader = the safe default; DOM = a
trusted-only convenience built on it.

## Done in the first cut (this slice)

- **`json_reader.rs` — forward-only, pull-based `JsonReader`** over a complete UTF-8
  buffer. `read()` yields one `JsonToken` per call, `None` at EOF. State bounded by
  nesting DEPTH (a small container stack), not document size → constant-memory
  streaming (proven: 50k-element array test, `depth()` stays at 2).
- **Zero-copy tokens.** Strings are `Cow<'a, str>` — `Borrowed` (zero-copy) when no
  escapes, `Owned` only when escapes force it. Numbers returned as raw `&'a str`
  slices (zero-copy, lossless; `number_as_f64()` parses on demand).
- **DOM built on the reader.** `ZetaJsonParser` now drives `JsonReader` to build the
  `Json` DOM (one tokenizer; the reader is the primitive). DRY; the old standalone
  recursive `Cursor` is gone.
- **DoS / trusted-only documented.** `ZetaJsonParser` carries a SECURITY note: the
  DOM materializes the whole tree + recurses on depth → trusted input only; use the
  forward-only `JsonReader` for untrusted/unbounded input. Same caveat noted on the
  serde adapter (also a DOM).
- **Hexagonal preserved.** `JsonReader` / `JsonToken` / `Json` / `JsonParser` are our
  ports; serde is the adapter; nothing outside the adapter names a serde type.
- **Tests.** 10 reader unit tests (exact token sequence, zero-copy borrow vs owned,
  empty containers, constant-depth streaming, on-demand number parse, control-char
  rejection, number grammar, depth cap, value-terminator rejection) + 3 always-on
  integration parity tests (`tests/golden_vectors.rs`); `--features serde` adds 1
  differential test. So `cargo test` runs 10 unit + 3 integration; `cargo test
  --features serde` runs 10 unit + 4 integration. Zero warnings; clippy-clean.

## Correctness fixes (Codex review 2026-05-31) — done in the reader

- [x] **Reject raw control characters** (U+0000–U+001F) in strings (both zero-copy
      and escaped paths) — JSON requires them escaped; matches serde.
- [x] **Strict JSON number grammar** — `-? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE][+-]?[0-9]+)?`;
      rejects `01` / `1.` / `-.1` / `+1` / bare `-` etc. (replaced the lenient
      scan-then-`f64::parse`). Matches serde. Tests added.

## Hardening + hygiene roadmap

- [ ] **Separate serde-adapter crate** (Codex finding: the optional serde dep sits
      in the default build graph, so a clean-offline `cargo test` must resolve it).
      Split the serde adapter + differential test into their own crate so the CORE
      crate's dependency graph is truly empty (offline-clean with zero registry
      packages). Aligns with the hexagonal "adapter is separate" + zero-dep
      supply-chain doctrine + the BCL-interface-boundary rule (only BCL/BCL-like or
      provenance-based 3rd-party interfaces; serde is 3rd-party → wrapped + isolated).

## Perf-hardening roadmap (acceptance for "ASP.NET-grade")

The first cut establishes the forward-only zero-copy shape. To actually meet
ASP.NET / System.Text.Json throughput + the full "infinite streams" capability:

- [ ] **Multi-segment / `BufRead`-refill variant** for truly infinite socket
      streams: read from an `impl BufRead` (or a `ReadOnlySequence`-style multi-buffer
      source), re-feeding bytes across reads, correctly handling tokens (strings,
      numbers) that span buffer boundaries. The current reader is over a single
      complete `&[u8]` (the `Utf8JsonReader`-over-a-span case).
- [ ] **SIMD-vectorized scanning** of whitespace + structural characters (the trick
      System.Text.Json + simdjson use for throughput). Behind a portable-SIMD path
      with a scalar fallback.
- [ ] **criterion benchmark vs serde_json** on representative payloads (small object,
      large array, deep nesting, big strings) — prove throughput parity-or-better;
      track allocations.
- [ ] **Optional max-depth + max-length guards** on the DOM builder for
      defense-in-depth even in semi-trusted situations (bounded recursion).
- [ ] **Streaming deserialize helper**: a typed `deserialize_stream<T>` that pulls a
      top-level array element-by-element via the reader (constant memory) — the
      `JsonSerializer.DeserializeAsyncEnumerable` analog.

## Cross-language note

This is the Rust instance. The same forward-only/zero-copy/trusted-DOM-on-streaming
shape should propagate to the other-language JSON ports (TS/F#/C#) as their parsers
mature — own the interface in every language (per the hexagonal substrate).

## Composes with

- 081KSXN940008QG0R0033T2BQT — the Rust observe oracle crate this reader lives in
- 081KSV2WD0008QG0R00051XS0N — cross-language-parity = compiler-BFT (the differential test is the same
  "not flying blind" discipline at parser scope)
- 081KSXN940008QG0R0002287MP — the System.Numerics / UoM interface-gate (sibling parser/algebra-interface row)
- `.claude/rules/no-directives.md` — these are observations acted on by an accountable peer
- the hexagonal / own-your-interfaces substrate (memory: hexagonal-own-interfaces-is-the-io-monad-shape)
