module Zeta.Tests.FSharp.ZetaId.BitLayoutAgreementTests

open global.Xunit
open Zeta.Core.FSharp.ZetaId

// ═══════════════════════════════════════════════════════════════════
// The V8-cycle cross-check, ported from Rust — because F# and C# did not have it.
//
// `BitLayout.create` has TWO independent construction paths, `createTopDown` (the canonical
// authoring order, matching the human-readable layout spec) and `createBottomUp`. They must produce
// identical field offsets; that redundancy IS the check, in exactly the way the four-oracle byte-lock
// is: two independent computations of the same answer.
//
// WHY THIS FILE EXISTS (2026-08-11). A mapping pass over the ZetaId bit layout found that only RUST
// asserts the two paths agree (`src/Core.Rust.ZetaId/src/bit_layout.rs:200-203`). In F# and C#,
// `BottomUp` appears in no test and no production call path — `Default` is `TopDown` in both — so it
// is unreachable dead code. The consequence is a silent trap: any layout edit applied to
// `createTopDown` and NOT to `createBottomUp` produces **no compile error and no test failure**. The
// bottom-up path simply retains the old field allocation and waits for whoever next calls
// `create BottomUp`.
//
// TypeScript, Python and Go are not exposed: they build their layout once, directly from the
// generated constants, so there is nothing to keep in sync.
//
// This is a general safety net rather than a one-off: it protects EVERY future layout change, and it
// was written before one — a bit-reclamation is under consideration — precisely so the trap is closed
// before the change that would spring it.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``TopDown and BottomUp produce the identical layout — a half-applied edit is caught here`` () =
    // Structural equality on the record compares every field's offset and width at once, so a change
    // applied to one path and not the other fails immediately rather than lying dormant.
    Assert.Equal(BitLayout.create TopDown, BitLayout.create BottomUp)

[<Fact>]
let ``the default layout IS the TopDown one — the canonical path is the one production uses`` () =
    // Pins the claim in BitLayout.fs's own doc comment. If Default were ever switched to BottomUp,
    // the untested path would silently become the production path.
    Assert.Equal(BitLayout.Default, BitLayout.create TopDown)

[<Fact>]
let ``the two paths agree field-by-field — so a failure names WHICH field drifted`` () =
    // The structural comparison above fails as one opaque inequality. These name the culprit, which
    // is what you actually want at 2am during a wire-format change.
    let td = BitLayout.create TopDown
    let bu = BitLayout.create BottomUp

    let fields =
        [ "Randomness", td.Randomness, bu.Randomness
          "Location", td.Location, bu.Location
          "Momentum", td.Momentum, bu.Momentum
          "Persona", td.Persona, bu.Persona
          "Authority", td.Authority, bu.Authority
          "Firefly", td.Firefly, bu.Firefly
          "Category", td.Category, bu.Category
          "Chromosome", td.Chromosome, bu.Chromosome
          "Timestamp", td.Timestamp, bu.Timestamp
          "Version", td.Version, bu.Version ]

    for name, a, b in fields do
        // Parenthesised deliberately: in argument position F# parses a bare `a = b` as a NAMED
        // ARGUMENT rather than an equality test (error FS0691) — a quietly wrong-shaped assertion.
        Assert.True((a = b), sprintf "field %s disagrees between TopDown and BottomUp: %A vs %A" name a b)
