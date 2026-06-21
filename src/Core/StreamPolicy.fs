namespace Zeta.Core

open System
open System.Reactive.Linq

/// **StreamPolicy — the νF (stream/traveler) interpreter of the policy kernel (081KT7YW00008QG0R003N6PF8A #2).**
///
/// This is the SECOND interpreter of the one `Policy` kernel (`Policy.fs`),
/// proving the converged "design the kernel once, interpret twice" thesis.
/// The FIRST interpreter (μF) runs the kernel over the finite `DynamicValue`
/// tree via a catamorphism (`DynamicValueXmlPolicy`); this one (νF) runs the
/// SAME kernel over an unbounded Rx push-stream.
///
/// **μF vs νF (least vs greatest fixpoint).** A `DynamicValue` tree is the
/// least fixpoint μF of its shape functor: a *finite, inductive* structure you
/// consume with `cata`. An `IObservable<'a>` is the greatest fixpoint νF: a
/// *potentially-infinite, coinductive* structure you observe element-by-element
/// as it is produced. The policy kernel is indifferent to which fixpoint it is
/// interpreted over — it just SELECTS a decision per value — so the same
/// `Policy<'a,'d,'f>` is faithful whether folded over μF or pushed through νF.
///
/// **Rx = push-dual of IEnumerable.** Following Meijer's duality thesis
/// (Subject/Observer is dual to Iterator, PLDI FIT 2010) and Bart De Smet's
/// `IQbservable` work, `IObservable<'a>` is the push-dual of `IEnumerable<'a>`;
/// it is the natural carrier for νF here (see `Rx.fs` for the codebase idiom).
///
/// **Select, never mutate (Amara's blade), over νF.** The policy does not
/// transform the stream's elements; it TAGS / ROUTES them. `applyPolicy` pairs
/// each element with its decision+feedback; `partition` / `route` use the
/// decision to split or filter; the caller acts.
///
/// **Traveler = an addressed νF stream on the bus.** A `Traveler<'a>` is a
/// stream (the νF value) plus an `Address` (the routing facet). Combining
/// travelers element-wise is `Observable.Zip`: `zip2` fuses two value
/// structures into their own traveler — the foundation of multidispatch —
/// and `zip3` is the "or three = multidispatch" case (N-ary zip over
/// travelers). Zip follows standard Rx semantics: it stops at the shorter
/// source.
///
/// Compile order: after `Policy.fs` and after `Rx.fs` (depends on both areas).
[<RequireQualifiedAccess>]
module StreamPolicy =

    /// Run `policy` per element of the νF stream, pairing each element with the
    /// decision+feedback it SELECTS. Select-not-mutate: the element is passed
    /// through untouched, carried alongside its `PolicyResult`.
    let applyPolicy
        (policy: Policy.Policy<'a, 'd, 'f>)
        (source: IObservable<'a>)
        : IObservable<'a * Policy.PolicyResult<'d, 'f>> =
        source.Select(fun a -> a, policy a)

    /// Run `policy` per element and observe only the `PolicyResult` stream
    /// (decision + feedback), dropping the element.
    let decisions
        (policy: Policy.Policy<'a, 'd, 'f>)
        (source: IObservable<'a>)
        : IObservable<Policy.PolicyResult<'d, 'f>> =
        source.Select(fun a -> policy a)

    /// Split the νF stream by a boolean routing policy: `(accepted, rejected)`,
    /// where `accepted` carries the elements whose decision is `true`. Both
    /// output streams observe the (single) source independently.
    let partition
        (policy: Policy.Policy<'a, bool, 'f>)
        (source: IObservable<'a>)
        : IObservable<'a> * IObservable<'a> =
        let accepted = source.Where(fun a -> (policy a).Decision)
        let rejected = source.Where(fun a -> not (policy a).Decision)
        accepted, rejected

    /// Keyed routing over νF: keep only the elements whose decision maps (via
    /// `key`) to `target` (e.g. local / bus / dead-letter routing).
    let route
        (key: 'd -> 'key)
        (policy: Policy.Policy<'a, 'd, 'f>)
        (target: 'key)
        (source: IObservable<'a>)
        : IObservable<'a> =
        source.Where(fun a -> key (policy a).Decision = target)

    /// An addressed νF stream on the bus: `Address` is the routing facet,
    /// `Stream` is the νF value.
    type Traveler<'a> = { Address: string; Stream: IObservable<'a> }

    /// Build a traveler from an address and a νF stream.
    let traveler (address: string) (stream: IObservable<'a>) : Traveler<'a> =
        { Address = address; Stream = stream }

    /// Combine two travelers element-wise (`Observable.Zip`) into a new
    /// traveler — two value structures becoming their own traveler, and the
    /// foundation of multidispatch. Stops at the shorter source (Rx Zip).
    let zip2 (address: string) (a: Traveler<'a>) (b: Traveler<'b>) : Traveler<'a * 'b> =
        { Address = address
          Stream = a.Stream.Zip(b.Stream, fun x y -> x, y) }

    /// The "or three = multidispatch" case: combine three travelers
    /// element-wise into one new traveler. Stops at the shortest source.
    let zip3
        (address: string)
        (a: Traveler<'a>)
        (b: Traveler<'b>)
        (c: Traveler<'c>)
        : Traveler<'a * 'b * 'c> =
        let ab = a.Stream.Zip(b.Stream, fun x y -> x, y)
        { Address = address
          Stream = ab.Zip(c.Stream, fun (x, y) z -> x, y, z) }
