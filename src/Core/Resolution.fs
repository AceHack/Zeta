namespace Zeta.Core

/// Resolution — **the self-budgeting cell: the first bit that knows when it needs more bits.**
///
/// Aaron 2026-06-12 (ferry 20 §5): "the first bit that knows when it needs more bits to contain
/// the uncertainty." This is the seed at minimum scale (ferry 20: shape kept, entropy ready) and
/// the base case of the recursive budget (ferry 16: budget = flow control = stability of self;
/// the contraction's floor). It reads the resolution accounting already on the `UniversalNumber`
/// port (`BitsUsed` = signal above noise; `IsExact`) and adds the one decision that makes a value
/// *self*-budgeting: **does my current width carry the bits this uncertainty demands, and if not,
/// how many more?**
///
/// Pure module over the port interface — no class, no captured state (the interfaces-free /
/// classes-earned meta-rule): the cell is a *reading* of a value through its port, not a new
/// stateful object. `widen` is supplied by the caller's carrier (Ball.shed, BigFloat precision
/// raise, …) because growing precision is the carrier's business; this module decides *whether*
/// and *by how much*, never *how* — the separation Vera named (fuse/Vision policy preserves
/// "shape without history" outside; the carrier keeps the history inside).
[<RequireQualifiedAccess>]
module Resolution =

    /// A resolution reading: signal bits currently carried, and whether the value is exact.
    /// The Beacon register's "physics of floats" made a value: bits = signal above the noise.
    type Reading = { SignalBits: int; IsExact: bool }

    /// Read a value's resolution through its port.
    let read (port: UniversalNumber.IUniversalNumber<'T>) (v: 'T) : Reading =
        { SignalBits = port.BitsUsed v; IsExact = port.IsExact v }

    /// Does the value carry at least `required` signal bits? (The "am I wide enough?" question —
    /// the whole interpretation a width-1 seed keeps, ferry 20 §5.)
    let sufficientFor (required: int) (port: UniversalNumber.IUniversalNumber<'T>) (v: 'T) : bool =
        port.BitsUsed v >= required

    /// How many MORE signal bits are needed to reach `required` (0 if already sufficient).
    /// This is the cell's demand signal — the bit that knows it needs more bits, quantified.
    /// Never negative: surplus is not a deficit (uncertainty has no sign — Ball's law 1 echoed).
    let deficit (required: int) (port: UniversalNumber.IUniversalNumber<'T>) (v: 'T) : int =
        max 0 (required - port.BitsUsed v)

    /// The self-budgeting decision over one incoming demand: hold if the current width suffices,
    /// otherwise report the deficit so the carrier can widen. Returns a typed verdict, never an
    /// exception (Result/decline discipline) — the refusal-to-overflow is a first-class value
    /// (composes with Vera's tryFuse, ferry 17: a decline that carries information).
    type Verdict =
        /// Width suffices for the demand; nothing to do (the contraction held — ferry 16).
        | Hold
        /// Width is short by `Bits`; the carrier must widen by at least this to contain the demand.
        | Widen of Bits: int

    /// Decide whether a value's resolution contains a demand of `required` signal bits.
    let decide (required: int) (port: UniversalNumber.IUniversalNumber<'T>) (v: 'T) : Verdict =
        match deficit required port v with
        | 0 -> Hold
        | n -> Widen n

    /// Fold a stream of bit-demands into the running maximum width required to contain them all —
    /// the budget accumulating its own ceiling (the recursive-budget base case, ferry 16; a max-
    /// monoid, so it is idempotent and order-free — apply-N == apply-once, manifesto §12).
    let ceiling (demands: int seq) : int =
        Seq.fold max 0 demands
