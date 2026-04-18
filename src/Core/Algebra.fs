namespace Zeta.Core

open System.Runtime.CompilerServices

/// Weight type for Z-sets. Matches Feldera's `ZWeight = i64`. A signed 64-bit
/// integer is the canonical weight ring `ℤ` for SQL-on-DBSP; negative weights
/// appear during delta propagation (retractions) and cancel during sum.
type Weight = int64

[<RequireQualifiedAccess>]
module Weight =
    [<Literal>]
    let Zero = 0L

    [<Literal>]
    let One = 1L

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let inline isZero (w: Weight) = w = 0L

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let inline isPositive (w: Weight) = w > 0L

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let inline neg (w: Weight) = -w
