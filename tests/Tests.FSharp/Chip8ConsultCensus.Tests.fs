module Zeta.Tests.Chip8ConsultCensusTests

// Falsifiers for the CONSULT-path post-selection census (register row R-1, Aaron 2026-08-17).
//
// The write path is already known not to post-select: `Chip8CrossRunStore.Verdict` keeps `OpenAtBound`
// as a distinct constructor from `Closed`, so budget exhaustion cannot be recorded as closure, and
// `TerminalKind` keeps `Halt` / `AwaitingInput` / `Cycle` apart. `CENSUS-0` pins that at the type level
// so this file does not merely assume it.
//
// The open question is the READ path. These tests are named for what they can refute, and the load-
// bearing one is `CENSUS-4`: a census that cannot see a deliberately skewed read distribution is the
// vacuity class, and the mutation numbers in the PR body record what breaks when it is blinded.

open global.Xunit
open Zeta.Core

let private budget: Chip8CrossRunStore.PrecomputeBudget =
    { MaxSteps = 64
      Attribution = "Chip8ConsultCensus.Tests: fixture bound, not a claim about any ROM" }

/// Synthetic artifacts. The census reads only `Key` and `Verdict`, so the checkpoint list is empty on
/// purpose — padding it would suggest the census depends on trajectory content, which it must not.
let private artifactWith (romTag: string) (v: Chip8CrossRunStore.Verdict) : Chip8CrossRunStore.Artifact =
    Chip8CrossRunStore.seal
        { Schema = Chip8CrossRunStore.Schema
          Key =
            { RomSha256 = Chip8CrossRunStore.sha256Hex (System.Text.Encoding.UTF8.GetBytes romTag)
              Seed = 0UL
              LoadAddr = Chip8.ProgramStart
              Dialect = "chip8"
              ChannelLabel = Chip8CrossRunStore.RunChannelLabel.clean
              StepMapVersion = Chip8CrossRunStore.StepMapVersion }
          Budget = budget
          Verdict = v
          Checkpoints = []
          FirstFaultStep = None
          BodyDigest = "" }

let private halted = artifactWith "halt" (Chip8CrossRunStore.Closed(4, 1, Chip8CrossRunStore.Halt))
let private stalled = artifactWith "stall" (Chip8CrossRunStore.Closed(16, 1, Chip8CrossRunStore.AwaitingInput))
let private cycling = artifactWith "cycle" (Chip8CrossRunStore.Closed(3, 5, Chip8CrossRunStore.Cycle))
let private openOrbit = artifactWith "open" (Chip8CrossRunStore.OpenAtBound 64)

let private allFour = [ halted; stalled; cycling; openOrbit ]

// ── CENSUS-0: the premise this whole measurement rests on ──────────────────────────────────────────

[<Fact>]
let ``CENSUS-0 the WRITE path keeps endings and budget exhaustion in DISTINCT buckets`` () =
    // If `OpenAtBound` and `Closed` collapsed to one bucket, or the three terminal kinds did, the stored
    // set would already be post-selected and no read-side census could recover the difference.
    let buckets = allFour |> List.map (fun a -> Chip8ConsultCensus.bucketOf a.Verdict)
    Assert.Equal<Chip8ConsultCensus.Bucket list>(Chip8ConsultCensus.allBuckets, buckets)
    Assert.Equal(4, buckets |> List.distinct |> List.length)

// ── CENSUS-1: the instrument observes without changing behaviour ───────────────────────────────────

[<Fact>]
let ``CENSUS-1 observing forwards every lookup UNCHANGED and records hits and misses`` () =
    let inner = Chip8CrossRunStore.readerOf allFour
    let seen = ResizeArray<Chip8CrossRunStore.Verdict option>()
    let instrumented = Chip8ConsultCensus.observing seen.Add inner

    let absent = { halted.Key with Seed = 0xDEADUL }

    for k in [ cycling.Key; halted.Key; absent ] do
        // the instrumented reader must return byte-identically what the inner reader returns
        Assert.Equal(inner.TryGet k, instrumented.TryGet k)

    // the inner reader was consulted twice per key above (once direct, once through the wrapper);
    // only the wrapper's three lookups are recorded
    Assert.Equal(3, seen.Count)
    Assert.Equal<Chip8CrossRunStore.Verdict option>(Some cycling.Verdict, seen.[0])
    Assert.Equal<Chip8CrossRunStore.Verdict option>(Some halted.Verdict, seen.[1])
    Assert.Equal<Chip8CrossRunStore.Verdict option>(None, seen.[2])

// ── CENSUS-2: an unbiased read set reports as unbiased ─────────────────────────────────────────────

[<Fact>]
let ``CENSUS-2 reading every stored orbit once reports zero divergence`` () =
    let events = allFour |> List.map (fun a -> Chip8ConsultCensus.Hit a.Verdict)
    let c = Chip8ConsultCensus.censusOf allFour events

    Assert.True(Chip8ConsultCensus.sharesIdentical c)
    Assert.Equal(0.0, Chip8ConsultCensus.totalVariation c, 12)
    Assert.Equal(0, c.Misses)

[<Fact>]
let ``CENSUS-2b a read set that is a SCALED copy of the stored set is also identical`` () =
    // proportions, not counts: reading each orbit three times is the same distribution
    let events =
        allFour
        |> List.collect (fun a -> List.replicate 3 (Chip8ConsultCensus.Hit a.Verdict))

    let c = Chip8ConsultCensus.censusOf allFour events
    Assert.True(Chip8ConsultCensus.sharesIdentical c)
    Assert.Equal(0.0, Chip8ConsultCensus.totalVariation c, 12)

// ── CENSUS-3: an empty read set is an ABSENCE, never a pass ────────────────────────────────────────

[<Fact>]
let ``CENSUS-3 an empty read set reports n-a, NOT agreement`` () =
    // This is the check-that-did-not-run masquerading as one that passed. With no consult path wired
    // (the state of the tree as of 2026-08-17) this is the case that actually occurs, so it must not
    // read as "no post-selection detected".
    let c = Chip8ConsultCensus.censusOf allFour []
    Assert.True(System.Double.IsNaN(Chip8ConsultCensus.totalVariation c))
    Assert.False(Chip8ConsultCensus.sharesIdentical c)
    Assert.Equal(0, Chip8ConsultCensus.total c.Read)

[<Fact>]
let ``CENSUS-3c an empty read set prints n-a in the delta column, not a fabricated skew`` () =
    // The trap this closes: `share` of an empty tally is 0.0, so a naive report renders "delta -0.400"
    // for a read set that does not exist — an ABSENCE dressed as a measured skew away from endings, which
    // is the exact confusion this census exists to prevent, committed by the census itself. Caught live
    // on the first run of `consult-census-report.ts` against the committed artifacts.
    let c = Chip8ConsultCensus.censusOf allFour []
    let joined = String.concat "\n" (Chip8ConsultCensus.report c)
    Assert.Contains("delta n/a", joined)
    Assert.DoesNotContain("delta -0.", joined)
    Assert.Contains("total variation = n/a (one side empty)", joined)

[<Fact>]
let ``CENSUS-3b misses are counted but contribute to NO bucket`` () =
    let events = [ Chip8ConsultCensus.Hit cycling.Verdict; Chip8ConsultCensus.Miss; Chip8ConsultCensus.Miss ]
    let c = Chip8ConsultCensus.censusOf allFour events
    Assert.Equal(2, c.Misses)
    Assert.Equal(1, Chip8ConsultCensus.total c.Read)

// ── CENSUS-4: THE falsifier — the census must SEE a skewed read set ────────────────────────────────

[<Fact>]
let ``CENSUS-4 a read set post-selected for NON-terminating orbits is detected`` () =
    // The deliberate skew: the store holds all four verdicts, but the reader only ever asks for the
    // orbits that keep going. If the census cannot separate this from CENSUS-2, "useful = the run
    // continues" would be measuring its own filter and nothing would say so.
    let skewed =
        [ Chip8ConsultCensus.Hit cycling.Verdict
          Chip8ConsultCensus.Hit openOrbit.Verdict
          Chip8ConsultCensus.Hit cycling.Verdict
          Chip8ConsultCensus.Hit openOrbit.Verdict ]

    let c = Chip8ConsultCensus.censusOf allFour skewed

    Assert.False(Chip8ConsultCensus.sharesIdentical c)
    // stored is (0.25, 0.25, 0.25, 0.25); read is (0, 0, 0.5, 0.5) -> d_TV = 0.5
    Assert.Equal(0.5, Chip8ConsultCensus.totalVariation c, 12)

    let deltas = Chip8ConsultCensus.shareDeltas c |> Map.ofList
    Assert.True(deltas.[Chip8ConsultCensus.Halt] < 0.0)
    Assert.True(deltas.[Chip8ConsultCensus.AwaitingInput] < 0.0)
    Assert.True(deltas.[Chip8ConsultCensus.Cycle] > 0.0)
    Assert.True(deltas.[Chip8ConsultCensus.OpenAtBound] > 0.0)

    let g = Chip8ConsultCensus.nonFixedPointShares c
    Assert.Equal(0.5, g.Stored, 12)
    Assert.Equal(1.0, g.Read, 12)

[<Fact>]
let ``CENSUS-4b the OPPOSITE skew is detected too - the instrument is not one-sided`` () =
    // Dual-use: the census reports the neutral fact "these distributions differ", never the verdict
    // "someone post-selected for continuation". A read set skewed toward endings must register equally.
    let skewed = [ Chip8ConsultCensus.Hit halted.Verdict; Chip8ConsultCensus.Hit stalled.Verdict ]
    let c = Chip8ConsultCensus.censusOf allFour skewed

    Assert.False(Chip8ConsultCensus.sharesIdentical c)
    Assert.Equal(0.5, Chip8ConsultCensus.totalVariation c, 12)
    Assert.Equal(0.0, (Chip8ConsultCensus.nonFixedPointShares c).Read, 12)

[<Fact>]
let ``CENSUS-4c a skew WITHIN the fixed-point group is invisible to the two-bucket view and visible to the four`` () =
    // Why the four-bucket distribution is primary and the fixed-point grouping is derived: reading only
    // halts while the store holds halts and stalls in equal measure is a real skew that the coarse view
    // scores as a perfect match.
    let skewed = List.replicate 4 (Chip8ConsultCensus.Hit halted.Verdict)
    let c = Chip8ConsultCensus.censusOf [ halted; stalled ] skewed

    let g = Chip8ConsultCensus.nonFixedPointShares c
    Assert.Equal(g.Stored, g.Read, 12) // coarse view: identical
    Assert.False(Chip8ConsultCensus.sharesIdentical c) // fine view: not identical
    Assert.Equal(0.5, Chip8ConsultCensus.totalVariation c, 12)

// ── CENSUS-5: no hidden constant ───────────────────────────────────────────────────────────────────

[<Fact>]
let ``CENSUS-5 the smallest possible skew is still reported - there is no tolerance band`` () =
    // An audit merged 2026-08-17 (#11534) found 112 unattributed gating constants. This module answers
    // by having none: the comparison is exact integer cross-multiplication, so a one-count difference in
    // a large sample is reported rather than absorbed.
    let stored = List.replicate 100 cycling @ [ halted ]
    let events = List.replicate 100 (Chip8ConsultCensus.Hit cycling.Verdict) @ [ Chip8ConsultCensus.Hit cycling.Verdict ]
    let c = Chip8ConsultCensus.censusOf stored events

    Assert.False(Chip8ConsultCensus.sharesIdentical c)
    Assert.True(Chip8ConsultCensus.totalVariation c > 0.0)

[<Fact>]
let ``CENSUS-5b the report is text, culture-invariant, and names every bucket including the empty ones`` () =
    let c = Chip8ConsultCensus.censusOf [ cycling ] [ Chip8ConsultCensus.Hit cycling.Verdict ]
    let lines = Chip8ConsultCensus.report c
    let joined = String.concat "\n" lines

    for b in Chip8ConsultCensus.allBuckets do
        Assert.Contains(Chip8ConsultCensus.bucketName b, joined)

    Assert.Contains("total variation = 0.000", joined)
    Assert.Contains("shares identical = yes", joined)
