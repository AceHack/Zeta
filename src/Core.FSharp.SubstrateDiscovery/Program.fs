module Zeta.SubstrateDiscovery.Program

open System
open Zeta.Core

/// Phase 0 PoC entry point — minimal smoke test validating the
/// AOT-publish toolchain end-to-end. Per the scoping doc at
/// docs/research/2026-05-03-substrate-discovery-zeta-native-aot-
/// scoping.md the load-bearing distribution-feasibility question is
/// whether a single AOT binary publishes cleanly across platforms
/// for zero-install external-agent consumption. This program answers
/// that by:
///   1. Building / publishing without trim or AOT warnings
///   2. Invoking the Zeta.Core IVM primitive (a no-op Circuit) to
///      prove the AOT-clean Core surface composes
///   3. Exiting 0 on `--version`, 0 on `--smoke`, non-zero on bad
///      args
///
/// Subsequent phases extend this binary with real substrate-
/// discovery operators (file-add / file-remove / file-modify Z-set
/// stream → IndexedZSet queries → JSON output). Phase 0 ships
/// nothing but the toolchain proof.
[<EntryPoint>]
let main argv =
    match argv with
    | [||] | [| "--help" |] | [| "-h" |] ->
        Console.WriteLine "Zeta.SubstrateDiscovery — Phase 0 PoC"
        Console.WriteLine ""
        Console.WriteLine "Usage:"
        Console.WriteLine "  Zeta.SubstrateDiscovery --version"
        Console.WriteLine "  Zeta.SubstrateDiscovery --smoke"
        Console.WriteLine "  Zeta.SubstrateDiscovery --biology"
        Console.WriteLine "  Zeta.SubstrateDiscovery --help"
        Console.WriteLine ""
        Console.WriteLine "Phase 0 PoC validates the AOT-publish toolchain on"
        Console.WriteLine "linux-x64, osx-arm64, win-x64. Subsequent phases add"
        Console.WriteLine "real substrate-discovery operators."
        0

    | [| "--version" |] ->
        Console.WriteLine "Zeta.SubstrateDiscovery 0.0.0-phase-0-poc"
        0

    | [| "--smoke" |] ->
        // AOT-clean smoke test: build a trivial Circuit + feed one
        // input + step once + observe the output. Proves Zeta.Core's
        // FULL IVM tick path composes through a PublishAot=true
        // binary — not just the build path. Per #1392 reviewer
        // finding: a pure Build()-only smoke would miss any AOT
        // incompatibility in the tick exe surface.
        let circuit = Circuit.create ()
        let input = circuit.ZSetInput<int> ()
        let view = circuit.Output input.Stream
        circuit.Build ()

        let tickBefore = circuit.Tick
        (task {
            input.Send(ZSet.ofKeys [ 1; 2; 3 ])
            do! circuit.StepAsync ()
        }).GetAwaiter().GetResult()
        let tickAfter = circuit.Tick

        Console.WriteLine $"smoke: circuit built + stepped (tick %d{tickBefore} -> %d{tickAfter})"
        let mutable count = 0
        for entry in view.Current do
            count <- count + int entry.Weight
        Console.WriteLine $"smoke: observed %d{count} entries in output ZSet"
        Console.WriteLine "smoke: ok"
        0

    | [| "--biology" |] ->
        // B-0045 smallest safe slice (inaugural): biology substrate stub.
        // Bounded one-step: wire the first subject into the discovery binary
        // as F# code (per "prefer F# code over docs"). Prints the retraction-
        // native biology entry point; no new deps, no doc changes.
        Console.WriteLine "B-0045.2: biology inaugural substrate"
        Console.WriteLine "  autopoiesis (Maturana/Varela) + retraction-native homeostasis"
        Console.WriteLine "  Kauffman autocatalytic sets + Wolpert fate maps as operator seeds"
        Console.WriteLine "  Stage-1 scaffold wired to discovery tool (code, not doc)"
        0

    | _ ->
        Console.Error.WriteLine $"unknown args: %A{argv}"
        Console.Error.WriteLine "use --help"
        2
