namespace Zeta.Research

open Zeta.Core

/// The normal service receives admitted numeric thresholds only. Runtime/source
/// handles and certificate identity remain outside controller state and timing.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledSelector =
    let private fast action path comparisons : HiddenSwitchCompiledReceipt.ChoiceWork =
        { Action = action; Path = path; GuardComparisons = comparisons; RecursiveCalls = 0u
          Nodes = 0u; ActionValues = 0u; Predictions = 0u; Updates = 0u }

    /// Internal conformance injection shares this exact branch logic. Normal
    /// choose below always binds the actual recursive service; no runtime flag
    /// or optional observer enters that service.
    let internal chooseWithFallback fallback (guards: HiddenSwitchCompiledCertificate.GuardSet) effect belief depth =
        result {
            do! HiddenSwitchCompiledPolicy.admit belief depth
            if System.Object.ReferenceEquals(guards, null) then
                return! Error(HiddenSwitchCompiledReceipt.failure "compiled-choice" "guards" "requires admitted numeric guards")
            if depth = 1 || not effect then return fast 0uy 3uy 0u
            else
                let struct(switchMax, harvestMin) =
                    if depth = 2 then HiddenSwitchCompiledCertificate.depthTwo guards
                    else HiddenSwitchCompiledCertificate.depthThree guards
                let mutable comparisons = 0u
                comparisons <- comparisons + 1u
                if belief <= switchMax then return fast 1uy 1uy comparisons
                else
                    comparisons <- comparisons + 1u
                    if belief >= harvestMin then return fast 0uy 2uy comparisons
                    else
                        let! actual = fallback effect belief depth
                        return { actual with Path = 4uy; GuardComparisons = comparisons }
        }

    let choose guards effect belief depth = chooseWithFallback HiddenSwitchCompiledPolicy.native guards effect belief depth

    /// Separate conformance-only path: no runtime boolean enters the service.
    /// Even trivial inputs execute the actual unmodified recursive evaluator.
    let unsupportedRuntime effect belief depth =
        result {
            let! actual = HiddenSwitchCompiledPolicy.native effect belief depth
            return { actual with Path = 4uy; GuardComparisons = 0u }
        }
