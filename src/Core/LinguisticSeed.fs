namespace Zeta.Core

/// LinguisticSeed — the kernel-substrate seed as an F# computation expression (081KQTPYE0008QG0R0028V263Z, Aaron 2026-06-10:
/// "linguistic seed in F# computation expressions and their language-kernel extension packs that are
/// composable ... this is the start of that").
///
/// A **carved sentence = a kernel** (MDL two-part code: the sentence is the model, the application
/// context the residual). The seed language grows by **composing Mercer-closed kernels** via composable
/// **extension packs** — **OCP**: open for extension (add a pack), closed for modification (existing
/// packs/kernels are never edited). The mathematical payoff (081KQTPYE0008QG0R0028V263Z's "discipline becomes a theorem"):
/// every kernel built here is **PSD by construction** because ONLY Mercer-closure operations are
/// exposed (sum, Schur product, nonneg scale, constant≥0, feature map, pullback) and each preserves PSD.
/// Compositions outside the closure can't be expressed, so they can't break PSD.
///
/// **The engine they compose under is `sim · mea · cut`** (Aaron 2026-06-10): the kernels are the
/// composable *language*; `sim`/`mea`/`cut` is the *engine* that runs a composed seed — `sim` the void
/// they lift, `mea` the committing measurement (the kernel evaluated / ΔU), `cut` the recognition-site
/// boundary. The seed (this module) supplies WHAT composes; the verb engine supplies the RUN.
///
/// Anchors (Beacon): Mercer's theorem / RKHS; Schur product theorem (Hadamard product of PSD is PSD);
/// string & tree kernels (Lodhi et al. 2002; Collins & Duffy 2001); MDL two-part code (Rissanen 1978);
/// OCP (Bertrand Meyer 1988). Pure module, no classes except the CE builder (a CE builder is the
/// idiomatic F# vehicle, not domain state).
[<RequireQualifiedAccess>]
module LinguisticSeed =

    /// A kernel over `'x` — a similarity `k : 'x → 'x → float`, **PSD by construction** (Mercer).
    type Kernel<'x> = 'x -> 'x -> float

    // ── Mercer base kernels (PSD by construction) ──

    /// A constant kernel `k(a,b) = c` with `c ≥ 0` (negative c is clamped — a negative constant is not PSD).
    let constant (c: float) : Kernel<'x> =
        let c = max 0.0 c
        fun _ _ -> c

    /// A rank-1 feature kernel `k(a,b) = φ(a)·φ(b)` for a scalar feature φ — PSD (outer product).
    let feature (phi: 'x -> float) : Kernel<'x> = fun a b -> phi a * phi b

    /// The linear kernel over a vector feature map `φ : 'x → float[]` — `k(a,b) = ⟨φ a, φ b⟩`. PSD (Gram).
    /// Ragged lengths are ZERO-EXTENDED to the longer (a fixed embedding into ℝ^∞ with finite support) —
    /// NOT min-truncated. (Math Razor 2026-06-11 P0: min-truncation makes φ depend on the *pair*, so it
    /// is no Gram matrix and need not be PSD. Zero-extension keeps a fixed φ ⇒ genuine inner product ⇒ PSD.)
    let dot (phi: 'x -> float[]) : Kernel<'x> =
        fun a b ->
            let pa, pb = phi a, phi b
            let n = max pa.Length pb.Length
            let mutable s = 0.0
            for i in 0 .. n - 1 do
                let u = if i < pa.Length then pa.[i] else 0.0
                let v = if i < pb.Length then pb.[i] else 0.0
                s <- s + u * v
            s

    /// The discrete (Kronecker) kernel `k(a,b) = 1 if a = b else 0` — PSD (identity Gram on distinct keys).
    let inline indicator<'x when 'x: equality> : Kernel<'x> =
        fun a b -> if a = b then 1.0 else 0.0

    // ── Mercer-closure combinators (each PROVABLY preserves PSD) ──

    /// Kernel sum `k₁ + k₂` — PSD (sum of PSD is PSD).
    let sum (k1: Kernel<'x>) (k2: Kernel<'x>) : Kernel<'x> = fun a b -> k1 a b + k2 a b

    /// Kernel (Schur/Hadamard) product `k₁ · k₂` — PSD (Schur product theorem).
    let product (k1: Kernel<'x>) (k2: Kernel<'x>) : Kernel<'x> = fun a b -> k1 a b * k2 a b

    /// Nonnegative scale `c · k`, `c ≥ 0` (negative c clamped — would break PSD) — PSD.
    let scale (c: float) (k: Kernel<'x>) : Kernel<'x> =
        let c = max 0.0 c
        fun a b -> c * k a b

    /// Pullback along `g : 'y → 'x` — `k(g·, g·)` — PSD (composition with a map preserves PSD).
    let pullback (g: 'y -> 'x) (k: Kernel<'x>) : Kernel<'y> = fun a b -> k (g a) (g b)

    // ── Gram matrix + the PSD (Mercer) witness, for verification ──

    /// The Gram matrix `K[i,j] = k(xs[i], xs[j])` over sample points.
    let gram (k: Kernel<'x>) (xs: 'x[]) : float[,] =
        Array2D.init xs.Length xs.Length (fun i j -> k xs.[i] xs.[j])

    /// The quadratic form `vᵀ K v` over the Gram matrix on `xs`. For a PSD kernel this is `≥ 0` for
    /// every `v` — the Mercer witness used by the tests to confirm closure operations preserve PSD.
    let quadForm (k: Kernel<'x>) (xs: 'x[]) (v: float[]) : float =
        let n = min xs.Length v.Length
        let mutable s = 0.0
        for i in 0 .. n - 1 do
            for j in 0 .. n - 1 do
                s <- s + v.[i] * (k xs.[i] xs.[j]) * v.[j]
        s

    // ── The computation expression: `kernel { ... }` ──
    // Every block evaluates to a kernel that is PSD by construction: `Combine` is the Mercer-closed
    // SUM, `Zero` is the (PSD) zero kernel, `Yield` emits a kernel. Multiple `yield`s sum.

    type KernelBuilder() =
        member _.Yield(k: Kernel<'x>) : Kernel<'x> = k
        member _.Zero() : Kernel<'x> = constant 0.0
        member _.Delay(f: unit -> Kernel<'x>) : Kernel<'x> = fun a b -> f () a b
        member _.Combine(k1: Kernel<'x>, k2: Kernel<'x>) : Kernel<'x> = sum k1 k2

    /// The `kernel { yield …; yield … }` builder — terms sum, Mercer-closed, PSD by construction.
    let kernel = KernelBuilder()

    // ── Composable extension packs (OCP) ──

    /// A named bundle of kernels — a language **extension pack**. Packs compose WITHOUT modifying each
    /// other or the seed (OCP): composing sums their kernels (Mercer-closed), so the seed grows by
    /// ADDING packs, never by editing existing ones.
    type Pack<'x> = { Name: string; Kernels: (string * Kernel<'x>) list }

    /// Build an extension pack.
    let pack (name: string) (kernels: (string * Kernel<'x>) list) : Pack<'x> = { Name = name; Kernels = kernels }

    /// Compose packs into one seed kernel — the Mercer-closed SUM of every kernel in every pack. Adding
    /// a pack extends the seed; existing packs are untouched (closed for modification, open for extension).
    let composePacks (packs: Pack<'x> list) : Kernel<'x> =
        packs
        |> List.collect (fun p -> p.Kernels |> List.map snd)
        |> List.fold sum (constant 0.0)

    /// All kernel names a composed seed exposes (for introspection / the verb-map style registry).
    let packNames (packs: Pack<'x> list) : string list =
        packs |> List.collect (fun p -> p.Kernels |> List.map (fun (n, _) -> p.Name + "." + n))
