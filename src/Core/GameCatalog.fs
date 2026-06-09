namespace Zeta.Core

/// **`GameCatalog` — per-game uncertainty keyed by the external fingerprint (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"our DynamicValue/SoftValue needs to be able to hold the **uncertainty per game** — assign game
/// uncertainty to an **identifiable location**."* The identifiable location is the `GameFingerprint` (the first
/// external index, #7154); the catalog maps **fingerprint → remaining uncertainty** for that game. This is the
/// external-index made into the uncertainty store: the system knows, per game, how much uncertainty is left to
/// reduce — which drives what to play next (`GamePortfolio.selectNext`) and when a game is *sufficiently* played
/// (`GamePortfolio` commutative regime, #7152).
///
/// The held quantity is a scalar **uncertainty** (e.g. the `SoftValue` entropy / `1 − confidence` for that game —
/// the catalog holds the *measure*; the full `SoftValue` is the source). Playing a game **reduces** its
/// uncertainty (monotone toward 0); a game at/below a threshold is **resolved** (sufficiently played).
///
/// **Honest scope (peel):** keyed by SHA-256 (exact-bytes identity — the No-Intro reality). Uncertainty is a
/// scalar projection of the per-game `SoftValue`; the full distribution lives in the engine, the catalog is the
/// index. An *uncatalogued* game returns `None` (unknown — not zero; not-known ≠ resolved, the good/bad-style
/// asymmetry #7150). `reduce` clamps at 0 (you can't go negative-uncertain). Deterministic (DST).
[<RequireQualifiedAccess>]
module GameCatalog =

    /// fingerprint SHA-256 → remaining uncertainty for that game.
    type Catalog = Map<string, float>

    let empty: Catalog = Map.empty

    /// Record a game's uncertainty under its fingerprint key.
    let assign (fp: GameFingerprint.Fingerprint) (uncertainty: float) (cat: Catalog) : Catalog =
        Map.add fp.Sha256 (max 0.0 uncertainty) cat

    /// Fingerprint a ROM and record its uncertainty (convenience).
    let assignRom (rom: byte[]) (uncertainty: float) (cat: Catalog) : Catalog =
        assign (GameFingerprint.fingerprint rom) uncertainty cat

    /// The recorded uncertainty for a game — `None` if uncatalogued (unknown ≠ zero/resolved).
    let uncertainty (fp: GameFingerprint.Fingerprint) (cat: Catalog) : float option = Map.tryFind fp.Sha256 cat

    /// **Reduce** a game's uncertainty (playing it) by `amount`, clamped at 0. No-op for uncatalogued games.
    let reduce (fp: GameFingerprint.Fingerprint) (amount: float) (cat: Catalog) : Catalog =
        match Map.tryFind fp.Sha256 cat with
        | Some u -> Map.add fp.Sha256 (max 0.0 (u - amount)) cat
        | None -> cat

    /// **Resolved** — uncertainty at/below `threshold` (sufficiently played). Uncatalogued ⇒ false (unknown, not
    /// resolved).
    let resolved (threshold: float) (fp: GameFingerprint.Fingerprint) (cat: Catalog) : bool =
        match Map.tryFind fp.Sha256 cat with
        | Some u -> u <= threshold
        | None -> false

    /// Total remaining game-uncertainty across the catalog (the system's outstanding uncertainty about games).
    let total (cat: Catalog) : float = cat |> Map.toSeq |> Seq.sumBy snd

    /// The catalogued game with the **most** remaining uncertainty — the play-next signal. `None` if empty.
    let mostUncertain (cat: Catalog) : (string * float) option =
        if Map.isEmpty cat then None else cat |> Map.toSeq |> Seq.maxBy snd |> Some
