---
name: gate-red-windows-x64-dynamicvalue-codec-stackoverflow
description: "gate windows-2025 went red 2026-06-06 (from 92b04d498; green at b40a097a5) — DynamicValue canonical codec recurses with no depth guard, deep-nesting fuzz overflows the windows-x64 ~1MB threadpool stack, unhandleable SOF kills the xUnit runner (TestPipelineException). windows-x64 ONLY; all 5 other platforms green. Filed P0 in BUGS.md, routed to DynamicValue owner — NOT drive-by patched (proven primitive, unreproducible on darwin/arm)."
type: project
created: 2026-06-06
---

CI triage of the chronic `gate` red (2026-06-06). Two distinct failures, neither from the 081KSXN940008QG0R002FWR9B2
backfill/lint work (backlog-index-integrity is green):

1. **markdownlint** — `docs/BUGS.md:281` MD022/MD032: the deferred MerkleTree.LeafDiff P2 entry lost its
   surrounding blank line when the 5 fixed audit entries were removed. FIXED (`53453dacc`).

2. **build-and-test (windows-2025)** — `Xunit.Sdk.TestPipelineException` / `VSTestTask returned false but
   did not log an error`, mid-`Tests.FSharp.fsproj` (598 passed, then FATAL). **windows-2025-x64 ONLY** —
   windows-11-arm, ubuntu-24.04, ubuntu-24.04-arm, macos-26 ALL pass. Stack frame:
   `DynamicValueModule.toCanonicalJson@428`. Root cause: the canonical codec recurses per nesting level
   with **no depth guard**; the `Fuzz.DecodeBoundary.Tests.fs` depth-2000 cases (run via `Task.Run`,
   ~1 MB threadpool stack on windows-x64) overflow the stack, and a `StackOverflowException` is
   **unhandleable in .NET** → it kills the test process. Deterministic, not a flake.

   **Bounded fix** (for the DynamicValue owner): add a recursion-depth guard to encode+decode that returns
   `Error` past a bound (fits Result-over-exception / no-throw); a bound < 2000 makes the deep-nesting
   tests get an Error-Result (still "a Result without throwing" → passes) AND stops the SOF. Will NOT
   touch golden vectors (they contain no pathologically-deep input). Must validate on a windows-x64
   runner — NOT reproducible on darwin/arm (larger/different stack). Filed P0 in `docs/BUGS.md` (`1a3fafbce`).

Why not drive-by-fixed: DynamicValue canonical codec is a PROVEN primitive (math ∧ 4-lang ∧ 4-ser ∧
golden-vectors). A blind fix I can't validate on this platform is exactly the "quick hack" BUGS.md warns
against. Routed, not patched. See [[soraya-b1019-dst-vacuity-review-portfolio-routing]] for the sibling
proven-primitive discipline.
