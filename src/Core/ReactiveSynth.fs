namespace Zeta.Core

/// **Reactive-interface synthesizer — `new` an interface from banana-split queries over one stream.**
///
/// Aaron #7052/#7060 (shadow*): *"take 1 stream and implement one interface from multiple banana-split RX
/// queries joined and/or zipped, then `new` the interface from the intersection."* And #7060: *"I'm breaking
/// things into little closures with free variables and binding them with Rx or graph; the more Rx, the more
/// we externalize into our what-remains (yin)."*
///
/// A **`Query`** is a *banana* — a catamorphism (fold) over a stream — packaged as a **little closure with
/// free variables**: `Seed` / `Step` / `Extract` are the closed-over free vars (#7060). Each interface member
/// is one such query. `zip` combines queries; `synthesize` `new`s the interface from the combined value.
///
/// **`zip` IS the Banana Split Law (#7054):** a tuple of two catamorphisms over one structure equals a single
/// catamorphism producing the tuple — `⦇f⦈ △ ⦇g⦈ = ⦇…⦈`. We implement it as exactly that: ONE fused fold over
/// the stream whose accumulator is the pair and whose extract is the pair of extracts. So joining/zipping
/// queries doesn't re-traverse the stream per member — it's one pass (the law made executable).
///
/// **Reactive / DST:** `scan` yields the running value at every prefix (the reactive trace — deterministic,
/// replayable, #7050 forced-RX); `run` is the final fold. The trace maps onto `RxAdapter.asObservable`
/// (Stream→IObservable) at the edge; the pure trace is the DST-friendly core. F# reference oracle.
module ReactiveSynth =

    /// A banana: a catamorphism over a stream of `'ev`, as a little closure with free variables (#7060).
    /// `Seed` is the initial accumulator (yin / what-remains), `Step` folds one event, `Extract` projects the
    /// member's value (`'out`) from the accumulator.
    type Query<'ev, 'acc, 'out> =
        { Seed: 'acc
          Step: 'acc -> 'ev -> 'acc
          Extract: 'acc -> 'out }

    /// Run the banana: fold the whole stream and extract the value.
    let run (q: Query<'ev, 'acc, 'out>) (stream: 'ev list) : 'out =
        stream |> List.fold q.Step q.Seed |> q.Extract

    /// Post-map a query's output (functor map on the extracted value).
    let map (f: 'out -> 'b) (q: Query<'ev, 'acc, 'out>) : Query<'ev, 'acc, 'b> =
        { Seed = q.Seed
          Step = q.Step
          Extract = q.Extract >> f }

    /// **The Banana Split Law (#7054), executable.** Zip two queries over the SAME stream into ONE query whose
    /// accumulator is the pair and whose extract is the pair of extracts — a single fused fold (one pass), not
    /// two traversals. `run (zip a b) s = (run a s, run b s)` by construction (the law).
    let zip (q1: Query<'ev, 'a, 'o1>) (q2: Query<'ev, 'b, 'o2>) : Query<'ev, 'a * 'b, 'o1 * 'o2> =
        { Seed = (q1.Seed, q2.Seed)
          Step = fun (a, b) e -> (q1.Step a e, q2.Step b e)
          Extract = fun (a, b) -> (q1.Extract a, q2.Extract b) }

    /// Zip three queries (sugar over `zip`), flattening to a 3-tuple.
    let zip3
        (q1: Query<'ev, 'a, 'o1>)
        (q2: Query<'ev, 'b, 'o2>)
        (q3: Query<'ev, 'c, 'o3>)
        : Query<'ev, ('a * 'b) * 'c, 'o1 * 'o2 * 'o3> =
        zip (zip q1 q2) q3 |> map (fun ((o1, o2), o3) -> (o1, o2, o3))

    /// **Synthesize** an interface: fold the (zipped) query over the stream and `new` the interface from the
    /// resulting value via `ctor` (an F# object expression, #7051). The interface is *born from the stream* —
    /// reactive by construction (#7050). `ctor` is the `{ new IFace with … }`; `q` is the joined banana-split.
    let synthesize (ctor: 'out -> 'iface) (q: Query<'ev, 'acc, 'out>) (stream: 'ev list) : 'iface =
        run q stream |> ctor

    /// The **reactive trace**: the running value at every prefix of the stream (seed first, then after each
    /// event) — `List.scan` + extract. Deterministic + replayable (DST §7); the pure core that
    /// `RxAdapter.asObservable` exposes as an `IObservable<'out>` at the edge (the forced-RX surface, #7050).
    let scan (q: Query<'ev, 'acc, 'out>) (stream: 'ev list) : 'out list =
        stream |> List.scan q.Step q.Seed |> List.map q.Extract

    /// Synthesize a *reactive* interface trace: the interface `new`'d at every prefix (one synthesized object
    /// per step). The latest is the current interface; the list is its evolution (#7058 evolving value).
    let synthesizeTrace (ctor: 'out -> 'iface) (q: Query<'ev, 'acc, 'out>) (stream: 'ev list) : 'iface list =
        scan q stream |> List.map ctor
