// F# oracle for the Clifford/E8 rendering byte-lock.
//
// `#load`s the shipped modules rather than restating them: a second copy of the
// construction inside the harness would make the cross-verification compare the harness to
// itself, which is the vacuity class in its purest form. The independence that matters is
// between this F# construction and the TypeScript one in `emit-golden.ts`, and that
// independence lives in the modules, not in this file.
//
// Prints the canonical document on stdout with no trailing addition, so the caller can
// compare bytes.

#load "../../../src/Core.FSharp.E8Render/E8Exact.fs"
#load "../../../src/Core.FSharp.E8Render/E8Clifford.fs"
#load "../../../src/Core.FSharp.E8Render/E8Shading.fs"
#load "../../../src/Core.FSharp.E8Render/E8Embedding.fs"
#load "../../../src/Core.FSharp.E8Render/E8Raytracer.fs"
#load "../../../src/Core.FSharp.E8Render/E8GoldenVector.fs"

open Zeta.E8Render

System.Console.Out.Write(E8GoldenVector.emit ())
System.Console.Out.Flush()
