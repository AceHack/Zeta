module Zeta.Tests.Chip8CrossRunStoreTests

// The CROSS-RUN half of CHIP-8 self-simulation (Aaron 2026-08-17). `Chip8SelfSim.Tests` proves the
// WITHIN-run claim (T1: `lookAhead n` IS the real timeline n steps later, byte-equal). These are the
// falsifiers for the claim that survives across the run boundary: what run 1 wrote down, run 2 reads,
// and what it reads is byte-equal to what it would have computed.
//
// Each test is named for the claim it can refute. Nothing here asserts a property the store gets for
// free — the mutation numbers in the PR body record what breaks when the store is made wrong.

open System
open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private romBytes (name: string) : byte[] =
    let p = Path.Join(repoRoot (), "roms", "chip8", name)
    Assert.True(File.Exists p, sprintf "committed ROM missing: %s" p)
    File.ReadAllBytes p

/// A budget with a real attribution — every test must supply one, which is the point of the guard.
let private budget (maxSteps: int) : Chip8CrossRunStore.PrecomputeBudget =
    { MaxSteps = maxSteps
      Attribution = "Chip8CrossRunStore.Tests: bound chosen to exceed the measured orbit of the fixture ROMs (max 513)" }

// 6A0C (V[A]=0x0C); 7A01 (V[A]+=1); 1202 (jump back) — increments forever, so the cycle is a real
// multi-state cycle (V[A] wraps mod 256 over two steps each), not a fixed point.
let private loopRom = [| 0x6Auy; 0x0Cuy; 0x7Auy; 0x01uy; 0x12uy; 0x02uy |]

// C0FF (RND V0,0xFF); 1200 (jump back) — `Rng` is a 2^64 additive counter carried INSIDE the frame,
// so this orbit provably cannot close within any tractable bound. Aaron's "other calculations may not
// be tractable", as a fixture.
let private rndLoopRom = [| 0xC0uy; 0xFFuy; 0x12uy; 0x00uy |]

let private keyFor (rom: byte[]) (seed: uint64) =
    Chip8CrossRunStore.runKey rom seed Chip8.ProgramStart "chip8" Chip8CrossRunStore.RunChannelLabel.clean

let private frame0 (rom: byte[]) (seed: uint64) =
    Chip8Cow.create seed |> Chip8Cow.loadRom rom

/// The ground truth: actually step the machine.
let private future (n: int) (f: Chip8Cow.Frame) =
    let mutable s = f
    for _ in 1..n do
        s <- Chip8Cow.step s
    s

let private ok (r: Result<'a, Chip8CrossRunStore.Feedback>) : 'a =
    match r with
    | Ok v -> v
    | Error e -> failwithf "expected Ok, got Error %A" e

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1. The core claim: a memo read is byte-equal to a real computation.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``X1 a state read from the store is BYTE-EQUAL to stepping the machine (the cross-run T1)`` () =
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)
    let f0 = frame0 loopRom 7UL

    let mutable checkedAny = false

    for n in [ 0; 1; 2; 5; 17; 100; 357; 512 ] do
        match Chip8CrossRunStore.stateAt a n with
        | Ok(Some fromStore) ->
            Assert.Equal<Chip8Cow.Frame>(future n f0, fromStore)
            checkedAny <- true
        | Ok None -> ()
        | Error e -> failwithf "store refused step %d: %A" n e

    Assert.True(checkedAny, "no step was actually served from the store — the test would be vacuous")

[<Fact>]
let ``X2 cycle reduction answers a step FAR beyond anything recorded, and is byte-equal to the real run`` () =
    // The payoff Aaron named: a finite artifact describing an unbounded future. 5000 steps are actually
    // executed here as ground truth, against an artifact whose recorded prefix stops at 513.
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)

    match a.Verdict with
    | Chip8CrossRunStore.Closed(mu, lambda, _) ->
        Assert.True(5000 > mu + lambda, "the probe step must lie beyond the recorded orbit or this proves nothing")
    | v -> failwithf "expected a closed orbit for the loop ROM, got %A" v

    let fromStore = ok (Chip8CrossRunStore.stateAt a 5000)
    Assert.True(fromStore.IsSome, "cycle reduction should have served step 5000")
    Assert.Equal<Chip8Cow.Frame>(future 5000 (frame0 loopRom 7UL), fromStore.Value)

[<Fact>]
let ``X3 fastForward through an INJECTED reader is byte-equal to SoftChip8.lookAhead`` () =
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)
    let reader = Chip8CrossRunStore.readerOf [ a ]

    // "Run 2" starts fresh and asks the store where it will be, without computing it.
    let run2Start = frame0 loopRom 7UL

    for ahead in [ 1; 4; 33; 200 ] do
        match Chip8CrossRunStore.fastForward reader key run2Start ahead with
        | Some fromStore ->
            let computed, hitBranch = SoftChip8.lookAhead ahead run2Start
            Assert.False(hitBranch, "fixture must stay on a deterministic segment")
            Assert.Equal<Chip8Cow.Frame>(computed, fromStore)
        | None -> failwithf "store failed to serve a lookahead of %d" ahead

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2. The hidden-oracle guard: a budget must never become a claim about the machine.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``X4 an UNATTRIBUTED budget is refused before any work happens`` () =
    // Aaron 2026-08-17: "always be on the lookout where the measurement or the limit/budget becomes the
    // oracle silently". A bound nobody signed for is exactly that, so it never runs.
    let key = keyFor loopRom 7UL

    for attribution in [ ""; "   "; "\t" ] do
        match Chip8CrossRunStore.precompute { MaxSteps = 100; Attribution = attribution } 1 key loopRom with
        | Error Chip8CrossRunStore.BudgetUnattributed -> ()
        | other -> failwithf "unattributed budget %A was not refused: %A" attribution other

    // and a nonsense bound is refused too, distinctly
    match Chip8CrossRunStore.precompute { MaxSteps = 0; Attribution = "signed" } 1 key loopRom with
    | Error(Chip8CrossRunStore.BudgetNotPositive 0) -> ()
    | other -> failwithf "non-positive bound not refused: %A" other

[<Fact>]
let ``X5 budget exhaustion is OpenAtBound, never a cycle — the RND loop cannot be memoized past its prefix`` () =
    // `Rng` is a 2^64 counter inside the frame, so this orbit does not close. A store that reported a
    // cycle here would let run 2 reduce modulo a cycle that does not exist and return a confident wrong
    // state. The type makes that unrepresentable; this test proves the type is actually used.
    let key = keyFor rndLoopRom 0UL
    let bound = 64

    let a =
        ok (
            Chip8CrossRunStore.precompute
                { MaxSteps = bound
                  Attribution = "Chip8CrossRunStore.Tests X5: deliberately small, to force the open verdict" }
                1
                key
                rndLoopRom
        )

    match a.Verdict with
    | Chip8CrossRunStore.OpenAtBound n -> Assert.Equal(bound, n)
    | v -> failwithf "the RND loop must NOT report a closed orbit; got %A" v

    // Inside the recorded prefix the store still answers, and answers correctly.
    let fromStore = ok (Chip8CrossRunStore.stateAt a 32)
    Assert.Equal<Chip8Cow.Frame>(future 32 (frame0 rndLoopRom 0UL), fromStore.Value)

    // Beyond it, it REFUSES — and the refusal names the bound and who set it.
    match Chip8CrossRunStore.reduceStep a (bound + 1) with
    | Error(Chip8CrossRunStore.NotClosedAtBound(m, attribution)) ->
        Assert.Equal(bound, m)
        Assert.Contains("deliberately small", attribution, StringComparison.Ordinal)
    | other -> failwithf "step beyond an open orbit must be refused, got %A" other

[<Fact>]
let ``X6 the budget that produced a result is ON the artifact, so a later reader can judge it`` () =
    let key = keyFor loopRom 7UL
    let attribution = "X6: the bound is legible on the record, not lost at the call site"

    let a =
        ok (Chip8CrossRunStore.precompute { MaxSteps = 4096; Attribution = attribution } 1 key loopRom)

    let round = ok (Chip8CrossRunStore.parse (Chip8CrossRunStore.toJson a))
    Assert.Equal(attribution, round.Budget.Attribution)
    Assert.Equal(4096, round.Budget.MaxSteps)
    Assert.Contains("\"attribution\"", Chip8CrossRunStore.toJson a, StringComparison.Ordinal)

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 3. Idempotency (#6), DST (#7), and the refusal of a corrupt memo.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``X7 precompute is IDEMPOTENT: running it twice produces byte-identical artifact text`` () =
    let key = keyFor loopRom 7UL
    let a1 = ok (Chip8CrossRunStore.precompute (budget 4096) 8 key loopRom)
    let a2 = ok (Chip8CrossRunStore.precompute (budget 4096) 8 key loopRom)
    Assert.Equal(Chip8CrossRunStore.toJson a1, Chip8CrossRunStore.toJson a2)
    // and the content-addressed name is stable, so a second write is an upsert of the same bytes
    Assert.Equal(Chip8CrossRunStore.artifactFileName key, Chip8CrossRunStore.artifactFileName a2.Key)

[<Fact>]
let ``X8 DST: same seed gives byte-identical bytes; a different seed gives a different key AND body`` () =
    let romA = loopRom
    let k7 = keyFor romA 7UL
    let k8 = keyFor romA 8UL

    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 8 k7 romA)
    let b = ok (Chip8CrossRunStore.precompute (budget 4096) 8 k7 romA)
    let c = ok (Chip8CrossRunStore.precompute (budget 4096) 8 k8 romA)

    Assert.Equal(Chip8CrossRunStore.toJson a, Chip8CrossRunStore.toJson b)
    Assert.NotEqual<string>(Chip8CrossRunStore.toJson a, Chip8CrossRunStore.toJson c)
    Assert.NotEqual<string>(Chip8CrossRunStore.artifactFileName k7, Chip8CrossRunStore.artifactFileName k8)

[<Fact>]
let ``X8b clean and frozen-address assisted runs cannot collide on one run key`` () =
    let clean = keyFor loopRom 7UL

    let frozenAddress =
        ok (Chip8CrossRunStore.RunChannelLabel.assisted "ram-write/freeze-0300=ff")

    let assisted =
        Chip8CrossRunStore.runKey loopRom 7UL Chip8.ProgramStart "chip8" frozenAddress

    let cleanArtifact = ok (Chip8CrossRunStore.precompute (budget 4096) 8 clean loopRom)
    let assistedArtifact = ok (Chip8CrossRunStore.precompute (budget 4096) 8 assisted loopRom)

    Assert.NotEqual<Chip8CrossRunStore.RunKey>(clean, assisted)
    Assert.NotEqual<string>(Chip8CrossRunStore.keyText clean, Chip8CrossRunStore.keyText assisted)
    Assert.NotEqual<string>(
        Chip8CrossRunStore.artifactFileName clean,
        Chip8CrossRunStore.artifactFileName assisted
    )
    Assert.NotEqual<string>(Chip8CrossRunStore.toJson cleanArtifact, Chip8CrossRunStore.toJson assistedArtifact)
    Assert.Contains("channel=clean", Chip8CrossRunStore.keyText clean, StringComparison.Ordinal)
    Assert.Contains(
        "channel=assisted:ram-write/freeze-0300=ff",
        Chip8CrossRunStore.keyText assisted,
        StringComparison.Ordinal
    )

[<Fact>]
let ``X8c invalid or delimiter-ambiguous channel labels are typed refusals`` () =
    for label in [ ""; "assisted:"; "assisted:ram-write|seed=bad"; "ASSISTED:ram-write" ] do
        match Chip8CrossRunStore.RunChannelLabel.tryCreate label with
        | Error(Chip8CrossRunStore.InvalidChannelLabel refused) -> Assert.Equal(label, refused)
        | other -> failwithf "invalid channel label %A was not refused: %A" label other

    let artifact =
        ok (Chip8CrossRunStore.precompute (budget 4096) 8 (keyFor loopRom 7UL) loopRom)

    let malformed =
        Chip8CrossRunStore.toJson artifact
        |> fun json -> json.Replace("\"channelLabel\": \"clean\"", "\"channelLabel\": \"assisted:\"", StringComparison.Ordinal)

    match Chip8CrossRunStore.parse malformed with
    | Error(Chip8CrossRunStore.InvalidChannelLabel "assisted:") -> ()
    | other -> failwithf "serialized invalid channel label was not refused distinctly: %A" other

[<Fact>]
let ``X9 MUTATION: a single corrupted nibble in a stored snapshot is REFUSED, not silently consulted`` () =
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)
    let json = Chip8CrossRunStore.toJson a

    // sanity: the untouched artifact parses
    Assert.True((Chip8CrossRunStore.parse json) |> Result.isOk)

    // flip exactly one nibble inside a snapshot's register block
    let needle = "|v="
    let at = json.IndexOf(needle, StringComparison.Ordinal)
    Assert.True(at > 0, "fixture must contain a register block to corrupt")
    let pos = at + needle.Length
    let orig = json.[pos]
    let flipped = if orig = '0' then '1' else '0'
    let corrupted = json.Remove(pos, 1).Insert(pos, string flipped)
    Assert.NotEqual<string>(json, corrupted)

    match Chip8CrossRunStore.parse corrupted with
    | Error(Chip8CrossRunStore.DigestMismatch(stored, actual)) -> Assert.NotEqual<string>(stored, actual)
    | other -> failwithf "a corrupted store must be refused, got %A" other

[<Fact>]
let ``X10 MUTATION: corrupting the recorded mu or lambda is also refused`` () =
    // The digest covers the verdict, not just the snapshots — otherwise an attacker (or a bad merge)
    // could leave every state intact and lie only about the cycle, which is the dangerous edit.
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)
    let json = Chip8CrossRunStore.toJson a
    let corrupted = json.Replace("\"lambda\": 512", "\"lambda\": 256", StringComparison.Ordinal)
    Assert.NotEqual<string>(json, corrupted)

    match Chip8CrossRunStore.parse corrupted with
    | Error(Chip8CrossRunStore.DigestMismatch _) -> ()
    | other -> failwithf "a falsified cycle length must be refused, got %A" other

[<Fact>]
let ``X11 JSON round-trips exactly, and the frame codec is an identity on a non-trivial frame`` () =
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 4 key loopRom)
    let round = ok (Chip8CrossRunStore.parse (Chip8CrossRunStore.toJson a))
    Assert.Equal(Chip8CrossRunStore.toJson a, Chip8CrossRunStore.toJson round)

    // a frame with display bits, a stack, keys, planes and a fault set — all the awkward fields at once
    let f =
        { frame0 (romBytes "zeta-draw-h.ch8") 3UL with
            Stack = [ 0x210us; 0x2FEus ]
            Display = Map.ofList [ 0, true; 1023, true; 2047, true ]
            Extra = Map.ofList [ 5, 6uy ]
            Plane = 7uy
            Keys = Array.init 16 (fun i -> i % 3 = 0)
            Delay = 9uy
            Sound = 11uy
            Fault = Some "stack underflow on 00EE" }

    let text = Chip8CrossRunStore.encodeFrame f
    Assert.Equal<Chip8Cow.Frame>(f, ok (Chip8CrossRunStore.decodeFrame text))

[<Fact>]
let ``X12 MUTATION: a snapshot with a non-hex nibble is refused, never decoded to a plausible frame`` () =
    let f = frame0 loopRom 7UL
    let text = Chip8CrossRunStore.encodeFrame f
    let at = text.IndexOf("|v=", StringComparison.Ordinal) + 3
    let corrupted = text.Remove(at, 1).Insert(at, "z")

    match Chip8CrossRunStore.decodeFrame corrupted with
    | Error(Chip8CrossRunStore.MalformedSnapshot _) -> ()
    | other -> failwithf "non-hex snapshot must be refused, got %A" other

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 4. Noninterference (#13): the store is injected, never fetched.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``X13 a room with no store injected gets NO memo — the module never reaches out for one`` () =
    let key = keyFor loopRom 7UL
    let f0 = frame0 loopRom 7UL
    Assert.True((Chip8CrossRunStore.fastForward Chip8CrossRunStore.emptyReader key f0 10).IsNone)

    // and a reader holding a DIFFERENT run's artifact does not answer for this key either
    let other = ok (Chip8CrossRunStore.precompute (budget 4096) 1 (keyFor loopRom 99UL) loopRom)
    let reader = Chip8CrossRunStore.readerOf [ other ]
    Assert.True((Chip8CrossRunStore.fastForward reader key f0 10).IsNone)

[<Fact>]
let ``X14 a frame the store never saw yields None, never a guess`` () =
    let key = keyFor loopRom 7UL
    let a = ok (Chip8CrossRunStore.precompute (budget 4096) 1 key loopRom)
    let reader = Chip8CrossRunStore.readerOf [ a ]
    // a frame from a different ROM entirely
    let alien = frame0 rndLoopRom 7UL
    Assert.True((Chip8CrossRunStore.fastForward reader key alien 4).IsNone)

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 5. The measured orbits of the committed ROMs, pinned as a regression.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

[<Theory>]
[<InlineData("zeta-selfloop.ch8", 0, 1, "halt")>]
[<InlineData("zeta-arith.ch8", 3, 5, "cycle")>]
[<InlineData("zeta-draw-h.ch8", 4, 1, "halt")>]
[<InlineData("mikolay-delay-timer-test.ch8", 16, 1, "awaiting-input")>]
[<InlineData("mikolay-random-number-test.ch8", 15, 1, "awaiting-input")>]
let ``X15 measured orbits of the committed ROMs (seed 0) are what the design doc reports``
    (rom: string)
    (expectedMu: int)
    (expectedLambda: int)
    (expectedTerminal: string)
    =
    let bytes = romBytes rom
    let key = keyFor bytes 0UL
    let a = ok (Chip8CrossRunStore.precompute (budget 100000) 1 key bytes)

    match a.Verdict with
    | Chip8CrossRunStore.Closed(mu, lambda, terminal) ->
        Assert.Equal(expectedMu, mu)
        Assert.Equal(expectedLambda, lambda)

        let terminalText =
            match terminal with
            | Chip8CrossRunStore.Halt -> "halt"
            | Chip8CrossRunStore.AwaitingInput -> "awaiting-input"
            | Chip8CrossRunStore.Cycle -> "cycle"

        Assert.Equal(expectedTerminal, terminalText)
    | v -> failwithf "%s should close within the bound; got %A" rom v

[<Fact>]
let ``X16 an input-blocked fixed point is NOT reported as a halt — the orbit ended at a branch`` () =
    // Two of the five committed ROMs end at FX0A, which `Chip8Cow` models as a no-advance wait, making
    // them literal fixed points of the pure step map. Calling that "cycle of length 1" and stopping
    // would be a store that lies by omission: the machine has not finished, it is waiting for a key.
    let bytes = romBytes "mikolay-random-number-test.ch8"
    let key = keyFor bytes 0UL
    let a = ok (Chip8CrossRunStore.precompute (budget 100000) 1 key bytes)

    match a.Verdict with
    | Chip8CrossRunStore.Closed(mu, 1, Chip8CrossRunStore.AwaitingInput) ->
        // and the claim is checkable independently of the store
        let f = future mu (frame0 bytes 0UL)
        Assert.True(SoftChip8.branchesOnInput f, "the terminal frame must actually be an input branch")
    | v -> failwithf "expected an input-blocked terminal, got %A" v
