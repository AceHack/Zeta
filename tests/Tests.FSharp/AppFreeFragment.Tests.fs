module Zeta.Tests.AppFreeFragmentTests

// The falsifier for the `app`-free fragment claim.
//
// WHAT IS BEING CHECKED. `app` is John Hughes's `ArrowApply` operator (*Generalising Monads to
// Arrows*, Science of Computer Programming 37, 2000), signature `a (a b c, b) c` — an arrow that
// receives ANOTHER ARROW through its own value channel and runs it. It is not the CCC evaluation
// morphism and not applicative `ap`. Hughes's theorem `ArrowApply` == `Monad` is what makes it
// load-bearing here: an arrow without `app` has its pipeline shape fixed at construction, so the
// CHIP-8 cost predictor can compute cost before execution; an arrow with `app` selects its
// continuation from a runtime value, and no static cost analysis survives that.
//
// WHY IT EXISTS. The claim "the ISR arrow sits inside the `app`-free fragment by construction" (the
// Schuller addendum, merged in #10351/#10360) was backed by a grep run once in a session and
// written into prose. Two things were wrong with it, both established in
// docs/research/2026-08-15-the-app-free-fragment-was-a-one-time-grep-not-a-check-and-by-construction-is-false-for-isr.md:
// the check left no artefact, and "by construction" is false — `ISR` is a Kleisli arrow over a
// monad, and Hughes gives `Kleisli m` as an `ArrowApply` instance for any monad, so `app` is
// definable in one line and compiles. The property is `app`-free BY ABSENCE. Absence needs a
// falsifier.
//
// THE THREE LAYERS. Scope lives in registry/app-free-fragment.json — a diffable declaration, not a
// regex buried here. That file is the artefact; this one is its executor.
//
//   C1 TOTALITY (textual, repo-scoped)   — every src/**/*.fs mentioning the `ISR<` type must be
//                                          classified `fragment` or `outside`. Closes the original
//                                          defect: undeclared scope.
//   C2 STRUCTURAL (reflection, assembly) — no member anywhere in Zeta.Core has app's TYPE SHAPE.
//                                          Name-independent: renaming `app` to something else does
//                                          not evade it (measured, 2026-08-15). Scoped by an
//                                          explicit `structuralAllowedTypes` list, today empty.
//   C3 SYNTACTIC (text, fragment-scoped) — declared-fragment sources define no `app`/`bind`
//                                          binding, no `.Bind` member, no `>>=`, no CE builder.
//                                          This layer MUST stay scoped: `Meno.fs` and
//                                          `SagaBuilder.fs` are legitimately monadic.
//
// WHAT IT CANNOT CATCH is pinned by the `unchecked-limits` test at the bottom, in code rather than
// in a comment, so a passing gate is not read as more than it is.

open System
open System.Collections.Generic
open System.IO
open System.Reflection
open System.Text.Json
open System.Text.RegularExpressions
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

// ── Repo location ────────────────────────────────────────────────────────────────────────────

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(typeof<Zeta.Core.IntrCtx>.Assembly.Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

// ── The declared scope (registry/app-free-fragment.json) ─────────────────────────────────────

type private ScopeEntry =
    { Path: string
      Reason: string
      UncheckedCaveats: string list }

type private Manifest =
    { Fragment: ScopeEntry list
      Outside: ScopeEntry list
      StructuralAllowedTypes: string list }

module private Scope =

    let private strings (root: JsonElement) (key: string) : string list =
        match root.TryGetProperty key with
        | true, a -> [ for x in a.EnumerateArray() -> x.GetString() ]
        | _ -> []

    let private entries (root: JsonElement) (key: string) : ScopeEntry list =
        match root.TryGetProperty key with
        | false, _ -> []
        | true, arr ->
            [ for e in arr.EnumerateArray() ->
                  { Path = e.GetProperty("path").GetString()
                    Reason =
                      match e.TryGetProperty "reason" with
                      | true, r -> r.GetString()
                      | _ -> ""
                    UncheckedCaveats =
                      match e.TryGetProperty "uncheckedCaveats" with
                      | true, c -> [ for x in c.EnumerateArray() -> x.GetString() ]
                      | _ -> [] } ]

    let path () =
        Path.Join(repoRoot (), "registry", "app-free-fragment.json")

    let read () : Manifest =
        let p = path ()
        Assert.True(File.Exists p, $"declared-scope manifest not found: %s{p}")
        use doc = JsonDocument.Parse(File.ReadAllText p)
        let root = doc.RootElement

        { Fragment = entries root "fragment"
          Outside = entries root "outside"
          StructuralAllowedTypes = strings root "structuralAllowedTypes" }

// ── C2: the structural detector (reflection; name-independent) ───────────────────────────────
//
// F# ETA-EXPANDS, which is the fact this layer turns on. `ISR<'A,'B>` is a type ABBREVIATION for
// `IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>`, so a module-level binding returning one
// compiles FLAT: `IsrLift.ofPure` has parameters (FSharpFunc<a,b>, IntrCtx, a) and return
// Task<Result<b, InterruptFeedback>> — the `ISR` node is not in the return type at all. Measured by
// reflection on the Release build, 2026-08-15. The detector therefore reads the flattened form.
//
// THE DISCRIMINATOR. In a flattened signature, everything BEFORE the last `IntrCtx` parameter is
// supplied at CONSTRUCTION; everything AFTER it is the arrow's VALUE CHANNEL. `app` is exactly "an
// arrow arriving through the value channel", which separates the legitimate from the forbidden with
// no reference to any name (all four rows measured on the Release build):
//
//   ISR.(>=>)        params (ISR<A,B>, ISR<B,C>, IntrCtx, A)  arrows are CONSTRUCTION args  → OK
//   IsrLift.ofPure   params (FSharpFunc<a,b>, IntrCtx, a)     value channel is `a`          → OK
//   app              params (IntrCtx, ISR<a,b>, a)            arrow IS the value channel    → VIOLATION
//   the same, renamed  params (IntrCtx, ISR<a,b>, a)          identical shape               → VIOLATION

module private Structural =

    let private coreAssembly = typeof<Zeta.Core.IntrCtx>.Assembly

    /// Recursion bound for `containsIsr`. An arrow buried deeper than this inside nested record
    /// fields is not found — a stated limit, not an accident.
    [<Literal>]
    let MaxFieldDepth = 8

    let private isIntrCtx (t: Type) = t = typeof<IntrCtx>

    /// `Task<Result<'B, InterruptFeedback>>` -> `Some 'B`. The ISR return shape.
    let private taskResultPayload (t: Type) : Type option =
        if t.IsGenericType && t.GetGenericTypeDefinition() = typedefof<Task<obj>> then
            let inner = t.GetGenericArguments().[0]

            if
                inner.IsGenericType
                && inner.GetGenericTypeDefinition() = typedefof<Result<obj, obj>>
                && inner.GetGenericArguments().[1] = typeof<InterruptFeedback>
            then
                Some(inner.GetGenericArguments().[0])
            else
                None
        else
            None

    /// A CURRIED `ISR<'A,'B>` node: `FSharpFunc<IntrCtx, FSharpFunc<'A, Task<Result<'B, IF>>>>`.
    /// This is the form `ISR` takes when NESTED inside another type (a parameter, a record field),
    /// as opposed to the flattened form it takes as a member's own signature.
    let asIsrFunc (t: Type) : (Type * Type) option =
        if
            t.IsGenericType
            && t.GetGenericTypeDefinition() = typedefof<FSharpFunc<obj, obj>>
        then
            let outer = t.GetGenericArguments()

            if
                isIntrCtx outer.[0]
                && outer.[1].IsGenericType
                && outer.[1].GetGenericTypeDefinition() = typedefof<FSharpFunc<obj, obj>>
            then
                let inner = outer.[1].GetGenericArguments()

                match taskResultPayload inner.[1] with
                | Some b -> Some(inner.[0], b)
                | None -> None
            else
                None
        else
            None

    let private containsCache = Dictionary<Type, bool>()

    /// Does an ISR arrow occur anywhere inside this type? Walks generic arguments, array element
    /// types, and — only for concrete types declared in Zeta.Core — record/union field types, so an
    /// arrow smuggled inside a wrapper record is still found. Bounded by `MaxFieldDepth`.
    let containsIsr (root: Type) : bool =
        match containsCache.TryGetValue root with
        | true, v -> v
        | _ ->
            let seen = HashSet<Type>()

            let rec go depth (t: Type) =
                if isNull t || depth > MaxFieldDepth || not (seen.Add t) then
                    false
                elif (asIsrFunc t).IsSome then
                    true
                else
                    let children =
                        [ if t.IsArray then
                              yield t.GetElementType()
                          if t.IsGenericType then
                              yield! t.GetGenericArguments()
                          if
                              t.Assembly = coreAssembly
                              && not t.IsGenericParameter
                              && not t.IsEnum
                              && not t.IsInterface
                          then
                              yield!
                                  t.GetFields(
                                      BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Instance
                                  )
                                  |> Array.map (fun f -> f.FieldType) ]

                    children |> List.exists (go (depth + 1))

            let result =
                try
                    go 0 root
                with _ ->
                    false

            containsCache.[root] <- result
            result

    /// One reported violation.
    type Diagnostic =
        { DeclaringType: string
          Member: string
          Construct: string }

        override this.ToString() =
            $"  %s{this.DeclaringType}.%s{this.Member}\n      %s{this.Construct}"

    /// The FLATTENED-member rule: an arrow in the value channel of an eta-expanded ISR member.
    let private flattenedViolation (mi: MethodInfo) : string option =
        match taskResultPayload mi.ReturnType with
        | None -> None
        | Some _ ->
            let ps = mi.GetParameters()

            match ps |> Array.tryFindIndexBack (fun p -> isIntrCtx p.ParameterType) with
            | None -> None
            | Some ctxIndex ->
                ps.[ctxIndex + 1 ..]
                |> Array.tryFind (fun p -> containsIsr p.ParameterType)
                |> Option.map (fun p ->
                    $"Hughes ArrowApply shape: value-channel parameter '%s{p.Name}' of an ISR-returning "
                    + $"member is itself an ISR arrow (%s{p.ParameterType.ToString()}). An arrow arriving "
                    + "through the value channel makes the pipeline shape value-dependent "
                    + "(ArrowApply == Monad, Hughes 2000).")

    /// The NESTED rule: any `ISR<'A,'B>` node, wherever it sits in a signature, whose input `'A`
    /// itself contains an arrow. Catches the non-eta-expanded spellings — a record field, a
    /// property, or a member genuinely returning a curried `ISR<ISR<_,_> * _, _>`.
    let private nestedViolation (where: string) (root: Type) : string option =
        let seen = HashSet<Type>()

        let rec go depth (t: Type) : string option =
            if isNull t || depth > MaxFieldDepth || not (seen.Add t) then
                None
            else
                match asIsrFunc t with
                | Some(input, _) when containsIsr input ->
                    Some(
                        $"Hughes ArrowApply shape: %s{where} is an ISR arrow whose VALUE channel type "
                        + $"(%s{input.ToString()}) contains another ISR arrow — `app` under some spelling."
                    )
                | _ ->
                    let children =
                        [ if t.IsArray then
                              yield t.GetElementType()
                          if t.IsGenericType then
                              yield! t.GetGenericArguments() ]

                    children |> List.tryPick (go (depth + 1))

        try
            go 0 root
        with _ ->
            None

    let private memberFlags =
        BindingFlags.Public
        ||| BindingFlags.NonPublic
        ||| BindingFlags.Static
        ||| BindingFlags.Instance
        ||| BindingFlags.DeclaredOnly

    let typeName (t: Type) =
        if isNull t.FullName then t.Name else t.FullName

    /// Scan one .NET type for app-shaped members.
    let scanType (t: Type) : Diagnostic list =
        let mk name construct =
            { DeclaringType = typeName t
              Member = name
              Construct = construct }

        let members =
            try
                t.GetMembers memberFlags
            with _ ->
                Array.empty

        [ for m in members do
              match m with
              | :? MethodInfo as mi ->
                  match flattenedViolation mi with
                  | Some c -> yield mk mi.Name c
                  | None ->
                      match nestedViolation $"the return type of '%s{mi.Name}'" mi.ReturnType with
                      | Some c -> yield mk mi.Name c
                      | None ->
                          for p in mi.GetParameters() do
                              match nestedViolation $"parameter '%s{p.Name}' of '%s{mi.Name}'" p.ParameterType with
                              | Some c -> yield mk mi.Name c
                              | None -> ()
              | :? FieldInfo as fi ->
                  match nestedViolation $"field '%s{fi.Name}'" fi.FieldType with
                  | Some c -> yield mk fi.Name c
                  | None -> ()
              | _ -> () ]

    /// Every type in an assembly, tolerating a partially-loadable dependency graph.
    let typesOf (asm: Assembly) : Type list =
        try
            asm.GetTypes() |> List.ofArray
        with :? ReflectionTypeLoadException as ex ->
            ex.Types |> Array.filter (isNull >> not) |> List.ofArray

    /// Scan a whole assembly. Repo-wide by default — an arrow in a value channel is not something we
    /// want appearing quietly ANYWHERE in Zeta.Core, and the exemption path is a manifest entry.
    let scanAssembly (asm: Assembly) : Diagnostic list = typesOf asm |> List.collect scanType

// ── C3: the syntactic detector (text; fragment-scoped only) ──────────────────────────────────

module private Syntactic =

    type Hit =
        { Path: string
          Line: int
          Construct: string
          Text: string }

        override this.ToString() =
            $"  %s{this.Path}:%d{this.Line}  %s{this.Construct}\n      %s{this.Text.Trim()}"

    /// Doc-comments and line comments are prose, and the prose in these very modules discusses
    /// `bind` and "the ISR monad" on purpose. Strip before matching, or the check fires on its own
    /// documentation. Block comments are NOT stripped — a stated limit.
    ///
    /// MEASURED 2026-08-15: without this, C1 reported `SchedulerShedHeat.fs` and `SoftThrottle.fs`,
    /// whose ONLY `ISR<'S,'S>` occurrences sit inside docstrings explaining what `Handler.Run`
    /// cannot see. Forcing a manifest entry for every prose mention would fill the allowlist with
    /// noise and erode exactly the signal it exists to carry. Both layers therefore read CODE.
    let stripComments (line: string) =
        let i = line.IndexOf("//", StringComparison.Ordinal)
        if i >= 0 then line.Substring(0, i) else line

    let private compiled: (Regex * string) list =
        [ @"\blet\s+(?:inline\s+|private\s+|rec\s+|mutable\s+)*app\b",
          "Hughes ArrowApply binding named `app`"
          @"\blet\s+(?:inline\s+|private\s+|rec\s+|mutable\s+)*bind\b", "monadic `bind` binding"
          @"\bmember\s+\S+\.Bind\b", "computation-expression `Bind` member (monadic bind)"
          @"\(\s*>>=\s*\)", "monadic bind operator `>>=`"
          @"\btype\s+\w*Builder\s*\(", "computation-expression builder type"
          @"\b\w+Builder\s*\(\s*\)", "computation-expression builder instantiation" ]
        |> List.map (fun (p, d) -> Regex(p, RegexOptions.CultureInvariant), d)

    /// Scan one source file for monadic spellings.
    let scanSource (root: string) (relPath: string) : Hit list =
        let abs = Path.Join(root, relPath)

        if not (File.Exists abs) then
            []
        else
            [ for i, raw in File.ReadAllLines abs |> Array.indexed do
                  let line = stripComments raw

                  for rx, desc in compiled do
                      if rx.IsMatch line then
                          yield
                              { Path = relPath
                                Line = i + 1
                                Construct = desc
                                Text = raw } ]

// ── C1: totality ─────────────────────────────────────────────────────────────────────────────

let private isrTypeRefs (root: string) : string list =
    let rx = Regex(@"\bISR<", RegexOptions.CultureInvariant)

    Directory.EnumerateFiles(Path.Join(root, "src"), "*.fs", SearchOption.AllDirectories)
    |> Seq.filter (fun p ->
        let n = p.Replace('\\', '/')

        not (n.Contains("/bin/", StringComparison.Ordinal))
        && not (n.Contains("/obj/", StringComparison.Ordinal)))
    |> Seq.filter (fun p ->
        File.ReadAllLines p
        |> Array.exists (Syntactic.stripComments >> rx.IsMatch))
    |> Seq.map (fun p -> Path.GetRelativePath(root, p).Replace('\\', '/'))
    |> Seq.sortWith (fun a b -> String.CompareOrdinal(a, b))
    |> List.ofSeq

// ═════════════════════════════════════════════════════════════════════════════════════════════
// The tests
// ═════════════════════════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``manifest - the declared scope is well-formed, exists on disk, and gives reasons`` () =
    let m = Scope.read ()
    let root = repoRoot ()
    Assert.NotEmpty m.Fragment
    Assert.NotEmpty m.Outside

    for e in m.Fragment @ m.Outside do
        Assert.True(File.Exists(Path.Join(root, e.Path)), $"declared path does not exist: %s{e.Path}")

        Assert.True(
            e.Reason.Length >= 60,
            $"%s{e.Path}: a scope entry without a real reason is undeclared scope wearing a filename "
            + $"(got %d{e.Reason.Length} chars). The allowlist IS the content."
        )

    let dup =
        m.Fragment
        |> List.map (fun e -> e.Path)
        |> List.filter (fun p -> m.Outside |> List.exists (fun o -> String.Equals(o.Path, p, StringComparison.Ordinal)))

    Assert.True(List.isEmpty dup, $"path declared both inside and outside the fragment: %A{dup}")

[<Fact>]
let ``C1 totality - every ISR-typed source file is classified, so scope cannot drift in silently`` () =
    let root = repoRoot ()
    let m = Scope.read ()

    let declared =
        (m.Fragment @ m.Outside) |> List.map (fun e -> e.Path) |> Set.ofList

    let unclassified = isrTypeRefs root |> List.filter (declared.Contains >> not)

    Assert.True(
        List.isEmpty unclassified,
        "These files use the `ISR<` type but are not classified in registry/app-free-fragment.json:\n"
        + String.Join("\n", unclassified |> List.map (fun p -> "  " + p))
        + "\n\nThe original defect was UNDECLARED SCOPE — a grep over one module, written up as if it "
        + "covered the arrow. Add each file to `fragment` (with the reason it stays app-free) or to "
        + "`outside` (with the reason it is legitimately monadic). Choosing is the point."
    )

[<Fact>]
let ``C2 structural - no member of Zeta.Core has the ArrowApply type shape`` () =
    let m = Scope.read ()
    let allowed = Set.ofList m.StructuralAllowedTypes

    let violations =
        Structural.scanAssembly (typeof<Zeta.Core.IntrCtx>.Assembly)
        |> List.filter (fun d -> not (allowed.Contains d.DeclaringType))

    Assert.True(
        List.isEmpty violations,
        "ArrowApply-shaped member(s) found in Zeta.Core — the `app`-free fragment claim is now FALSE:\n"
        + String.Join("\n", violations |> List.map string)
        + "\n\nThis is detected by TYPE SHAPE, not by name, so renaming the operator does not clear it. "
        + "If the member is deliberate it belongs in `structuralAllowedTypes` in "
        + "registry/app-free-fragment.json with a reason, and any cost claim resting on the fragment "
        + "must be re-stated as no longer statically analysable."
    )

[<Fact>]
let ``C3 syntactic - declared-fragment sources contain no monadic construct`` () =
    let root = repoRoot ()
    let m = Scope.read ()
    let hits = m.Fragment |> List.collect (fun e -> Syntactic.scanSource root e.Path)

    Assert.True(
        List.isEmpty hits,
        "Monadic construct(s) inside the declared `app`-free fragment:\n"
        + String.Join("\n", hits |> List.map string)
        + "\n\nEither the construct leaves, or the module leaves `fragment` in "
        + "registry/app-free-fragment.json — and if it leaves, the CHIP-8 static-cost claim no longer "
        + "covers it."
    )

// ── Mutation tests: the check must be able to FAIL, and for the right reason ──────────────────

/// A synthetic in-fragment mutation. This IS `app` — an arrow arriving through the value channel —
/// written under a name sharing no substring with `app`, `bind`, or `Bind`. It exists to prove C2
/// fires on SHAPE. A grep re-encoded as a lint would pass this, and passing it would mean the
/// falsifier had the same defect as the prose it replaces.
module private SyntheticFragmentMutation =

    let dispatchInner (ctx: IntrCtx) (inner: ISR<'a, 'b>) (value: 'a) : Task<Result<'b, InterruptFeedback>> =
        inner ctx value

[<Fact>]
let ``mutation C2 - an ArrowApply-shaped member is detected under a non-obvious name`` () =
    let t =
        Structural.typesOf (Assembly.GetExecutingAssembly())
        |> List.find (fun t -> String.Equals(t.Name, "SyntheticFragmentMutation", StringComparison.Ordinal))

    let diags = Structural.scanType t
    let d = List.exactlyOne diags

    // The diagnostic names the module and the construct — requirement, not decoration.
    Assert.Equal("dispatchInner", d.Member)
    Assert.Contains("SyntheticFragmentMutation", d.DeclaringType, StringComparison.Ordinal)
    Assert.Contains("ArrowApply", d.Construct, StringComparison.Ordinal)
    Assert.Contains("value-channel parameter", d.Construct, StringComparison.Ordinal)
    // The NAME carries no signal. That is the whole point of a shape check.
    Assert.DoesNotContain("app", d.Member, StringComparison.Ordinal)

[<Fact>]
let ``mutation C2 - the legitimate combinators stay green (>=> takes its arrows at construction)`` () =
    // `ISR.(>=>)` has TWO ISR parameters and must NOT be flagged: they are supplied when the pipeline
    // is built, not carried through it. If this ever goes red the detector has become a ban on arrows
    // as arguments — which would flag every combinator in the fragment and get itself deleted.
    //
    // These assertions are deliberately MEMBER-scoped rather than type-scoped. A type-scoped
    // `Assert.Empty(scanType isrLift)` would go red under the IsrLift mutation too, which muddies the
    // signal: a mutation should redden the two CLAIM tests (C2, C3) and nothing else.
    let core = typeof<Zeta.Core.IntrCtx>.Assembly

    let isrModule =
        Structural.typesOf core
        |> List.find (fun t -> String.Equals(t.Name, "ISRModule", StringComparison.Ordinal))

    Assert.Empty(
        Structural.scanType isrModule
        |> List.filter (fun d -> d.Member.Contains("GreaterEqualsGreater", StringComparison.Ordinal))
    )

    Assert.Empty(
        Structural.scanType (core.GetType("Zeta.Core.IsrLift", true))
        |> List.filter (fun d ->
            String.Equals(d.Member, "ofPure", StringComparison.Ordinal)
            || String.Equals(d.Member, "ofPolicy", StringComparison.Ordinal))
    )

[<Fact>]
let ``mutation C3 - the syntactic layer fires when ArrowApply is injected into a fragment file`` () =
    // The real mutation (appending the operator to src/Core/IsrLift.fs and rebuilding the solution)
    // was run against the Release build and its raw exit codes are recorded in the research doc.
    // Here the fixture is a SELF-CONTAINED snippet rather than a copy of the live file: reading
    // IsrLift.fs would make this test's verdict depend on the very file the real mutation edits, so
    // it would go red during the mutation run for a reason unrelated to what it asserts.
    let tmp = Zeta.Tests.Support.DeterministicTestPath.nextDir "app-free-mutation"

    let clean =
        String.Join(
            "\n",
            [ "[<RequireQualifiedAccess>]"
              "module Fixture ="
              "    /// A doc-comment naming app, bind and Bind — prose must not trip the check."
              "    let ofPure (f: 'a -> 'b) : ISR<'a, 'b> ="
              "        fun _ctx a -> Task.FromResult(Ok(f a))" ]
        )

    let injected =
        clean
        + "\n\n    let app<'a, 'b> : ISR<ISR<'a, 'b> * 'a, 'b> =\n        fun ctx (f, a) -> f ctx a\n"

    // Clean fixture: no hits — including from the doc-comment that names every banned spelling.
    File.WriteAllText(Path.Join(tmp, "clean.fs"), clean)
    Assert.Empty(Syntactic.scanSource tmp "clean.fs")

    // Injected fixture: exactly one hit, naming the file, the line and the construct.
    File.WriteAllText(Path.Join(tmp, "injected.fs"), injected)
    let h = List.exactlyOne (Syntactic.scanSource tmp "injected.fs")
    Assert.Contains("ArrowApply", h.Construct, StringComparison.Ordinal)
    Assert.Equal("injected.fs", h.Path)
    Assert.Equal(7, h.Line)

// ── Scope tests: the check must NOT fire outside the declared fragment ────────────────────────

[<Fact>]
let ``scope - Meno and SagaBuilder are OUTSIDE, and their monadic code is exactly what C3 bans`` () =
    let root = repoRoot ()
    let m = Scope.read ()
    let outsidePaths = m.Outside |> List.map (fun e -> e.Path) |> Set.ofList
    let fragmentPaths = m.Fragment |> List.map (fun e -> e.Path) |> Set.ofList

    for path in [ "src/Core/Meno.fs"; "src/Core/SagaBuilder.fs" ] do
        Assert.True(outsidePaths.Contains path, $"%s{path} must be declared outside the fragment")
        Assert.False(fragmentPaths.Contains path, $"%s{path} must never be pulled into the fragment")

        // The load-bearing half. Both files DO contain constructs C3 bans — `MenoBuilder.Bind`
        // selects a continuation arrow from a runtime value, and `SagaBuilder` is a full computation
        // expression that ingests ISR via `liftISR`. They stay green ONLY because scope excludes
        // them. Green for any other reason would mean the lint is a no-op wearing a passing badge;
        // and a lint that flagged them would be switched off the first time someone wrote legitimate
        // monadic code.
        Assert.NotEmpty(Syntactic.scanSource root path)

[<Fact>]
let ``scope - the modules the predictor actually composes are IN the fragment`` () =
    let m = Scope.read ()
    let fragmentPaths = m.Fragment |> List.map (fun e -> e.Path) |> Set.ofList

    // The original grep covered IsrLift.fs alone, yet the claim was read as covering the arrow. The
    // declared fragment therefore covers the CHIP-8 composition path: the carrier, the lifts, the
    // run loop, the CHIP-8 client, and the soft-value arrows.
    for required in
        [ "src/Core/IntrCtx.fs"
          "src/Core/IsrLift.fs"
          "src/Core/SoftScheduler.fs"
          "src/Core/SoftChip8Scheduler.fs"
          "src/Core/SoftIsr.fs" ] do
        Assert.True(fragmentPaths.Contains required, $"%s{required} is on the predictor path and must be declared")

// ── The honest limits, pinned in code ─────────────────────────────────────────────────────────

[<Fact>]
let ``unchecked-limits - the known in-fragment boundary case is DECLARED, not silently passed`` () =
    // `SoftScheduler.HandlerK.RunK : InterruptKind -> ISR<'S,'S>` selects an arrow from a runtime
    // value. That is the bind-continuation shape and it is the closest thing to `app` inside the
    // declared fragment. NEITHER layer flags it, and neither can by type: it is indistinguishable
    // from `SoftChip8Scheduler.timerIsr : int -> ISR<Frame,Frame>`, a legitimate construction-time
    // parameterised builder. Telling them apart needs dataflow — does the argument originate inside
    // the pipeline? — which this checker does not do.
    //
    // This test's job is to keep that limit WRITTEN DOWN. A silent unchecked case is how the prose
    // claim got into trouble in the first place.
    let m = Scope.read ()

    let softScheduler =
        m.Fragment
        |> List.find (fun e -> String.Equals(e.Path, "src/Core/SoftScheduler.fs", StringComparison.Ordinal))

    Assert.NotEmpty softScheduler.UncheckedCaveats
    let caveat = String.Join(" ", softScheduler.UncheckedCaveats)
    Assert.Contains("HandlerK", caveat, StringComparison.Ordinal)
    Assert.Contains("RunK", caveat, StringComparison.Ordinal)

    // And the shape really is present in the compiled type — a live gap, not a hedge against
    // something imaginary.
    let handlerK =
        Structural.typesOf (typeof<Zeta.Core.IntrCtx>.Assembly)
        |> List.find (fun t -> t.Name.StartsWith("HandlerK", StringComparison.Ordinal))

    let runK =
        handlerK.GetProperties(BindingFlags.Public ||| BindingFlags.Instance)
        |> Array.find (fun p -> String.Equals(p.Name, "RunK", StringComparison.Ordinal))

    // It is a function INTO an arrow (unflagged, by design) and not an arrow whose value channel
    // carries an arrow (which would be flagged).
    Assert.True(runK.PropertyType.IsGenericType)
    Assert.Empty(Structural.scanType handlerK)
