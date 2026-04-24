module Zeta.Samples.CrmSample.Program

open System
open Zeta.Core

// A CRM-shaped demo: customer records + opportunity pipeline, maintained
// incrementally by Zeta. The point is not the CRM features themselves — it
// is to show what "retraction-native" buys you on CRM-shaped data:
//
//   * customer address change = retraction of the old row + insert of the
//     new row as a single delta (no "update-in-place" hack)
//   * opportunity stage transition = retraction from old stage + insert
//     into new stage; pipeline funnel counts update for free
//   * duplicate detection = equi-join on email; firing shows newly-found
//     duplicates, retracting shows ones that have been resolved
//
// The demo is narrow on purpose: four canonical views, each updated per
// tick, each printed before and after. A full production CRM surface
// (contact history, lead scoring, pipeline kanban, duplicate merging,
// call/SMS/email integration) is a much larger project — this file is
// the algebraic kernel.

type Customer =
    { Id: int
      Name: string
      Email: string
      Phone: string
      Address: string }

type Opportunity =
    { Id: int
      CustomerId: int
      Stage: string
      Amount: int64 }

[<EntryPoint>]
let main _argv =
    let circuit = Circuit.create ()
    let customers = circuit.ZSetInput<Customer> ()
    let opportunities = circuit.ZSetInput<Opportunity> ()

    // View 1 — current customer roster. Integrate the delta stream so
    // consumers see the current snapshot, not the last delta.
    let customerSnapshot = circuit.IntegrateZSet customers.Stream
    let customerView = circuit.Output customerSnapshot

    // View 2 — opportunity pipeline funnel by stage. GroupBySum on the
    // integrated snapshot gives "count per stage"; updates flow for free
    // as opportunities transition.
    let opportunitySnapshot = circuit.IntegrateZSet opportunities.Stream
    let funnel =
        circuit.GroupBySum(
            opportunitySnapshot,
            Func<Opportunity, string>(fun o -> o.Stage),
            Func<Opportunity, int64>(fun _ -> 1L))
    let funnelView = circuit.Output funnel

    // View 3 — total pipeline value per stage (same shape, sum the amount
    // instead of counting).
    let pipelineValue =
        circuit.GroupBySum(
            opportunitySnapshot,
            Func<Opportunity, string>(fun o -> o.Stage),
            Func<Opportunity, int64>(fun o -> o.Amount))
    let pipelineValueView = circuit.Output pipelineValue

    // View 4 — duplicate-email detection. Self-join customers on email;
    // filter out self-matches (same Id); each matching pair is a
    // candidate duplicate to review. Retraction-native: when a merge or
    // email correction resolves a duplicate, the pair retracts from this
    // view automatically.
    let duplicatePairs =
        circuit.Join(
            customerSnapshot,
            customerSnapshot,
            Func<Customer, string>(fun c -> c.Email),
            Func<Customer, string>(fun c -> c.Email),
            Func<Customer, Customer, int * int * string>(fun a b -> (a.Id, b.Id, a.Email)))
    let distinctPairs =
        circuit.Filter(
            duplicatePairs,
            Func<int * int * string, bool>(fun (a, b, _) -> a < b))
    let duplicateView = circuit.Output distinctPairs

    circuit.Build ()

    // Deliberately using the plain-tuple `ZSet.ofSeq` form for the sample —
    // readability-first, one less concept to explain to a newcomer. Production
    // code takes the zero-alloc path via `ZSet.ofPairs` + `struct (k, w)`
    // literals (see `docs/BENCHMARKS.md` "Allocation guarantees" and the
    // hot-path helpers in `src/Core/ZSet.fs`).
    let feedCustomers (rows: (Customer * int64) list) =
        task {
            customers.Send(ZSet.ofSeq rows)
            do! circuit.StepAsync ()
        }

    let feedOpps (rows: (Opportunity * int64) list) =
        task {
            opportunities.Send(ZSet.ofSeq rows)
            do! circuit.StepAsync ()
        }

    let printSection (label: string) =
        Console.WriteLine ""
        Console.WriteLine $"--- %s{label}  (tick %d{circuit.Tick}) ---"

    let printCustomers () =
        Console.WriteLine "Customers:"
        for entry in customerView.Current do
            let c = entry.Key
            Console.WriteLine $"    #%d{c.Id} %s{c.Name} <%s{c.Email}> @ %s{c.Address}"

    let printFunnel () =
        Console.WriteLine "Pipeline funnel (count):"
        for entry in funnelView.Current do
            let (stage, count) = entry.Key
            Console.WriteLine $"    %s{stage}: %d{count}"

    let printPipelineValue () =
        Console.WriteLine "Pipeline value ($):"
        for entry in pipelineValueView.Current do
            let (stage, total) = entry.Key
            Console.WriteLine $"    %s{stage}: $%d{total}"

    let printDuplicates () =
        Console.WriteLine "Duplicate-email candidates:"
        let any = ref false
        for entry in duplicateView.Current do
            let (a, b, email) = entry.Key
            Console.WriteLine $"    #%d{a} vs #%d{b} share <%s{email}>"
            any.Value <- true
        if not any.Value then
            Console.WriteLine "    (none)"

    let snapshot (label: string) =
        printSection label
        printCustomers ()
        printFunnel ()
        printPipelineValue ()
        printDuplicates ()

    // Scenario: a four-person trades-contractor CRM in miniature. Inserts,
    // a duplicate email collision, a pipeline walk, an address correction,
    // a duplicate resolution.
    (task {
        let alice =
            { Id = 1
              Name = "Alice Plumbing"
              Email = "alice@example.com"
              Phone = "555-0100"
              Address = "123 Old St" }
        let bob =
            { Id = 2
              Name = "Bob HVAC"
              Email = "bob@example.com"
              Phone = "555-0200"
              Address = "45 Oak Ave" }
        let carol =
            { Id = 3
              Name = "Carol Electric"
              Email = "alice@example.com"  // intentional duplicate
              Phone = "555-0300"
              Address = "9 Pine Rd" }

        do! feedCustomers [ alice, 1L ; bob, 1L ; carol, 1L ]
        snapshot "After initial customer load"

        do! feedOpps [
                { Id = 101; CustomerId = 1; Stage = "Lead"; Amount = 2500L }, 1L
                { Id = 102; CustomerId = 2; Stage = "Lead"; Amount = 4000L }, 1L
                { Id = 103; CustomerId = 3; Stage = "Qualified"; Amount = 1800L }, 1L
            ]
        snapshot "After three opportunities created"

        // Alice's opportunity walks the funnel: Lead -> Qualified -> Proposal -> Won.
        // Each transition is a retraction + insert in the *same* delta; the funnel
        // updates atomically.
        let oppV1 = { Id = 101; CustomerId = 1; Stage = "Lead"; Amount = 2500L }
        let oppV2 = { Id = 101; CustomerId = 1; Stage = "Qualified"; Amount = 2500L }
        do! feedOpps [ oppV1, -1L ; oppV2, 1L ]
        snapshot "Alice #101: Lead -> Qualified"

        let oppV3 = { Id = 101; CustomerId = 1; Stage = "Proposal"; Amount = 2500L }
        do! feedOpps [ oppV2, -1L ; oppV3, 1L ]
        snapshot "Alice #101: Qualified -> Proposal"

        let oppV4 = { Id = 101; CustomerId = 1; Stage = "Won"; Amount = 2500L }
        do! feedOpps [ oppV3, -1L ; oppV4, 1L ]
        snapshot "Alice #101: Proposal -> Won"

        // Alice moves. Retract the old record, insert the new. This is the
        // "update" primitive in a retraction-native store.
        let aliceV2 = { alice with Address = "900 New Blvd" }
        do! feedCustomers [ alice, -1L ; aliceV2, 1L ]
        snapshot "Alice changes address (retraction + insert)"

        // Duplicate resolution — Carol's email was wrong; correct it.
        let carolV2 = { carol with Email = "carol@example.com" }
        do! feedCustomers [ carol, -1L ; carolV2, 1L ]
        snapshot "Carol's email corrected (duplicate pair retracts automatically)"
    }).GetAwaiter().GetResult()

    0
