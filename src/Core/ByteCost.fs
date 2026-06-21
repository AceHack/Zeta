namespace Zeta.Core

open System.Text
open System.Runtime.CompilerServices

/// Byte-cost of a context-startup surface: the UTF-8 byte length of its
/// canonical bytes. Slice 1 of 081KT7YW00008QG0R002T1XNWT (context-window minimization meter).
///
/// WHY bytes, not model tokens: bytes are deterministic and byte-lockable
/// across the four oracles (the golden-vectors harness); model tokenizers vary
/// by tokenizer/version and cannot enter the proof lineage. Bytes are a faithful
/// proxy; a bytes→tokens calibration layers on later.
///
/// `(ByteCost, add, Zero)` is a commutative monoid, so a fileset's total cost is
/// the order-independent sum of per-file costs — exactly what lets the DORA
/// aggregate be sound. Proven in tests/Tests.FSharp/Formal/ByteCost.Laws.Tests.fs
/// (Z3 symbolic + FsCheck on the real type). The meter only measures; it removes
/// no capability (NCI-safe by construction).
[<Struct>]
type ByteCost = { Bytes: int64 }

[<RequireQualifiedAccess>]
module ByteCost =

    /// Additive identity — the empty surface costs nothing.
    let Zero: ByteCost = { Bytes = 0L }

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let inline ofBytes (n: int64) : ByteCost = { Bytes = n }

    /// Monoid combine — checked addition of byte counts (counts never go
    /// negative, but Checked guards the int64 ceiling like the weight ring).
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let add (a: ByteCost) (b: ByteCost) : ByteCost = { Bytes = Checked.(+) a.Bytes b.Bytes }

    /// Measure a surface from its text: UTF-8 byte length (the canonical
    /// encoding for every context-startup file).
    let measureText (text: string) : ByteCost =
        { Bytes = int64 (Encoding.UTF8.GetByteCount text) }

    /// Measure already-encoded surface bytes directly.
    let measureBytes (bytes: byte[]) : ByteCost =
        { Bytes = int64 bytes.Length }

    /// Order-independent total of a fileset's costs (monoid fold over `add`).
    let sum (costs: ByteCost seq) : ByteCost = Seq.fold add Zero costs
