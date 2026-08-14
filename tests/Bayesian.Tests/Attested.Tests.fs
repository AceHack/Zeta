module Zeta.Bayesian.Tests.AttestedTests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

// The key invariant the whole design rests on: a source id is content-addressed
// on its evidence, so one id can only ever carry one message. These generators
// honour it by DERIVING the message from the id.
let private messageFor (i: int) : Gaussian =
    let k = abs (i % 20)
    { PrecisionMean = float (k + 1) * 0.5; Precision = float (k + 1) }

let private sourceOf (i: int) : string = sprintf "s%d" (abs (i % 20))

let private beliefOf (xs: int list) : Attested.Belief<Gaussian> =
    xs
    |> List.map (fun i -> Attested.ofSource (sourceOf i) (messageFor i))
    |> Attested.admit
    |> fst

let private alg = Gaussian.algebra

let private same (a: Attested.Belief<Gaussian>) (b: Attested.Belief<Gaussian>) : bool =
    a.Atoms = b.Atoms

let private combine a b =
    match Attested.tryCombine a b with
    | Ok r -> r
    | Error ks -> failwithf "unexpected conflict: %A" ks

// ---------------------------------------------------------------------------
// The four semilattice laws. Together they are the SCALE-FREE proof: a bounded
// join-semilattice folds to the same answer in any order and any grouping, which
// is exactly what lets an individual, a society and a world share one interface
// with no special case at any scale (manifesto §9, §10).
// ---------------------------------------------------------------------------

[<Property(MaxTest = 300)>]
let ``AT-1 empty is the identity`` (xs: int list) =
    let a = beliefOf xs
    same (combine Attested.empty a) a && same (combine a Attested.empty) a

[<Property(MaxTest = 300)>]
let ``AT-2 the join is idempotent`` (xs: int list) =
    let a = beliefOf xs
    same (combine a a) a

[<Property(MaxTest = 300)>]
let ``AT-3 the join is commutative`` (xs: int list) (ys: int list) =
    same (combine (beliefOf xs) (beliefOf ys)) (combine (beliefOf ys) (beliefOf xs))

[<Property(MaxTest = 300)>]
let ``AT-4 the join is associative`` (xs: int list) (ys: int list) (zs: int list) =
    let a, b, c = beliefOf xs, beliefOf ys, beliefOf zs
    same (combine (combine a b) c) (combine a (combine b c))

[<Property(MaxTest = 300)>]
let ``AT-5 grouping does not change the fold`` (xs: int list) (ys: int list) (zs: int list) =
    // The self-similarity law stated at the primitive: folding groups and then
    // folding the groups equals folding everything flat.
    let a, b, c = beliefOf xs, beliefOf ys, beliefOf zs
    let flat, _ = Attested.admit [ a; b; c ]
    let grouped, _ =
        let ab, _ = Attested.admit [ a; b ]
        Attested.admit [ ab; c ]
    same flat grouped

// ---------------------------------------------------------------------------
// The algebraic fact the whole design rests on
// ---------------------------------------------------------------------------

[<Property(MaxTest = 500)>]
let ``AT-6 no proper message reduces precision, so redundancy is not expressible`` (a: NormalFloat) (b: NormalFloat) =
    // For PROPER messages the product is monotone in precision. That is why a
    // fold cannot notice double counting from the inside, and therefore why the
    // correction has to arrive as PROVENANCE from outside rather than as a
    // correlation coefficient fitted after the fact.
    let ta = abs a.Get % 1000.0 + 1e-6
    let tb = abs b.Get % 1000.0 + 1e-6
    let x = { PrecisionMean = 0.0; Precision = ta }
    let y = { PrecisionMean = 0.0; Precision = tb }
    (x * y).Precision >= max ta tb

[<Fact>]
let ``AT-7 shared evidence is counted once, independent evidence is not`` () =
    let stream = { PrecisionMean = 100.0; Precision = 10.0 }
    let priorOf i = Attested.ofSource (sprintf "prior-%d" i) { PrecisionMean = 0.0; Precision = 1.0 }
    let holders =
        [ for i in 1 .. 3 -> combine (priorOf i) (Attested.ofSource "stream-S" stream) ]
    let folded, conflicts = Attested.admit holders
    Assert.Empty(conflicts)
    // Three distinct priors plus ONE stream.
    Assert.Equal(4, folded.Atoms.Count)
    let v = Attested.value alg folded
    Assert.True(abs (v.Precision - 13.0) < 1e-12,
        sprintf "expected tau 13.0 (naive product gives 33.0), got %.12f" v.Precision)

[<Fact>]
let ``AT-8 remove is the cavity: it takes a named source back out`` () =
    let stream = { PrecisionMean = 100.0; Precision = 10.0 }
    let prior = { PrecisionMean = 0.0; Precision = 1.0 }
    let held = combine (Attested.ofSource "prior-A" prior) (Attested.ofSource "stream-S" stream)
    let cavity = Attested.remove (FromSource "stream-S") held
    let v = Attested.value alg cavity
    Assert.True(abs (v.Precision - 1.0) < 1e-12, sprintf "cavity tau was %.12f, expected 1.0" v.Precision)

// ---------------------------------------------------------------------------
// Sameness is not identity; conflicts are named, not resolved
// ---------------------------------------------------------------------------

[<Fact>]
let ``AT-9 two agents that independently reached the same value are two sources`` () =
    // Keying on the VALUE would collapse these into one and silently discard a
    // real second piece of evidence. Keying on the SOURCE keeps them apart.
    let same1 = Attested.ofSource "src-A" { PrecisionMean = 0.0; Precision = 1.0 }
    let same2 = Attested.ofSource "src-B" { PrecisionMean = 0.0; Precision = 1.0 }
    let folded = combine same1 same2
    Assert.Equal(2, folded.Atoms.Count)
    Assert.True(abs ((Attested.value alg folded).Precision - 2.0) < 1e-12)

[<Fact>]
let ``AT-10 unattested atoms never merge with each other`` () =
    let a = Attested.ofUnattested "n1" { PrecisionMean = 0.0; Precision = 1.0 }
    let b = Attested.ofUnattested "n2" { PrecisionMean = 0.0; Precision = 1.0 }
    let folded = combine a b
    Assert.Equal(2, folded.Atoms.Count)
    Assert.False(Attested.isPublishable folded)

[<Fact>]
let ``AT-11 a conflicting source is reported, never resolved by picking a winner`` () =
    let a = Attested.ofSource "src-A" { PrecisionMean = 1.0; Precision = 1.0 }
    let b = Attested.ofSource "src-A" { PrecisionMean = 9.0; Precision = 3.0 }
    match Attested.tryCombine a b with
    | Ok _ -> failwith "expected a conflict"
    | Error ks -> Assert.Equal<Attestation list>([ FromSource "src-A" ], ks)
    // The total form excludes the conflicted atom rather than choosing one.
    let merged, reported = Attested.combineReporting a b
    Assert.Empty(merged.Atoms)
    Assert.Equal<Attestation list>([ FromSource "src-A" ], reported)
    match Attested.reading reported merged with
    | ConflictingSources [ FromSource "src-A" ] -> ()
    | other -> failwithf "expected ConflictingSources, got %A" other

[<Fact>]
let ``AT-12 the reading names the fact, and Deduplicated is not independence`` () =
    let folded, conflicts = Attested.admit [ Attested.ofSource "a" { PrecisionMean = 0.0; Precision = 1.0 }
                                             Attested.ofSource "b" { PrecisionMean = 0.0; Precision = 2.0 } ]
    match Attested.reading conflicts folded with
    | Deduplicated 2 -> ()
    | other -> failwithf "expected Deduplicated 2, got %A" other
    Assert.True(Attested.isPublishable folded)
