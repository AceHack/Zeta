namespace Zeta.Core

open System

/// **`CostarZSet` — the co-star link-set as a DBSP `ZSet` (Aaron 2026-06-19, shadow\*).**
///
/// The "reified over a bounded timeframe → plug into our own **ZSets** / **schema-evolution zero-downtime**"
/// leg. The co-star links of `ImdbDataset` become a **`ZSet<Link>`** where the **weight is the shared-title
/// count** — so **reverse-mint *is* a ZSet fold** (sum of per-title deltas), and the objective link rating
/// (`SharedTitles`) is just the accumulated weight.
///
/// Because it is a ZSet, the graph is **DBSP-incremental**: adding a title is a `+` delta (`addTitle`), and
/// removing one is the **Z-set antiparticle** (`removeTitle`, `−1` weights) — `add then remove = identity`,
/// and an incremental add equals a full recompute (IVM correctness). The link's **`DynamicValue`** form rides
/// **`SchemaEvolution`** for **zero-downtime** schema change (additive expand is forward/back compatible;
/// non-destructive contract via the dump).
[<RequireQualifiedAccess>]
module CostarZSet =

    /// A co-star link as a ZSet key: the unordered pair, stored ordinal `A ≤ B`. The ZSet **weight** carries the
    /// shared-title count, so the key is just the pair.
    type Link = { A: string; B: string }

    /// Canonical (ordinal-ordered) link for an unordered pair.
    let link (a: string) (b: string) : Link =
        if String.CompareOrdinal(a, b) <= 0 then { A = a; B = b } else { A = b; B = a }

    /// The co-star pairs contributed by ONE title, each at weight `+1` (the title's ZSet delta).
    let titleDelta (persons: string seq) : ZSet<Link> =
        let arr =
            persons |> Seq.distinct |> Seq.sortWith (fun a b -> String.CompareOrdinal(a, b)) |> Seq.toArray

        ZSet.ofSeq
            [ for i in 0 .. arr.Length - 1 do
                  for j in i + 1 .. arr.Length - 1 -> link arr.[i] arr.[j], 1L ]

    /// The accumulated co-star ZSet — **reverse-mint AS a ZSet fold** (sum of per-title deltas). Each link's
    /// weight = the number of shared titles (the objective rating).
    let ofPrincipals (principals: ImdbDataset.Principal list) : ZSet<Link> =
        principals
        |> List.groupBy (fun p -> p.Tconst)
        |> List.map (fun (_, ps) -> titleDelta (ps |> List.map (fun p -> p.Nconst)))
        |> ZSet.sum

    /// **Incremental add** of a title (DBSP delta): `z + titleDelta`. Equals a full recompute (IVM correctness).
    let addTitle (persons: string seq) (z: ZSet<Link>) : ZSet<Link> = ZSet.add z (titleDelta persons)

    /// **Incremental retraction** of a title (the Z-set antiparticle, `−1` weights): `add` then `remove` = identity.
    let removeTitle (persons: string seq) (z: ZSet<Link>) : ZSet<Link> =
        ZSet.add z (ZSet.scale -1L (titleDelta persons))

    /// Shared-title count (the rating) of a pair = the link's ZSet weight (`0` if absent).
    let sharedTitles (a: string) (b: string) (z: ZSet<Link>) : int64 = z.[link a b]

    /// A link + its rating as a `DynamicValue` record — the bridge to `SchemaEvolution` (zero-downtime schema
    /// change on the link shape).
    let toDynamicValue (rating: int64) (l: Link) : DynamicValue =
        DynamicValue.Object
            [ "a", DynamicValue.String l.A
              "b", DynamicValue.String l.B
              "sharedTitles", DynamicValue.Int rating ]
