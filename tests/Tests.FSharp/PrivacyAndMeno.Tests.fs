namespace Zeta.Tests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

module PrivacyAndMenoTests =

    // --- PrivacyPreservingIdentity Tests ---

    [<Fact>]
    let ``PPI-1: Short history returns None`` () =
        let history : Zeta.Core.PrivacyPreservingIdentity.StreamHistory = []
        let token = PrivacyPreservingIdentity.generateToken history
        Assert.True(token.IsNone)

    [<Fact>]
    let ``PPI-2: Valid history generates valid E8/Adinkra token`` () =
        // Need at least 9 points to get 8 diffs (bits).
        // Use alternating precision to avoid the all-ones codeword (which has normSq=8, not 4).
        // Alternating [1,0,1,0,...] produces message [1,0,1,0] -> codeword with normSq=4.
        let history : Zeta.Core.PrivacyPreservingIdentity.StreamHistory = 
            [ for i in 0..8 -> { Zeta.Core.PrivacyPreservingIdentity.Precision = float (i % 2); Mean = 0.0 } ]
        
        let tokenOpt = PrivacyPreservingIdentity.generateToken history
        Assert.True(tokenOpt.IsSome)
        let token = tokenOpt.Value
        
        // Token must be valid (syndrome 0 and norm^2 = 4)
        Assert.True(PrivacyPreservingIdentity.verifyToken token)

    [<Fact>]
    let ``PPI-3: Continuity proof is valid rotor on E8 lattice`` () =
        // Use a history that produces two DIFFERENT valid codewords for pubKey and currentCodeword.
        // Precision pattern [0,1,0,1,0,1,0,1,0] -> bits [1,0,1,0,1,0,1,0]
        // pubKeyBits = [1,0,1,0] -> codeword with normSq=4
        // currentBits = [1,0,1,0] -> same codeword (identity case: R = I)
        // Use [0,1,2,1,0,1,2,1,0] for different pub and current
        let history : Zeta.Core.PrivacyPreservingIdentity.StreamHistory = 
            [ for i in 0..8 -> { Zeta.Core.PrivacyPreservingIdentity.Precision = float (i % 3); Mean = 0.0 } ]
        
        let token = (PrivacyPreservingIdentity.generateToken history).Value
        let rotor = PrivacyPreservingIdentity.proveContinuity token
        
        // Verifying the proof should succeed
        Assert.True(PrivacyPreservingIdentity.verifyContinuity token rotor)

    // --- Meno Tests ---
    // Meno.Arrow wraps ZSet<'a> -> ZSet<'b>.
    // To test, we wrap inputs in ZSet.singleton and extract keys from the output.

    [<Fact>]
    let ``MENO-1: Identity arrow preserves state`` () =
        let (Meno.MenoArrow f) = Meno.id<int>
        // Input: ZSet with a single element 42 at weight 1
        let input = ZSet.singleton 42 1L
        let output = f input
        // The output should contain 42 with weight 1
        let keys = [ for e in output -> e.Key ]
        Assert.Contains(42, keys)

    [<Fact>]
    let ``MENO-2: Braid swaps parallel states`` () =
        let (Meno.MenoArrow f) = Meno.braid<int, string>
        // Input: ZSet with a single (int * string) pair
        let input = ZSet.singleton (42, "hello") 1L
        let output = f input
        // The output should contain ("hello", 42) with weight 1
        let keys = [ for e in output -> e.Key ]
        Assert.Contains(("hello", 42), keys)

    [<Fact>]
    let ``MENO-3: Bridge identity applies persistence rotor`` () =
        let history : Zeta.Core.PrivacyPreservingIdentity.StreamHistory = 
            [ for i in 0..8 -> { Zeta.Core.PrivacyPreservingIdentity.Precision = float (i % 3); Mean = 0.0 } ]
        
        let token = (PrivacyPreservingIdentity.generateToken history).Value
        
        // Create the Meno arrow (Arrow<Cl3.Mv, Cl3.Mv>)
        let (Meno.MenoArrow persistenceArrow) = Meno.bridgeIdentity token
        
        // Apply the arrow to the public key (wrapped in a ZSet).
        let input = ZSet.singleton token.PublicKey 1L
        let output = persistenceArrow input
        
        // The output should contain a single Cl3.Mv that is close to CurrentCodeword.
        let outputKeys = [ for e in output -> e.Key ]
        Assert.Equal(1, outputKeys.Length)
        let result = outputKeys.[0]
        // Use Euclidean normSq (not Clifford distSq) for the distance check
        let normSqDiff = Cl3.normSq (Cl3.sub result token.CurrentCodeword)
        Assert.True(normSqDiff < 1e-6, sprintf "normSqDiff = %f, expected < 1e-6" normSqDiff)

    [<Fact>]
    let ``MENO-4: Tensor is the Z-linear (Kronecker) product of arrows`` () =
        // The real ⊗ (not the old ZSet.empty placeholder): (f ⊗ g) applied to a Z-linear
        // combination of basis pairs acts factor-wise and multiplies weights, with NO cross terms.
        // f: +1, g: *10 over ints. input = 3·(1,2) + 1·(5,6)  ⇒  3·(2,20) + 1·(6,60).
        let f = Meno.arr (fun (x: int) -> x + 1)
        let g = Meno.arr (fun (x: int) -> x * 10)
        let input = ZSet.ofSeq [ ((1, 2), 3L); ((5, 6), 1L) ]
        let (Meno.MenoArrow t) = Meno.tensor f g
        let output = t input
        let pairs = [ for e in output -> (e.Key, e.Weight) ]
        Assert.Equal(2, pairs.Length)                       // no (2,60)/(6,20) cross terms
        Assert.Contains(((2, 20), 3L), pairs)               // weight 3·1 = 3
        Assert.Contains(((6, 60), 1L), pairs)               // weight 1·1 = 1

    [<Fact>]
    let ``MENO-5: first applies an arrow to the first factor only (f ⊗ id)`` () =
        let f = Meno.arr (fun (x: int) -> x + 100)
        let (Meno.MenoArrow ff) = Meno.first<int, int, string> f
        let input = ZSet.singleton (1, "keep") 1L
        let output = ff input
        let pairs = [ for e in output -> (e.Key, e.Weight) ]
        Assert.Equal(1, pairs.Length)
        Assert.Contains(((101, "keep"), 1L), pairs)         // f on the first factor, second untouched

    // --- Monoidal coherence: associator + unitors + pentagon + triangle (Soraya's Step 1) ---

    let private applyMeno (arrow: Meno.Arrow<'a, 'b>) (x: 'a) : 'b list =
        let (Meno.MenoArrow f) = arrow
        [ for e in f (ZSet.singleton x 1L) -> e.Key ]

    [<Fact>]
    let ``MENO-6: associator reassociates and α⁻¹ inverts it`` () =
        Assert.Equal<(int * (int * int)) list>([ (1, (2, 3)) ], applyMeno Meno.associator ((1, 2), 3))
        Assert.Equal<((int * int) * int) list>(
            [ ((1, 2), 3) ], applyMeno (Meno.compose Meno.associator Meno.associatorInv) ((1, 2), 3))

    [<Fact>]
    let ``MENO-7: unitors drop the monoidal unit`` () =
        Assert.Equal<int list>([ 42 ], applyMeno Meno.leftUnitor ((), 42))
        Assert.Equal<int list>([ 42 ], applyMeno Meno.rightUnitor (42, ()))

    [<Fact>]
    let ``MENO-8: pentagon — the two reassociation paths agree`` () =
        let sample = (((1, 2), 3), 4)
        let top = Meno.compose Meno.associator Meno.associator                    // 2 α's
        let bottom =                                                              // 3 α's: (α⊗id) · α · (id⊗α)
            Meno.compose (Meno.compose (Meno.first Meno.associator) Meno.associator) (Meno.second Meno.associator)
        Assert.Equal<(int * (int * (int * int))) list>(applyMeno top sample, applyMeno bottom sample)

    [<Fact>]
    let ``MENO-9: triangle — the unit coherence`` () =
        let sample = ((7, ()), 9)
        let viaAlpha = Meno.compose Meno.associator (Meno.second Meno.leftUnitor) // α then (id ⊗ λ)
        let viaUnitor = Meno.first Meno.rightUnitor                               // ρ ⊗ id
        Assert.Equal<(int * int) list>(applyMeno viaAlpha sample, applyMeno viaUnitor sample)
