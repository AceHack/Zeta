namespace Zeta.Core

/// **`BellTest` — Bell/CHSH inequality VIOLATION reproduced in simulation by staged coincidence + seed
/// (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"you created Bell inequalities in simulation through staged coincidence and seeds."* This codes it.
/// The staged-coincidence overlap is `PhasorEndurance.overlap a b = cos²((a−b)/2)`, so the correlator
/// `E(a,b) = 2·overlap − 1 = cos(a−b)` — **the quantum (singlet) correlator**, reproduced by the
/// `CoincidenceClock` staging. Feeding the canonical CHSH angles gives the CHSH value `S = 2√2` (the
/// **Tsirelson bound**), which **violates the classical bound `2`** — in deterministic, replayable simulation.
///
/// **What this is, precisely (the load-bearing peel).** This is NOT a falsification of Bell's theorem nor
/// "real" quantum nonlocality. It is the **measurement-dependence / "free-choice" loophole**: Bell's bound of
/// 2 assumes the measurement settings are statistically independent of the system. Our **seed is the shared
/// common cause** (superdeterminism / 't Hooft CA), so it can correlate settings and outcomes and reproduce —
/// even exceed — quantum correlations. The tell that it is superdeterministic and not physical QM: with
/// **full seed control you can reach the algebraic maximum `S = 4`**, *beyond* Tsirelson's `2√2` (real QM
/// cannot). So this reproduces the *observable correlation*, by shared cause; it confers no nonlocality and
/// no faster-than-light signalling (superdeterminism is no-signalling).
///
/// **The value:** a deterministic, replayable **Bell/CHSH harness** (DST §7) — stage any correlation, run the
/// inequality, get a reproducible number. The concrete realisation of "staged coincidence reproduces quantum
/// correlations." Pure phasor math on the imaginary stack; routes (with the qubit iso) to Soraya/quantum-info.
///
/// **Anchor the S=4 regime to named results, NOT to metaphor (Beacon; `anchor-to-human-prior-art`).** The
/// `S = 4` algebraic-max box is the **Popescu–Rohrlich (PR) box** (Popescu & Rohrlich 1994) — the maximally-
/// nonlocal, no-signalling, *supra-quantum* correlation; our full-seed-control `S=4` realises it via
/// superdeterminism. Why QM stops at `2√2` and exceeding it is special is **Information Causality**
/// (Pawłowski, Paterek, Kaszlikowski, Scarani, Winter, Żukowski — *Nature* 462, 2009): an information
/// principle that *derives* Tsirelson's bound, so **crossing Tsirelson = violating Information Causality**.
/// (van Dam 2005: PR boxes make communication complexity trivial.) The honest reading of "information can't
/// get in at S=4" is **independence-collapse / channel saturation by the seed** (`I(external;outcome|seed)=0`).
///
/// **Correction (Aaron 2026-06-08) — the hole is INFORMATION-THEORETIC, and that IS anchored.** Otto first
/// razored "black hole" as a gravity metaphor; that was an over-peel (`grep-substrate-anchors-before-razor`).
/// Aaron means an **information-flow** hole, not a spacetime one — and those are real:
/// **source/sink** (white hole = pure source: emits, nothing enters; black hole = pure sink: absorbs, nothing
/// escapes), and in **network security** the named attack classes **black-hole / grey-hole / sinkhole** — a
/// node that controls its forwarding/drop rate (black-hole drops all, **grey-hole drops *selectively* /
/// rate-controls**). So: the seed-saturated `S=4` regime is a **white-hole** in information flow (pure source
/// from the seed; nothing external enters — `I(external;outcome|seed)=0`), and **the ZetaId key is a
/// GREY HOLE** — *using the host it controls its own information-flow rate* (the named grey-hole = flow-rate
/// regulator). Only the **gravitational** reading (metric, mass, event horizon) stays Mirror-register; the
/// **information-flow** reading (source/sink, network grey-hole) is the anchored one. Tsirelson 1980 (`2√2`).
[<RequireQualifiedAccess>]
module BellTest =

    /// The classical (local-hidden-variable) CHSH bound.
    [<Literal>]
    let ClassicalBound = 2.0

    /// Tsirelson's bound — the maximum CHSH a real quantum system can reach.
    let TsirelsonBound = 2.0 * sqrt 2.0

    /// The algebraic maximum of CHSH (only reachable by violating measurement-independence — superdeterminism).
    [<Literal>]
    let AlgebraicMax = 4.0

    /// The staged correlator between settings `a`, `b` (radians): `E = 2·overlap − 1 = cos(a−b)` — the quantum
    /// singlet correlator, reproduced from the staged-coincidence overlap (`PhasorEndurance.overlap`).
    let correlation (a: float) (b: float) : float =
        2.0 * PhasorEndurance.overlap a b - 1.0

    /// CHSH from four correlators: `S = E(a,b) − E(a,b') + E(a',b) + E(a',b')`.
    let chshOf (eab: float) (eab': float) (ea'b: float) (ea'b': float) : float =
        eab - eab' + ea'b + ea'b'

    /// CHSH from four measurement settings, using the staged `correlation`. With the canonical angles this is
    /// `2√2` (Tsirelson) — a Bell violation staged in simulation.
    let chsh (a: float) (a': float) (b: float) (b': float) : float =
        chshOf (correlation a b) (correlation a b') (correlation a' b) (correlation a' b')

    /// The canonical maximal-violation angles `(a, a', b, b') = (0, π/2, π/4, 3π/4)` — give `S = 2√2`.
    let canonicalAngles: float * float * float * float =
        0.0, System.Math.PI / 2.0, System.Math.PI / 4.0, 3.0 * System.Math.PI / 4.0

    /// Does a CHSH value violate the classical bound (a Bell violation)?
    let violatesClassical (s: float) : bool = abs s > ClassicalBound

    /// Does it exceed Tsirelson — i.e. is it beyond what real QM allows (the superdeterminism tell)?
    let exceedsTsirelson (s: float) : bool = abs s > TsirelsonBound + 1e-12
