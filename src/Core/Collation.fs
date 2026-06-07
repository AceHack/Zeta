namespace Zeta.Core

open System
open System.Collections.Generic

/// **Database-style collation selection** (B-0969). A collation is a *named, selectable ordering* — modeled
/// the way databases do it (SQL / Postgres `COLLATE`, ICU locales), NOT a raw `IComparer` knob exposed as
/// CS plumbing (maintainer 2026-06-07). We ship a **catalog** of named collations and **one default**,
/// chosen to be (i) identically supportable across all four oracle languages and (ii) familiar to database
/// people — both of which point to **binary / ordinal** (codepoint ≡ UTF-8 byte order; DB "binary
/// collation": `*_bin` / `BINARY` / Postgres `C`). Other collations (case-insensitive, invariant) are
/// **opt-in** catalog entries, never the silent default.
///
/// The chosen collation is **part of a value's identity** (comparer-is-part-of-identity — B-0969 strategy
/// (a)). The algebra-ladder primitives (G-Set → Bag → Z-set) resolve their string ordering through here
/// instead of the culture-SENSITIVE `Comparer<string>.Default` (the live B-0969 defect). The comparator
/// contract (ordinal / codepoint ≡ UTF-8 byte order) is the **collation treaty** every oracle + golden
/// vector conforms to — see `.claude/rules/culture-invariant-by-default.md`.
[<RequireQualifiedAccess>]
module Collation =

    /// The canonical default for STRING keys: ordinal (codepoint / byte order) = DB "binary collation".
    /// All four oracles coincide on this order for the golden vectors (F# ordinal, C#
    /// `StringComparer.Ordinal`, TS UTF-16 code-unit, Rust byte `Ord`); the astral/UTF-16 caveat is
    /// resolved by the treaty picking codepoint ≡ UTF-8 byte order.
    let binary: StringComparer = StringComparer.Ordinal

    /// The default collation name we ship with.
    [<Literal>]
    let defaultName = "binary"

    /// The named string-collation catalog (DB-style). `binary`/`ordinal` is the shipped default; the rest
    /// are opt-in. Case-insensitive + invariant are *linguistic* — selectable, never the default.
    let catalog: IReadOnlyDictionary<string, StringComparer> =
        let d = Dictionary<string, StringComparer>(StringComparer.OrdinalIgnoreCase)
        d.["binary"] <- StringComparer.Ordinal
        d.["ordinal"] <- StringComparer.Ordinal
        d.["ordinal-ci"] <- StringComparer.OrdinalIgnoreCase
        d.["invariant"] <- StringComparer.InvariantCulture
        d.["invariant-ci"] <- StringComparer.InvariantCultureIgnoreCase
        d :> IReadOnlyDictionary<string, StringComparer>

    /// Resolve a named collation from the catalog, or `None` if unknown (the caller decides the fallback —
    /// typically `binary`).
    let tryByName (name: string) : StringComparer option =
        match catalog.TryGetValue name with
        | true, c -> Some c
        | _ -> None

    /// Resolve a named collation, falling back to the `binary` default for an unknown name.
    let byNameOrDefault (name: string) : StringComparer =
        match tryByName name with
        | Some c -> c
        | None -> binary

    /// The DEFAULT comparer for an arbitrary key type `'T` — the value primitives use unless an explicit
    /// collation is selected. **Ordinal for `string`** (the B-0969 fix: never the culture-sensitive
    /// `Comparer<string>.Default`); `Comparer<'T>.Default` for every other `'T` (numbers etc. are already
    /// ordinal-equivalent, so the BCL default is correct + fast there).
    let forKey<'T> () : IComparer<'T> =
        if typeof<'T> = typeof<string> then
            unbox<IComparer<'T>> (box (StringComparer.Ordinal :> IComparer<string>))
        else
            Comparer<'T>.Default
