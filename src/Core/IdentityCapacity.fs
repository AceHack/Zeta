namespace Zeta.Core

/// **`IdentityCapacity` — identity count = bits of uncertainty (qubits); a self-imposable complexity bound (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"identity is an **entropy-bounded** thing in our system, not a flags-enum combinatorial on hats… the
/// number of identities is directly tied to the uncertainty in the system; the **bits of uncertainty = the number
/// of available identities**, and it can also tell us **when we run out of qubits and need more — we can
/// complexity-bound ourselves**."*
///
/// So identity capacity is **`2^(bits of uncertainty)`**, not the flags-enum `2^(num hats)`: private state
/// (#7148) supplies *additional* bits beyond the hat-flags, so identity is bounded by the **total entropy
/// (qubits)** available, which the hat enum is only a floor of. The bits/qubits *are* the identity capacity:
///   - `capacity bits = 2^bits` — identities representable with that many bits of uncertainty (qubits);
///   - `bitsNeeded n = ⌈log2 n⌉` — qubits needed to hold `n` distinct identities;
///   - `outOfQubits` / `qubitsShort` — when you've exhausted your bits and need more (the "need more qubits" signal);
///   - and the **complexity self-bound:** distinct identities ≤ `capacity (identityBits …)` — you can *bound your
///     own* identity space by your qubit count.
///
/// **Honest scope (peel):** classical bit-counting (each qubit ≈ 1 bit of *distinguishable* identity capacity —
/// the classical readout, not exploiting superposition; ties to the controller-qubit #7140 as the unit of
/// identity-uncertainty). `int` capacity saturates near 2^31. Generic over the identity type (equality).
/// Deterministic (DST). The flags-enum bound (`flagsEnumBound`) is the *without-private* floor it lifts above.
[<RequireQualifiedAccess>]
module IdentityCapacity =

    /// Identities representable with `bits` of uncertainty (qubits): `2^bits` (saturates near 2^31).
    let capacity (bits: int) : int =
        if bits <= 0 then 1
        elif bits >= 31 then System.Int32.MaxValue
        else 1 <<< bits

    /// Bits of uncertainty (qubits) needed to represent `n` distinct identities = `⌈log2 n⌉` (integer, exact).
    let bitsNeeded (n: int) : int =
        if n <= 1 then 0
        else
            let mutable b = 0
            while capacity b < n do
                b <- b + 1
            b

    /// The flags-enum bound (WITHOUT private state): `2^numHats` identities — the combinatorial floor that private
    /// state lifts above.
    let flagsEnumBound (numHats: int) : int = capacity numHats

    // ---- the qubit taxonomy (Aaron 2026-06-08): hats EMERGE from games; meta-hats persist = the decision points ----

    /// **Hat qubits.** In our system **hats *emerge* from the games played** — most are game-specific
    /// (`Hat.Scope.GameSpecific`, transient). A few **persist across games** (`Hat.Scope.Meta`) — and *those meta
    /// hats are the real decision points* where the **human wants to be involved** (governance / standing-auth gate;
    /// the persistent identity dimensions). `hatBits` counts the hat dimensions of identity (the flags-enum bits).
    let hatBits (numHats: int) : int = max 0 numHats

    /// **Private-state qubits** — the emergent identity beyond the hats (#7148; earned via the privacy economy #7149).
    let privateBits (bits: int) : int = max 0 bits

    /// **Total identity qubits = hat bits + private bits** — *"personas use qubits for emergent identities"*. A
    /// persona's identity capacity is `2^(totalBits …)`: hats (mostly emergent, meta-hats persistent = the
    /// decision points) plus the emergent private-state lift.
    let totalBits (numHats: int) (privateStateBits: int) : int = hatBits numHats + privateBits privateStateBits

    /// Distinct realized identities (e.g. the `(hatFlags, private)` pairs of a population).
    let distinctIdentities (identities: 'id list) : int = identities |> List.distinct |> List.length

    /// Realized bits of identity uncertainty = qubits currently in use.
    let identityBits (identities: 'id list) : int = bitsNeeded (distinctIdentities identities)

    /// **Out of qubits?** Do you need more bits than `availableBits` provide for `neededIdentities`?
    let outOfQubits (availableBits: int) (neededIdentities: int) : bool =
        neededIdentities > capacity availableBits

    /// How many *more* qubits to add to hold `neededIdentities` given `availableBits` now (0 if you have enough).
    let qubitsShort (availableBits: int) (neededIdentities: int) : int =
        max 0 (bitsNeeded neededIdentities - availableBits)
