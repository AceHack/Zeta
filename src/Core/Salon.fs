namespace Zeta.Core

/// Salon — the **door** on the *quantum-physics* landmark of the metaspace floorplan (Aaron 2026-06-10,
/// shadow*: "give the salon its door").
///
/// A landmark's **fittings** are the code that does the work; the **door** is the module that gathers
/// those fittings under the landmark *name* so navigation resolves "go to the salon" to one place
/// (UX/DX/AX way-finding — `docs/research/2026-06-10-metaspace-landmarks-floorplan-...`). The salon is the
/// quantum room because **topology is hairdressing** (`docs/craft/subjects/quantum/topology-is-hairdressing/`):
/// braid/weave/tie are hairdressing words AND the operations of topological quantum computing.
///
/// This door does two things: (1) a navigable **`stations` registry** — the salon's named offerings,
/// each pointing to its fitting (the machine-readable floorplan entry); (2) the **live entrance** —
/// `tie`, the one fitting that is a working slice today (delegates to `SoftTie`), so the salon has a
/// door you can actually walk through, not just a sign. The room-as-`seed + extensions + parameters`
/// realization (the salon as a `LinguisticSeed.Pack`) is the next plank — flagged below.
[<RequireQualifiedAccess>]
module Salon =

    /// A station in the salon — one named offering: what it does, the verb it serves (if any), and the
    /// module that implements it (the code pointer). The navigable gathering = the door.
    type Station =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool } // true = a working slice today; false = a furnished fitting awaiting a verb wiring

    /// The salon's offerings — the quantum-substrate fittings gathered under one door. (Topology is
    /// hairdressing: the salon's stations are the braid/weave/tie chairs over the qubit substrate.)
    let stations: Station list =
        [ { Name = "tie"
            Does = "soft-link two strands (the soft, weighted topology link); the 2-strand base of the ladder"
            Verb = Some "tie"
            Module = "src/Core/SoftTie.fs"
            Live = true }
          { Name = "braid"
            Does = "cross n strands in a pattern — a braid-group element = an effective-qubit gate"
            Verb = Some "braid"
            Module = "src/Core/QubitIso.fs (Pauli/SU(2)); src/Core/Cl3.fs (Clifford Cl(3,0))"
            Live = false }
          { Name = "weave"
            Does = "interlace the braided strands into one n×n structure (build the effective qubit)"
            Verb = Some "weave"
            Module = "src/Core/AmplitudeEmu.fs (complex amplitudes → interference)"
            Live = false }
          { Name = "bob"
            Does = "cut the weave to a chosen length/dimension — the cut that sizes the structure (the n in n×n)"
            Verb = Some "bob"
            Module = "src/Core/CayleyDickson.fs (ℝ→ℂ→ℍ→𝕆; ℍ = SU(2) = one qubit)"
            Live = false }
          { Name = "bell"
            Does = "the entanglement bench — reproduces the CHSH Tsirelson bound 2√2 in deterministic simulation"
            Verb = None
            Module = "src/Core/BellTest.fs"
            Live = true }
          { Name = "fingerprint"
            Does = "soft recognition — the rainbow/soft-match the ties run on (switch games staying soft)"
            Verb = None
            Module = "src/Core/FingerprintPrism.fs"
            Live = true } ]

    /// The salon's name and what work happens here (the signage).
    let name = "salon"
    let does = "quantum physics — braid/weave/tie (topology is hairdressing); the effective-qubit substrate"

    /// The live entrance: `tie` — soft-link two byte strands, delegating to the working `SoftTie` fitting.
    /// Walking through the salon's door and tying two strands.
    let tie (threshold: float) (a: byte[]) (b: byte[]) : SoftTie.SoftTie<byte[]> option =
        SoftTie.tieBytes threshold a b

    /// The stations that are working slices today (Live = true) — what you can actually use at the salon now.
    let liveStations: Station list = stations |> List.filter (fun s -> s.Live)

    // ── The salon as a LinguisticSeed.Pack (room = seed + extensions + parameters, made literal) ──
    // The salon's soft-tie similarity IS a kernel: Jaccard over MinHash sketches is the min-max kernel,
    // PSD (Gärtner; the min-max/Jaccard kernel literature) — so the salon's offerings compose into the
    // seed language under Mercer closure, and a salon ROOM is literally seed + extensions(Pack) +
    // parameters(budget/threshold), ticking to its sign-off.

    /// The Jaccard (min-max) kernel over byte strands — the soft tie's similarity, kernel-shaped. PSD.
    let jaccardKernel: LinguisticSeed.Kernel<byte[]> =
        fun a b -> FingerprintPrism.softBytesSimilarity (FingerprintPrism.softBytes a) (FingerprintPrism.softBytes b)

    /// The salon's extension pack — its kernels, composable into any seed (OCP: add, never edit).
    let seedPack: LinguisticSeed.Pack<byte[]> =
        LinguisticSeed.pack
            "salon"
            [ "tie-jaccard", jaccardKernel
              "exact", LinguisticSeed.indicator ]

    /// A salon ROOM, literally `seed + extensions + parameters`: state = the running kernel evaluation
    /// of two strands under the COMPOSED pack (seed ∪ salon extensions); parameters = budget + the
    /// sign-off threshold; resolves when the composed kernel clears it.
    let asRoom (extraPacks: LinguisticSeed.Pack<byte[]> list) (a: byte[]) (b: byte[]) (budget: int) (threshold: float) : SimFramework.Room<float> =
        let kernel = LinguisticSeed.composePacks (seedPack :: extraPacks)
        SimFramework.room
            "salon-room"
            (fun _ -> 0.0)
            [ SoftScheduler.handler
                  "salon-kernel"
                  (function
                  | TimerElapsed _ -> true
                  | _ -> false)
                  (fun _ _ -> System.Threading.Tasks.Task.FromResult(Ok(kernel a b))) ]
            budget
            (fun v -> v >= threshold)
