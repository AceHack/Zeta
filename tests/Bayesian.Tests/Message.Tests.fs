module Zeta.Bayesian.Tests.MessageTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Bayesian

// The message algebra (B-1000 slice 2) — the inference kernel of the
// Zeta Infer.NET rewrite. These tests are the formal-proof obligations
// from the clean-room spec papers (KFL 2001 sum-product; Minka 2001 EP;
// Bishop PRML conjugacy): product is a commutative monoid (identity =
// uniform) and a group with divide (the EP cavity), the Gaussian product
// is precision-weighted, and the Beta conjugate product matches the
// existing BayesianAggregate.BetaBernoulli. "The compilers don't lie."

// ─── Gaussian: precision-weighted product, identity, cavity ───

[<Fact>]
let ``Gaussian uniform is the identity for product`` () =
    let g = Gaussian.ofMeanVariance 1.5 2.0
    let viaLeft = Gaussian.product Gaussian.uniform g
    let viaRight = Gaussian.product g Gaussian.uniform
    Gaussian.mean viaLeft |> should (equalWithin 1e-9) (Gaussian.mean g)
    Gaussian.variance viaRight |> should (equalWithin 1e-9) (Gaussian.variance g)

[<Fact>]
let ``Gaussian product is precision-weighted (KFL/Bishop)`` () =
    // N(0,1) · N(2,1): equal precision → mean = midpoint 1.0, variance halves to 0.5
    let p = Gaussian.product (Gaussian.ofMeanVariance 0.0 1.0) (Gaussian.ofMeanVariance 2.0 1.0)
    Gaussian.mean p |> should (equalWithin 1e-9) 1.0
    Gaussian.variance p |> should (equalWithin 1e-9) 0.5

[<Fact>]
let ``Gaussian divide inverts product (the EP cavity)`` () =
    let a = Gaussian.ofMeanVariance 1.0 2.0
    let b = Gaussian.ofMeanVariance -0.5 3.0
    let back = Gaussian.divide (Gaussian.product a b) b
    Gaussian.mean back |> should (equalWithin 1e-9) (Gaussian.mean a)
    Gaussian.variance back |> should (equalWithin 1e-9) (Gaussian.variance a)

[<Fact>]
let ``Gaussian product is commutative and associative`` () =
    let a = Gaussian.ofMeanVariance 0.0 1.0
    let b = Gaussian.ofMeanVariance 2.0 4.0
    let c = Gaussian.ofMeanVariance -1.0 0.5
    Gaussian.mean (Gaussian.product a b) |> should (equalWithin 1e-9) (Gaussian.mean (Gaussian.product b a))
    let left = Gaussian.product (Gaussian.product a b) c
    let right = Gaussian.product a (Gaussian.product b c)
    Gaussian.mean left |> should (equalWithin 1e-9) (Gaussian.mean right)
    Gaussian.variance left |> should (equalWithin 1e-9) (Gaussian.variance right)

// ─── Beta: conjugate-to-Bernoulli, grounded against BayesianAggregate ───

[<Fact>]
let ``Beta uniform Beta(1,1) is the identity for product`` () =
    let d = Beta.create 3.0 5.0
    let p = Beta.product Beta.uniform d
    p.Alpha |> should (equalWithin 1e-9) 3.0
    p.Beta |> should (equalWithin 1e-9) 5.0

[<Fact>]
let ``Beta product with likelihood is the conjugate posterior`` () =
    // prior Beta(2,3), observe 5 successes + 1 failure → Beta(7,4)
    let posterior = Beta.product (Beta.create 2.0 3.0) (Beta.likelihood 5.0 1.0)
    posterior.Alpha |> should (equalWithin 1e-9) 7.0
    posterior.Beta |> should (equalWithin 1e-9) 4.0

[<Fact>]
let ``Beta conjugate product matches BayesianAggregate.BetaBernoulli`` () =
    // the message-algebra posterior must equal the existing hand-rolled
    // conjugate update — the referee against existing substrate
    let bb = BetaBernoulli(2.0, 3.0)
    bb.Observe(5L, 1L)
    let posterior = Beta.product (Beta.create 2.0 3.0) (Beta.likelihood 5.0 1.0)
    posterior.Alpha |> should (equalWithin 1e-9) bb.Alpha
    posterior.Beta |> should (equalWithin 1e-9) bb.Beta
    Beta.mean posterior |> should (equalWithin 1e-9) bb.Mean

[<Fact>]
let ``Beta divide inverts product (the EP cavity)`` () =
    let a = Beta.create 4.0 7.0
    let b = Beta.create 2.0 3.0
    let back = Beta.divide (Beta.product a b) b
    back.Alpha |> should (equalWithin 1e-9) a.Alpha
    back.Beta |> should (equalWithin 1e-9) a.Beta

// ─── Bernoulli: discrete combine ───

[<Fact>]
let ``Bernoulli uniform 0.5 is the identity for product`` () =
    let b = Bernoulli.create 0.8
    (Bernoulli.product Bernoulli.uniform b).ProbTrue |> should (equalWithin 1e-9) 0.8

[<Fact>]
let ``Bernoulli product multiplies and renormalizes`` () =
    // 0.8 · 0.6 → 0.48 / (0.48 + 0.2·0.4=0.08) = 0.48/0.56
    let p = Bernoulli.product (Bernoulli.create 0.8) (Bernoulli.create 0.6)
    p.ProbTrue |> should (equalWithin 1e-9) (0.48 / 0.56)

[<Fact>]
let ``Bernoulli divide inverts product`` () =
    let a = Bernoulli.create 0.7
    let b = Bernoulli.create 0.4
    (Bernoulli.divide (Bernoulli.product a b) b).ProbTrue |> should (equalWithin 1e-9) a.ProbTrue

// ─── The IMessage dictionaries route to the same ops (generic BP/EP) ───

[<Fact>]
let ``IMessage algebra dictionaries agree with the direct ops`` () =
    let g = Gaussian.algebra
    let p = g.Product(Gaussian.ofMeanVariance 0.0 1.0, Gaussian.ofMeanVariance 2.0 1.0)
    Gaussian.mean p |> should (equalWithin 1e-9) 1.0
    let bt = Beta.algebra
    (bt.Product(Beta.create 2.0 3.0, Beta.likelihood 5.0 1.0)).Alpha |> should (equalWithin 1e-9) 7.0

// ─── Generic-math surface: One / ( * ) / ( / ) and family-agnostic BP ───

[<Fact>]
let ``generic-math operators equal the named ops`` () =
    // ( * ) = product, ( / ) = divide, One = uniform — across families
    Gaussian.mean (Gaussian.ofMeanVariance 0.0 1.0 * Gaussian.ofMeanVariance 2.0 1.0)
    |> should (equalWithin 1e-9) 1.0
    (Beta.create 2.0 3.0 * Beta.likelihood 5.0 1.0).Alpha |> should (equalWithin 1e-9) 7.0
    Gaussian.One |> should equal Gaussian.uniform
    Beta.One |> should equal Beta.uniform

[<Fact>]
let ``Message.marginal is family-agnostic (SRTP over generic-math One/( * ))`` () =
    // the SAME generic function combines Gaussian messages …
    let g = Message.marginal [ Gaussian.ofMeanVariance 0.0 1.0; Gaussian.ofMeanVariance 2.0 1.0 ]
    Gaussian.mean g |> should (equalWithin 1e-9) 1.0
    Gaussian.variance g |> should (equalWithin 1e-9) 0.5
    // … and Beta messages — prior · likelihood = conjugate posterior Beta(7,4)
    let b = Message.marginal [ Beta.create 2.0 3.0; Beta.likelihood 5.0 1.0 ]
    b.Alpha |> should (equalWithin 1e-9) 7.0
    b.Beta |> should (equalWithin 1e-9) 4.0
    // empty product = the identity (One)
    (Message.marginal (List.empty<Beta>)) |> should equal Beta.One

[<Fact>]
let ``Message.cavity divides the outgoing message out of the marginal`` () =
    let m1 = Gaussian.ofMeanVariance 1.0 2.0
    let m2 = Gaussian.ofMeanVariance -0.5 3.0
    let marginal = Message.marginal [ m1; m2 ]
    let cav = Message.cavity marginal m2   // remove m2 → should recover m1
    Gaussian.mean cav |> should (equalWithin 1e-9) (Gaussian.mean m1)
    Gaussian.variance cav |> should (equalWithin 1e-9) (Gaussian.variance m1)

// ─── Domain contract: constructors fail-fast; operators tolerate improper ───

[<Fact>]
let ``Gaussian.ofMeanVariance rejects non-positive or non-finite variance`` () =
    (fun () -> Gaussian.ofMeanVariance 0.0 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Gaussian.ofMeanVariance 0.0 -1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Gaussian.ofMeanVariance nan 1.0 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Beta.create rejects non-positive shape parameters`` () =
    (fun () -> Beta.create 0.0 1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Beta.create 1.0 -2.0 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Beta.likelihood rejects negative counts`` () =
    (fun () -> Beta.likelihood -1.0 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Beta.likelihood 0.0 infinity |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Bernoulli.create rejects p outside the open interval (0,1)`` () =
    (fun () -> Bernoulli.create 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Bernoulli.create 1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Bernoulli.create 1.5 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``divide may yield an improper message and isProper detects it (EP cavity)`` () =
    // narrow ÷ wide → negative precision: improper, but NOT an error (Minka 2001)
    let narrow = Gaussian.ofMeanVariance 0.0 1.0    // τ = 1
    let wide = Gaussian.ofMeanVariance 0.0 2.0       // τ = 0.5
    let cav = Gaussian.divide wide narrow            // τ = 0.5 - 1 = -0.5 < 0
    Gaussian.isProper cav |> should equal false
    cav.Precision |> should (equalWithin 1e-9) -0.5  // well-defined, just improper
