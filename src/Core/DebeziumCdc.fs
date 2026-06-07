namespace Zeta.Core

/// **Debezium CDC ↔ DBSP Z-set delta — read & write the Debezium change-event format (081KTH0WQ3C).**
///
/// Debezium's change-event envelope (`before`/`after`/`op`/`source`/`ts_ms`) is **a Z-set delta in
/// disguise** (Aaron 2026-06-07; anchor: Debezium / Red Hat, CDC):
///   `c` create → `+1·after`   ·   `d` delete → `−1·before`   ·   `u` update → `−1·before +1·after`
///   `r` snapshot-read → `+1·after`   ·   `t` truncate → retract-all (needs the full key set; see note).
/// So we get **huge ecosystem interop**: read a Debezium stream straight into Z-set deltas, and emit our
/// deltas as Debezium events. Lossless at the *delta* level; an `update` round-trips through the Z-set as a
/// `delete`+`create` pair (the Z-set is a multiset of rows, not row-identity-tracked — the honest semantics
/// of CDC-as-Z-set). Wrap in a CloudEvents envelope on the bus (separate, follow-up).
///
/// Generic over the row type `'K` (which must be a Z-set key, i.e. `comparison`). Debezium rows are
/// `DynamicValue`-shaped; since `DynamicValue` is `NoComparison`, the caller keys rows by a canonical
/// encoding (e.g. canonical-CBOR bytes / the `ZSetMerkle` leaf) — that wiring is the integration follow-up.
[<RequireQualifiedAccess>]
module DebeziumCdc =

    /// The Debezium operation code.
    type Op =
        | Create // "c"
        | Update // "u"
        | Delete // "d"
        | Read // "r" (snapshot)
        | Truncate // "t"

    /// Map an op code string to/from `Op` (the on-the-wire `op` field).
    let opOfCode (code: string) : Op option =
        match code with
        | "c" -> Some Create
        | "u" -> Some Update
        | "d" -> Some Delete
        | "r" -> Some Read
        | "t" -> Some Truncate
        | _ -> None

    let codeOfOp (op: Op) : string =
        match op with
        | Create -> "c"
        | Update -> "u"
        | Delete -> "d"
        | Read -> "r"
        | Truncate -> "t"

    /// A Debezium change event over a row of type `'K` (`source`/`ts_ms` ride as metadata, elsewhere).
    type ChangeEvent<'K> =
        { Op: Op
          Before: 'K option
          After: 'K option }

    /// **READ: Debezium change event → Z-set delta** (rows ARE the keys).
    /// `Truncate` returns the empty delta — a truncate retracts the whole relation and can't be expressed
    /// as a bounded delta without the current key set (handle truncate at the stream/store level).
    let toZSetDelta (e: ChangeEvent<'K>) : ZSet<'K> =
        let plus (v: 'K) = ZSet.singleton v 1L
        let minus (v: 'K) = ZSet.singleton v -1L
        match e.Op, e.Before, e.After with
        | Create, _, Some a -> plus a
        | Read, _, Some a -> plus a
        | Delete, Some b, _ -> minus b
        | Update, Some b, Some a -> minus b + plus a
        | Update, None, Some a -> plus a // degenerate update with no before
        | _, _, _ -> ZSet.Empty

    /// **WRITE: Z-set delta → Debezium change events.** Each positive-weight row → `create` (repeated by
    /// multiplicity); each negative-weight row → `delete`. Updates are emitted as a delete+create pair
    /// (Z-set deltas don't carry row-identity to re-pair an `update`) — delta-equivalent to the input.
    let ofZSetDelta (delta: ZSet<'K>) : ChangeEvent<'K> list =
        [ for entry in delta do
              let w = entry.Weight
              if w > 0L then
                  for _ in 1L .. w -> { Op = Create; Before = None; After = Some entry.Key }
              elif w < 0L then
                  for _ in 1L .. (-w) -> { Op = Delete; Before = Some entry.Key; After = None } ]

    let create (after: 'K) : ChangeEvent<'K> = { Op = Create; Before = None; After = Some after }
    let delete (before: 'K) : ChangeEvent<'K> = { Op = Delete; Before = Some before; After = None }
    let update (before: 'K) (after: 'K) : ChangeEvent<'K> = { Op = Update; Before = Some before; After = Some after }
