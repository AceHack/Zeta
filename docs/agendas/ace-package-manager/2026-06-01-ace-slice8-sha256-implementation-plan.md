# Ace slice 8 — SHA-256 cross-language primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Full behavior in `2026-06-01-ace-slice8-sha256-cross-language-primitive-design.md`.

**Goal:** Land SHA-256 as a 4-oracle (TS/F#/C#/Rust) Tier-1 primitive — shared
standard-anchored golden vectors + N-way `compare` byte-consensus — per the zeta-id template,
flipping the registry `⬜ SHA-256` → `✅ 4/4`.

**Architecture:** our `Sha256` port per language over native (TS `node:crypto`; F#/C#
`System.Security.Cryptography.SHA256`, BCL-direct) or **hand-rolled** (Rust, zero-dep house
style; `sha2` only as an optional differential-oracle feature). Each oracle's `cross-verify`
entry reads the shared flat `vectors.yaml` (hand-rolled ~40-line reader per non-TS lang, per
the zeta-id precedent — zero-dep), computes `sha256Hex`, writes `<lang>-output.json`;
`compare.ts` diffs all four + against `expected_hex` (the published standard).

**Tech stack / conventions:** TS on Bun; F#/C# in `Zeta.sln` (register via `dotnet sln add`,
NOT hand-editing the .sln); Rust standalone crate (own Cargo.toml + Cargo.lock, no workspace).
Gates: `bun test`/`tsc` (TS), `dotnet build Zeta.sln -c Release` 0-warn + `dotnet test` (F#/C#),
`cargo test` (Rust), the 4-way `compare.ts` exit 0, markdownlint on the registry edit. Harness:
NO Edit tool — new files via Write, edits via Python patch-scripts (exact-occurrence asserts;
`rm` before commit; never commit `_patch_*`). Pure LF — verify CR=0 with Python
(`open(f,'rb').read().count(b'\r')`), NOT grep. Canary `git ls-tree HEAD | wc -l` = 67 (new
dirs live under existing `src/`, `tests/`, `docs/` top-level entries). Commit trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Standard vectors (lowercase hex):
empty → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
`abc` → `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`;
`abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq` (NIST 2-block) →
`248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1`.

**Tasks (sequential):** T1 = TS reference + fixture + compare; T2 = Rust (hand-rolled,
de-risk early); T3 = F#; T4 = C#; T5 = 4-way compare green + registry flip. T1 first (defines
the fixture + format); T2–T4 each produce their `<lang>-output.json` against the shared
fixture; T5 gates.

---

## Task 1: TS reference + shared fixture + compare harness

**Files (new):** `src/Core.TypeScript/sha256/{sha256.ts, sha256.test.ts, cross-verify.ts, package.json}`;
`tests/cross-verification/sha256/{vectors.yaml, compare.ts, ts-output.json}`.

- [ ] **Step 1: fixture `tests/cross-verification/sha256/vectors.yaml`** — flat-scalar schema
  (per zeta-id; each record a flat block). Each vector: `id`, exactly one of `input_utf8` /
  `input_hex`, and `expected_hex`. Include: `empty` (`input_utf8: ""`), `abc`, the NIST 2-block,
  and 1-2 Ace-shaped inputs (e.g. `input_utf8: '{"a":1}'`). Compute the `expected_hex` for the
  Ace-shaped ones with the TS impl (Step 3) and bake them in.

- [ ] **Step 2: `sha256.ts` (port)** —

```ts
import { createHash } from "node:crypto";
export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
```

- [ ] **Step 3: `sha256.test.ts`** — assert the three standard vectors (hard-coded expected
  digests above) via `sha256Hex(new TextEncoder().encode(...))`; assert `sha256` returns 32
  bytes; assert hex/raw agree. RED first (no module), GREEN after Step 2.

- [ ] **Step 4: `cross-verify.ts`** — read `../../tests/cross-verification/sha256/vectors.yaml`
  (resolve via repo-root walk to `Zeta.sln`, matching the zeta-id/observe convention), for each
  vector compute the input bytes (`input_utf8` → `TextEncoder`, `input_hex` → hex-decode) and
  `sha256Hex`, write `{ id: digest_hex }` to `tests/cross-verification/sha256/ts-output.json`.
  Run it to generate the file.

- [ ] **Step 5: `compare.ts`** — copy `tests/cross-verification/zeta-id/compare.ts`, adapt to
  read `{ts,fsharp,cs,rust}-output.json` from the sha256 dir, AND additionally assert each
  present oracle's hex equals the `expected_hex` from `vectors.yaml` (so a lone-wrong oracle is
  caught even before all four exist). Tolerate missing oracle files (null → "MISSING", like
  zeta-id) so it runs green on TS-only until T2-T4 land. Key-set equality + per-key equality;
  exit non-zero on mismatch.

- [ ] **Step 6: `package.json`** — mirror `src/Core.TypeScript/zeta-id/package.json` (name,
  type module, scripts for test + cross-verify).

- [ ] **Step 7: verify + commit** — `bun test src/Core.TypeScript/sha256/`;
  `bun --bun tsc --noEmit -p tsconfig.json` exit 0; run cross-verify.ts → ts-output.json
  present; run compare.ts → green (TS-only). CR=0; canary 67. Commit.

---

## Task 2: Rust oracle (hand-rolled SHA-256, zero-dep)

**Files (new):** `src/Core.Rust.Sha256/{Cargo.toml, Cargo.lock, src/lib.rs, tests/cross_verify.rs}`.

- [ ] **Step 1: `Cargo.toml`** — mirror `src/Core.Rust.ZetaId/Cargo.toml`: `name =
  "zeta-core-sha256"`, edition 2024, `publish = false`, **zero `[dependencies]`** (production
  default), `[lints.rust] unsafe_code = "forbid"`. (Optional: a `sha2`/`serde`-style differential
  feature is OUT of scope for this slice — note it for later; default is the hand-rolled impl.)

- [ ] **Step 2: `src/lib.rs` — hand-rolled SHA-256 (FIPS 180-4)** — `pub fn sha256(bytes: &[u8])
  -> [u8; 32]` + `pub fn sha256_hex(bytes: &[u8]) -> String`. Implement the standard algorithm
  (the 64 round constants K, the eight initial H values, message padding to a multiple of 512
  bits with the 64-bit big-endian length, the 64-round compression with `ch`/`maj`/`Σ0`/`Σ1`/
  `σ0`/`σ1` and `wrapping_add`/`rotate_right`). The published NIST vectors (Step 4) are the gate —
  a bug cannot pass them. `#![forbid(unsafe_code)]`; `#![warn(missing_docs)]`.

- [ ] **Step 3: unit test (in lib or `tests/`)** — assert the three standard vectors. RED first,
  GREEN when the impl is correct (this is where a padding/endianness bug surfaces).

- [ ] **Step 4: `tests/cross_verify.rs`** — mirror `src/Core.Rust.ZetaId/tests/cross_verify.rs`:
  repo-root walk to `Zeta.sln`; hand-rolled flat-`vectors.yaml` reader (id / input_utf8 /
  input_hex / expected_hex — ~40 lines, zero-dep); for each vector compute `sha256_hex`, also
  assert it equals `expected_hex`; write `{ id: hex }` to
  `tests/cross-verification/sha256/rust-output.json`.

- [ ] **Step 5: verify + commit** — `cargo test` in the crate dir green (unit + cross_verify);
  `rust-output.json` written + matches ts-output.json (run compare.ts → TS≡Rust). CR=0; canary
  67. Commit.

---

## Task 3: F# oracle

**Files (new):** `src/Core.FSharp.Sha256/{Sha256.fs, CrossVerify.fs, Zeta.Core.FSharp.Sha256.fsproj}`.

- [ ] **Step 1: `.fsproj`** — mirror `src/Core.FSharp.ZetaId/Zeta.Core.FSharp.ZetaId.fsproj`
  (TargetFramework, TreatWarningsAsErrors etc.); compile `Sha256.fs` then `CrossVerify.fs`.
- [ ] **Step 2: `Sha256.fs`** — module `Zeta.Core.FSharp.Sha256`:
  `let sha256 (bytes: byte[]) : byte[] = System.Security.Cryptography.SHA256.HashData bytes` +
  `let sha256Hex (bytes: byte[]) : string = (sha256 bytes |> Array.map (sprintf "%02x") |> String.concat "")`.
- [ ] **Step 3: unit test** — add to `tests/Tests.FSharp/` (or a Sha256 test file) asserting
  the three standard vectors. (Match where ZetaId's F# tests live.)
- [ ] **Step 4: `CrossVerify.fs`** — an entry (e.g. `[<EntryPoint>]` or a test) that does the
  repo-root walk, hand-reads `vectors.yaml` (flat reader), computes `sha256Hex`, asserts ==
  `expected_hex`, writes `fsharp-output.json`. Match how ZetaId's F# cross-verify emits its output.
- [ ] **Step 5: register + verify + commit** — `dotnet sln Zeta.sln add src/Core.FSharp.Sha256/Zeta.Core.FSharp.Sha256.fsproj`;
  `dotnet build Zeta.sln -c Release` 0-warn; run the cross-verify to emit `fsharp-output.json`;
  `dotnet test` green; compare.ts → TS≡F#(≡Rust). CR=0; canary 67. Commit.

---

## Task 4: C# oracle (BCL-clean — no FSharp.Core)

**Files (new):** `src/Core.CSharp.Sha256/{Sha256.cs, CrossVerify.cs, Zeta.Core.CSharp.Sha256.csproj}`.

- [ ] **Step 1: `.csproj`** — mirror `src/Core.CSharp.ZetaId/Zeta.Core.CSharp.ZetaId.csproj`;
  no FSharp.Core reference.
- [ ] **Step 2: `Sha256.cs`** — `public static class Sha256`:
  `public static byte[] Hash(ReadOnlySpan<byte> bytes) => System.Security.Cryptography.SHA256.HashData(bytes);`
  + `public static string HashHex(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(Hash(bytes));`
  (use `Convert.ToHexStringLower`, .NET 9 — verify availability; else `Convert.ToHexString(...).ToLowerInvariant()`).
- [ ] **Step 3: unit test** — `tests/Core.CSharp.Tests/` (or where ZetaId C# tests live) — three standard vectors.
- [ ] **Step 4: `CrossVerify.cs`** — repo-root walk, hand-read `vectors.yaml`, compute, assert ==
  `expected_hex`, write `cs-output.json`. Match ZetaId C# cross-verify emission.
- [ ] **Step 5: register + verify + commit** — `dotnet sln Zeta.sln add src/Core.CSharp.Sha256/Zeta.Core.CSharp.Sha256.csproj`;
  `dotnet build Zeta.sln -c Release` 0-warn; emit `cs-output.json`; `dotnet test` green;
  compare.ts → all four equal. CR=0; canary 67. Commit.

---

## Task 5: 4-way compare green + registry flip

**Files:** Modify `docs/PRIMITIVE-REGISTRY.md`.

- [ ] **Step 1: run the full 4-way compare** — `cd tests/cross-verification/sha256 && bun compare.ts`
  → exit 0, all four oracles present + byte-identical + matching `expected_hex`.
- [ ] **Step 2: registry flip** — in `docs/PRIMITIVE-REGISTRY.md`: change the Codec/BCL-like
  `⬜ SHA-256` to `✅ SHA-256 (4/4)`; add a Tier-1 table row (TS/F#/C# ✅, Rust ✅; Consensus
  "Tier 1 — golden-vector byte-consensus + N-way compare"; Locations the four `src/Core.*.Sha256`
  + `tests/cross-verification/sha256/`); note it's the foundation of the Ace trust core arc
  (slice 8). Watch markdownlint (no nested backticks; blank lines around lists/fences;
  no wrapped line starting with a `+` or `-` list marker).
- [ ] **Step 3: verify + commit** — markdownlint clean; CR=0; canary 67. Commit.

---

## Final holistic review

Reviewer over `git diff origin/main..HEAD`: all four `Sha256` ports expose the same surface;
each oracle's output matches the published standard vectors AND the other three; Rust is
zero-dep hand-rolled + forbids unsafe; F#/C# registered in `Zeta.sln` + build 0-warn; C# is
BCL-clean (no FSharp.Core); `compare.ts` exits 0 across all four; registry flipped honestly to
Tier 1; CR=0; canary 67; `dotnet build Zeta.sln -c Release` + `dotnet test` + `bun test` +
`cargo test` all green. Then open the impl PR + run the PR-gate loop.
