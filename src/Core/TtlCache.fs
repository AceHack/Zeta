namespace Zeta.Core

/// **`TtlCache` — a time-to-live cache with an INJECTED clock (Aaron 2026-06-19, shadow\*).**
///
/// The "don't re-source every time / respect the sites" mechanism for the IMDb/Wikipedia type provider: cache
/// the **reified graphs** (e.g. `ImdbDataset.toCoEmpowerGraph`) keyed by source, valid for a TTL, so an
/// external source is hit **only on a miss or after expiry** — respecting the source sites' ToS / rate limits.
///
/// **In discipline:** the clock is **injected** — `now` is passed in, never an ambient local wall-clock read
/// (noninterference §13: entropy/time only through declared channels). Per the **Zeta-NTP** model, `now` is the
/// **soft phase-spacetime generated time** (the common-seed phase tick — the canonical soft base) **coupled
/// with UTC observables**: because these data sources are *on Earth*, **UTC (± uncertainty) is the best
/// Earth-time we have**, captured as a *correlated observation* of the soft phase, not as the base itself.
/// (The UTC ↔ common-seed-phase coupling has existing code/math/backlog —
/// `memory/project_zeta_ntp_phase_grounded_…`.) The cache is an **immutable `Map`** ⇒ lock-free, **idempotent**
/// (upsert by key), and **DST-replayable / byte-lockable** (same `now`/`ttl`/ops ⇒ same cache). "Bounded
/// timeframe" = the TTL window (in phase-time, UTC-anchored) the data is reified over.
[<RequireQualifiedAccess>]
module TtlCache =

    /// A cached value + the tick at which it expires (exclusive: live while `now < ExpiresAt`).
    type Entry<'V> = { Value: 'V; ExpiresAt: int64 }

    /// Immutable cache: key → entry.
    type Cache<'K, 'V when 'K: comparison> = Map<'K, Entry<'V>>

    let empty<'K, 'V when 'K: comparison> : Cache<'K, 'V> = Map.empty

    /// Insert/refresh `key` with `value`, valid for `ttl` ticks from `now`. Idempotent (upsert by key).
    let put (now: int64) (ttl: int64) (key: 'K) (value: 'V) (cache: Cache<'K, 'V>) : Cache<'K, 'V> =
        Map.add key { Value = value; ExpiresAt = now + ttl } cache

    /// Look up `key` as of `now`: `Some value` iff present **and** not expired (`now < ExpiresAt`); else `None`.
    let tryGet (now: int64) (key: 'K) (cache: Cache<'K, 'V>) : 'V option =
        match Map.tryFind key cache with
        | Some e when now < e.ExpiresAt -> Some e.Value
        | _ -> None

    /// **Get-or-source:** return the cached value if live; else call `source` (the expensive / site-hitting
    /// reifier — invoked **only** on miss/expiry, the rate-respecting path), cache it for `ttl`, and return both.
    let getOrSource
        (now: int64)
        (ttl: int64)
        (key: 'K)
        (source: unit -> 'V)
        (cache: Cache<'K, 'V>)
        : 'V * Cache<'K, 'V> =
        match tryGet now key cache with
        | Some v -> v, cache
        | None ->
            let v = source ()
            v, put now ttl key v cache

    /// Drop expired entries (optional housekeeping; `tryGet` already treats expired as absent).
    let evictExpired (now: int64) (cache: Cache<'K, 'V>) : Cache<'K, 'V> =
        cache |> Map.filter (fun _ e -> now < e.ExpiresAt)

    /// Count of live (non-expired) entries as of `now`.
    let liveCount (now: int64) (cache: Cache<'K, 'V>) : int =
        cache |> Map.filter (fun _ e -> now < e.ExpiresAt) |> Map.count
