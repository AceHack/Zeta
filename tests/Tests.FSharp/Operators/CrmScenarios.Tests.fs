module Zeta.Tests.Operators.CrmScenariosTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// Scenario tests mirroring `samples/CrmSample` but as xUnit
// assertions. Validates that Zeta's algebraic operations give the
// correct CRM-shaped answers for each scenario in the demo. Lives
// under Operators/ because each test exercises one or more operators
// (GroupBySum, Join, IntegrateZSet) in a realistic CRM shape.

type Customer =
    { Id: int
      Name: string
      Email: string }

type Opportunity =
    { Id: int
      CustomerId: int
      Stage: string
      Amount: int64 }


[<Fact>]
let ``pipeline funnel count updates after stage transition`` () =
    task {
        let c = Circuit.create ()
        let opps = c.ZSetInput<Opportunity> ()
        let snap = c.IntegrateZSet opps.Stream
        let funnel =
            c.GroupBySum(
                snap,
                Func<Opportunity, string>(fun o -> o.Stage),
                Func<Opportunity, int64>(fun _ -> 1L))
        let view = c.Output funnel
        c.Build ()

        let oppLead = { Id = 1; CustomerId = 1; Stage = "Lead"; Amount = 100L }
        opps.Send(ZSet.ofSeq [ oppLead, 1L ])
        do! c.StepAsync()
        view.Current.[("Lead", 1L)] |> should equal 1L

        // Stage transition = retraction + insert in one delta. Funnel
        // counts update atomically — no intermediate "both stages at 0"
        // state visible between ticks.
        let oppQualified = { oppLead with Stage = "Qualified" }
        opps.Send(ZSet.ofSeq [ oppLead, -1L ; oppQualified, 1L ])
        do! c.StepAsync()
        view.Current.[("Lead", 1L)]      |> should equal 0L
        view.Current.[("Qualified", 1L)] |> should equal 1L
    }


[<Fact>]
let ``pipeline value aggregates correctly through stage walk`` () =
    task {
        let c = Circuit.create ()
        let opps = c.ZSetInput<Opportunity> ()
        let snap = c.IntegrateZSet opps.Stream
        let value =
            c.GroupBySum(
                snap,
                Func<Opportunity, string>(fun o -> o.Stage),
                Func<Opportunity, int64>(fun o -> o.Amount))
        let view = c.Output value
        c.Build ()

        let opp = { Id = 42; CustomerId = 7; Stage = "Lead"; Amount = 2500L }
        opps.Send(ZSet.ofSeq [ opp, 1L ])
        do! c.StepAsync()
        view.Current.[("Lead", 2500L)] |> should equal 1L

        // Walk Lead -> Qualified -> Proposal -> Won. Each transition
        // is a single retraction+insert delta; value moves with the
        // opportunity.
        let stages = [ "Qualified" ; "Proposal" ; "Won" ]
        let mutable current = opp
        for stage in stages do
            let next = { current with Stage = stage }
            opps.Send(ZSet.ofSeq [ current, -1L ; next, 1L ])
            do! c.StepAsync()
            current <- next

        view.Current.[("Won", 2500L)]     |> should equal 1L
        view.Current.[("Lead", 2500L)]    |> should equal 0L
        view.Current.[("Proposal", 2500L)] |> should equal 0L
    }


[<Fact>]
let ``duplicate-email self-join identifies colliding customers`` () =
    task {
        let c = Circuit.create ()
        let customers = c.ZSetInput<Customer> ()
        let snap = c.IntegrateZSet customers.Stream

        let pairs =
            c.Join(
                snap,
                snap,
                Func<Customer, string>(fun x -> x.Email),
                Func<Customer, string>(fun x -> x.Email),
                Func<Customer, Customer, int * int * string>(fun a b -> (a.Id, b.Id, a.Email)))
        let distinctPairs =
            c.Filter(pairs, Func<int * int * string, bool>(fun (a, b, _) -> a < b))
        let view = c.Output distinctPairs
        c.Build ()

        let alice = { Id = 1; Name = "Alice"; Email = "collide@example.com" }
        let bob   = { Id = 2; Name = "Bob";   Email = "unique@example.com" }
        let carol = { Id = 3; Name = "Carol"; Email = "collide@example.com" }

        customers.Send(ZSet.ofSeq [ alice, 1L ; bob, 1L ; carol, 1L ])
        do! c.StepAsync()

        // Alice (#1) and Carol (#3) collide on email; pair (1,3) present
        // once thanks to the a<b filter.
        view.Current.[(1, 3, "collide@example.com")] |> should equal 1L
        view.Current.Count |> should equal 1
    }


[<Fact>]
let ``duplicate pair retracts when email is corrected`` () =
    task {
        let c = Circuit.create ()
        let customers = c.ZSetInput<Customer> ()
        let snap = c.IntegrateZSet customers.Stream

        let pairs =
            c.Join(
                snap,
                snap,
                Func<Customer, string>(fun x -> x.Email),
                Func<Customer, string>(fun x -> x.Email),
                Func<Customer, Customer, int * int * string>(fun a b -> (a.Id, b.Id, a.Email)))
        let distinctPairs =
            c.Filter(pairs, Func<int * int * string, bool>(fun (a, b, _) -> a < b))
        let view = c.Output distinctPairs
        c.Build ()

        let alice = { Id = 1; Name = "Alice"; Email = "collide@example.com" }
        let carol = { Id = 2; Name = "Carol"; Email = "collide@example.com" }
        customers.Send(ZSet.ofSeq [ alice, 1L ; carol, 1L ])
        do! c.StepAsync()
        view.Current.Count |> should equal 1

        // Correct Carol's email. Retraction + insert. The duplicate
        // pair retracts from the view automatically on the same tick —
        // no separate "cleanup" step required.
        let carolFixed = { carol with Email = "carol@example.com" }
        customers.Send(ZSet.ofSeq [ carol, -1L ; carolFixed, 1L ])
        do! c.StepAsync()
        view.Current.Count |> should equal 0
    }


[<Fact>]
let ``customer address change preserves identity under integrated snapshot`` () =
    task {
        // Retraction-native "update" — ensure retraction+insert
        // produces exactly one row in the snapshot, not two.
        let c = Circuit.create ()
        let customers = c.ZSetInput<Customer> ()
        let snap = c.IntegrateZSet customers.Stream
        let view = c.Output snap
        c.Build ()

        let alice = { Id = 1; Name = "Alice"; Email = "alice@example.com" }
        customers.Send(ZSet.ofSeq [ alice, 1L ])
        do! c.StepAsync()
        view.Current.Count |> should equal 1

        // Rename Alice. One row in, one row out.
        let aliceRenamed = { alice with Name = "Alice Plumbing Inc." }
        customers.Send(ZSet.ofSeq [ alice, -1L ; aliceRenamed, 1L ])
        do! c.StepAsync()
        view.Current.Count              |> should equal 1
        view.Current.[aliceRenamed]     |> should equal 1L
        view.Current.[alice]            |> should equal 0L
    }
