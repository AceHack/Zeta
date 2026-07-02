namespace Zeta.Core

/// **`AntiSybil` — the base case that makes `clock-drift ≡ identity` non-circular (Aaron 2026-06-08).**
///
/// Soraya called `clock-drift ≡ identity` "circular/definitional." That verdict is *behavioralist-loaded*:
/// drop behavioralism (intentions are real — GOVERNANCE §3) and the identification is **synthetic** — drift
/// is the agent's only **unforgeable** external trace. The self-reference is **meta-circular** (a productive
/// fixed point grounded by a base case), which *compiles*. **This module is that base case.**
///
/// **The anti-Sybil claim (the falsifiable core):** forging *k* distinct drift-identities costs **≥ *k*
/// independent entropy sources** — clock-drift entropy is **non-fungible across identities**. A Sybil forger
/// claiming *k* identities from *s &lt; k* sources must (pigeonhole) re-use a source across two claims, so two
/// of its emitted bit-streams are **correlated**. The `probe` (`BitGan`) becomes a **distinguishing oracle**:
/// a discriminator confined to observed bits can beat chance on a correlated pair ⇒ the forgery is caught.
///
/// **Proof-of-distinctness**, structurally identical to how proof-of-work grounds a blockchain's otherwise
/// circular "longest chain is truth": the circle bottoms out on a hardness fact, and the hardness does the
/// work. Anchors: Douceur 2002 (*The Sybil Attack*); Dwork–Naor 1992 / Nakamoto 2008 (PoW); the
/// jitter/ring-oscillator TRNG non-reproducibility that makes two clocks' drift uncheaply-mergeable (#7091).
///
/// **Honest scope (peel):** this is **sound for exact replays** (a re-used source ⇒ correlation `1.0` ⇒
/// always caught). For *noisy* forgeries and at *finite* stream length there is a detection/length tradeoff:
/// genuinely-independent streams can spuriously correlate at short length (false positive), with probability
/// shrinking as length grows. So the guarantee is: *exact source-reuse is always detected*; noisy reuse is
/// detected above a length/threshold curve. This is the attack-research surface — route to Aminata/Mateo
/// before any outward "Sybil-resistance via drift non-fungibility" claim. Not yet a proved theorem: a named
/// function + a falsifiable property + an attack program.
module AntiSybil =

    open ZetaCli

    /// Cross-stream agreement **beyond chance**, in `[0,1]`. Streams are truncated to the shorter length.
    /// `0` = independent (≈50% agreement); `1` = same source (perfect agreement **or** perfect
    /// anti-correlation — an inverted replay is still one source). Empty/length-≤-0 overlap ⇒ `0`.
    let correlation (a: int list) (b: int list) : float =
        let n = min (List.length a) (List.length b)
        if n <= 0 then
            0.0
        else
            let agree =
                List.zip (List.truncate n a) (List.truncate n b)
                |> List.sumBy (fun (x, y) -> if (x <> 0) = (y <> 0) then 1 else 0)
            let frac = float agree / float n
            abs (2.0 * frac - 1.0)

    /// Verdict of an anti-Sybil run over a set of claimed identities (indexed by position in the input).
    type SybilVerdict =
        { /// Number of claimed identities (input streams).
          ClaimedCount: int
          /// Number of genuinely-distinct entropy sources detected (connected components). The **forgery-cost
          /// floor**: to pass as `ClaimedCount`, the adversary needed at least this many independent clocks.
          DistinctCount: int
          /// Claimed-identity index → its source-component id (`0 .. DistinctCount-1`). Two indices sharing a
          /// component were forged from one source (Sybil).
          SourceOf: Map<int, int>
          /// True iff every claimed identity is its own source — no Sybil detected within budget.
          AllDistinct: bool }

    /// Run the anti-Sybil oracle: collapse claimed identities whose pairwise `correlation` meets `threshold`
    /// into shared sources (union-find), and report how many genuinely-distinct sources remain.
    ///
    /// **The guarantee:** an adversary emitting `streams` from `s` independent sources yields
    /// `DistinctCount ≤ s` — it cannot be seen as more distinct identities than it had sources (exact reuse ⇒
    /// `correlation = 1 ≥ threshold` ⇒ collapsed). Deterministic (DST §7).
    let antiSybil (threshold: float) (streams: int list list) : SybilVerdict =
        let k = List.length streams
        let arr = List.toArray streams
        // Union-find over claimed indices.
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                if correlation arr.[i] arr.[j] >= threshold then
                    union i j

        // Canonical component ids 0..d-1 in order of first appearance.
        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    /// The forgery-cost floor for a claimed identity set: the minimum number of independent entropy sources
    /// (clocks) an adversary needed to produce `streams` — i.e. `DistinctCount`. "Forging *k* identities costs
    /// ≥ this many clocks." Equal to `ClaimedCount` exactly when no Sybil is present.
    let forgeryCostFloor (threshold: float) (streams: int list list) : int =
        (antiSybil threshold streams).DistinctCount

    // ── CHSH escalation (2026-07-02, Addendum 4 of the name(name) doc) ──────────
    //
    // `correlation` above is a ONE-setting Bell correlator (|E|): sound for exact
    // replays, but a *strategic* forger can suppress a single-setting correlation.
    // The randomized-settings CHSH closes that gap: two systems with no live
    // channel and no shared seed cannot exceed |S| = 2 (Bell 1964; CHSH 1969) —
    // whatever per-setting strategy they run — so |S| > 2 CONVICTS a common cause
    // (shared seed or in-tick communication). Direction of inference is ONE-WAY
    // and stays stated: high |S| convicts sameness; low |S| never acquits
    // (firewalled puppets can decorrelate). Distinctness is proven by the other
    // legs of the identity definition (captured irreducible entropy + an exchange
    // history that model-checks), never by this oracle alone.

    /// One round of a CHSH identity probe: the SETTING this claimed identity was
    /// challenged with (0 or 1) and the ±1 OUTCOME it emitted.
    type ChshRound = { Setting: int; Outcome: int }

    /// Pairwise CHSH `S` from two per-round probe streams (truncated to the
    /// shorter). Rounds are bucketed by the setting pair; `E` per bucket is the
    /// mean outcome product; `S = E(0,0) − E(0,1) + E(1,0) + E(1,1)` via
    /// `BellTest.chshOf`. An EMPTY bucket contributes `E = 0` — degeneracy only
    /// ever weakens conviction (soundness-biased), never manufactures it.
    let chshS (a: ChshRound list) (b: ChshRound list) : float =
        let n = min (List.length a) (List.length b)
        if n <= 0 then
            0.0
        else
            let sums = Array.zeroCreate<float> 4
            let counts = Array.zeroCreate<int> 4
            List.zip (List.truncate n a) (List.truncate n b)
            |> List.iter (fun (ra, rb) ->
                let bucket = (ra.Setting &&& 1) * 2 + (rb.Setting &&& 1)
                let prod = float (sign ra.Outcome * sign rb.Outcome)
                sums.[bucket] <- sums.[bucket] + prod
                counts.[bucket] <- counts.[bucket] + 1)
            let e i = if counts.[i] = 0 then 0.0 else sums.[i] / float counts.[i]
            // Same combination as `BellTest.chshOf` (compiled later in Core, so
            // inlined here; agreement is locked by a cross-check test):
            // S = E(a,b) − E(a,b') + E(a',b) + E(a',b').
            e 0 - e 1 + e 2 + e 3

    /// The coordination-bandwidth estimator (geo-superdeterminism doc):
    /// `f̂ = (|S| − 2) / 2`, clamped to `[0, 1]` — the fraction of rounds on
    /// which a conductor's cross-setting instruction was effectively delivered.
    /// `0` = no in-tick coordination detected; `1` = fully conducted (PR-box).
    let coordinationBandwidth (s: float) : float =
        min 1.0 (max 0.0 ((abs s - 2.0) / 2.0))

    /// Run the CHSH identity oracle over a set of claimed identities: collapse
    /// every pair whose `|chshS|` exceeds `threshold` into a shared source,
    /// union-find, and report.
    ///
    /// **The guarantee (one-way, IN EXPECTATION):** E[S] > 2 is impossible for
    /// two systems sharing only past classical randomness with no in-tick
    /// channel (Bell 1964; CHSH 1969). `AllDistinct = true` means "no pair
    /// convicted", NEVER "all proven distinct". Deterministic (DST §7).
    ///
    /// **Finite-sample honesty (Soraya's finding, 2026-07-02):** the EMPIRICAL
    /// Ŝ of an honestly-local pair fluctuates around its expectation — a
    /// λ-mixing pair (shared past randomness alternating two deterministic S=2
    /// strategies) sits AT the bound with nonzero variance, so at
    /// `threshold = 2.0` exactly it is falsely convicted with probability ≈ 1/2
    /// at every run length. A sound conviction threshold is `2 + ε(n)` with
    /// ε(n) concentration-calibrated (Hoeffding-shaped, `c·sqrt(ln(1/δ)/n)`) —
    /// the calibrated gate is routed work (Soraya batch 2; BUGS.md). Until it
    /// lands, callers own the margin: pass `threshold = 2 + ε`, never bare 2.0,
    /// when false collapse has consequences.
    let chshSybil (threshold: float) (streams: ChshRound list list) : SybilVerdict =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                if abs (chshS arr.[i] arr.[j]) > threshold then
                    union i j

        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    /// Hoeffding-shaped conviction margin ε(n, δ) for the CHSH oracle (Soraya
    /// batch 2b — the calibration the BUGS.md P1 asked for). Derivation: each
    /// bucket mean of ±1 outcomes is sub-Gaussian with parameter 1/n_b; Ŝ is a
    /// ±-signed sum of the four independent bucket means, so its deviation is
    /// sub-Gaussian with parameter Σ 1/n_b ≈ 16/n under uniform probe settings
    /// (n_b ≈ n/4 — architectural: WE choose the settings, seeded uniform).
    /// P(Ŝ − E[Ŝ] ≥ ε) ≤ exp(−n·ε²/32) ⇒ ε(n, δ) = sqrt(32·ln(1/δ)/n).
    /// Scope: per-round-independent local strategies (shared λ i.i.d. across
    /// rounds); Hoeffding 1963, finite-statistics DI lineage Pironio et al. 2010.
    let chshMargin (delta: float) (rounds: int) : float =
        if rounds <= 0 || delta <= 0.0 || delta >= 1.0 then infinity
        else sqrt (32.0 * log (1.0 / delta) / float rounds)

    /// The CALIBRATED CHSH identity oracle: conviction at `2 + ε(n, δ)` with the
    /// pair's own run length, so an honestly-local pair at the bound is falsely
    /// convicted with probability ≤ δ (per pair) — the sound default the bare-
    /// threshold `chshSybil` is not. Same one-way inference: convicts sameness,
    /// never acquits. Deterministic (DST §7).
    let chshSybilCalibrated (delta: float) (streams: ChshRound list list) : SybilVerdict =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                let n = min (List.length arr.[i]) (List.length arr.[j])
                if abs (chshS arr.[i] arr.[j]) > 2.0 + chshMargin delta n then
                    union i j

        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    [<Literal>]
    let SeamName = "sim"

    /// Is this command on the `sim` seam (`zeta sim anti-sybil ...`)?
    let isSimCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
