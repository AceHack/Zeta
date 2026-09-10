// F# oracle for the H3 rank-3 geometry byte-lock.
//
// `#load`s the shipped modules rather than restating them: a second copy of the construction
// inside the harness would make the cross-verification compare the harness to itself, which is
// the vacuity class in its purest form. The independence that matters is between this F#
// construction and the TypeScript one in `emit-golden.ts`, and it lives in the modules — the
// exhaustive supporting-plane facet search, the `p`-first `zSqrt`, the angular facet ordering,
// and the worklist orbit closure are all different there.
//
// Prints the canonical document on stdout with no trailing addition, so the caller can compare
// bytes.

#load "../../../src/Core.FSharp.E8Render/H3Exact.fs"
#load "../../../src/Core.FSharp.E8Render/H3GoldenVector.fs"

open Zeta.E8Render

System.Console.Out.Write(H3GoldenVector.emit ())
System.Console.Out.Flush()
