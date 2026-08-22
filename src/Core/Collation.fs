namespace Zeta.Core

open System
open System.Collections.Generic
open System.Text

/// A StringComparer that orders strings ordinally by Unicode code point (Rune) value (081KT07NV0008QG0R001YDB73K).
/// Matches TS's true Unicode code point comparison, resolving the UTF-16 surrogate pair discrepancy.
type UnicodeCodePointComparer(ignoreCase: bool) =
    inherit StringComparer()
    
    static member val Ordinal = UnicodeCodePointComparer(false)
    static member val OrdinalIgnoreCase = UnicodeCodePointComparer(true)

    override this.Compare(x: string, y: string) =
        if obj.ReferenceEquals(x, y) then 0
        elif isNull x then -1
        elif isNull y then 1
        else
            let mutable enumX = x.EnumerateRunes()
            let mutable enumY = y.EnumerateRunes()
            let mutable result = 0
            let mutable loop = true
            while loop do
                let hasX = enumX.MoveNext()
                let hasY = enumY.MoveNext()
                if not hasX && not hasY then
                    result <- 0
                    loop <- false
                elif not hasX then
                    result <- -1
                    loop <- false
                elif not hasY then
                    result <- 1
                    loop <- false
                else
                    let mutable runeX = enumX.Current
                    let mutable runeY = enumY.Current
                    if ignoreCase then
                        runeX <- Rune.ToLowerInvariant(runeX)
                        runeY <- Rune.ToLowerInvariant(runeY)
                    if runeX.Value < runeY.Value then
                        result <- -1
                        loop <- false
                    elif runeX.Value > runeY.Value then
                        result <- 1
                        loop <- false
            result

    override this.Equals(x: string, y: string) =
        if obj.ReferenceEquals(x, y) then true
        elif isNull x || isNull y then false
        else
            let comp = if ignoreCase then StringComparison.OrdinalIgnoreCase else StringComparison.Ordinal
            String.Equals(x, y, comp)

    override this.GetHashCode(obj: string) =
        if isNull obj then raise (ArgumentNullException("obj"))
        let comp = if ignoreCase then StringComparison.OrdinalIgnoreCase else StringComparison.Ordinal
        obj.GetHashCode(comp)



/// **Database-style collation selection** (081KT07NV0008QG0R001YDB73K). A collation is a *named, selectable ordering* — modeled
/// the way databases do it (SQL / Postgres `COLLATE`, ICU locales), NOT a raw `IComparer` knob exposed as
/// CS plumbing (maintainer 2026-06-07). We ship a **catalog** of named collations and **one default**,
/// chosen to be (i) identically supportable across all four oracle languages and (ii) familiar to database
/// people — both of which point to **binary / ordinal** (codepoint ≡ UTF-8 byte order; DB "binary
/// collation": `*_bin` / `BINARY` / Postgres `C`). Other collations (case-insensitive, invariant) are
/// **opt-in** catalog entries, never the silent default.
///
/// The chosen collation is **part of a value's identity** (comparer-is-part-of-identity — 081KT07NV0008QG0R001YDB73K strategy
/// (a)). The algebra-ladder primitives (G-Set → Bag → Z-set) resolve their string ordering through here
/// instead of the culture-SENSITIVE `Comparer<string>.Default` (the live 081KT07NV0008QG0R001YDB73K defect). The comparator
/// contract (ordinal / codepoint ≡ UTF-8 byte order) is the **collation treaty** every oracle + golden
/// vector conforms to — see `.claude/rules/culture-invariant-by-default.md`.
[<RequireQualifiedAccess>]
module Collation =

    /// The canonical default for STRING keys: codepoint / UTF-8 byte order = DB "binary collation".
    /// This differs from .NET `StringComparer.Ordinal` for non-BMP characters because ordinal compares
    /// UTF-16 code units. The treaty comparator compares Unicode scalar values.
    let binary: StringComparer = UnicodeCodePointComparer.Ordinal :> StringComparer

    /// The default collation name we ship with.
    [<Literal>]
    let defaultName = "binary"

    /// The named string-collation catalog (DB-style). `binary`/`ordinal` is the shipped default; the rest
    /// are opt-in. Case-insensitive + invariant are *linguistic* — selectable, never the default.
    let catalog: IReadOnlyDictionary<string, StringComparer> =
        let d = Dictionary<string, StringComparer>(StringComparer.OrdinalIgnoreCase)
        d.["binary"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["ordinal"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["ordinal-ci"] <- UnicodeCodePointComparer.OrdinalIgnoreCase :> StringComparer
        d.["invariant"] <- StringComparer.InvariantCulture
        d.["invariant-ci"] <- StringComparer.InvariantCultureIgnoreCase
        
        // Postgres / Standard SQL aliases
        d.["C"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["POSIX"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["utf8_bin"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["utf8mb4_bin"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        
        // SQLite alias
        d.["NOCASE"] <- UnicodeCodePointComparer.OrdinalIgnoreCase :> StringComparer
        
        // MySQL aliases
        d.["utf8_general_ci"] <- UnicodeCodePointComparer.OrdinalIgnoreCase :> StringComparer
        d.["utf8mb4_general_ci"] <- UnicodeCodePointComparer.OrdinalIgnoreCase :> StringComparer
        d.["utf8_unicode_ci"] <- StringComparer.InvariantCultureIgnoreCase
        d.["utf8mb4_unicode_ci"] <- StringComparer.InvariantCultureIgnoreCase
        
        // SQL Server aliases. See
        // `docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md`.
        //
        // EXACT: `_BIN2_UTF8` stores as UTF-8, which has no surrogates, so its BIN2 sort is TRUE
        // code-point order (Unicode Standard 2.5.3: "A binary sort of UTF-8 strings gives the same
        // ordering as a binary sort of Unicode code points"). This is the one SQL Server name that
        // denotes exactly our canonical collation — it is what a DBA should be told to use.
        d.["Latin1_General_100_BIN2_UTF8"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        // APPROXIMATE — agrees with us on the BMP, DIVERGES above it. `BIN2` over `nvarchar`
        // (UTF-16) compares per WCHAR, i.e. by UTF-16 code UNIT, not code point (Microsoft's own
        // "pure code-point comparison" label contradicts its own stated mechanism; Unicode 2.5.2
        // says UTF-16 binary order is not code-point order for supplementary characters). Legacy
        // `_BIN` is weaker still: first character by code point, then raw byte-by-byte.
        d.["Latin1_General_100_BIN2"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["Latin1_General_BIN"] <- UnicodeCodePointComparer.Ordinal :> StringComparer
        d.["Latin1_General_CI_AS"] <- StringComparer.InvariantCultureIgnoreCase
        d.["Latin1_General_CS_AS"] <- StringComparer.InvariantCulture
        
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
    /// collation is selected. **Ordinal for `string`** (the 081KT07NV0008QG0R001YDB73K fix: never the culture-sensitive
    /// `Comparer<string>.Default`); `Comparer<'T>.Default` for every other `'T` (numbers etc. are already
    /// ordinal-equivalent, so the BCL default is correct + fast there).
    let forKey<'T> () : IComparer<'T> =
        if typeof<'T> = typeof<string> then
            unbox<IComparer<'T>> (box (UnicodeCodePointComparer.Ordinal :> IComparer<string>))
        else
            Comparer<'T>.Default

[<AbstractClass; Sealed>]
type internal KeyComparerCache<'T when 'T : comparison> =
    static member val Instance: IComparer<'T> = Collation.forKey<'T> ()
