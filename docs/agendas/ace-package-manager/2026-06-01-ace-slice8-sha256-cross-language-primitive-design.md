# Ace slice 8 — SHA-256 cross-language primitive (design)

> Spec for slice 8 of the Ace package manager (081KR2E4K0008QG0R002YE3MMD). The first step of the
> **cross-language Ace trust core**: land **SHA-256** as a 4-oracle primitive
> (TypeScript / F# / C# / Rust) with golden-vector byte-consensus, per the
> 4-language compiler-BFT model (`docs/PRIMITIVE-REGISTRY.md` +
> `docs/DECISIONS/2026-05-31-four-language-compiler-bft-...`). Brainstormed + decided
> with the operator 2026-06-01 (cross-language direction; trust-core first;
> foundation-first starting at SHA-256).

## Goal

SHA-256 is the foundation of Ace's trust core: `package_hash = sha256(canonical-JSON)`
and `key_id = sha256(SPKI)`. Before the cross-language trust core can exist, all four
oracles must agree, byte-for-byte, on SHA-256. This slice lands that agreement as a
**Tier-1** primitive (shared golden-vector fixture + N-way `compare` harness) and ticks the
existing `⬜ SHA-256` registry wish to `✅ 4/4`.

It is deliberately the smallest, lowest-risk first step: SHA-256 is a published standard, so
the oracles agree both with each other **and** with the NIST test vectors — and it stands up
the Ace-trust cross-verification harness at minimal risk before the real crux (canonical-JSON
byte-identity) lands next.

## Decomposition — the cross-language trust-core arc

- **Slice 8 (this spec):** SHA-256 — 4-oracle, golden-vector byte-consensus.
- **Slice 8.1:** canonical-JSON — byte-identical canonicalization (sorted keys, number
  formatting, escaping) across all four; the real cross-language crux (builds on the
  in-flight `ZetaJsonParser`).
- **Slice 8.2:** `package_hash` — the composition `sha256 ∘ canonical-JSON` (+ `key_id`).
- **Slice 8.3:** ed25519 sign/verify — new crypto primitive, dep-behind-port per language.
- **Slice 8.4:** index signature-verify — `ed25519-verify ∘ canonical-JSON-of-content`;
  proves "publish in TS, consume in Rust — signatures hold."

This spec covers slice 8 only (SHA-256). The later steps get their own specs.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Four oracles, byte-consensus (Tier 1).** TS / F# / C# / Rust each implement SHA-256
   behind our own port; a shared golden-vector fixture + an N-way `compare` harness assert
   byte-identical digests across all four (and against the published standard vectors). The
   `tests/cross-verification/zeta-id/` layout is the template.
2. **Own the port; native/dep is the adapter** (per `bcl-interface-boundary`). We expose our
   own `Sha256` surface; underneath: TS `node:crypto`, F#/C# `System.Security.Cryptography.SHA256`
   (BCL — depend directly), Rust the `sha2` crate (Rust std has no SHA-256; `sha2` is the
   RustCrypto de-facto standard — provenance-vetted + ubiquitous — wrapped **behind our port**
   as the bootstrap impl + differential oracle, exactly as `Core.Rust.Observe` keeps
   `serde_json` behind a feature).
3. **Port surface (one common shape, idiomatic per language):**
   - `sha256(bytes) -> 32-byte digest` (raw bytes in, 32 bytes out)
   - `sha256Hex(bytes) -> lowercase-hex string` (the golden-vector + display form)
   - idiomatic: TS `Uint8Array`; F# `byte[]`; C# `ReadOnlySpan<byte>`/`byte[]`; Rust `&[u8] -> [u8; 32]`.
4. **Vectors anchored to the standard.** The fixture includes the canonical published SHA-256
   vectors (empty input; `"abc"`; the NIST 56-byte + longer message) so the oracle is the
   SHA-256 standard itself, not mere self-consistency — plus a few Ace-shaped inputs (a small
   JSON blob's bytes) for realism.

## Layout (mirrors zeta-id / observe)

```text
src/Core.TypeScript/sha256/
  sha256.ts            our port over node:crypto
  sha256.test.ts       per-lang unit tests (standard vectors)
  cross-verify.ts      reads vectors.yaml → writes ts-output.json
  package.json
src/Core.FSharp.Sha256/    Sha256.fs (port) + cross-verify entry + .fsproj
src/Core.CSharp.Sha256/    Sha256.cs (port) + cross-verify entry + .csproj
src/Core.Rust.Sha256/      src/lib.rs (port over sha2) + tests/cross_verify.rs + Cargo.toml

tests/cross-verification/sha256/
  vectors.yaml         shared inputs + expected_hex (the oracle)
  ts-output.json       each oracle's { id: digest_hex }
  fsharp-output.json
  cs-output.json
  rust-output.json
  compare.ts           N-way diff; key-set equality + per-key hex equality; non-zero on mismatch
```

## Cross-verification (the Tier-1 gate)

- **`vectors.yaml`** — `{ version, description, vectors: [{ id, input_utf8? , input_hex?, expected_hex }] }`.
  Each vector gives an input as either a UTF-8 string (`input_utf8`) or hex bytes
  (`input_hex`), and the expected lowercase-hex SHA-256 digest. Standard vectors:
  - `empty` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
  - `abc` → `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`
  - the NIST multi-block vector(s) + 1-2 Ace-shaped JSON-bytes inputs.
- Each oracle's `cross-verify` entry reads `vectors.yaml`, computes `sha256Hex` for each
  vector's input, and writes `<lang>-output.json` = `{ id: digest_hex }`.
- **`compare.ts`** (copy the zeta-id harness): asserts every present impl has exactly the TS
  key set AND per-key hex equality; exits non-zero on any mismatch. Because the expected
  digests are the published standard, each oracle's output is also checked against
  `expected_hex` (so a lone wrong oracle is caught even if another is also wrong).

## Components

- **`src/Core.TypeScript/sha256/sha256.ts`** — `sha256(bytes: Uint8Array): Uint8Array` +
  `sha256Hex(bytes: Uint8Array): string` over `node:crypto.createHash("sha256")`. No 3rd-party dep.
- **`src/Core.FSharp.Sha256/Sha256.fs`** — `sha256 (bytes: byte[]) : byte[]` + `sha256Hex`
  over `System.Security.Cryptography.SHA256` (BCL). Module surface; idiomatic.
- **`src/Core.CSharp.Sha256/Sha256.cs`** — `static byte[] Sha256(ReadOnlySpan<byte>)` +
  `static string Sha256Hex(...)` over `System.Security.Cryptography.SHA256`. BCL-clean (no
  FSharp.Core).
- **`src/Core.Rust.Sha256/src/lib.rs`** — `pub fn sha256(bytes: &[u8]) -> [u8; 32]` +
  `sha256_hex` over the `sha2` crate **behind our port** (the only non-BCL dep; pinned per
  `dep-pin-search-first-authority` — verify current `sha2` version at impl time).
- **`tests/cross-verification/sha256/`** — fixture + per-oracle outputs + `compare.ts`.
- **`docs/PRIMITIVE-REGISTRY.md`** — flip `⬜ SHA-256` to `✅ 4/4 (Tier 1)`; add the
  Tier-1/2 table row with locations; note it's the foundation of the Ace trust core.

## Testing

- **Per-language unit tests** — each oracle hashes the standard vectors (empty, `abc`, NIST)
  and asserts the published digests. (assert-don't-skip: hard-coded expected digests, not
  self-comparison.)
- **Cross-verification** — `compare.ts` over the four `*-output.json`; non-zero on any
  mismatch or key-set drift. This is the Tier-1 byte-consensus gate.
- Gates: each language's native test runner (bun:test / dotnet test / `cargo test`) green;
  `bun --bun tsc --noEmit -p tsconfig.json` exit 0 for the TS; markdownlint on this doc +
  the registry edit.

## Scope / YAGNI

In scope: SHA-256 over our port in four languages; standard-anchored golden vectors; N-way
compare; registry flip.

Out of scope (later trust-core slices): canonical-JSON (8.1), `package_hash`/`key_id`
composition (8.2), ed25519 (8.3), index-verify (8.4); streaming/incremental hashing; other
hash functions (SHA-512, BLAKE3) — pull only when a use case needs them.

## Files touched

- `src/Core.TypeScript/sha256/` — **new** (sha256.ts, sha256.test.ts, cross-verify.ts, package.json).
- `src/Core.FSharp.Sha256/` — **new** (Sha256.fs, cross-verify, .fsproj).
- `src/Core.CSharp.Sha256/` — **new** (Sha256.cs, cross-verify, .csproj).
- `src/Core.Rust.Sha256/` — **new** (src/lib.rs, tests/cross_verify.rs, Cargo.toml).
- `tests/cross-verification/sha256/` — **new** (vectors.yaml, compare.ts, four *-output.json).
- `docs/PRIMITIVE-REGISTRY.md` — flip SHA-256 to ✅ 4/4 (Tier 1) + table row.
