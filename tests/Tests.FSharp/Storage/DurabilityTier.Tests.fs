module Zeta.Tests.Storage.DurabilityTierTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// DurabilityTier — tier model + registration-time classification
// (081KTF48J3V increment 5; locked design §2 + §7).
//
// Law families:
//  1. POLICY — leaves declare (Durable|Ephemeral only); internal
//     relations auto-classify (Derived when every input survives,
//     Ephemeral through a NAMED lost input); override-upward allowed,
//     downward rejected.
//  2. THE UPWARD-CLOSED INVARIANT — in every ACCEPTED classification,
//     no Derived relation depends on a non-surviving relation
//     (quantified over random DAGs, not spot-checked).
//  3. STRUCTURE — duplicate names, unknown edges, cycles: loud,
//     all-or-nothing, deterministic.
//  4. MANIFEST — the generated audit artifact is byte-locked.
// ═══════════════════════════════════════════════════════════════════

let private node name deps declared : TierNode =
    { Name = name; DependsOn = deps; Declared = declared }

let private classifyOk nodes =
    match DurabilityTier.classify nodes with
    | Ok rows -> rows
    | Error e -> failwithf "expected Ok, got %A" e

let private tierOf name rows =
    (rows |> List.find (fun (a: TierAssignment) -> a.Name = name)).Tier

// ── 1. Policy ────────────────────────────────────────────────────────

[<Fact>]
let ``leaves declare; internal relations auto-classify Derived when every input survives`` () =
    let rows =
        classifyOk
            [ node "orders" [] (Some Durable)
              node "customers" [] (Some Durable)
              node "joined" [ "orders"; "customers" ] None
              node "totals" [ "joined" ] None ]
    Assert.Equal<DurabilityTier>(Derived, tierOf "joined" rows)
    Assert.Equal<DurabilityTier>(Derived, tierOf "totals" rows)
    Assert.Equal<TierReason>(AutoDerived, (rows |> List.find (fun a -> a.Name = "joined")).Reason)

[<Fact>]
let ``a relation fed by scratch auto-classifies Ephemeral and NAMES the lost input`` () =
    let rows =
        classifyOk
            [ node "orders" [] (Some Durable)
              node "session" [] (Some Ephemeral)
              node "mixed" [ "orders"; "session" ] None
              node "downstream" [ "mixed" ] None ]
    Assert.Equal<DurabilityTier>(Ephemeral, tierOf "mixed" rows)
    Assert.Equal<TierReason>(AutoEphemeral "session", (rows |> List.find (fun a -> a.Name = "mixed")).Reason)
    // ephemerality propagates: downstream cannot be regenerated either
    Assert.Equal<DurabilityTier>(Ephemeral, tierOf "downstream" rows)

[<Fact>]
let ``override-UPWARD is allowed: durable snapshots instead of recomputing — even over scratch inputs`` () =
    let rows =
        classifyOk
            [ node "session" [] (Some Ephemeral)
              node "audit" [ "session" ] (Some Durable) ] // persisted directly; self-contained recovery
    Assert.Equal<DurabilityTier>(Durable, tierOf "audit" rows)
    Assert.Equal<TierReason>(DeclaredOverride Ephemeral, (rows |> List.find (fun a -> a.Name = "audit")).Reason)

[<Fact>]
let ``override-DOWNWARD is rejected — the accident path to referencing lost state`` () =
    match DurabilityTier.classify
              [ node "orders" [] (Some Durable)
                node "view" [ "orders" ] (Some Ephemeral) ] with
    | Error [ DownwardOverride ("view", Ephemeral, Derived) ] -> ()
    | other -> failwithf "unexpected: %A" other

[<Fact>]
let ``declaring Derived over a lost input violates the upward-closed invariant, naming the edge`` () =
    match DurabilityTier.classify
              [ node "session" [] (Some Ephemeral)
                node "view" [ "session" ] (Some Derived) ] with
    | Error [ SurvivorDependsOnEphemeral ("view", Derived, "session") ] -> ()
    | other -> failwithf "unexpected: %A" other

[<Fact>]
let ``an undeclared leaf and a Derived leaf are both rejected — the graph cannot infer intent at a source`` () =
    match DurabilityTier.classify [ node "orders" [] None; node "weird" [] (Some Derived) ] with
    | Error errs ->
        Assert.Contains(UndeclaredLeaf "orders", errs)
        Assert.Contains(LeafDeclaredDerived "weird", errs)
    | Ok _ -> failwith "expected Error"

// ── 2. The upward-closed invariant, quantified ───────────────────────

type private DagArb =
    /// Random layered DAGs: each node may depend only on earlier nodes, so the
    /// graph is acyclic by construction. Leaves get random legal declarations;
    /// internal nodes are mostly undeclared, sometimes Durable (upward).
    static member Nodes() : Arbitrary<TierNode list> =
        gen {
            let! n = Gen.choose (1, 12)
            let names = [ for i in 1 .. n -> sprintf "n%02d" i ]
            let! nodes =
                names
                |> List.mapi (fun i name ->
                    gen {
                        let earlier = names |> List.take i
                        let! deps =
                            if List.isEmpty earlier then Gen.constant []
                            else
                                gen {
                                    let! k = Gen.choose (0, min 3 (List.length earlier))
                                    let! chosen = Gen.elements earlier |> Gen.listOfLength k
                                    return List.distinct chosen
                                }
                        let! declared =
                            if List.isEmpty deps then
                                Gen.elements [ Some Durable; Some Ephemeral ]
                            else
                                Gen.frequency [ 6, Gen.constant None; 1, Gen.constant (Some Durable) ]
                        return { Name = name; DependsOn = deps; Declared = declared }
                    })
                |> List.fold (fun acc g -> gen { let! xs = acc in let! x = g in return x :: xs }) (Gen.constant [])
            return List.rev nodes
        }
        |> Arb.fromGen

[<Property(Arbitrary = [| typeof<DagArb> |])>]
let ``INVARIANT: in every accepted classification the surviving set is upward-closed`` (nodes: TierNode list) =
    match DurabilityTier.classify nodes with
    | Error e -> failwithf "generated graphs are legal by construction: %A" e
    | Ok rows ->
        let tier = rows |> List.map (fun a -> a.Name, a.Tier) |> Map.ofList
        rows
        |> List.forall (fun a ->
            a.Tier <> Derived
            || a.DependsOn |> List.forall (fun d -> DurabilityTier.survives tier.[d]))

[<Property(Arbitrary = [| typeof<DagArb> |])>]
let ``determinism: classification and manifest replay byte-identically`` (nodes: TierNode list) =
    DurabilityTier.classifyToManifest nodes = DurabilityTier.classifyToManifest nodes
    && DurabilityTier.classifyToManifest (List.rev nodes) = DurabilityTier.classifyToManifest nodes

// ── 3. Structure ─────────────────────────────────────────────────────

[<Fact>]
let ``duplicate names, unknown edges, and cycles are loud`` () =
    match DurabilityTier.classify
              [ node "a" [] (Some Durable); node "a" [] (Some Durable); node "b" [ "ghost" ] None ] with
    | Error errs ->
        Assert.Contains(DuplicateNode "a", errs)
        Assert.Contains(UnknownDependency("b", "ghost"), errs)
    | Ok _ -> failwith "expected Error"
    match DurabilityTier.classify
              [ node "x" [ "y" ] None; node "y" [ "x" ] None; node "leaf" [] (Some Durable) ] with
    | Error [ DependencyCycle [ "x"; "y" ] ] -> ()
    | other -> failwithf "unexpected: %A" other

// ── 4. The generated manifest ────────────────────────────────────────

[<Fact>]
let ``GOLDEN MANIFEST: the audit artifact is byte-locked`` () =
    let rows, manifest =
        match DurabilityTier.classifyToManifest
                  [ node "orders" [] (Some Durable)
                    node "session" [] (Some Ephemeral)
                    node "joined" [ "orders" ] None
                    node "cache" [ "session"; "joined" ] None
                    node "ledger" [ "session" ] (Some Durable) ] with
        | Ok pair -> pair
        | Error e -> failwithf "expected Ok, got %A" e
    Assert.Equal(5, List.length rows)
    let expected =
        "ztiermanifest/1\n\
         cache\tephemeral\tauto-ephemeral-via:session\tjoined,session\n\
         joined\tderived\tauto-derived\torders\n\
         ledger\tdurable\tdeclared-override-from:ephemeral\tsession\n\
         orders\tdurable\tdeclared-leaf\t\n\
         session\tephemeral\tdeclared-leaf\t"
    Assert.Equal<string>(expected, manifest)
