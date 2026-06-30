module Zeta.Tests.Simulation.AgentIntegrateTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.AgentIntegrate
open Zeta.Bayesian

[<Fact>]
let ``AgentIntegrate: monadic computation expression control flow works`` () =
    let initialState = "initial"
    
    let workflow = integrate {
        let! current = integrate.Observe(fun s -> s)
        
        let proposal = integrate.Limit(current, fun s -> 
            { ProposalState = s + "_simulated"; Fidelity = 0.95; IsApproved = true }
        )
        
        if proposal.IsApproved then
            do! integrate.Emit(fun s -> ())
            return proposal.ProposalState
        else
            return current
    }
    
    let (Integrate f) = workflow
    let result, status = f initialState
    
    result |> should equal "initial_simulated"
    match status with
    | Committed _ -> ()
    | _ -> failwith "Expected Committed status"

[<Fact>]
let ``AgentIntegrate: Put and Update successfully thread and commit state transitions`` () =
    let initialState = "initial"
    
    let workflow = integrate {
        do! integrate.Put("new_state")
        do! integrate.Update(fun s -> s + "_updated")
        let! current = integrate.Observe(fun s -> s)
        return current
    }
    
    let (Integrate f) = workflow
    let result, status = f initialState
    
    result |> should equal "new_state_updated"
    match status with
    | Committed s -> s |> should equal "new_state_updated"
    | _ -> failwith "Expected Committed status"

[<Fact>]
let ``InferNetTopology: native belief propagation simulation reconstructs topology under noise`` () =
    let numNodes = 8
    let numProjections = 4
    let solver = InferNetTopology(numNodes, numProjections)
    
    let x = [| 1.0; -1.0; 1.0; 1.0; -1.0; 1.0; -1.0; -1.0 |]
    
    // Configure Hebbian weight alignment prior (Emit-as-weights matching correlation)
    for i in 0 .. numNodes - 2 do
        solver.SetCoupling(i, i + 1, 0.8 * x.[i] * x.[i+1])
    solver.SetCoupling(numNodes - 1, 0, 0.8 * x.[numNodes - 1] * x.[0])
    
    let noiseSigma = 0.05
    let seed = 42
    let y = solver.Project(x, noiseSigma, seed)
    
    let maxIterations = 25
    let lambda = 1.5
    let reconstructedSoft = solver.Reconstruct(y, maxIterations, lambda)
    
    let reconstructedHard = reconstructedSoft |> Array.map (fun v -> if v >= 0.0 then 1.0 else -1.0)
    
    // Check that at least 7 out of 8 nodes match exactly (high fidelity under noise)
    let mutable matchCount = 0
    for i in 0 .. numNodes - 1 do
        if reconstructedHard.[i] = x.[i] then
            matchCount <- matchCount + 1
            
    matchCount |> should (be greaterThanOrEqualTo) 7
