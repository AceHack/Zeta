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

    [<Literal>]
    let SeamName = "sim"

    /// Is this command on the `sim` seam (`zeta sim anti-sybil ...`)?
    let isSimCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
