module Zeta.Tests.RxJoinTests

// ═══════════════════════════════════════════════════════════════════════════
// Falsifiers for the stage-one (planner-free) Rx join operators in src/Core/Rx.fs.
//
// Every test here is written to go RED when the operator under test is removed
// or mutated — see the PR body for the mutation log. Three of them exist for
// reasons beyond "does it work":
//
//   §DETERMINISM     — a seeded interleaving at DoP = 1 replays byte-identically.
//                      This is the property that makes the operators DST-safe.
//   §NEGATIVE CONTROL — goes red if a wall clock is substituted for the injected
//                      scheduler (.claude/rules/local-time-never-enters-the-shared-fold.md).
//   §TEARDOWN        — pins the file header's claim: "our lifetimes are bounded
//                      above every subscription".
// ═══════════════════════════════════════════════════════════════════════════

open System
open System.Collections.Generic
open System.Diagnostics
open System.IO
open System.Reactive.Concurrency
open System.Reactive.Disposables
open System.Reactive.Linq
open System.Reactive.Subjects
open Xunit
open Zeta.Core


/// Deterministic, ordinal, readable rendering of an emission log.
let private render (xs: seq<string>) = String.Join("|", xs)

let private collect (obs: IObservable<'a>) =
    let acc = ResizeArray<string>()
    let mutable completed = false
    let mutable error: exn option = None

    let sub =
        obs.Subscribe(
            { new IObserver<'a> with
                member _.OnNext v = acc.Add(String.Format(Globalization.CultureInfo.InvariantCulture, "{0}", v))
                member _.OnError e = error <- Some e
                member _.OnCompleted() = completed <- true }
        )

    acc, (fun () -> completed), (fun () -> error), sub

/// Wraps a source so the test can count how many times the operator DISPOSED it.
let private countingSource (source: IObservable<'a>) (disposals: int ref) : IObservable<'a> =
    { new IObservable<'a> with
        member _.Subscribe o =
            let d = source.Subscribe o

            { new IDisposable with
                member _.Dispose() =
                    disposals.Value <- disposals.Value + 1
                    d.Dispose() } }


// ───────────────────────────────────────────────────────────────────────────
// zip — arrival-index pairing, no clock, no statistics
// ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``zip pairs by arrival index and buffers the faster side`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    let acc, _, _, sub = collect (RxJoin.zip l r (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b))
    use _sub = sub

    l.OnNext 1
    l.OnNext 2
    l.OnNext 3
    Assert.Equal<string>("", render acc) // nothing can pair yet
    r.OnNext "a"
    r.OnNext "b"
    Assert.Equal<string>("1a|2b", render acc)
    r.OnNext "c"
    r.OnNext "d" // 4th right has no left partner yet — buffered, not dropped
    Assert.Equal<string>("1a|2b|3c", render acc)
    l.OnNext 4
    Assert.Equal<string>("1a|2b|3c|4d", render acc)

[<Fact>]
let ``zip completes as soon as one side is done and its buffer is drained`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    let acc, isDone, _, sub = collect (RxJoin.zip l r (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b))
    use _sub = sub

    l.OnNext 1
    r.OnNext "a"
    Assert.False(isDone ())
    l.OnCompleted() // left buffer empty ⇒ no further pair can exist
    Assert.True(isDone ())
    Assert.Equal<string>("1a", render acc)

[<Fact>]
let ``zip does NOT complete while the completed side still has buffered values`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    let acc, isDone, _, sub = collect (RxJoin.zip l r (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b))
    use _sub = sub

    l.OnNext 1
    l.OnCompleted()
    Assert.False(isDone ()) // 1 is still pairable
    r.OnNext "a"
    Assert.Equal<string>("1a", render acc)
    Assert.True(isDone ())

[<Fact>]
let ``zipBounded errors at the caller-declared ceiling instead of growing silently`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()

    let acc, _, err, sub =
        collect (RxJoin.zipBounded 2 l r (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b))

    use _sub = sub

    l.OnNext 1
    l.OnNext 2
    Assert.True((err ()).IsNone)
    l.OnNext 3 // 3rd buffered left exceeds capacity 2
    Assert.True((err ()).IsSome)
    Assert.IsType<InvalidOperationException>(err().Value) |> ignore
    Assert.Contains("capacity of 2", (err ()).Value.Message, StringComparison.Ordinal)
    Assert.Equal<string>("", render acc)

[<Fact>]
let ``zipBounded rejects a non-positive capacity`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()
    Assert.Throws<ArgumentException>(fun () -> RxJoin.zipBounded 0 l r (fun a b -> a + b) |> ignore) |> ignore


// ───────────────────────────────────────────────────────────────────────────
// combineLatest — emit on EITHER side
// ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``combineLatest emits on either side once both have a value`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()

    let acc, _, _, sub =
        collect (RxJoin.combineLatest l r (fun a b -> String.Format(Globalization.CultureInfo.InvariantCulture, "{0}:{1}", a, b)))

    use _sub = sub

    l.OnNext 1
    Assert.Equal<string>("", render acc) // right has never emitted
    r.OnNext 10
    Assert.Equal<string>("1:10", render acc)
    r.OnNext 20 // right alone re-emits
    Assert.Equal<string>("1:10|1:20", render acc)
    l.OnNext 2 // left alone re-emits
    Assert.Equal<string>("1:10|1:20|2:20", render acc)

[<Fact>]
let ``combineLatest completes early when a side completes having never emitted`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()
    let _, isDone, _, sub = collect (RxJoin.combineLatest l r (fun a b -> a + b))
    use _sub = sub

    l.OnNext 1
    Assert.False(isDone ())
    r.OnCompleted() // no combination can ever exist
    Assert.True(isDone ())

[<Fact>]
let ``combineLatest waits for BOTH sides when both have emitted`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()
    let _, isDone, _, sub = collect (RxJoin.combineLatest l r (fun a b -> a + b))
    use _sub = sub

    l.OnNext 1
    r.OnNext 2
    r.OnCompleted()
    Assert.False(isDone ()) // left can still move the combination
    l.OnCompleted()
    Assert.True(isDone ())


// ───────────────────────────────────────────────────────────────────────────
// withLatestFrom — LEFT-driven, asymmetric
// ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``withLatestFrom emits on the left only and drops lefts before the first right`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()

    let acc, _, _, sub =
        collect (RxJoin.withLatestFrom l r (fun a b -> String.Format(Globalization.CultureInfo.InvariantCulture, "{0}:{1}", a, b)))

    use _sub = sub

    l.OnNext 0 // DROPPED: right has no value yet
    r.OnNext 10
    Assert.Equal<string>("", render acc) // a right arrival never emits
    l.OnNext 1
    Assert.Equal<string>("1:10", render acc)
    r.OnNext 20 // still no emission on the right
    Assert.Equal<string>("1:10", render acc)
    l.OnNext 2
    Assert.Equal<string>("1:10|2:20", render acc)

[<Fact>]
let ``withLatestFrom completes with the LEFT and ignores right completion`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()
    let acc, isDone, _, sub = collect (RxJoin.withLatestFrom l r (fun a b -> a + b))
    use _sub = sub

    r.OnNext 10
    r.OnCompleted()
    Assert.False(isDone ()) // right's last value stays valid
    l.OnNext 1
    Assert.Equal<string>("11", render acc)
    l.OnCompleted()
    Assert.True(isDone ())

/// THE surprise this operator exists to make explicit: identical input, and
/// `combineLatest` emits three times where `withLatestFrom` emits twice.
/// If these two ever agree on this sequence, one of them is wrong.
[<Fact>]
let ``withLatestFrom and combineLatest DISAGREE on the same input - the asymmetry is real`` () =
    let drive (build: IObservable<int> -> IObservable<int> -> (int -> int -> string) -> IObservable<string>) =
        use l = new Subject<int>()
        use r = new Subject<int>()

        let acc, _, _, sub =
            collect (build l r (fun a b -> String.Format(Globalization.CultureInfo.InvariantCulture, "{0}:{1}", a, b)))

        use _sub = sub
        r.OnNext 10
        l.OnNext 1
        r.OnNext 20
        l.OnNext 2
        render acc

    let combined = drive RxJoin.combineLatest
    let sampled = drive RxJoin.withLatestFrom
    Assert.Equal<string>("1:10|1:20|2:20", combined)
    Assert.Equal<string>("1:10|2:20", sampled)
    Assert.NotEqual<string>(combined, sampled)


// ───────────────────────────────────────────────────────────────────────────
// join / groupJoin — CALLER-DECLARED windows (this is what makes them planner-free)
// ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``join emits only pairs whose caller-declared lifetimes overlap`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    use leftExpiry = new Subject<unit>() // caller fires this to close ALL left windows

    let acc, _, _, sub =
        collect (
            RxJoin.join
                l
                r
                (fun _ -> leftExpiry.AsObservable())
                (fun _ -> Observable.Never<unit>())
                (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b)
        )

    use _sub = sub

    l.OnNext 1
    r.OnNext "a" // 1 is live ⇒ pair
    Assert.Equal<string>("1a", render acc)
    l.OnNext 2
    Assert.Equal<string>("1a|2a", render acc) // 2 meets the still-live "a"
    leftExpiry.OnNext() // caller closes every left window
    r.OnNext "b" // no live left ⇒ nothing
    Assert.Equal<string>("1a|2a", render acc)
    l.OnNext 3 // new left meets the two still-live rights
    Assert.Equal<string>("1a|2a|3a|3b", render acc)

[<Fact>]
let ``join with a synchronously-firing duration produces a zero-length window that matches nothing`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()

    let acc, _, _, sub =
        collect (
            RxJoin.join
                l
                r
                (fun _ -> Observable.Return(()))   // closes immediately
                (fun _ -> Observable.Never<unit>())
                (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b)
        )

    use _sub = sub

    r.OnNext "a"
    l.OnNext 1 // window opens and closes before it can meet "a"
    Assert.Equal<string>("", render acc)

[<Fact>]
let ``join completes when one side is done and the other has no live elements`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    let _, isDone, _, sub =
        collect (
            RxJoin.join l r (fun _ -> Observable.Never<unit>()) (fun _ -> Observable.Never<unit>()) (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b)
        )
    use _sub = sub

    l.OnNext 1
    l.OnCompleted()
    Assert.False(isDone ()) // 1 is still live; a right could still pair with it
    r.OnCompleted()
    Assert.True(isDone ())

[<Fact>]
let ``groupJoin gives each left element a window of the rights alive with it`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    use leftExpiry = new Subject<unit>()
    let group = new CompositeDisposable()
    let windows = ResizeArray<int * ResizeArray<string> * bool ref>()

    let obs =
        RxJoin.groupJoin
            l
            r
            (fun _ -> leftExpiry.AsObservable())
            (fun _ -> Observable.Never<unit>())
            (fun lv w -> (lv, w))

    use _outer =
        obs.Subscribe(fun (lv, w) ->
            let acc = ResizeArray<string>()
            let closed = ref false
            windows.Add((lv, acc, closed))

            group.Add(
                w.Subscribe(
                    { new IObserver<string> with
                        member _.OnNext v = acc.Add v
                        member _.OnError _ = ()
                        member _.OnCompleted() = closed.Value <- true }
                )
            ))

    l.OnNext 1
    r.OnNext "a"
    l.OnNext 2 // window 2 opens and immediately receives the still-live "a"
    r.OnNext "b"
    Assert.Equal(2, windows.Count)
    let _, w1, c1 = windows[0]
    let _, w2, c2 = windows[1]
    Assert.Equal<string>("a|b", render w1)
    Assert.Equal<string>("a|b", render w2)
    Assert.False(c1.Value)
    leftExpiry.OnNext() // caller closes both windows
    Assert.True(c1.Value)
    Assert.True(c2.Value)
    r.OnNext "c" // no open window
    Assert.Equal<string>("a|b", render w1)
    group.Dispose()


// ───────────────────────────────────────────────────────────────────────────
// §TEARDOWN — the file header's claim, pinned
// ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``TEARDOWN disposing a combinator releases BOTH source subscriptions`` () =
    use l = new Subject<int>()
    use r = new Subject<int>()
    let disposals = ref 0
    let ls = countingSource (l.AsObservable()) disposals
    let rs = countingSource (r.AsObservable()) disposals
    let acc, _, _, sub = collect (RxJoin.combineLatest ls rs (fun a b -> a + b))

    l.OnNext 1
    r.OnNext 2
    Assert.Equal<string>("3", render acc)
    Assert.Equal(0, disposals.Value)
    sub.Dispose()
    Assert.Equal(2, disposals.Value)
    l.OnNext 5 // nothing may reach the observer after teardown
    r.OnNext 6
    Assert.Equal<string>("3", render acc)

[<Fact>]
let ``TEARDOWN disposing groupJoin completes every open window and releases duration subscriptions`` () =
    use l = new Subject<int>()
    use r = new Subject<string>()
    let disposals = ref 0
    let ls = countingSource (l.AsObservable()) disposals
    let rs = countingSource (r.AsObservable()) disposals
    let closed = ResizeArray<bool ref>()
    let received = ResizeArray<string>()

    let obs =
        RxJoin.groupJoin ls rs (fun _ -> Observable.Never<unit>()) (fun _ -> Observable.Never<unit>()) (fun _ w -> w)

    let outer =
        obs.Subscribe(fun (w: IObservable<string>) ->
            let c = ref false
            closed.Add c

            w.Subscribe(
                { new IObserver<string> with
                    member _.OnNext v = received.Add v
                    member _.OnError _ = ()
                    member _.OnCompleted() = c.Value <- true }
            )
            |> ignore)

    l.OnNext 1
    l.OnNext 2
    r.OnNext "a"
    Assert.Equal(2, closed.Count)
    Assert.Equal<string>("a|a", render received)
    Assert.False(closed[0].Value)
    outer.Dispose()
    Assert.True(closed[0].Value) // every open window is closed by the ONE handle
    Assert.True(closed[1].Value)
    Assert.Equal(2, disposals.Value)
    r.OnNext "b"
    Assert.Equal<string>("a|a", render received)


// ───────────────────────────────────────────────────────────────────────────
// §DETERMINISM — same seed ⇒ same interleaving ⇒ same output, at DoP = 1
// ───────────────────────────────────────────────────────────────────────────

/// Drive both sides from ONE thread (DoP = 1) using a seeded interleaving.
/// The whole point: the operators are a pure fold over the arrival sequence,
/// so replaying the sequence replays the output exactly.
let private driveSeeded (seed: int) (build: IObservable<int> -> IObservable<int> -> (int -> int -> string) -> IObservable<string>) =
    let rnd = Random(seed)
    use l = new Subject<int>()
    use r = new Subject<int>()

    let acc, _, _, sub =
        collect (build l r (fun a b -> String.Format(Globalization.CultureInfo.InvariantCulture, "{0}:{1}", a, b)))

    use _sub = sub
    let interleaving = ResizeArray<string>()
    let mutable li = 0
    let mutable ri = 0

    for _ in 1..300 do
        if rnd.Next 2 = 0 then
            interleaving.Add "L"
            l.OnNext li
            li <- li + 1
        else
            interleaving.Add "R"
            r.OnNext ri
            ri <- ri + 1

    render interleaving, render acc

/// S = 4 is the factory's common seed.
let private commonSeed = 4

[<Theory>]
[<InlineData "zip">]
[<InlineData "combineLatest">]
[<InlineData "withLatestFrom">]
let ``DETERMINISM same seed replays the same interleaving and the same output`` (op: string) =
    let build: IObservable<int> -> IObservable<int> -> (int -> int -> string) -> IObservable<string> =
        match op with
        | "zip" -> RxJoin.zip
        | "combineLatest" -> RxJoin.combineLatest
        | "withLatestFrom" -> RxJoin.withLatestFrom
        | other -> failwithf "unknown operator %s" other

    let i1, o1 = driveSeeded commonSeed build
    let i2, o2 = driveSeeded commonSeed build
    Assert.Equal<string>(i1, i2)
    Assert.Equal<string>(o1, o2)
    Assert.NotEmpty o1

    // Non-vacuity control: a DIFFERENT seed must produce a different interleaving.
    // Without this the equality above would pass for a no-op implementation.
    let i3, _ = driveSeeded (commonSeed + 1) build
    Assert.NotEqual<string>(i1, i3)

[<Fact>]
let ``DETERMINISM join replays identically under a seeded interleaving`` () =
    let build (l: IObservable<int>) (r: IObservable<int>) (sel: int -> int -> string) =
        RxJoin.join l r (fun _ -> Observable.Never<unit>()) (fun _ -> Observable.Never<unit>()) sel

    // Windows never close here, so the pair count is quadratic; keep it honest by
    // comparing the rendered output, which is exactly what a DST replay compares.
    let _, o1 = driveSeeded commonSeed build
    let _, o2 = driveSeeded commonSeed build
    Assert.Equal<string>(o1, o2)
    Assert.NotEmpty o1


// ───────────────────────────────────────────────────────────────────────────
// §NEGATIVE CONTROL — goes red if a wall clock leaks into a join window
// ───────────────────────────────────────────────────────────────────────────

/// A join duration is a CHOICE CONTEXT. Resolve it from a wall clock and local
/// time has entered a shared conclusion
/// (.claude/rules/local-time-never-enters-the-shared-fold.md).
///
/// The control: the window is ONE HOUR long on an injected `HistoricalScheduler`
/// that the test advances by hand. Virtual time moves an hour; real time moves
/// microseconds. Substitute `Scheduler.Default` for the injected scheduler and
/// `AdvanceBy` stops closing anything — the window stays open for a real hour,
/// the post-expiry assertions see pairs that must not exist, and this test goes
/// red. That is the substitution it is built to catch.
[<Fact>]
let ``NEGATIVE CONTROL a join window closes on VIRTUAL time only - a wall clock would keep it open`` () =
    let scheduler = HistoricalScheduler()
    let oneHour = TimeSpan.FromHours 1.0
    use l = new Subject<int>()
    use r = new Subject<string>()

    let acc, _, _, sub =
        collect (
            RxJoin.join
                l
                r
                (fun _ -> RxJoin.durationAfter scheduler oneHour)
                (fun _ -> RxJoin.durationAfter scheduler oneHour)
                (fun a b -> a.ToString(Globalization.CultureInfo.InvariantCulture) + b)
        )

    use _sub = sub
    let wall = Stopwatch.StartNew()

    l.OnNext 1
    r.OnNext "a"
    Assert.Equal<string>("1a", render acc)

    // Advance VIRTUAL time past both windows. Nothing sleeps.
    scheduler.AdvanceBy(TimeSpan.FromHours 2.0)

    // 1's window and "a"'s window both expired at virtual +1h.
    r.OnNext "b" // no live left ⇒ no pair
    l.OnNext 2 // "a" is gone; only the fresh "b" is live ⇒ exactly one pair
    Assert.Equal<string>("1a|2b", render acc)

    // Name the leak directly: "1b" and "2a" are the pairs that exist ONLY if the
    // windows survived the advance — i.e. only if a wall clock, not the injected
    // scheduler, was deciding when they closed. Substituting `Scheduler.Default`
    // yields "1a|1b|2a|2b" and both of these fail.
    Assert.DoesNotContain("1b", render acc, StringComparison.Ordinal)
    Assert.DoesNotContain("2a", render acc, StringComparison.Ordinal)

    wall.Stop()
    // Two hours of window time elapsed in well under a second of real time. If a
    // wall clock were driving the window this could not be true AND the
    // assertions above could not both hold.
    Assert.True(
        wall.Elapsed < TimeSpan.FromSeconds 30.0,
        String.Format(Globalization.CultureInfo.InvariantCulture, "virtual-time join took {0} of real time", wall.Elapsed))

/// The behavioural control above catches a substituted scheduler. This one
/// catches the wall clock being reached for DIRECTLY inside the operators, which
/// no behavioural test can see. It reads the shipped source of the `RxJoin`
/// module and refuses every ambient-time API — comment and docstring lines are
/// excluded, because the doc deliberately NAMES the APIs it forbids.
[<Fact>]
let ``NEGATIVE CONTROL the RxJoin implementation names no wall-clock API`` () =
    let repoRoot () =
        let mutable dir =
            DirectoryInfo(Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly().Location))

        while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
            dir <- dir.Parent

        if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

    let path = Path.Join(repoRoot (), "src", "Core", "Rx.fs")
    Assert.True(File.Exists path, path)
    let lines = File.ReadAllLines path

    let moduleStart =
        lines
        |> Array.tryFindIndex (fun line -> line.Contains("module RxJoin", StringComparison.Ordinal))

    Assert.True(moduleStart.IsSome, "RxJoin module not found in src/Core/Rx.fs")

    let codeLines =
        lines
        |> Array.skip moduleStart.Value
        |> Array.filter (fun line -> not ((line.TrimStart()).StartsWith("//", StringComparison.Ordinal)))

    // Non-vacuity: the scan must actually have code to look at.
    Assert.True(codeLines.Length > 200, String.Format(Globalization.CultureInfo.InvariantCulture, "only {0} code lines scanned", codeLines.Length))

    let forbidden =
        [ "Scheduler.Default"
          "DefaultScheduler"
          "TaskPoolScheduler"
          "ThreadPoolScheduler"
          "CurrentThreadScheduler"
          "DateTime.Now"
          "DateTime.UtcNow"
          "DateTimeOffset.Now"
          "DateTimeOffset.UtcNow"
          "Stopwatch"
          "Thread.Sleep"
          "Task.Delay"
          "Task.Run" ]

    let offenders =
        [ for line in codeLines do
              for token in forbidden do
                  if line.Contains(token, StringComparison.Ordinal) then
                      yield String.Format(Globalization.CultureInfo.InvariantCulture, "{0} :: {1}", token, line.Trim()) ]

    Assert.Equal<string>("", String.Join(" ;; ", offenders))
