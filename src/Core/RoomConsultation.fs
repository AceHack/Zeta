namespace Zeta.Core

open System
open System.Numerics

/// Reuse a previously verified deterministic transition without hiding its cost.
///
/// The kernel is deliberately independent of CHIP-8, ARC, Atari, storage, and the
/// scheduler. A room supplies one transition, one boundary predicate, and an
/// injected lookup port. That keeps memoization a declared input rather than an
/// ambient cache and gives each language port the same small treaty to implement.
[<RequireQualifiedAccess>]
module RoomConsultation =

    type Feedback =
        | NegativeRequestedUnits of units: int
        | NegativeLookupBytesPerAttempt of bytes: int64
        | NegativeComputeBytesPerUnit of bytes: int64
        | CostPolicyUnattributed

    /// Projected costs are policy inputs, not measurements invented by the kernel.
    /// Attribution is mandatory because a limit or estimate must never become a
    /// silent source of truth.
    type CostPolicy =
        { LookupBytesPerAttempt: int64
          ComputeBytesPerUnit: int64
          Attribution: string }

    /// An injected, deterministic one-transition lookup. `None` is an ordinary
    /// miss; the caller still owns the transition function and computes it.
    type Port<'State> =
        { TryAdvanceOne: 'State -> 'State option }

    type StopReason =
        | Completed
        | Boundary

    /// Exact work counts plus projected byte economics. BigInteger keeps long
    /// horizons honest without overflow, exceptions, or saturated arithmetic.
    type Receipt =
        { RequestedUnits: int
          ReusedUnits: int
          ComputedUnits: int
          LookupAttempts: int
          StopReason: StopReason
          ProjectedLookupBytes: BigInteger
          ProjectedComputeBytes: BigInteger
          ProjectedAvoidedComputeBytes: BigInteger
          /// Savings relative to computing every reused unit, after lookup cost.
          ProjectedNetSavedBytes: BigInteger
          CostAttribution: string }

    type Advance<'State> =
        { State: 'State
          Receipt: Receipt }

    let validateCostPolicy (policy: CostPolicy) : Result<CostPolicy, Feedback> =
        if policy.LookupBytesPerAttempt < 0L then
            Error(NegativeLookupBytesPerAttempt policy.LookupBytesPerAttempt)
        elif policy.ComputeBytesPerUnit < 0L then
            Error(NegativeComputeBytesPerUnit policy.ComputeBytesPerUnit)
        elif String.IsNullOrWhiteSpace policy.Attribution then
            Error CostPolicyUnattributed
        else
            Ok policy

    /// Advance at most `requestedUnits`, stopping before a boundary. Every
    /// completed unit is either reused or computed, never both and never neither.
    /// Cost validation happens before the port or transition function is called.
    let advance
        (policy: CostPolicy)
        (isBoundary: 'State -> bool)
        (computeOne: 'State -> 'State)
        (port: Port<'State>)
        (requestedUnits: int)
        (initial: 'State)
        : Result<Advance<'State>, Feedback> =
        if requestedUnits < 0 then
            Error(NegativeRequestedUnits requestedUnits)
        else
            validateCostPolicy policy
            |> Result.map (fun validPolicy ->
                let mutable state = initial
                let mutable reused = 0
                let mutable computed = 0
                let mutable attempts = 0
                let mutable boundary = false

                while reused + computed < requestedUnits && not boundary do
                    if isBoundary state then
                        boundary <- true
                    else
                        attempts <- attempts + 1
                        match port.TryAdvanceOne state with
                        | Some next ->
                            state <- next
                            reused <- reused + 1
                        | None ->
                            state <- computeOne state
                            computed <- computed + 1

                let lookupBytes = BigInteger attempts * BigInteger validPolicy.LookupBytesPerAttempt
                let computeBytes = BigInteger computed * BigInteger validPolicy.ComputeBytesPerUnit
                let avoidedBytes = BigInteger reused * BigInteger validPolicy.ComputeBytesPerUnit

                { State = state
                  Receipt =
                    { RequestedUnits = requestedUnits
                      ReusedUnits = reused
                      ComputedUnits = computed
                      LookupAttempts = attempts
                      StopReason = if boundary then Boundary else Completed
                      ProjectedLookupBytes = lookupBytes
                      ProjectedComputeBytes = computeBytes
                      ProjectedAvoidedComputeBytes = avoidedBytes
                      ProjectedNetSavedBytes = avoidedBytes - lookupBytes
                      CostAttribution = validPolicy.Attribution } })
