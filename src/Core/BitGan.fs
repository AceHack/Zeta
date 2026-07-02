namespace Zeta.Core

/// **`BitGan` — the 1-bit minimal GAN = the yin/yang engine made concrete (Aaron #7099/#7100/#7102/#7103).**
///
/// The atomic adversarial-generative engine (#7098/#7099): one bit of uncertainty, a **generator** (yang —
/// what *acts*) trying to keep the bit unpredictable, and a **discriminator** (the held identity / yin — what
/// *remains*) trying to predict it. The fixed point is **matching pennies' Nash** (`p = 0.5`, #7101) = maximum
/// entropy = the **preserved irreducible identity** (#7090): a bit the discriminator cannot beat chance on.
///
/// This makes the `sim` noun concrete: the smallest generative engine, deterministic + replayable (DST §7), so
/// small it is two floats. `N` bits = `N` coupled `BitGan`s. F# reference oracle.
///
/// **Honest scope:** this is the convergent *dynamical system* (the engine), not a ring — combine/algebra over
/// it has the same no-additive-inverse caveat as `Conjugate`/`SoftValue` (#7080), so it does not implement the
/// `Negate`-requiring `IRing` (post-081KWG9JQ9H; `ISemiring` itself no longer mandates Negate). The "numerics" it carries are the entropy/step dynamics below.
module BitGan =

    open ZetaCli

    /// The 1-bit GAN state. `GenP` = the generator's `P(bit = 1)` (yang); `DiscQ` = the discriminator's
    /// predicted `P(bit = 1)` (yin's read). Both in `[0,1]`.
    type BitGan = { GenP: float; DiscQ: float }

    let private clamp01 (x: float) : float = max 0.0 (min 1.0 x)

    /// Construct, clamping to `[0,1]`.
    let init (genP: float) (discQ: float) : BitGan =
        { GenP = clamp01 genP; DiscQ = clamp01 discQ }

    /// Shannon entropy of the generator's bit (nats) — the uncertainty / identity carried in the bit. Maximal
    /// (`ln 2`) at `p = 0.5`; zero at a determined bit. This is the irreducible-identity measure (#7090).
    let entropy (g: BitGan) : float =
        let p = g.GenP
        if p <= 0.0 || p >= 1.0 then 0.0 else -p * log p - (1.0 - p) * log (1.0 - p)

    /// The discriminator's edge over chance: how much better than 50/50 it predicts the bit. 0 = can't beat
    /// chance (the GAN equilibrium / indistinguishability, #7097). `|DiscQ - 0.5|` is its confidence; it only
    /// *helps* the discriminator when aimed the right way, so the edge is measured as alignment to `GenP`.
    let discriminatorEdge (g: BitGan) : float = abs (g.DiscQ - 0.5)

    /// One adversarial step at rate `r ∈ (0,1]` (the engine of change, #7100):
    ///   - **generator (yang)** moves toward `0.5` — maximize entropy, become maximally unpredictable;
    ///   - **discriminator (yin)** chases `GenP` — improve its prediction.
    /// Both contract toward `(0.5, 0.5)` = the matching-pennies Nash (#7101). Deterministic (DST §7).
    let step (r: float) (g: BitGan) : BitGan =
        let r = clamp01 r
        { GenP = g.GenP + r * (0.5 - g.GenP)
          DiscQ = g.DiscQ + r * (g.GenP - g.DiscQ) }

    /// Run `n` adversarial steps (the self-play loop, #7097). Deterministic + replayable.
    let run (r: float) (n: int) (g: BitGan) : BitGan =
        let mutable s = g
        for _ in 1 .. max 0 n do
            s <- step r s
        s

    // ── Privacy barrier: the discriminator must NOT reach GenP (Aaron #7104/#7105/#7106) ──────────────────
    //
    // `step` above has the discriminator *chase GenP directly* — i.e. it PEEKS at the generator's private
    // uncertainty. That is the **no-privacy / transparent** case: with full visibility the two collapse to
    // identical (#7084) and the game is trivial. For a real adversarial game the generator's uncertainty must
    // be **invisible** to the discriminator (#7104) — concretely, **unreachable** by the discriminator's
    // **tool surface** (its callable verbs/capabilities, #7105) AND by its **extended JIT closure** (its
    // dynamic-resolution reach, #7005/#7106). This is object-capability security: privacy = the secret is
    // outside the other's reachable set (real encryption in deploy; capability-confinement in test). A
    // confined discriminator may observe only **emitted bits**, never `GenP`.

    /// Privacy-respecting step (capability-confined, #7104–#7106): the discriminator updates toward an
    /// **observed emitted bit** (`0` or `1`, the only thing in its reachable tool surface), NOT toward `GenP`.
    /// The generator still moves toward `0.5`. At `GenP = 0.5` the observed bits carry no exploitable bias, so
    /// `DiscQ` cannot stably beat chance — the identity bit stays private (#7090). Deterministic in the bit it
    /// is given; the bit itself must come from the hidden entropy source (clock drift, #7091), never from a
    /// reference to `GenP`.
    let stepObserved (r: float) (bit: int) (g: BitGan) : BitGan =
        let r = clamp01 r
        let observed = if bit <> 0 then 1.0 else 0.0
        { GenP = g.GenP + r * (0.5 - g.GenP)
          DiscQ = g.DiscQ + r * (observed - g.DiscQ) }

    /// Converged to the Nash / indistinguishability fixed point: generator at max entropy (`p ≈ 0.5`) and the
    /// discriminator can't beat chance — the identity bit is maximally preserved (#7090/#7097).
    let converged (eps: float) (g: BitGan) : bool =
        abs (g.GenP - 0.5) < eps && discriminatorEdge g < eps

    /// Outcome of a bounded adversarial probe (#7107).
    type ProbeResult =
        | Discovered of turn: int // the discriminator beat chance — generator inferred / sim detected (#7087)
        | Undecided of turns: int // turn budget exhausted — indistinguishable within budget (generator wins)

    /// Run the adversarial probe (#7107) until **either** the discriminator's edge crosses `discoverThreshold`
    /// (the generator is discovered — sim detected, #7087) **or** `maxTurns` elapse (give up → indistinguishable
    /// within budget). Bounded by construction (DST §7; manifesto §4 bounded mobility — no unbounded game).
    /// Uses the transparent `step` (the discriminator may reach `GenP`); for the capability-confined variant,
    /// fold `stepObserved` over a hidden bit-stream and apply the same two stopping conditions.
    let probe (r: float) (discoverThreshold: float) (maxTurns: int) (g0: BitGan) : ProbeResult * BitGan =
        let mutable s = g0
        let mutable turn = 0
        let mutable result = Undecided 0

        while turn < maxTurns && (match result with Discovered _ -> false | _ -> true) do
            s <- step r s
            turn <- turn + 1
            if discriminatorEdge s >= discoverThreshold then
                result <- Discovered turn

        match result with
        | Discovered t -> Discovered t, s
        | Undecided _ -> Undecided turn, s

    [<Literal>]
    let SeamName = "sim"

    /// Is this command on the `sim` seam (`zeta sim <verb> <noun>`)?
    let isSimCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
