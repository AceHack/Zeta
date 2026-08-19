namespace Zeta.Core

/// GeneratorRegistry — **stable interfaces and generator functions get ZetaIds, so a filetype can
/// refer to its artifacts by ID** (Aaron 2026-06-11: "we should start assigning our stable interfaces
/// ZetaIds and generator functions, then the filetype can start referring [to] those artifacts by
/// ZetaId").
///
/// The ID is CONTENT-ADDRESSED from the generator's stable name + version (deterministic, reproducible,
/// homoiconic — the id IS derivable from the name, never minted-and-forgotten). A MediaLines `gen` line
/// then reads `gen <local-name> <generator-zetaid> <version> <seed> <args…>` — the artifact references
/// the GENERATOR by id, so the same id means the same function on every node/oracle (a treaty over
/// generators). Stable interfaces (the kernels, the optics, the verbs) register the same way.
[<RequireQualifiedAccess>]
module GeneratorRegistry =

    /// A registered generator: its stable name, version, and the derived ZetaId (32-hex).
    type Entry =
        { Name: string
          Version: int
          ZetaId: string }

    // deterministic content-address: FNV-1a 128-bit fold over name@version (no wall, no random —
    // the id is a pure function of identity, so it is the SAME everywhere, forever).
    // The second lane (h2) uses non-linear bitwise rotation and a different prime to ensure
    // full 128-bit entropy (decorrelated lanes).
    let private hash128 (s: string) : string =
        let mutable h1 = 0xcbf29ce484222325UL
        let mutable h2 = 0x84222325cbf29ce4UL
        for ch in s do
            h1 <- (h1 ^^^ uint64 (int ch)) * 0x100000001b3UL
            let c = uint64 (int ch)
            let rotated = (c <<< 31) ||| (c >>> 33)
            h2 <- (h2 ^^^ rotated) * 0x1000000021bUL
        sprintf "%016x%016x" h1 h2

    /// Mint the stable ZetaId for a generator name@version (deterministic; the same input always yields
    /// the same id — that is the point).
    let idOf (name: string) (version: int) : string = hash128 (sprintf "%s@%d" name version)

    /// Register (declare) a generator — returns its entry. Registration is just naming; the id follows.
    let register (name: string) (version: int) : Entry =
        { Name = name
          Version = version
          ZetaId = idOf name version }

    /// The stable generators known today — the BoundaryLight family + the kernel + the verbs that have
    /// earned a fixed identity. Adding a generator = adding a line; bumping a version = a new id (so a
    /// change is never silent — same blade as TimeGen's versioning).
    let known: Entry list =
        [ register "boundary.curve" 1
          register "boundary.glow" 1
          register "boundary.mirror" 1
          register "boundary.scatter" 1
          register "boundary.grid" 1
          register "boundary.rotorCurve" 1
          register "kernel.rbf" 1
          register "timegen.phasor" 1
          // v2: v1 folded only the 32-bit Randomness field into the identicon, so ids differing
          // in timestamp/category/persona/location drew identical faces (081M0DYG9X9087G0R002JK171Z).
          register "zetaid.glyph" 2
          register "audio.saw" 1
          register "audio.square" 1
          register "audio.triangle" 1
          register "audio.sine" 1
          register "midi.track" 1
          register "view.flux-curve" 1
          register "view.flux-gauge" 1
          register "view.flux-timeline" 1
          register "view.interrupt-grid" 1
          register "ui.magnetic-ports" 1
          // the pixel-shader family (Aaron: "everything shaderable, ZetaIds again — the existing-
          // emulator enhancement techniques; shit tons here"): each a post-generator over colorAt.
          register "shader.antialias" 1
          register "shader.xbr" 1
          register "shader.hq2x" 1
          register "shader.crt-scanline" 1
          register "shader.crt-phosphor" 1
          register "shader.crt-curvature" 1
          register "shader.ntsc" 1
          // THE SHAPE CATALOG (Aaron: "a cartridge per shape — a shape catalog — zetaid"): each
          // externalized head-shape is a registered generator AND ships as its own .lines cartridge.
          register "shape.worldline" 1
          register "shape.lightcone" 1
          register "shape.fourcorner" 1
          register "shape.braid" 1
          register "shape.spiral" 1
          register "shape.seam" 1
          register "shape.buckyball" 1
          register "shape.shadow-loop" 1
          register "shape.plait-move" 1
          register "algebra.braid-memory" 1
          register "algebra.z2-parity" 1
          register "algebra.mod2" 1
          register "shape.adinkra" 1
          register "shape.exchange-worldlines" 1
          register "shape.kitaev-chain" 1
          register "shape.crossing" 1
          register "shape.sybil-verdict" 1
          register "shape.refraction" 1
          // THE CONTRAST cartridge (still `pending/`): one word (σ·σ), two categories, two panels.
          // Registered because registration is what makes its `meta shape-zetaid` CHECKABLE — the id
          // in the file is `idOf "shape.symmetric-vs-braided" 1`, derivable, so the shelf and the
          // cartridge cannot silently disagree. Registration is naming, NOT ratification: the file
          // stays in pending/ until its own oracles write their treaty rows.
          register "shape.symmetric-vs-braided" 1
          // THE TRACE cartridge (still `pending/`): a feedback wire that bends back and crosses
          // NOTHING. Registered for the same reason as its sibling above — registration is what makes
          // `meta shape-zetaid` CHECKABLE (`idOf "shape.traced" 1`, derivable), and it is naming, NOT
          // ratification: the file stays in pending/ until its own oracles write their treaty rows.
          register "shape.traced" 1
          register "rng.splitmix64" 1
          register "rng.lcg64_mmix" 1
          register "hash.murmur3_32_tail" 1
          register "rng.lcg32_glibc" 1
          register "engine.zeta-bayesian" 1
          register "engine.infer-net" 1
          register "engine.mock-flat" 1
          register "sketch.iblt" 1
          register "test.loop" 1
          register "shape.softvalue" 1
          register "shape.gc" 1
          register "shape.dynamicvalue" 1
          register "shape.triboolean" 1
          register "test.ben" 1
          register "binding.html-css" 1
          register "sim.wave-interference" 1
          register "viz.adinkra" 1
          register "spectral.hard-dft" 1
          register "spectral.soft-probe" 1 ]

    /// Look a generator up by its ZetaId (the filetype's reverse direction: id -> what it is).
    /// Registry-side collision guard (BUGS.md idOf finding, the cheap additive piece: the full
    /// hash-lane fix is a treaty-scale migration since ids are pinned in cartridges). Two DISTINCT
    /// names sharing one ZetaId on the shelf = a collision the first-match byId would silently
    /// shadow — this surfaces it as a checkable fact (the suite asserts it stays empty).
    let collisions () : (string * string list) list =
        known
        |> List.groupBy (fun e -> e.ZetaId)
        |> List.filter (fun (_, es) -> (es |> List.map (fun e -> e.Name) |> List.distinct |> List.length) > 1)
        |> List.map (fun (zid, es) -> zid, es |> List.map (fun e -> e.Name))

    let byId (zetaId: string) : Entry option =
        known |> List.tryFind (fun e -> e.ZetaId = zetaId)

    /// Look up by name (newest version wins).
    let byName (name: string) : Entry option =
        known |> List.filter (fun e -> e.Name = name) |> List.sortByDescending (fun e -> e.Version) |> List.tryHead
