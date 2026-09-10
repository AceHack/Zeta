module Zeta.Benchmarks.E8RaytraceBench

open BenchmarkDotNet.Attributes
open Zeta.E8Render

/// **The committed harness for the CPU ray-tracer numbers.**
///
/// A frame time without a named machine is not a measurement, so this class exists to make
/// the numbers re-derivable rather than quoted: BenchmarkDotNet prints the host CPU, the
/// runtime and the confidence intervals alongside every row, and
/// `docs/research/2026-09-09-*` records what one named machine produced.
///
/// The three axes are the ones that carry the claims:
///
///   - `UseVector` — scalar reference versus the `Vector<float32>` kernel. The two must
///     produce byte-identical images (`E8Render.Tests`), so this measures the kernel and
///     nothing else.
///   - `DegreeOfParallelism` — the knob, not a thread spawn. DoP = 1 is the deterministic
///     single loop; DoP = N is N workers on the same code path.
///   - `Resolution` — rays per frame.
///
/// The scene is built once in `Setup`: building it enumerates 60,480 triangles and runs a
/// Jacobi eigen-decomposition, neither of which is what these rows are about.
[<MemoryDiagnoser>]
type E8Raytrace() =

    let mutable scene = Unchecked.defaultof<E8Raytracer.Scene>
    let mutable camera = Unchecked.defaultof<E8Raytracer.Camera>

    /// Frame edge in pixels; the ray count is the square of this.
    [<Params(128, 256)>]
    member val Resolution = 0 with get, set

    /// False measures the scalar Moeller-Trumbore reference; true measures the SIMD kernel.
    [<Params(false, true)>]
    member val UseVector = false with get, set

    /// 1 is the deterministic single loop; 8 exercises the same code path across workers.
    [<Params(1, 8)>]
    member val DegreeOfParallelism = 1 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        let roots = E8Exact.roots ()
        let adjacency = E8Exact.adjacency roots
        let faces = E8Exact.triangleFaces adjacency
        let light = E8Shading.lightFromRootIndex 0 roots
        scene <- E8Raytracer.buildScene roots faces light
        camera <- E8Raytracer.frameCamera scene

    [<Benchmark>]
    member this.RenderFrame() =
        E8Raytracer.render scene camera this.Resolution this.Resolution this.UseVector this.DegreeOfParallelism
