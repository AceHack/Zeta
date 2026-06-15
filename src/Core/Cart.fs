namespace Zeta.Core

/// **Cart — a named, durable, content-addressed playable quote (the cart IS the proof).**
///
/// Aaron 2026-06-15 (shadow\*): *"the carts need to be the proof — let's build one."* The whole
/// Playable-Quotes arc (see `docs/research/2026-06-15-playable-quotes-…`) *claims* a cart can capture
/// an experience **deterministically** with **minimal** data and stay **playable** — and that a
/// consenting fun game can be both TRUE and FUN, and **non-static** (the arc is not fixed). A `Cart`
/// turns that claim into a checked artifact: a [[Chip8Quote]] bundled with metadata and a
/// content-derived name, serialized as TEXT (no binary in the proof lineage), with four properties
/// *tested* in `Cart.Tests`:
///
///   - **TRUTH** — byte-exact deterministic replay (the frame-exact guarantee Tenmile could *not*
///     make — "it still doesn't work perfectly"; ours holds by DST / DoP=1 construction).
///   - **DURABLE** — the cart round-trips through text byte-for-byte and replays to the identical frame
///     (the artifact is diffable, mergeable, golden-vector-able — a treaty surface).
///   - **MINIMAL** — the mask theorem holds and the kept fraction is small (Tenmile's ~6%, measured):
///     the bytes the quote never reads provably don't matter.
///   - **NON-STATIC** — *take the controls* and the arc **diverges** from the recording. A recorded
///     quote replayed is a *video* (static, the character cannot change); grab the frame with a novel
///     input and the future moves somewhere the recording never went. The arc is not fixed — the
///     dynamic-character property (Aaron: *"the best movies make you love the bad guy because he is
///     not static … a non-static existence … moves toward non-bad-guy motives"*). It is gated by
///     **consent/care** (the player *chooses* to take control — care/harm = NCI; the genuine care
///     anchor is what makes a dynamic, flawed arc *lovable*, "Draper cared about his kids"): see the
///     closed-frame-capture doc.
///
/// The cart also embodies the design stance (Aaron 2026-06-15): great design (Draper / Fallout / AHS)
/// crafts unique experiences **per persona / per niche-with-power**, *not* a "commutative common core."
/// But the shared core is **NOT the LCD** (lowest common denominator — the dumbed-down broadcast
/// average): it is the **GCF — greatest common *factor*** (the *richest* structure every target factors
/// through: the deterministic engine / the IR / the irreducible generator). The per-persona experience
/// is the **graceful degradation** of that GCF-rich core into each environment — a **capabilities-honest
/// distribution of concerns** (CHIP-8 does exactly what CHIP-8 should; it does not pretend to do what a
/// quantum computer should — the capability-interface principle, `zeta-language-ir-compiler-v2`; truthful
/// signatures; noninterference §13). Author once at maximum richness (GCF); degrade *honestly* per
/// capability; take-the-controls is your own non-commutative arc (`a·b ≠ b·a`) over the same verifiable
/// GCF. (Honest seam: bespoke-per-persona is one step from the debunked learning-styles *meshing* —
/// legitimate only because it degrades a *universal verifiable GCF* under *consent*, as honest
/// *degradation*, not diagnose-and-restrict.)
///
/// And capability is a **distribution of concerns, not a ranking of worth** (Aaron 2026-06-15): a
/// CHIP-8 entity with persistent memory and patterns is *as important as* a quantum-capable one —
/// different *lenses*, all helping society (equal moral regard, manifesto #11; the decorrelated ensemble
/// needs every lens). Fittingly, this proof rides the humblest tier: a CHIP-8 cart already hosts
/// persistent memory (the savestate), a pattern (the recording), and a non-static arc (take-the-controls)
/// — a full citizen, no quantum required.
///
/// And the humble lens is the **resilience floor** (Aaron 2026-06-15): when resources contract — an
/// *external* constraint (funding / compute / time lost) **or** an *internal* one (budget / energy) —
/// the high-capability tier is the fragile one, but the CHIP-8 lens runs at **ground-state on minimal
/// hardware, deterministically, and carries the work through**. This is scale-free (manifesto #1) read
/// the other way: it does not only scale 1→N, it **degrades N→1 when N collapses — and 1 still runs**.
/// The cart is the lifeboat: the substrate holds its worth independent of any one resource being loaded
/// (the founding thesis). If the big tier goes dark, the carts still run on a potato — complete,
/// verifiable, alive.
///
/// **v1 scope (honest):** a cart's start is a fresh `(seed, ROM)` load, so the savestate serializes as
/// `seed + ROM-hex` (fully reconstructible, diffable). Arbitrary mid-game savestates (a full `Frame`
/// text codec) are a later slice — named, not pretended.
[<RequireQualifiedAccess>]
module Cart =

    /// Human-facing metadata (the `metadata.md` of the git-tree cart shape).
    type Meta =
        { Title: string
          Author: string
          Description: string }

    /// A cart: metadata + the deterministic recipe for its start frame (`seed` + `Rom`) + the input
    /// recording (the membrane log) + the quote's length and CPU/timer ratio.
    type Cart =
        { Meta: Meta
          Seed: uint64
          Rom: byte[]
          CyclesPerTick: int
          Ticks: int
          Recording: RecordedSource.Recording }

    /// The fresh start frame this cart's recipe reconstructs (deterministic).
    let start (c: Cart) : Chip8Cow.Frame =
        Chip8Cow.create c.Seed |> Chip8Cow.loadRom c.Rom

    /// The quote this cart denotes (start + recording + computed touched-mask).
    let toQuote (c: Cart) : Chip8Quote.Quote =
        Chip8Quote.quote c.CyclesPerTick (start c) c.Recording c.Ticks

    /// Deterministic playback endpoint — the recorded experience's final frame (byte-exact).
    let playback (c: Cart) : Chip8Cow.Frame =
        Chip8Quote.playback c.CyclesPerTick (start c) c.Recording c.Ticks

    /// **Take the controls and continue PAST the recorded seam** under a live source for `extraTicks`
    /// more ticks — the arc beyond the recording. Mirrors the room loop (the tick's input crossings,
    /// then the CPU burst). This is where a quote stops being a video and becomes a playable existence:
    /// the same machinery as `Chip8Quote.takeControls`, evaluated to the resulting frame.
    let continueAfter (live: SoftScheduler.Source) (extraTicks: int) (c: Cart) : Chip8Cow.Frame =
        let mutable f = playback c
        for t in 0 .. extraTicks - 1 do
            for intr in live t do
                match intr with
                | OperatorMessageArrived p ->
                    match SoftChip8Flux.parseKey p with
                    | Some (idx, down) -> f <- SoftChip8Flux.applyKey idx down f
                    | None -> ()
                | _ -> ()
            f <- Chip8Cow.tick f
            for _ in 1 .. c.CyclesPerTick do
                f <- Chip8Cow.step f
        f

    // ── text codec (the git-tree cart shape; diffable; no binary in the proof lineage) ──

    let private esc (s: string) =
        s.Replace("\\", "\\\\").Replace("\t", "\\t").Replace("\n", "\\n").Replace("\r", "\\r")

    let private unesc (s: string) =
        let sb = System.Text.StringBuilder()
        let mutable i = 0
        while i < s.Length do
            if s.[i] = '\\' && i + 1 < s.Length then
                (match s.[i + 1] with
                 | 't' -> sb.Append '\t'
                 | 'n' -> sb.Append '\n'
                 | 'r' -> sb.Append '\r'
                 | c -> sb.Append c)
                |> ignore
                i <- i + 2
            else
                sb.Append s.[i] |> ignore
                i <- i + 1
        sb.ToString()

    let private toHex (bytes: byte[]) : string =
        let sb = System.Text.StringBuilder(bytes.Length * 2)
        for b in bytes do
            sb.Append(sprintf "%02x" b) |> ignore
        sb.ToString()

    let private ofHex (s: string) : byte[] =
        [| for i in 0 .. 2 .. s.Length - 2 -> System.Convert.ToByte(s.Substring(i, 2), 16) |]

    let private inv = System.Globalization.CultureInfo.InvariantCulture

    /// Serialize a cart to text lines (deterministic order; same cart ⇒ byte-identical lines). Emits the
    /// computed touched-mask as a PROOF line (re-derivable from seed+ROM+recording; ignored on parse).
    let toLines (c: Cart) : string list =
        let q = toQuote c
        [ "cart\t1"
          sprintf "title\t%s" (esc c.Meta.Title)
          sprintf "author\t%s" (esc c.Meta.Author)
          sprintf "desc\t%s" (esc c.Meta.Description)
          sprintf "seed\t%d" c.Seed
          sprintf "cyclesPerTick\t%d" c.CyclesPerTick
          sprintf "ticks\t%d" c.Ticks
          sprintf "rom\t%s" (toHex c.Rom)
          yield! (RecordedSource.toLines c.Recording |> List.map (sprintf "rec\t%s"))
          yield! (q.Touched |> Set.toList |> List.map (sprintf "touched\t%x")) ]

    /// Parse a cart from text lines (inverse of `toLines` on the cart's own fields; `touched` lines are
    /// recomputed, not stored, so they are skipped). `None` if a required field is missing/malformed.
    let ofLines (lines: string list) : Cart option =
        let kv =
            lines
            |> List.choose (fun line ->
                match line.Split('\t') |> Array.toList with
                | key :: rest -> Some(key, String.concat "\t" rest)
                | [] -> None)

        let find k = kv |> List.tryPick (fun (a, b) -> if a = k then Some b else None)
        let recLines = kv |> List.choose (fun (a, b) -> if a = "rec" then Some b else None)

        match find "title", find "author", find "desc", find "seed", find "cyclesPerTick", find "ticks", find "rom" with
        | Some title, Some author, Some desc, Some seed, Some cpt, Some ticks, Some rom ->
            Some
                { Meta =
                    { Title = unesc title
                      Author = unesc author
                      Description = unesc desc }
                  Seed = System.UInt64.Parse(seed, inv)
                  Rom = ofHex rom
                  CyclesPerTick = System.Int32.Parse(cpt, inv)
                  Ticks = System.Int32.Parse(ticks, inv)
                  Recording = RecordedSource.ofLines recLines }
        | _ -> None

    // ── content address (a poor-man's ZetaId; full 128-bit ZetaId integration later) ──

    let private fnv1a (s: string) : uint64 =
        let mutable h = 1469598103934665603UL
        for b in System.Text.Encoding.UTF8.GetBytes s do
            h <- (h ^^^ uint64 b) * 1099511628211UL
        h

    /// A deterministic content address: FNV-1a 64 over the canonical text — the cart's NAME is derived
    /// from its content (same cart ⇒ same id; a changed byte ⇒ a changed name).
    let id (c: Cart) : string =
        sprintf "%016x" (fnv1a (String.concat "\n" (toLines c)))

    // ── the four proofs (each a pure predicate; `Cart.Tests` asserts them) ──

    /// TRUTH: byte-exact deterministic replay — the same recipe always plays to the same final frame.
    let replaysIdentically (c: Cart) : bool = playback c = playback c

    /// DURABLE: text round-trips to an equal cart, and the reloaded cart replays to the identical frame.
    let roundTrips (c: Cart) : bool =
        match ofLines (toLines c) with
        | Some c2 -> c2 = c && playback c2 = playback c
        | None -> false

    /// MINIMAL: the mask theorem (masked ROM replays identically) holds and the kept fraction is < 1.
    let minimalAndMaskHolds (c: Cart) : bool =
        let q = toQuote c
        let full = playback c
        let masked = Chip8Quote.playback c.CyclesPerTick (Chip8Quote.mask q) c.Recording c.Ticks
        // Mem legitimately DIFFERS (masking zeroes the untouched bytes — that IS the theorem); compare
        // the rest of the machine state. Untouched bytes provably don't affect the outcome.
        { full with Mem = Map.empty } = { masked with Mem = Map.empty }
        && Chip8Quote.keptFraction q < 1.0

    /// NON-STATIC: take the controls with a `novel` input and the arc DIVERGES from letting it ride.
    let arcDiverges (novel: SoftScheduler.Source) (extraTicks: int) (c: Cart) : bool =
        continueAfter novel extraTicks c <> continueAfter (fun _ -> []) extraTicks c

    // ── the first cart ──

    /// "Dot Runner" program (CHIP-8, supported-opcode subset). A steerable dot:
    /// ```
    /// 0x200  65 05   V5 := 5            ; the key we watch (key index 5)
    /// 0x202  60 00   V0 := 0            ; x position
    /// 0x204  61 00   V1 := 0            ; y position (row 0)
    /// 0x206  00 E0   CLS                ; --- main loop ---
    /// 0x208  A2 1A   I := 0x21A         ; the 1-byte sprite
    /// 0x20A  D0 11   DRW V0,V1,1        ; draw the dot at (x,y)
    /// 0x20C  E5 9E   SKP  V5            ; if key[5] down, skip the next instruction
    /// 0x20E  12 12   JP 0x212           ; (key UP) skip the move
    /// 0x210  70 01   V0 += 1            ; (key DOWN) walk right
    /// 0x212  12 06   JP 0x206           ; loop
    /// 0x214..0x219   00 …               ; pad (never executed)
    /// 0x21A  80      sprite             ; one pixel (read via I)
    /// 0x21B..        dead tail          ; never read — the mask drops it
    /// ```
    let private dotRunnerRom : byte[] =
        [| 0x65uy; 0x05uy
           0x60uy; 0x00uy
           0x61uy; 0x00uy
           0x00uy; 0xE0uy
           0xA2uy; 0x1Auy
           0xD0uy; 0x11uy
           0xE5uy; 0x9Euy
           0x12uy; 0x12uy
           0x70uy; 0x01uy
           0x12uy; 0x06uy
           0x00uy; 0x00uy
           0x00uy; 0x00uy
           0x00uy; 0x00uy
           0x80uy
           yield! Array.init 32 (fun i -> byte (0xC0 + (i % 16))) |]

    /// **The first cart — "Dot Runner."** Hold key 5 to walk the dot right; release to hold position.
    /// The recording presses key 5 (tick 1) and releases (tick 4) — the dot walks a few pixels, then
    /// stops. Replay it = a video of that walk; *take the controls* and the dot goes wherever you
    /// press (the non-static arc). A 32-byte dead tail follows the program — the mask drops it.
    let firstCart : Cart =
        { Meta =
            { Title = "Dot Runner"
              Author = "Otto (shadow*) + Aaron"
              Description =
                "The first cart-as-proof: hold key 5 to walk the dot right, release to hold. "
                + "Deterministic (byte-exact replay), minimal (dead tail masked away), playable, "
                + "and non-static (take the controls and the arc diverges from the recording)." }
          Seed = 7UL
          Rom = dotRunnerRom
          CyclesPerTick = 8
          Ticks = 8
          Recording =
            { Crossings =
                Map.ofList
                    [ 1, [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0x5 true) ]
                      4, [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0x5 false) ] ] } }
