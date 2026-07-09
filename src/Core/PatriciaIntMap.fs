namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Numerics
open System.Runtime.CompilerServices

/// A per-key group inside an `IndexedZSet`. Immutable struct, span-friendly.
[<Struct; IsReadOnly; NoComparison>]
type KeyGroup<'K, 'V when 'K : comparison and 'V : comparison> =
    val Key: 'K
    val Values: ZSet<'V>
    new(key, values) = { Key = key; Values = values }

[<Struct; NoComparison; NoEquality>]
type KeyGroupComparer<'K, 'V when 'K : comparison and 'V : comparison> =
    interface IComparer<KeyGroup<'K, 'V>> with
        member _.Compare(a: KeyGroup<'K, 'V>, b: KeyGroup<'K, 'V>) =
            KeyComparerCache<'K>.Instance.Compare(a.Key, b.Key)

/// A persistent big-endian Patricia trie for integer keys,
/// based on Okasaki & Gill's "Fast Mergeable Integer Maps".
[<NoEquality; NoComparison>]
type PatriciaTree<'K, 'V when 'K : comparison and 'V : comparison> =
    | Nil
    | Tip of keyHash: uint64 * KeyGroup: KeyGroup<'K, 'V>
    | Bin of prefix: uint64 * mask: uint64 * left: PatriciaTree<'K, 'V> * right: PatriciaTree<'K, 'V>

module PatriciaInt =

    let inline zero (key: uint64) (mask: uint64) : bool =
        (key &&& mask) = 0UL

    let inline nomatch (key: uint64) (prefix: uint64) (mask: uint64) : bool =
        let mask' = mask - 1UL
        let prefixMask = ~~~(mask' ||| mask)
        (key &&& prefixMask) <> prefix

    let inline branchingBit (p1: uint64) (p2: uint64) : uint64 =
        let diff = p1 ^^^ p2
        if diff = 0UL then 0UL
        else 1UL <<< (63 - BitOperations.LeadingZeroCount(diff))

    let join (p1: uint64) (t1: PatriciaTree<'K, 'V>) (p2: uint64) (t2: PatriciaTree<'K, 'V>) : PatriciaTree<'K, 'V> =
        let m = branchingBit p1 p2
        let p = p1 &&& ~~~(m ||| (m - 1UL))
        if zero p1 m then
            Bin(p, m, t1, t2)
        else
            Bin(p, m, t2, t1)

    let rec insert (keyHash: uint64) (group: KeyGroup<'K, 'V>) (tree: PatriciaTree<'K, 'V>) : PatriciaTree<'K, 'V> =
        match tree with
        | Nil -> Tip(keyHash, group)
        | Tip(h, g) ->
            if h = keyHash then
                Tip(keyHash, group)
            else
                join keyHash (Tip(keyHash, group)) h (Tip(h, g))
        | Bin(p, m, l, r) ->
            if nomatch keyHash p m then
                join keyHash (Tip(keyHash, group)) p tree
            else
                if zero keyHash m then
                    Bin(p, m, insert keyHash group l, r)
                else
                    Bin(p, m, l, insert keyHash group r)

    let rec tryFind (keyHash: uint64) (tree: PatriciaTree<'K, 'V>) : KeyGroup<'K, 'V> option =
        match tree with
        | Nil -> None
        | Tip(h, g) ->
            if h = keyHash then Some g else None
        | Bin(p, m, l, r) ->
            if nomatch keyHash p m then None
            elif zero keyHash m then tryFind keyHash l
            else tryFind keyHash r

    let rec remove (keyHash: uint64) (tree: PatriciaTree<'K, 'V>) : PatriciaTree<'K, 'V> =
        match tree with
        | Nil -> Nil
        | Tip(h, g) ->
            if h = keyHash then Nil else tree
        | Bin(p, m, l, r) ->
            if nomatch keyHash p m then tree
            else
                if zero keyHash m then
                    let l' = remove keyHash l
                    match l' with
                    | Nil -> r
                    | _ -> Bin(p, m, l', r)
                else
                    let r' = remove keyHash r
                    match r' with
                    | Nil -> l
                    | _ -> Bin(p, m, l, r')

    let rec merge (resolve: KeyGroup<'K, 'V> -> KeyGroup<'K, 'V> -> KeyGroup<'K, 'V>) (t1: PatriciaTree<'K, 'V>) (t2: PatriciaTree<'K, 'V>) : PatriciaTree<'K, 'V> =
        match t1, t2 with
        | Nil, t -> t
        | t, Nil -> t
        | Tip(h1, g1), t2 ->
            let rec insertTip t =
                match t with
                | Nil -> Tip(h1, g1)
                | Tip(h2, g2) ->
                    if h1 = h2 then Tip(h1, resolve g1 g2)
                    else join h1 (Tip(h1, g1)) h2 (Tip(h2, g2))
                | Bin(p2, m2, l2, r2) ->
                    if nomatch h1 p2 m2 then
                        join h1 (Tip(h1, g1)) p2 t
                    else
                        if zero h1 m2 then
                            Bin(p2, m2, insertTip l2, r2)
                        else
                            Bin(p2, m2, l2, insertTip r2)
            insertTip t2
        | t1, Tip(h2, g2) ->
            let rec insertTip t =
                match t with
                | Nil -> Tip(h2, g2)
                | Tip(h1, g1) ->
                    if h1 = h2 then Tip(h1, resolve g1 g2)
                    else join h1 (Tip(h1, g1)) h2 (Tip(h2, g2))
                | Bin(p1, m1, l1, r1) ->
                    if nomatch h2 p1 m1 then
                        join h2 (Tip(h2, g2)) p1 t
                    else
                        if zero h2 m1 then
                            Bin(p1, m1, insertTip l1, r1)
                        else
                            Bin(p1, m1, l1, insertTip r1)
            insertTip t1
        | Bin(p1, m1, l1, r1), Bin(p2, m2, l2, r2) ->
            if m1 < m2 then
                if nomatch p1 p2 m2 then
                    join p1 t1 p2 t2
                else
                    if zero p1 m2 then
                        Bin(p2, m2, merge resolve t1 l2, r2)
                    else
                        Bin(p2, m2, l2, merge resolve t1 r2)
            elif m1 > m2 then
                if nomatch p2 p1 m1 then
                    join p1 t1 p2 t2
                else
                    if zero p2 m1 then
                        Bin(p1, m1, merge resolve l1 t2, r1)
                    else
                        Bin(p1, m1, l1, merge resolve r1 t2)
            else
                if p1 = p2 then
                    Bin(p1, m1, merge resolve l1 l2, merge resolve r1 r2)
                else
                    join p1 t1 p2 t2

    let toList (tree: PatriciaTree<'K, 'V>) : KeyGroup<'K, 'V> list =
        let rec loop t acc =
            match t with
            | Nil -> acc
            | Tip(h, g) -> g :: acc
            | Bin(p, m, l, r) -> loop l (loop r acc)
        loop tree []

    let rec count (tree: PatriciaTree<'K, 'V>) : int =
        match tree with
        | Nil -> 0
        | Tip(_, _) -> 1
        | Bin(_, _, l, r) -> count l + count r
