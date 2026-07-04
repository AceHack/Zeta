namespace Zeta.Core.Sql

open System
open Zeta.Core

/// Represents a schema-typed stream (relation) in the Zeta DBSP runtime.
type Relation<'Schema when 'Schema : comparison> =
    { Stream: ZSet<'Schema> }

/// Builder for the `zeta` query computation expression.
type ZetaQueryBuilder() =
    member _.For(r: Relation<'T>, f: 'T -> Relation<'U>) : Relation<'U> when 'T : comparison and 'U : comparison =
        let result = ResizeArray<ZEntry<'U>>()
        for entryT in r.Stream do
            let relU = f entryT.Key
            for entryU in relU.Stream do
                let weight = Checked.( * ) entryT.Weight entryU.Weight
                result.Add(ZEntry(entryU.Key, weight))
        { Stream = ZSet(Pool.Freeze (result.ToArray())) }

    member _.Yield(x: 'T) : Relation<'T> when 'T : comparison =
        { Stream = ZSet(System.Collections.Immutable.ImmutableArray.Create(ZEntry(x, 1L))) }

    member _.YieldFrom(r: Relation<'T>) : Relation<'T> when 'T : comparison = r

    [<CustomOperation("where", MaintainsVariableSpace = true)>]
    member _.Where(r: Relation<'T>, [<ProjectionParameter>] predicate: 'T -> bool) : Relation<'T> when 'T : comparison =
        let filtered = 
            r.Stream
            |> Seq.filter (fun entry -> predicate entry.Key)
            |> Seq.toArray
        { Stream = ZSet(Pool.Freeze filtered) }

    [<CustomOperation("select")>]
    member _.Select(r: Relation<'T>, [<ProjectionParameter>] projection: 'T -> 'U) : Relation<'U> when 'T : comparison and 'U : comparison =
        let mapped =
            r.Stream
            |> Seq.map (fun entry -> ZEntry(projection entry.Key, entry.Weight))
            |> Seq.toArray
        { Stream = ZSet(Pool.Freeze mapped) }

    [<CustomOperation("join")>]
    member _.Join(relR: Relation<'R>, 
                  relS: Relation<'S>, 
                  keySelectorR: 'R -> 'Key, 
                  keySelectorS: 'S -> 'Key, 
                  projector: 'R -> 'S -> 'Result) : Relation<'Result> when 'R : comparison and 'S : comparison and 'Key : comparison and 'Result : comparison =
        let mapR = relR.Stream |> Seq.groupBy (fun e -> keySelectorR e.Key) |> Map.ofSeq
        let result = ResizeArray<ZEntry<'Result>>()
        
        for entryS in relS.Stream do
            let key = keySelectorS entryS.Key
            match mapR.TryFind key with
            | Some entriesR ->
                for entryR in entriesR do
                    let weight = Checked.( * ) entryR.Weight entryS.Weight
                    let resVal = projector entryR.Key entryS.Key
                    result.Add(ZEntry(resVal, weight))
            | None -> ()

        { Stream = ZSet(Pool.Freeze (result.ToArray())) }

[<AutoOpen>]
module ZetaQueryModule =
    let zeta = ZetaQueryBuilder()
