namespace Zeta.Research

open System.Globalization
open Zeta.Core

/// Bounded exact witnesses for the registered classical-channel inclusion.
/// This is research evidence, not a general quantum API or a positivity prover.
[<RequireQualifiedAccess>]
module FiniteStochasticBridge =
    module Q = ProbabilitySemiring
    type private Matrix = Q.Rational array array

    type Case = { Id: string; Left: string array; Right: string array; Passed: bool }
    type Check = { Name: string; Cases: Case array; Passed: bool }
    type Bounds = { OperandLimit: int64; MaximumAbsoluteNumerator: int64; MaximumDenominator: int64; Refusals: int }
    type Report = { Version: int; Complete: bool; Failure: string; MatrixRoster: string array; Checks: Check array; Arithmetic: Bounds }

    // Existing int64 arithmetic is exact only inside a checked bounded domain.
    // Inputs <= 10^6 give products <= 10^12 and addition numerator <= 2*10^12.
    // Refused operands/results never reach an unchecked subsequent operation.
    type private Arithmetic () =
        let limit = 1000000L
        let mutable maximumNumerator = 0L
        let mutable maximumDenominator = 1L
        let mutable refusals = 0
        let admit (q: Q.Rational) =
            if q.Num < -limit || q.Num > limit || q.Den < 1L || q.Den > limit then
                refusals <- refusals + 1
                false
            else
                maximumNumerator <- max maximumNumerator (abs q.Num)
                maximumDenominator <- max maximumDenominator q.Den
                true
        let calculate operation a b =
            let admittedA = admit a
            let admittedB = admit b
            if admittedA && admittedB then
                let value = operation a b
                if admit value then value else Q.zero
            else Q.zero
        member _.Add a b = calculate Q.add a b
        member _.Mul a b = calculate Q.mul a b
        member _.Bounds =
            { OperandLimit = limit; MaximumAbsoluteNumerator = maximumNumerator
              MaximumDenominator = maximumDenominator; Refusals = refusals }
        interface ISemiring<Q.Rational> with
            member _.Zero = Q.zero
            member _.One = Q.one
            member this.Add(a, b) = this.Add a b
            member this.Mul(a, b) = this.Mul a b

    let private integer (value: int64) = value.ToString(CultureInfo.InvariantCulture)
    let private rational (q: Q.Rational) = integer q.Num + "/" + integer q.Den
    let private matrixText (m: Matrix) =
        string m.Length + "x" + string m.[0].Length + ":" + (m |> Array.collect id |> Array.map rational |> String.concat ",")
    let private boolean value = if value then "true" else "false"
    let private identity n : Matrix = Array.init n (fun r -> Array.init n (fun c -> if r = c then Q.one else Q.zero))
    let private basis n a b : Matrix = Array.init n (fun r -> Array.init n (fun c -> if r = a && c = b then Q.one else Q.zero))
    let private column (values: Q.Rational array) : Matrix = values |> Array.map Array.singleton
    let private transpose (m: Matrix) = Array.init m.[0].Length (fun c -> Array.init m.Length (fun r -> m.[r].[c]))
    let private diag (m: Matrix) = Array.init m.Length (fun r -> Array.init m.Length (fun c -> if r = c then m.[r].[0] else Q.zero))
    let private nonnegative (m: Matrix) = m |> Array.forall (Array.forall (fun q -> q.Num >= 0L))
    let private sum (a: Arithmetic) values = values |> Array.fold a.Add Q.zero
    let private multiply (a: Arithmetic) (left: Matrix) (right: Matrix) : Matrix =
        Array.init left.Length (fun r -> Array.init right.[0].Length (fun c ->
            Array.init right.Length (fun k -> a.Mul left.[r].[k] right.[k].[c]) |> sum a))
    let private tensorMatrix (a: Arithmetic) (left: Matrix) (right: Matrix) : Matrix =
        Array.init (left.Length * right.Length) (fun r -> Array.init (left.[0].Length * right.[0].Length) (fun c ->
            a.Mul left.[r / right.Length].[c / right.[0].Length] right.[r % right.Length].[c % right.[0].Length]))
    let private stochastic a m = nonnegative m && (transpose m |> Array.forall (fun c -> sum a c = Q.one))
    let private sparseVector (m: Matrix) = [ for r in 0 .. m.Length - 1 do if m.[r].[0] <> Q.zero then yield r, m.[r].[0] ]
    let private sparseMatrix (m: Matrix) =
        [ for r in 0 .. m.Length - 1 do
            for c in 0 .. m.[0].Length - 1 do
                if m.[r].[c] <> Q.zero then yield (r, c), m.[r].[c] ]
    let private consolidate a values = WSet.consolidate a ((=) Q.zero) values
    let private denseVector n values =
        let lookup = Map.ofList values
        Array.init n (fun r -> [| Map.tryFind r lookup |> Option.defaultValue Q.zero |])
    let private denseMatrix n values =
        let lookup = Map.ofList values
        Array.init n (fun r -> Array.init n (fun c -> Map.tryFind (r, c) lookup |> Option.defaultValue Q.zero))
    let private applyVector a (s: Matrix) state =
        state |> WSet.apply a (fun i -> [ for j in 0 .. s.Length - 1 -> j, s.[j].[i] ]) |> consolidate a
    let private applyChannel a (s: Matrix) state =
        state |> WSet.apply a (fun (r, c) -> if r <> c then [] else [ for j in 0 .. s.Length - 1 -> (j, j), s.[j].[r] ]) |> consolidate a
    let private channelMatrix a s rho = sparseMatrix rho |> applyChannel a s |> denseMatrix s.Length
    let private tensorSparse a rightDimension left right =
        WSet.tensor a left right
        |> List.map (fun (((r, c), (u, v)), weight) -> (r * rightDimension + u, c * rightDimension + v), weight)
        |> consolidate a
    let private channelImages a (s: Matrix) =
        [| for r in 0 .. s.[0].Length - 1 do
            for c in 0 .. s.[0].Length - 1 do yield channelMatrix a s (basis s.[0].Length r c) |]
    let private choi a (s: Matrix) =
        let n, m = s.[0].Length, s.Length
        let result = Array.init (n * m) (fun _ -> Array.create (n * m) Q.zero)
        for r in 0 .. n - 1 do
            for c in 0 .. n - 1 do
                let image = channelMatrix a s (basis n r c)
                for j in 0 .. m - 1 do
                    for k in 0 .. m - 1 do result.[r * m + j].[c * m + k] <- image.[j].[k]
        result
    let private outputPartialTrace a n m (j: Matrix) =
        Array.init n (fun r -> Array.init n (fun c -> Array.init m (fun k -> j.[r * m + k].[c * m + k]) |> sum a))
    let private case label left right = { Id = label; Left = left; Right = right; Passed = left = right }
    let private check name cases = { Name = name; Cases = cases; Passed = Array.forall (fun (c: Case) -> c.Passed) cases }
    let private texts = Array.map matrixText

    // Hand fixture for the arithmetic instrument, outside the scientific roster.
    // The MinValue operand must be refused before abs or core rational arithmetic.
    let internal arithmeticGuardFixture () =
        let a = Arithmetic()
        let operand = a.Mul (Q.ofInt System.Int64.MinValue) Q.one
        let result = a.Mul (Q.ofInt 1000000L) (Q.ofInt 1000000L)
        operand = Q.zero && result = Q.zero && a.Bounds.Refusals = 2

    /// Executes only the fourteen fixed rosters. A bounded-arithmetic refusal
    /// invalidates the whole report even if individual comparisons coincide.
    let run () =
        let a = Arithmetic()
        let half = Q.rat 1L 2L
        let choices = [| Q.zero; half; Q.one |]
        let maps = [| for x in choices do for y in choices do yield [| [| x; y |]; [| a.Add Q.one (Q.negate x); a.Add Q.one (Q.negate y) |] |] |]
        let unit = identity 2
        let plus = [| [| half; half |]; [| half; half |] |]
        let states = [| column [| Q.one; Q.zero |]; column [| Q.zero; Q.one |]; column [| half; half |] |]
        let rows = ResizeArray<Check>()
        rows.Add(check "stochastic admission" (maps |> Array.mapi (fun i s -> case (string i) [| boolean (stochastic a s) |] [| "true" |])))
        rows.Add(check "WSet propagation/discard" [|
            for i in 0 .. 8 do
                for j in 0 .. 2 do
                    let sparse = applyVector a maps.[i] (sparseVector states.[j])
                    yield case (string i + "," + string j)
                        [| matrixText (denseVector 2 sparse); rational (WSet.discard a sparse) |]
                        [| matrixText (multiply a maps.[i] states.[j]); "1/1" |] |])
        rows.Add(check "commutative identity" [|
            for n in 1 .. 3 do
                for i in 0 .. n - 1 do
                    let input = basis n i i
                    yield case (string n + "," + string i) [| matrixText (channelMatrix a (identity n) input) |] [| matrixText input |] |])
        rows.Add(check "composition" [|
            for i in 0 .. 8 do
                for j in 0 .. 8 do
                    let s, t = maps.[i], maps.[j]
                    let product = multiply a t s
                    let basisColumns = [| for k in 0 .. 1 -> column (Array.init 2 (fun r -> if r = k then Q.one else Q.zero)) |]
                    let left = Array.append (basisColumns |> Array.map (fun v -> applyVector a s (sparseVector v) |> applyVector a t |> denseVector 2)) (channelImages a s |> Array.map (channelMatrix a t))
                    let right = Array.append (basisColumns |> Array.map (multiply a product)) (channelImages a product)
                    yield case (string i + "," + string j) (texts left) (texts right) |])
        rows.Add(check "associativity" [|
            for i in 0 .. 8 do
                for j in 0 .. 8 do
                    for k in 0 .. 8 do
                        yield case (string i + "," + string j + "," + string k)
                            [| matrixText (multiply a (multiply a maps.[k] maps.[j]) maps.[i]) |]
                            [| matrixText (multiply a maps.[k] (multiply a maps.[j] maps.[i])) |] |])
        rows.Add(check "tensor" [|
            for i in 0 .. 8 do
                for j in 0 .. 8 do
                    let s, t = maps.[i], maps.[j]
                    let product = tensorMatrix a s t
                    let left = [| for r in 0 .. 3 do for c in 0 .. 3 do yield channelMatrix a product (basis 4 r c) |]
                    let right = [|
                        for r in 0 .. 3 do
                            for c in 0 .. 3 do
                                let one = applyChannel a s (List.singleton ((r / 2, c / 2), Q.one))
                                let two = applyChannel a t (List.singleton ((r % 2, c % 2), Q.one))
                                yield tensorSparse a 2 one two |> denseMatrix 4 |]
                    yield case (string i + "," + string j) (texts left) (texts right) |])
        rows.Add(check "CP/TP certificates" (maps |> Array.mapi (fun i s ->
            let j = choi a s
            let diagonalCertificate = Array.init 4 (fun r -> Array.init 4 (fun c -> if r = c then s.[r % 2].[r / 2] else Q.zero))
            case (string i) [| matrixText j; boolean (nonnegative j); matrixText (outputPartialTrace a 2 2 j) |]
                [| matrixText diagonalCertificate; "true"; matrixText unit |])))
        rows.Add(check "dephasing sandwich/identity" (maps |> Array.mapi (fun i s ->
            let images = channelImages a s
            let left = Array.concat [|
                images |> Array.map (channelMatrix a unit)
                channelImages a unit |> Array.map (channelMatrix a s)
                channelImages a unit |> Array.map (channelMatrix a s >> channelMatrix a unit)
                channelImages a unit |> Array.map (channelMatrix a unit) |]
            let right = Array.concat [| images; images; images; channelImages a unit |]
            case (string i) (texts left) (texts right))))
        let u = column [| Q.rat 1L 3L; Q.rat 2L 3L |]
        let rectangularA = [| [| half; Q.zero |]; [| half; Q.rat 1L 3L |]; [| Q.zero; Q.rat 2L 3L |] |]
        let rectangularB = [| [| Q.one; Q.zero; half |]; [| Q.zero; Q.one; half |] |]
        let result = multiply a rectangularB (multiply a rectangularA u)
        let sparseResult = sparseVector u |> applyVector a rectangularA |> applyVector a rectangularB |> denseVector 2
        let quantumResult = channelMatrix a rectangularB (channelMatrix a rectangularA (diag u))
        rows.Add(check "rectangular composition" [| case "B,A,u"
            (texts [| result; sparseResult; quantumResult; multiply a (multiply a rectangularB rectangularA) u |])
            (texts [| column [| Q.rat 7L 18L; Q.rat 11L 18L |]; result; diag result; result |]) |])
        let dephased = channelMatrix a unit plus
        rows.Add(check "naive quantum identity refusal" [| case "rho-plus"
            [| matrixText dephased; boolean (dephased = plus); rational (a.Add plus.[0].[1] (Q.negate dephased.[0].[1])) |]
            [| matrixText (diag (column [| half; half |])); "false"; "1/2" |] |])
        let signed = [| [| Q.ofInt 2L; Q.zero |]; [| Q.ofInt -1L; Q.one |] |]
        let signedChoi = choi a signed
        rows.Add(check "signed normalized refusal" [| case "standard-cone"
            [| matrixText (multiply a signed states.[0]); boolean (stochastic a signed); rational signedChoi.[1].[1]; matrixText (outputPartialTrace a 2 2 signedChoi) |]
            [| matrixText (column [| Q.ofInt 2L; Q.ofInt -1L |]); "false"; "-1/1"; matrixText unit |] |])
        let bell = Array.init 4 (fun r -> Array.init 4 (fun c -> if (r = 0 || r = 3) && (c = 0 || c = 3) then half else Q.zero))
        let partialTranspose = Array.init 4 (fun r -> Array.init 4 (fun c -> bell.[(r / 2) * 2 + c % 2].[(c / 2) * 2 + r % 2]))
        let v = column [| Q.zero; Q.one; Q.ofInt -1L; Q.zero |]
        let quadratic = multiply a (transpose v) (multiply a partialTranspose v)
        let transposeInputs = [| basis 2 0 0; basis 2 1 1; plus |]
        rows.Add(check "positive but not CP" [| case "Bell-partial-transpose"
            (Array.append (texts (transposeInputs |> Array.map transpose)) [| matrixText partialTranspose; matrixText quadratic |])
            (Array.append (texts transposeInputs) [| "4x4:1/2,0/1,0/1,0/1,0/1,0/1,1/2,0/1,0/1,1/2,0/1,0/1,0/1,0/1,0/1,1/2"; "1x1:-1/1" |]) |])
        let reset = [| [| Q.one; Q.one |]; [| Q.zero; Q.zero |] |]
        rows.Add(check "dagger nonclosure" [| case "reset-transpose"
            [| boolean (stochastic a reset); boolean (stochastic a (transpose reset)); matrixText (column (reset |> Array.map (sum a))) |]
            [| "true"; "false"; "2x1:2/1,0/1" |] |])
        let doubled = unit |> Array.map (Array.map (fun q -> a.Add q q))
        rows.Add(check "additive nonclosure" [| case "identity-plus-identity"
            [| boolean (nonnegative doubled); boolean (stochastic a doubled); matrixText doubled |]
            [| "true"; "false"; "2x2:2/1,0/1,0/1,2/1" |] |])
        let checks = rows.ToArray()
        let complete = a.Bounds.Refusals = 0 && (checks |> Array.forall _.Passed)
        { Version = 1; Complete = complete; Failure = if complete then "" else "finite comparison failure or bounded arithmetic refusal"
          MatrixRoster = texts maps; Checks = checks; Arithmetic = a.Bounds }
