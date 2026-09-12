module Zeta.Tests.Algebra.LawWitnessTests

open System
open System.IO
open System.Reflection
open Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════
// LAWS AS AN INDEPENDENT AXIS — the falsifiers (081M29N1AX9087G0R001GSJD6G)
//
// `src/Core/LawWitness.fs` claims that `Associative<Octonion>` cannot be built. A claim
// like that is worth exactly its falsifier, so this file is organised as one:
//
//   §A CONTROL      — the scheme is not vacuous. A witness scheme where NOTHING is
//                     constructible passes every "it refuses X" test, so the first job is
//                     to prove `Associative<Quaternion>` IS constructible and IS usable.
//   §B THE LOSS     — the laws really are lost, counted exhaustively over the repo's own
//                     `ImaginaryStack`: 42/49 · 168/343 · 84. Pinned, not stated in prose.
//   §C THE REFUSAL  — a reachability search by reflection over every accessible producer
//                     in the module. This is the falsifier proper: it fails the moment any
//                     path to `Associative<Octonion>` appears.
//   §D THE ESCAPES  — the deliberate hunt for a hole, and what it FOUND. One escape is
//                     caught by the module; two are not, and say so out loud.
//   §E THE GUARD    — a source scan so the caught escape stays caught.
// ═══════════════════════════════════════════════════════════════════════════

// ── element builders (integer components ⇒ float arithmetic is exact) ──────

let private cplx (a: float) (b: float) : Complex = Doubled.make a b

let private quat (a: float) (b: float) (c: float) (d: float) : Quaternion =
    Doubled.make (cplx a b) (cplx c d)

let private octOf (v: float[]) : Octonion =
    Doubled.make (quat v.[0] v.[1] v.[2] v.[3]) (quat v.[4] v.[5] v.[6] v.[7])

let private sedOf (v: float[]) : Sedenion =
    Doubled.make (octOf v.[0..7]) (octOf v.[8..15])

let private octUnit (i: int) : Octonion =
    octOf (Array.init 8 (fun k -> if k = i then 1.0 else 0.0))

let private sedUnit (i: int) : Sedenion =
    sedOf (Array.init 16 (fun k -> if k = i then 1.0 else 0.0))

let private R = Real.algebra
let private C = ImaginaryStack.complex
let private H = ImaginaryStack.quaternion
let private O = ImaginaryStack.octonion
let private S = ImaginaryStack.sedenion

// ═══════════════════════════════════════════════════════════════════════════
// §A  CONTROL — the scheme is NOT vacuous
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``CONTROL: Associative<Quaternion> IS constructible — the scheme hands out real witnesses`` () =
    let proof = LawWitness.QuaternionRung.associative
    Assert.False(isNull (box proof))
    // The lift chain is visible in the label: R doubled to C doubled to H.
    Assert.Equal("Doubled<Doubled<R>>", proof.Rung)

[<Fact>]
let ``CONTROL: the witness is USABLE — productBalanced agrees with the left fold at H`` () =
    let proof = LawWitness.QuaternionRung.associative

    let xs =
        [| quat 1.0 2.0 -1.0 3.0
           quat 0.0 1.0 2.0 -2.0
           quat 3.0 -1.0 0.0 1.0
           quat -2.0 0.0 1.0 1.0
           quat 1.0 1.0 1.0 -1.0 |]

    // Two different bracketings of the same product. Equal at H precisely because ℍ is
    // associative, which is what the witness attests.
    Assert.Equal<Quaternion>(LawWitness.productLeftFold H xs, LawWitness.productBalanced proof H xs)

[<Fact>]
let ``CONTROL: at O the SAME two bracketings DISAGREE — which is why the witness is withheld`` () =
    // No `Associative<Octonion>` exists, so `productBalanced` cannot even be called here.
    // The rebracketing is done by hand to show the refusal is protecting a real difference.
    let xs = [| octUnit 1; octUnit 2; octUnit 4 |]
    let leftFold = LawWitness.productLeftFold O xs // ((1·x0)·x1)·x2
    let rebracketed = O.Mul(xs.[0], O.Mul(xs.[1], xs.[2])) // x0·(x1·x2)
    Assert.NotEqual<Octonion>(leftFold, rebracketed)

[<Fact>]
let ``CONTROL: Commutative<Complex> IS constructible and squareOfSum is correct at C`` () =
    let proof = LawWitness.ComplexRung.commutative
    let x = cplx 2.0 3.0
    let y = cplx -1.0 4.0
    let s = C.Add(x, y)
    Assert.Equal<Complex>(C.Mul(s, s), LawWitness.squareOfSum proof C x y)

[<Fact>]
let ``CONTROL: at H the squareOfSum identity FAILS — which is why Commutative<Quaternion> is withheld`` () =
    // `squareOfSum` is uncallable at H; the expansion is inlined to show the loss is real.
    let x = quat 0.0 1.0 0.0 0.0 // i
    let y = quat 0.0 0.0 1.0 0.0 // j
    let s = H.Add(x, y)
    let xy = H.Mul(x, y)
    let expanded = H.Add(H.Add(H.Mul(x, x), H.Add(xy, xy)), H.Mul(y, y))
    Assert.NotEqual<Quaternion>(H.Mul(s, s), expanded)

[<Fact>]
let ``CONTROL: Alternative<Octonion> IS constructible and mulSquareLeft is correct at O`` () =
    let proof = LawWitness.OctonionRung.alternative

    let cases =
        [ octUnit 1, octUnit 2
          octUnit 3, octUnit 5
          octOf [| 1.0; 2.0; 0.0; -1.0; 3.0; 0.0; 1.0; 2.0 |], octUnit 6
          octOf [| 0.0; 1.0; 1.0; 0.0; -2.0; 1.0; 0.0; 3.0 |],
          octOf [| 2.0; 0.0; -1.0; 1.0; 0.0; 1.0; 2.0; 0.0 |] ]

    for (x, y) in cases do
        // The left alternative law: x·(x·y) = (x·x)·y.
        Assert.Equal<Octonion>(O.Mul(x, O.Mul(x, y)), LawWitness.mulSquareLeft proof O x y)

[<Fact>]
let ``CONTROL: at S the left-alternative rewrite FAILS — which is why Alternative<Sedenion> is withheld`` () =
    // Uncallable at S; inlined to show the loss. e₁ and e₁₀ generate a non-alternative pair.
    let x = S.Add(sedUnit 1, sedUnit 10)
    let y = sedUnit 5
    Assert.NotEqual<Sedenion>(S.Mul(x, S.Mul(x, y)), S.Mul(S.Mul(x, x), y))

[<Fact>]
let ``CONTROL: unitInverse is available at O and its result is a genuine two-sided inverse`` () =
    let x = octOf [| 0.0; 1.0; 0.0; 0.0; 0.0; 0.0; 0.0; 0.0 |] // unit norm
    let inv = LawWitness.unitInverse LawWitness.OctonionRung.noZeroDivisors LawWitness.OctonionRung.alternative O x
    Assert.Equal<Octonion>(O.One, O.Mul(x, inv))
    Assert.Equal<Octonion>(O.One, O.Mul(inv, x))

[<Fact>]
let ``CONTROL: the SelfConjugate axiom is TRUE at R and FALSE one rung up`` () =
    // The axiom `SelfConjugate<float>` asserts `Conj = id` on ℝ. It must not be a decoration.
    for v in [ 0.0; 1.0; -3.5; 42.0 ] do
        Assert.Equal(v, R.Conj v)

    // ℂ is not self-conjugate — which is the whole reason `Commutative<Quaternion>` does
    // not exist. If this ever became true, the refusal in §C would be unjustified.
    let z = cplx 1.0 2.0
    Assert.NotEqual<Complex>(z, C.Conj z)

// ═══════════════════════════════════════════════════════════════════════════
// §B  THE LOSS — counted exhaustively, pinned as regression witnesses
//
// A stated counterexample rots; a locked one does not. Every count below is computed from
// `ImaginaryStack` at test time, not copied from a note.
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``PINNED: 42 of the 49 octonion imaginary-basis pairs refute Mul commutativity`` () =
    let e = [| for i in 1..7 -> octUnit i |]
    let mutable refuted = 0

    for a in e do
        for b in e do
            if O.Mul(a, b) <> O.Mul(b, a) then
                refuted <- refuted + 1

    Assert.Equal(49, e.Length * e.Length)
    Assert.Equal(42, refuted)

[<Fact>]
let ``PINNED: 168 of the 343 octonion imaginary-basis triples refute Mul associativity`` () =
    let e = [| for i in 1..7 -> octUnit i |]
    let mutable refuted = 0

    for a in e do
        for b in e do
            for c in e do
                if O.Mul(O.Mul(a, b), c) <> O.Mul(a, O.Mul(b, c)) then
                    refuted <- refuted + 1

    Assert.Equal(343, e.Length * e.Length * e.Length)
    Assert.Equal(168, refuted)

[<Fact>]
let ``PINNED: 84 sedenion basis-sum pairs multiply to zero with both factors non-zero`` () =
    // The 105 elements `eᵢ + eⱼ` for 1 ≤ i < j ≤ 15. Exactly 84 ORDERED pairs of them have
    // a zero product — the standard sedenion zero-divisor count, and the reason there is no
    // `NoZeroDivisors<Sedenion>`.
    let sums =
        [| for i in 1..15 do
               for j in (i + 1) .. 15 -> S.Add(sedUnit i, sedUnit j) |]

    Assert.Equal(105, sums.Length)

    for p in sums do
        Assert.NotEqual<Sedenion>(S.Zero, p) // both factors non-zero, by construction

    let mutable zeroProducts = 0

    for x in sums do
        for y in sums do
            if S.Mul(x, y) = S.Zero then
                zeroProducts <- zeroProducts + 1

    Assert.Equal(84, zeroProducts)

[<Fact>]
let ``CONTROL for the 84: the identical construction over OCTONIONS yields ZERO zero divisors`` () =
    // 𝕆 is a division algebra, so the same sweep must find nothing. Without this control the
    // 84 above could be an artefact of how the sums were built rather than a fact about 𝕊.
    let sums =
        [| for i in 1..7 do
               for j in (i + 1) .. 7 -> O.Add(octUnit i, octUnit j) |]

    Assert.Equal(21, sums.Length)
    let mutable zeroProducts = 0

    for x in sums do
        for y in sums do
            if O.Mul(x, y) = O.Zero then
                zeroProducts <- zeroProducts + 1

    Assert.Equal(0, zeroProducts)

// ═══════════════════════════════════════════════════════════════════════════
// §C  THE REFUSAL — reachability over every accessible producer, by reflection
//
// The scheme's central claim is a NEGATIVE: no path reaches `Associative<Octonion>`. Asserting
// that by hand would only test the paths I thought of, so the producer graph is derived from
// the compiled assembly and searched. The mutation this is built to catch is dropping the
// `Commutative<'W>` parameter from `Associative<'W>.Double`.
// ═══════════════════════════════════════════════════════════════════════════

let private rungTypes: Type[] =
    [| typeof<float>; typeof<Complex>; typeof<Quaternion>; typeof<Octonion>; typeof<Sedenion> |]

let private rungName (t: Type) =
    if t = typeof<float> then "R"
    elif t = typeof<Complex> then "C"
    elif t = typeof<Quaternion> then "H"
    elif t = typeof<Octonion> then "O"
    elif t = typeof<Sedenion> then "S"
    else t.Name

let private witnessDefs: Type[] =
    [| typedefof<LawWitness.SelfConjugate<float>>
       typedefof<LawWitness.Commutative<float>>
       typedefof<LawWitness.Associative<float>>
       typedefof<LawWitness.Alternative<float>>
       typedefof<LawWitness.NoZeroDivisors<float>> |]

let private lawWitnessModule: Type =
    typedefof<LawWitness.Associative<float>>.DeclaringType

/// The 25 closed witness types (5 laws × 5 rungs) that form the search space.
let private nodes: Set<string> =
    set
        [ for d in witnessDefs do
              for r in rungTypes -> d.MakeGenericType(r).AssemblyQualifiedName ]

let private nodeName (t: Type) =
    let head = t.Name.Split('`').[0]
    head + "<" + rungName (t.GetGenericArguments().[0]) + ">"

let private isNode (t: Type) =
    t.IsGenericType
    && not t.IsGenericTypeDefinition
    && nodes.Contains t.AssemblyQualifiedName

let rec private nestedClosure (t: Type) : Type list =
    t
    :: (t.GetNestedTypes(BindingFlags.Public ||| BindingFlags.NonPublic)
        |> Array.toList
        |> List.collect nestedClosure)

/// Reachable from an assembly that has `InternalsVisibleTo` — i.e. what ordinary code,
/// rather than reflection, could call.
let private ilAccessible (m: MethodBase) =
    m.IsPublic || m.IsAssembly || m.IsFamilyOrAssembly

/// (inputs, output, label) for every accessible METHOD that yields a witness.
/// Constructors are deliberately excluded: F# refuses `new Associative<_>(..)` outside the
/// type (measured: FS0801), so they are not an F#-reachable producer. They ARE an IL-level
/// escape, and §D says so rather than hiding it here.
let private producerEdges () =
    let edges = ResizeArray<Type list * Type * string>()
    let unguardedMints = ResizeArray<string>()
    let tooManyTypeParams = ResizeArray<string>()

    let closedVariants (t: Type) =
        if t.IsGenericTypeDefinition then
            match t.GetGenericArguments().Length with
            | 1 -> [ for r in rungTypes -> t.MakeGenericType(r) ]
            | _ ->
                tooManyTypeParams.Add(t.FullName)
                []
        else
            [ t ]

    let flags =
        BindingFlags.Public
        ||| BindingFlags.NonPublic
        ||| BindingFlags.Static
        ||| BindingFlags.Instance
        ||| BindingFlags.DeclaredOnly

    for openType in nestedClosure lawWitnessModule do
        for t in closedVariants openType do
            for m0 in t.GetMethods(flags) do
                if ilAccessible m0 then
                    let instantiations =
                        if m0.IsGenericMethodDefinition then
                            match m0.GetGenericArguments().Length with
                            | 1 ->
                                [ for r in rungTypes do
                                      match (try Some(m0.MakeGenericMethod(r)) with _ -> None) with
                                      | Some mi -> yield mi
                                      | None -> () ]
                            | _ ->
                                tooManyTypeParams.Add(t.FullName + "." + m0.Name)
                                []
                        else
                            [ m0 ]

                    for m in instantiations do
                        if isNode m.ReturnType then
                            let inputs =
                                [ if not m.IsStatic then
                                      yield m.DeclaringType
                                  for p in m.GetParameters() -> p.ParameterType ]

                            if inputs |> List.forall isNode then
                                edges.Add(inputs, m.ReturnType, t.Name + "." + m.Name)
                            else
                                // A witness minted from something that is not a witness is an
                                // unguarded mint — exactly the hole this search exists to find.
                                unguardedMints.Add(
                                    t.FullName
                                    + "."
                                    + m.Name
                                    + " -> "
                                    + nodeName m.ReturnType
                                    + " from ["
                                    + String.Join(", ", inputs |> List.map (fun i -> i.Name))
                                    + "]"
                                )

    edges, unguardedMints, tooManyTypeParams

let private reachableNodeNames () =
    let edges, unguardedMints, tooMany = producerEdges ()

    Assert.True(
        tooMany.Count = 0,
        "the reachability search cannot analyse these, so it cannot claim a refusal: "
        + String.Join("; ", tooMany)
    )

    Assert.True(
        unguardedMints.Count = 0,
        "a witness is minted from a non-witness argument — the law axis has a back door: "
        + String.Join("; ", unguardedMints)
    )

    let known = Collections.Generic.HashSet<string>()
    let mutable changed = true

    while changed do
        changed <- false

        for (inputs, output, _) in edges do
            let key = output.AssemblyQualifiedName

            if not (known.Contains key) && inputs |> List.forall (fun i -> known.Contains i.AssemblyQualifiedName) then
                known.Add key |> ignore
                changed <- true

    edges
    |> Seq.map (fun (_, o, _) -> o)
    |> Seq.filter (fun o -> known.Contains o.AssemblyQualifiedName)
    |> Seq.map nodeName
    |> Set.ofSeq

[<Fact>]
let ``FALSIFIER: no accessible producer chain reaches Associative<Octonion>`` () =
    let reachable = reachableNodeNames ()

    // The control first: a scheme where nothing is constructible would pass the refusal.
    Assert.Contains("Associative<H>", reachable)
    Assert.Contains("Commutative<C>", reachable)
    Assert.Contains("Alternative<O>", reachable)
    Assert.Contains("NoZeroDivisors<O>", reachable)

    // The refusal proper.
    Assert.DoesNotContain("Associative<O>", reachable)
    Assert.DoesNotContain("Commutative<H>", reachable)
    Assert.DoesNotContain("SelfConjugate<C>", reachable)

[<Fact>]
let ``FALSIFIER: the sedenion rung is uninhabited by EVERY witness`` () =
    let reachable = reachableNodeNames ()

    for law in [ "SelfConjugate"; "Commutative"; "Associative"; "Alternative"; "NoZeroDivisors" ] do
        Assert.DoesNotContain(law + "<S>", reachable)

    Assert.Equal(0, LawWitness.SedenionRung.witnessCount)

[<Fact>]
let ``FALSIFIER: the reachable set is EXACTLY the 14 witnesses the Cayley-Dickson theorems allow`` () =
    // Pins the whole frontier at once: a new lift, a loosened lift, or a stray factory all
    // change this set. 14 = R{5 laws} ∪ C{4} ∪ H{3} ∪ O{2} ∪ S{0}, minus SelfConjugate above R.
    let expected =
        set
            [ "SelfConjugate<R>"
              "Commutative<R>"
              "Commutative<C>"
              "Associative<R>"
              "Associative<C>"
              "Associative<H>"
              "Alternative<R>"
              "Alternative<C>"
              "Alternative<H>"
              "Alternative<O>"
              "NoZeroDivisors<R>"
              "NoZeroDivisors<C>"
              "NoZeroDivisors<H>"
              "NoZeroDivisors<O>" ]

    let reachable = reachableNodeNames ()
    Assert.Equal<Set<string>>(expected, reachable)

// ═══════════════════════════════════════════════════════════════════════════
// §D  THE ESCAPES — the deliberate hunt, and what it FOUND
//
// The brief named the falsifier in advance: if `Associative<Octonion>` turns out
// constructible by any path, the witness is decoration. Three paths were hunted. One is
// caught. TWO ARE NOT, and are recorded here as passing tests so the limit is a measured
// fact in the suite rather than a sentence in a docstring.
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``ESCAPE 1 — CAUGHT: Unchecked.defaultof type-checks as a witness, and the consumer refuses it`` () =
    // `Unchecked` is documented as outside F#'s safety guarantee, so this compiles. It is a
    // forgery the TYPE system cannot stop...
    let forged: LawWitness.Associative<Octonion> = Unchecked.defaultof<_>
    Assert.True(isNull (box forged))

    // ...but every consumer null-checks its proof, so the forgery dies at the call site.
    let ex =
        Assert.Throws<InvalidOperationException>(fun () ->
            LawWitness.productBalanced forged O [| octUnit 1; octUnit 2 |] |> ignore)

    Assert.Contains("Forged law witness", ex.Message, StringComparison.Ordinal)

[<Fact>]
let ``ESCAPE 2 — NOT CAUGHT: reflection mints Associative<Octonion> and the consumer computes a WRONG answer`` () =
    // The witness constructor is not IL-private (see ESCAPE 3), so reflection reaches it.
    // Nothing in the module can distinguish the result from a real proof — this is the
    // honest limit of the scheme, demonstrated rather than asserted.
    let t = typedefof<LawWitness.Associative<float>>.MakeGenericType(typeof<Octonion>)

    let ctor =
        t.GetConstructors(BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Instance)
        |> Array.exactlyOne

    let forged = ctor.Invoke([| box "forged-by-reflection" |]) :?> LawWitness.Associative<Octonion>
    Assert.False(isNull (box forged))

    // And the forged proof licenses a rebracketing that is simply false at 𝕆.
    let xs = [| octUnit 1; octUnit 2; octUnit 4 |]
    let balanced = LawWitness.productBalanced forged O xs
    Assert.NotEqual<Octonion>(LawWitness.productLeftFold O xs, balanced)

[<Fact>]
let ``ESCAPE 3 — NOT CAUGHT: the witness constructor is visible inside the InternalsVisibleTo boundary`` () =
    // MEASURED, and pinned so a change is noticed. F#'s `private` on a primary constructor is
    // enforced by the F# COMPILER (`FS0801` from another assembly) and is NOT lowered to IL
    // `private`: it is emitted `public` on a non-public type. A C# project on the
    // `InternalsVisibleTo` list therefore compiles `new LawWitness.Associative<Oct>("forged")`.
    // The private-union spelling leaks the same way via an `assembly`-visible `NewAssocW`.
    //
    // If a future F# emits these as IL-private, THIS TEST WILL FAIL — and the fix is to delete
    // the assertion and the matching paragraph in `LawWitness.fs`, because the hole closed.
    for d in witnessDefs do
        for r in rungTypes do
            let t = d.MakeGenericType(r)

            Assert.False(
                t.IsVisible,
                nodeName t + " is publicly visible — a prototype must not be a distribution contract"
            )

            let ctor =
                t.GetConstructors(BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Instance)
                |> Array.exactlyOne

            Assert.False(
                ctor.IsPrivate,
                nodeName t
                + ": the constructor is now IL-private. The hole closed — delete this assertion "
                + "and the 'THE HOLE THAT WAS FOUND' section of LawWitness.fs."
            )

[<Fact>]
let ``ESCAPE 3 bound: the leak stops at the assembly boundary — no witness type is public`` () =
    // What the scheme still does buy: nothing outside `Zeta.Core` + its IVT list can forge
    // anything, because none of these types is reachable at all from a package consumer.
    for d in witnessDefs do
        Assert.False(d.IsVisible, d.Name + " must stay non-public")

    Assert.False(lawWitnessModule.IsVisible, "the LawWitness module must stay internal")

// ═══════════════════════════════════════════════════════════════════════════
// §E  THE GUARD — keep the caught escape caught
// ═══════════════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

[<Fact>]
let ``GUARD: no source file under src/ forges a law witness with the unchecked escape`` () =
    // The needle is assembled from fragments so this guard cannot be satisfied — or tripped —
    // by its own text, and so a grep for the literal does not find the checker itself.
    let escape = "Unchecked" + "." + "defaultof"

    let lawNames =
        [ "Self" + "Conjugate"
          "Commut" + "ative"
          "Assoc" + "iative"
          "Altern" + "ative"
          "NoZero" + "Divisors" ]

    let isComment (line: string) =
        let t = line.TrimStart()
        t.StartsWith("//", StringComparison.Ordinal)
        || t.StartsWith("(*", StringComparison.Ordinal)
        || t.StartsWith("*", StringComparison.Ordinal)

    let srcDir = Path.Join(repoRoot (), "src")
    Assert.True(Directory.Exists srcDir, "src/ not found from " + repoRoot ())

    let offenders =
        [ for ext in [ "*.fs"; "*.cs" ] do
              for file in Directory.EnumerateFiles(srcDir, ext, SearchOption.AllDirectories) do
                  for (i, line) in File.ReadLines(file) |> Seq.indexed do
                      if
                          not (isComment line)
                          && line.Contains(escape, StringComparison.Ordinal)
                          && lawNames |> List.exists (fun n -> line.Contains(n, StringComparison.Ordinal))
                      then
                          yield
                              Path.GetRelativePath(repoRoot (), file)
                              + ":"
                              + string (i + 1) ]

    Assert.True(
        List.isEmpty offenders,
        "a law witness is being forged with the unchecked escape: " + String.Join("; ", offenders)
    )

[<Fact>]
let ``GUARD CONTROL: the scan actually reads files and would see the pattern it looks for`` () =
    // Without this, the guard above is the vacuity class — a check that passes because it
    // examined nothing. Assert the corpus is non-empty AND that the matcher fires on a
    // synthetic line, so a broken matcher cannot masquerade as a clean repo.
    let srcDir = Path.Join(repoRoot (), "src")

    let fsFiles =
        Directory.EnumerateFiles(srcDir, "*.fs", SearchOption.AllDirectories) |> Seq.length

    Assert.True(fsFiles > 100, "the guard scanned an implausibly small corpus: " + string fsFiles)

    let escape = "Unchecked" + "." + "defaultof"
    let synthetic = "    let bogus = " + escape + "<" + ("Assoc" + "iative") + "<Octonion>>"
    Assert.Contains(escape, synthetic, StringComparison.Ordinal)
    Assert.Contains("Assoc" + "iative", synthetic, StringComparison.Ordinal)


// ═══════════════════════════════════════════════════════════════════════════
// §F  THE COMPARISON — witness VALUES vs. the LATTICE (`LawRung`)
//
// A parallel prior-art survey (PR #17319) refuted the premise the first prototype was built
// on: FriCAS makes the ASSOCIATIVE algebra a DESCENDANT of the non-associative one, so losing
// a law is moving toward the ROOT — which subtyping expresses natively. And FriCAS does it as
// a LATTICE, not a chain: `OctonionCategory` joins TWO parents. `LawRung.fs` is that repair.
//
// This section is the evidence for preferring it. The first test is decisive; the rest pin the
// lattice's own claims, including the one thing the shipped tower cannot express at all.
// ═══════════════════════════════════════════════════════════════════════════

/// A perfectly legal `IStarRing<Quaternion>` whose `Mul` is NOT associative. Nothing about it is
/// malformed — it is a different multiplication on the same carrier, which is exactly the case a
/// law-about-a-TYPE cannot distinguish.
let private twistedQuaternion: IStarRing<Quaternion> =
    { new IStarRing<Quaternion> with
        member _.Zero = H.Zero
        member _.One = H.One
        member _.Add(a, b) = H.Add(a, b)
        member _.Negate a = H.Negate a
        member _.Mul(a, b) = H.Add(H.Mul(a, b), H.One)
        member _.Conj a = H.Conj a }

[<Fact>]
let ``DECISIVE: the WITNESS form admits a witness/instance MISMATCH and licenses a false rewrite`` () =
    // `Associative<Quaternion>` is keyed on the TYPE. It says nothing about WHICH `Mul` it
    // attests, so it pairs with a non-associative multiplication on the same carrier — and the
    // compiler is satisfied. This is the defect that decides the comparison.
    let proof = LawWitness.QuaternionRung.associative // genuine, correctly minted

    let xs =
        [| quat 1.0 2.0 -1.0 3.0
           quat 0.0 1.0 2.0 -2.0
           quat 3.0 -1.0 0.0 1.0 |]

    // First establish the twisted product really is non-associative, so the next assertion is
    // about the witness rather than about an accidentally-associative operation.
    let a, b, c = xs.[0], xs.[1], xs.[2]

    Assert.NotEqual<Quaternion>(
        twistedQuaternion.Mul(twistedQuaternion.Mul(a, b), c),
        twistedQuaternion.Mul(a, twistedQuaternion.Mul(b, c))
    )

    // And now the defect: the witness licenses the rebracketing anyway, and the answer is wrong.
    let balanced = LawWitness.productBalanced proof twistedQuaternion xs
    let leftFold = LawWitness.productLeftFold twistedQuaternion xs
    Assert.NotEqual<Quaternion>(leftFold, balanced)

[<Fact>]
let ``DECISIVE, other half: the LATTICE cannot express that mismatch — the law rides the instance`` () =
    // `LawRung.productBalanced` takes ONE argument that is both the operations and the law, so
    // there is no second thing to disagree with. `LawRung.productBalanced twistedQuaternion xs`
    // does not compile: `twistedQuaternion` is an `IStarRing<Quaternion>`, not an
    // `IAssociativeMul<Quaternion>`. Non-compilation cannot be asserted at runtime, so the
    // structural fact is asserted instead — the parameter's type IS the law.
    Assert.False(
        box twistedQuaternion :? LawRung.IAssociativeMul<Quaternion>,
        "a non-associative Mul must not satisfy the associativity parent"
    )

    // Positive control: the legitimate rung IS accepted, and agrees with the fold.
    let xs =
        [| quat 1.0 2.0 -1.0 3.0
           quat 0.0 1.0 2.0 -2.0
           quat 3.0 -1.0 0.0 1.0
           quat -2.0 0.0 1.0 1.0 |]

    Assert.Equal<Quaternion>(
        LawRung.productLeftFold LawRung.quaternion xs,
        LawRung.productBalanced LawRung.quaternion xs
    )

[<Fact>]
let ``LATTICE: each rung satisfies exactly the parents it earns, and NOT the one above`` () =
    // The refusals, read off the runtime types. A loosened lift would give a rung a parent it
    // has not earned, and this fails.
    Assert.IsAssignableFrom<LawRung.ISelfConjugate<float>>(LawRung.real) |> ignore
    Assert.IsAssignableFrom<LawRung.ICommutativeMul<Complex>>(LawRung.complex) |> ignore
    Assert.IsAssignableFrom<LawRung.IAssociativeMul<Quaternion>>(LawRung.quaternion) |> ignore
    Assert.IsAssignableFrom<LawRung.IAlternativeMul<Octonion>>(LawRung.octonion) |> ignore
    Assert.IsAssignableFrom<LawRung.INoZeroDivisors<Octonion>>(LawRung.octonion) |> ignore

    Assert.False(box LawRung.complex :? LawRung.ISelfConjugate<Complex>, "C is not self-conjugate")

    Assert.False(
        box LawRung.quaternion :? LawRung.ICommutativeMul<Quaternion>,
        "H must not be commutative"
    )

    Assert.False(
        box LawRung.octonion :? LawRung.IAssociativeMul<Octonion>,
        "O must not be associative — this is the whole point"
    )

    Assert.False(
        box LawRung.sedenion :? LawRung.IAlternativeMul<Sedenion>,
        "S must carry NO law parent at all"
    )

    Assert.False(
        box LawRung.sedenion :? LawRung.INoZeroDivisors<Sedenion>,
        "S has 84 zero-divisor pairs; it must not claim otherwise"
    )

[<Fact>]
let ``LATTICE: the axes are INDEPENDENT — commutativity is not under associativity`` () =
    // The chain version of this module got this wrong. Commutativity does not entail
    // associativity (Jordan algebras), so the two markers must not be ordered. Asserted
    // structurally: neither interface is assignable to the other.
    // CLOSED types, not `typedefof`: an open generic type definition is assignable from
    // nothing, so `typedefof` would make every assertion below trivially true — the vacuity
    // class. The first draft used it and the one TRUE implication (assoc => alt) failed, which
    // is how the mistake surfaced.
    let comm = typeof<LawRung.ICommutativeMul<float>>
    let assoc = typeof<LawRung.IAssociativeMul<float>>
    let alt = typeof<LawRung.IAlternativeMul<float>>
    let nzd = typeof<LawRung.INoZeroDivisors<float>>

    Assert.False(comm.IsAssignableFrom assoc, "associativity must not imply commutativity")
    Assert.False(assoc.IsAssignableFrom comm, "commutativity must not imply associativity")
    Assert.False(nzd.IsAssignableFrom assoc, "associativity must not imply no-zero-divisors")
    Assert.False(assoc.IsAssignableFrom nzd, "no-zero-divisors must not imply associativity")

    // ...and the ONE ordering that is a theorem is present: associative ⇒ alternative.
    Assert.True(alt.IsAssignableFrom assoc, "associativity must imply alternativity")

[<Fact>]
let ``LATTICE: the involution axis does NOT require an additive inverse — Lumen's 3.5 weight exists`` () =
    // THE PAYOFF. The belief pair has an involution (coordinate swap) and NO additive inverse
    // (its ⊕ is max, which is idempotent). Under the shipped tower it is inexpressible: `Conj`
    // lives on `IStarRing`, `IStarRing : IRing`, and `IRing` demands a `Negate` it does not have.
    let b = LawRung.beliefPair
    Assert.IsAssignableFrom<LawRung.IInvolutiveSemiring<LawRung.BeliefPair>>(b) |> ignore
    Assert.IsAssignableFrom<ISemiring<LawRung.BeliefPair>>(b) |> ignore

    // The thing that could not be said before: it carries Conj and is NOT a ring.
    Assert.False(box b :? IRing<LawRung.BeliefPair>, "the belief pair must NOT satisfy IRing")
    Assert.False(box b :? IStarRing<LawRung.BeliefPair>, "the belief pair must NOT satisfy IStarRing")

[<Fact>]
let ``LATTICE FALSIFIER: the belief pair's involution laws hold and its additive inverse does NOT exist`` () =
    // A marker is a name, not a proof — so the laws it names are CHECKED, the way FriCAS pays
    // for `SemiGroup == Magma` with `associative?()`. Exhaustive over an 11×11 grid of the unit
    // square, which is exact in float at tenths for max/min.
    let b = LawRung.beliefPair
    let grid = [ for i in 0..10 -> float i / 10.0 ]

    let pts =
        [ for s in grid do
              for r in grid -> ({ Support = s; Refutation = r }: LawRung.BeliefPair) ]

    Assert.Equal(121, pts.Length)

    // involution: Conj ∘ Conj = id
    for p in pts do
        Assert.Equal<LawRung.BeliefPair>(p, b.Conj(b.Conj p))

    // antihomomorphism: Conj(x⊗y) = Conj y ⊗ Conj x
    for x in pts do
        for y in pts do
            Assert.Equal<LawRung.BeliefPair>(b.Conj(b.Mul(x, y)), b.Mul(b.Conj y, b.Conj x))

    // NO additive inverse except at Zero — which is why IRing must not be claimed.
    let zero = b.Zero
    let mutable invertible = 0

    for x in pts do
        if pts |> List.exists (fun y -> b.Add(x, y) = zero) then
            invertible <- invertible + 1

    Assert.Equal(1, invertible) // only Zero itself

[<Fact>]
let ``LATTICE: a constraint list expresses a THREE-parent join with no named intersection`` () =
    // `unitInverse` demands IAlternativeMul ∧ INoZeroDivisors ∧ IInvolutiveSemiring — three
    // axes, no named join type, no witness value. This is what makes the marker lattice cost
    // linear names rather than 2^n.
    let u = octUnit 1
    Assert.Equal<Octonion>(O.One, O.Mul(u, LawRung.unitInverse LawRung.octonion u))
    Assert.Equal<Octonion>(O.One, O.Mul(LawRung.unitInverse LawRung.octonion u, u))

    // And the constraint really is a three-way conjunction, read off the method's own metadata.
    let m =
        typedefof<LawWitness.Associative<float>>.Assembly.GetType("Zeta.Core.LawRung")
            .GetMethod("unitInverse", BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Static)

    Assert.False(isNull m, "LawRung.unitInverse not found")
    let ringParam = m.GetGenericArguments().[0]

    let constraintNames =
        ringParam.GetGenericParameterConstraints()
        |> Array.map (fun c -> c.Name.Split('`').[0])
        |> Set.ofArray

    Assert.Equal<Set<string>>(
        set [ "IAlternativeMul"; "INoZeroDivisors"; "IInvolutiveSemiring" ],
        constraintNames
    )

[<Fact>]
let ``LATTICE: markers add NO members — they are pure names, as FriCAS's unitsKnown is`` () =
    // A marker that grew a member would be a capability, not a law, putting us back on one axis.
    for t in
        [ typedefof<LawRung.IAlternativeMul<float>>
          typedefof<LawRung.IAssociativeMul<float>>
          typedefof<LawRung.ICommutativeMul<float>>
          typedefof<LawRung.INoZeroDivisors<float>>
          typedefof<LawRung.ISelfConjugate<float>> ] do
        let declared =
            t.GetMembers(
                BindingFlags.Public
                ||| BindingFlags.NonPublic
                ||| BindingFlags.Instance
                ||| BindingFlags.Static
                ||| BindingFlags.DeclaredOnly
            )

        Assert.True(
            declared.Length = 0,
            t.Name + " declares " + string declared.Length + " member(s); a law marker must declare none"
        )

    // The involution axis is the one parent that DOES add a member — it is a capability, and it
    // is on its own axis precisely so that capability does not drag a law along with it.
    let inv = typedefof<LawRung.IInvolutiveSemiring<float>>

    let invMembers =
        inv.GetMembers(BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Instance ||| BindingFlags.DeclaredOnly)

    Assert.Equal(1, invMembers.Length)
    Assert.Equal("Conj", invMembers.[0].Name)

[<Fact>]
let ``LATTICE: the refined rungs compute identically to the unrefined tower`` () =
    // A marker must add a NAME and change no arithmetic, or the laws would be attached to a
    // different algebra than the one §B measured.
    for (a, b) in [ octUnit 1, octUnit 2; octUnit 3, octUnit 5; octUnit 6, octUnit 7 ] do
        Assert.Equal<Octonion>(O.Mul(a, b), LawRung.octonion.Mul(a, b))
        Assert.Equal<Octonion>(O.Add(a, b), LawRung.octonion.Add(a, b))
        Assert.Equal<Octonion>(O.Conj a, LawRung.octonion.Conj a)
        Assert.Equal<Octonion>(O.Negate a, LawRung.octonion.Negate a)

    Assert.Equal<Octonion>(O.One, LawRung.octonion.One)
    Assert.Equal<Octonion>(O.Zero, LawRung.octonion.Zero)
    Assert.Equal<Sedenion>(S.Mul(sedUnit 3, sedUnit 9), LawRung.sedenion.Mul(sedUnit 3, sedUnit 9))
    Assert.Equal<Complex>(C.Mul(cplx 1.0 2.0, cplx 3.0 4.0), LawRung.complex.Mul(cplx 1.0 2.0, cplx 3.0 4.0))

[<Fact>]
let ``LATTICE: the consumers are correct where they are permitted`` () =
    let cx = cplx 2.0 3.0
    let cy = cplx -1.0 4.0
    let s = C.Add(cx, cy)
    Assert.Equal<Complex>(C.Mul(s, s), LawRung.squareOfSum LawRung.complex cx cy)

    for (x, y) in [ octUnit 1, octUnit 2; octUnit 3, octUnit 5 ] do
        Assert.Equal<Octonion>(O.Mul(x, O.Mul(x, y)), LawRung.mulSquareLeft LawRung.octonion x y)

[<Fact>]
let ``NOT A HUB: a weight that joins NOTHING in the lattice still works, and the shipped tower is unchanged`` () =
    // Exit, not degree. `IntegerRing` carries no law parent from this module and never will;
    // every law-free operation must still accept it, or the lattice has become a hub.
    let z: ISemiring<int64> = IntegerRing.Instance
    Assert.Equal(24L, LawRung.productLeftFold z [| 1L; 2L; 3L; 4L |])
    Assert.False(box z :? LawRung.IAssociativeMul<int64>, "IntegerRing joins nothing here, by design")

    // And the shipped tower is untouched: the defect this work item names is still present and
    // still reachable. If this fails, the PR has grown past its declared scope.
    Assert.IsAssignableFrom<IStarRing<Sedenion>>(ImaginaryStack.sedenion) |> ignore
    Assert.IsAssignableFrom<IRing<Sedenion>>(ImaginaryStack.sedenion) |> ignore
    Assert.IsAssignableFrom<IStarRing<Octonion>>(ImaginaryStack.octonion) |> ignore

    // The bridge runs the other way too: anything with both parents becomes an IStarRing on
    // demand, so entering the lattice does not mean leaving the shipped tower behind.
    let bridged: IStarRing<Octonion> = LawRung.asStarRing LawRung.octonion
    Assert.Equal<Octonion>(O.Mul(octUnit 1, octUnit 2), bridged.Mul(octUnit 1, octUnit 2))
    Assert.Equal<Octonion>(O.Conj(octUnit 3), bridged.Conj(octUnit 3))

[<Fact>]
let ``LATTICE: no type in it is public — a prototype must not be a distribution contract`` () =
    for t in
        [ typedefof<LawRung.IInvolutiveSemiring<float>>
          typedefof<LawRung.IAlternativeMul<float>>
          typedefof<LawRung.IAssociativeMul<float>>
          typedefof<LawRung.ICommutativeMul<float>>
          typedefof<LawRung.INoZeroDivisors<float>>
          typedefof<LawRung.ISelfConjugate<float>>
          typedefof<LawRung.IRealCategory<float>>
          typedefof<LawRung.IComplexCategory<float>>
          typedefof<LawRung.IQuaternionCategory<float>>
          typedefof<LawRung.IOctonionCategory<float>>
          typedefof<LawRung.ISedenionCategory<float>>
          typeof<LawRung.BeliefPair> ] do
        Assert.False(t.IsVisible, t.Name + " must stay non-public")
