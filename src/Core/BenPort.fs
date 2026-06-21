namespace Zeta.Core

/// BenPort — **the hexagonal benchmark port: OUR interfaces and attributes; BenchmarkDotNet is
/// an adapter behind them** (Aaron 2026-06-12: "yes on benchmark hexagonally on our interfaces
/// and attributes and such so we depend on ours"). Same blade as the inference port (081KTZ4EF0008QG0R000WJGSWX:
/// Zeta.Bayesian + Infer.NET as adapters) — Zeta code depends on THIS port only; which engine
/// drives a case (the chip8 tick meter, the alloc meter, a BenchmarkDotNet wall-time job) is an
/// adapter choice at the edge, never a dependency of the case.
///
/// THE GLASS-SIDE RULING applies per meter: exact meters (ticks, allocBytes) may run in-room;
/// wall-time adapters are statistical and live glass-side (their own process/methodology — the
/// BenchmarkDotNet child-process model is glass-side BY DESIGN).
[<RequireQualifiedAccess>]
module BenPort =

    /// Marks a case for discovery. Artifact + op key the case to its ComplexityRegistry row —
    /// a benchmark IS a prediction check (the ben verb), so every case names its prediction.
    [<System.AttributeUsage(System.AttributeTargets.Class, AllowMultiple = false)>]
    type ZetaBenAttribute(artifact: string, op: string) =
        inherit System.Attribute()
        member _.Artifact = artifact
        member _.Op = op

    /// One benchmark case — pure shape, no engine types (interfaces are free; the rules of the
    /// game). Run must be deterministic GIVEN the size for the exact meters to be meaningful;
    /// statistical adapters tolerate (and average over) what the exact meters would refuse.
    type IBenCase =
        /// ComplexityRegistry key, first half (e.g. "sketch.iblt").
        abstract Artifact: string
        /// ComplexityRegistry key, second half (e.g. "build").
        abstract Op: string
        /// The doubling ladder this case supports (the grader wants ≥3 sizes, span ≥8×).
        abstract Sizes: int list
        /// One measured invocation at the given size. The meter wraps THIS and nothing else.
        abstract Run: int -> unit

    /// A meter drives a case and prices each size — the engine-shaped hole. Exact meters return
    /// replay-equal costs; statistical meters return summaries. Cost unit is the meter's own
    /// (ticks, bytes, ns) — the grader only ever compares WITHIN one meter's samples.
    type IBenMeter =
        /// Meter name for the report ("chip8-ticks" | "alloc-bytes" | "bdn-wall-ns" | …).
        abstract Name: string
        /// Whether two runs from the same state are byte-equal (in-room eligible) — statistical
        /// meters say false and stay glass-side per the ruling.
        abstract Deterministic: bool
        /// Price one (case, size): the cost in this meter's unit.
        abstract Measure: IBenCase -> int -> int64

    /// Drive a case across its ladder with a meter → samples ready for Ben.infer/Ben.grade.
    let samples (meter: IBenMeter) (case: IBenCase) : (int * int64) list =
        case.Sizes |> List.map (fun n -> n, meter.Measure case n)

    /// The alloc meter as a port citizen (exact, in-room eligible; Ben.allocBytes with one
    /// warmup to settle one-time allocation).
    let allocMeter: IBenMeter =
        { new IBenMeter with
            member _.Name = "alloc-bytes"
            member _.Deterministic = true
            member _.Measure case n = Ben.allocBytes 1 (fun () -> case.Run n) }

    /// Discover [<ZetaBen>]-marked IBenCase types in an assembly (the attribute half of "our
    /// attributes"). Honest-partial: usable cases come back AND every marked-but-unusable type
    /// is named in errors — never skipped silently, never poisoning the good cases (the
    /// IbltReconcile Partial blade, applied to discovery).
    let discover (asm: System.Reflection.Assembly) : IBenCase list * string list =
        let marked =
            asm.GetTypes()
            |> Array.filter (fun t -> t.GetCustomAttributes(typeof<ZetaBenAttribute>, false).Length > 0)
        let cases, errors =
            marked
            |> Array.fold
                (fun (ok, bad) t ->
                    if typeof<IBenCase>.IsAssignableFrom t && not t.IsAbstract && t.GetConstructor [||] <> null then
                        match System.Activator.CreateInstance t with
                        | :? IBenCase as case -> case :: ok, bad
                        | _ -> ok, sprintf "%s constructed but did not yield an IBenCase" t.FullName :: bad
                    else
                        ok, sprintf "%s carries [<ZetaBen>] but is not a constructible IBenCase" t.FullName :: bad)
                ([], [])
        List.rev cases, List.rev errors
