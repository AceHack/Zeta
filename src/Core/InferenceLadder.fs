namespace Zeta.Core

open Zeta.Core.Abstractions

/// InferenceLadder — `universal/port` implemented for the inference port (081KTZ4EF0008QG0R000WJGSWX follow-up; the
/// FIRST CUSTOMER of the converged plug grammar). Name = engine ZetaIds on the shelf
/// (engine.zeta-bayesian / engine.infer-net / engine.mock-flat); Ladder = Live → Injected → Mock
/// (no Adapted rung yet — an engine-to-engine adapter piece has no instance; carve it when one
/// exists, never speculatively); Light = the red-light glance form; Missing = the registered ids
/// the host could install. The Mock is HONEST: flat marginals with Converged=false — a rehearsal
/// engine that can never masquerade as inference (the value says so).
[<RequireQualifiedAccess>]
module InferenceLadder =

    /// The rehearsal engine — the ladder's Mock rung: flat (uninformative) marginals,
    /// Converged = false ALWAYS. Nothing real was inferred and the result says so.
    type MockFlatEngine() =
        interface IInferenceEngine with
            member _.Name = "mock-flat"
            member _.RunGaussian(model, _maxRounds, _tolerance) =
                let flat = [| for v in 0 .. model.VariableCount - 1 -> GaussianMarginal(v, 0.0, 1e8) |]
                InferenceResult(false, 0, flat)

    /// An engine binding, ladder-shaped (mirrors MediaLines.IoBinding — the universal grammar).
    type EngineBinding =
        | Live of zetaId: string * engine: IInferenceEngine
        | Injected of zetaId: string * engine: IInferenceEngine
        | Mock of requestedZetaId: string * engine: IInferenceEngine

    /// Resolve a requested engine ZetaId against the host's live factories and the door's grants.
    /// Total: absent everywhere ⇒ the rehearsal engine, never an error (the expansion law).
    let resolve
        (hostLive: Map<string, unit -> IInferenceEngine>)
        (granted: Map<string, unit -> IInferenceEngine>)
        (zetaId: string)
        : EngineBinding =
        match Map.tryFind zetaId hostLive with
        | Some make -> Live(zetaId, make ())
        | None ->
            match Map.tryFind zetaId granted with
            | Some make -> Injected(zetaId, make ())
            | None -> Mock(zetaId, MockFlatEngine() :> IInferenceEngine)

    /// THE LIGHT (universal/port `Light`): the binding's truth in one glance —
    /// `[REC ●]` something real runs; `[off ○]` rehearsal, nothing real is inferred.
    let light (b: EngineBinding) : string =
        match b with
        | Live(zid, e) -> sprintf "[REC ●] inference LIVE %s (%s)" e.Name zid
        | Injected(zid, e) -> sprintf "[REC ●] inference INJECTED %s (%s)" e.Name zid
        | Mock(zid, _) -> sprintf "[off ○] inference MOCK for %s (rehearsal — nothing real is inferred; Converged=false by construction)" zid
