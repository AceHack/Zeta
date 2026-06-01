namespace Zeta.Core

/// RangeSet — the F# ferry (oracle #2 of TS/F#/C#/Rust) for the **RangeSet** primitive: a sparse
/// integer set in compact range notation (`"1-5,8,10-17"`). The TS reference
/// (`src/Core.TypeScript/range-set/`) authors the shared `golden-vectors.json`; this replays it:
/// `render (parse input)` equals the **canonical** form, and `contains` agrees. "The compilers
/// don't lie."
///
/// Canonical form (the cross-oracle byte-diff contract): ranges sorted, disjoint, NON-ADJACENT
/// (overlapping AND touching ranges coalesce, `1-3,4-6` → `1-6`), each emitted as `n` when
/// `lo = hi` else `lo-hi`, joined by `,` with no spaces; the empty set renders `""`. Non-negative
/// JS-safe integers (matching the shared int wire domain).
///
/// Result over throw: `parse` returns `Result<RangeSet, RangeSetFeedback>` (the rejection-vector
/// contract — a malformed token declines the SPECIFIC variant, matching across oracles).
module RangeSet =

    /// The shared JS-safe-integer ceiling (2^53 - 1) — the int wire domain (matches Bonsai).
    [<Literal>]
    let private MaxSafeInt = 9007199254740991L

    /// An inclusive integer range `(lo, hi)` with `lo <= hi`.
    type Range = int64 * int64

    /// A normalized set of ranges: sorted, disjoint, non-adjacent (the canonical invariant).
    type RangeSet = Range list

    /// The typed reasons `parse` declines — the shared cross-oracle rejection-vector contract.
    type RangeSetFeedback =
        /// A token (or sub-token) was not a non-negative safe integer.
        | NotInteger of token: string
        /// A range `lo-hi` had `lo > hi`.
        | InvertedRange of lo: int64 * hi: int64
        /// A structurally bad token (empty between commas, trailing comma, empty sub-token, too many dashes).
        | Malformed of token: string

    /// Parse a non-negative integer token strictly: digits only, within the safe-int range.
    let private parseNat (token: string) : int64 option =
        if token.Length > 0 && token |> Seq.forall (fun c -> c >= '0' && c <= '9') then
            match System.Int64.TryParse token with
            | true, n when n >= 0L && n <= MaxSafeInt -> Some n
            | _ -> None
        else
            None

    /// Normalize raw ranges into the canonical invariant: sort, then coalesce overlapping/adjacent.
    let private normalize (ranges: Range list) : RangeSet =
        ranges
        |> List.sortWith (fun (a0, a1) (b0, b1) -> if a0 <> b0 then compare a0 b0 else compare a1 b1)
        |> List.fold
            (fun acc (lo, hi) ->
                match acc with
                // coalesce when the next range overlaps OR touches the previous (lo <= phi + 1)
                | (plo, phi) :: rest when lo <= phi + 1L -> (plo, max phi hi) :: rest
                | _ -> (lo, hi) :: acc)
            []
        |> List.rev

    /// Parse compact range notation into a canonical `RangeSet`. Empty string → empty set.
    let parse (s: string) : Result<RangeSet, RangeSetFeedback> =
        let trimmed = s.Trim()

        if trimmed = "" then
            Ok []
        else
            let tokens = trimmed.Split(',')

            let rec loop i acc =
                if i >= Array.length tokens then
                    Ok(normalize (List.rev acc))
                else
                    let raw = tokens.[i]
                    let token = raw.Trim()

                    if token = "" then
                        Error(Malformed raw)
                    else
                        let parts = token.Split('-')

                        match parts.Length with
                        | 1 ->
                            match parseNat parts.[0] with
                            | Some n -> loop (i + 1) ((n, n) :: acc)
                            | None -> Error(NotInteger token)
                        | 2 ->
                            // an empty sub-token ("-3", "5-") is structurally missing, not a bad number
                            if parts.[0] = "" || parts.[1] = "" then
                                Error(Malformed token)
                            else
                                match parseNat parts.[0], parseNat parts.[1] with
                                | Some lo, Some hi -> if lo > hi then Error(InvertedRange(lo, hi)) else loop (i + 1) ((lo, hi) :: acc)
                                | None, _ -> Error(NotInteger parts.[0])
                                | _, None -> Error(NotInteger parts.[1])
                        | _ -> Error(Malformed token)

            loop 0 []

    /// Render a `RangeSet` to its canonical compact string.
    let render (rs: RangeSet) : string =
        rs
        |> List.map (fun (lo, hi) -> if lo = hi then string lo else sprintf "%d-%d" lo hi)
        |> String.concat ","

    /// Whether `n` is a member of the set (ranges are sorted, so the scan early-exits).
    let rec contains (rs: RangeSet) (n: int64) : bool =
        match rs with
        | [] -> false
        | (lo, hi) :: rest ->
            if n < lo then false
            elif n <= hi then true
            else contains rest n

    /// The union of two range sets, re-normalized to canonical form.
    let union (a: RangeSet) (b: RangeSet) : RangeSet = normalize (a @ b)

    /// Add a single integer to the set (returns a new canonical set).
    let add (rs: RangeSet) (n: int64) : RangeSet = normalize ((n, n) :: rs)

    /// The total count of integers covered by the set.
    let size (rs: RangeSet) : int64 = rs |> List.sumBy (fun (lo, hi) -> hi - lo + 1L)
