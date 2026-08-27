namespace Zeta.Tests

open Xunit
open FsUnit.Xunit
open Zeta.Core

module AdopterRegisterTests =

    [<Fact>]
    let ``AdopterRegister - fold computes active net support properly`` () =
        let lineage1 = Provenance.token "alice_prov"
        let lineage2 = Provenance.token "bob_prov"
        let lineage3 = Provenance.token "charlie_prov"
        let events = [
            AdopterRegister.Adopted ("alice", lineage1)
            AdopterRegister.Adopted ("bob", lineage2)
            AdopterRegister.Retracted ("alice", lineage1)
            AdopterRegister.Adopted ("charlie", lineage3)
        ]
        
        let reg = AdopterRegister.fold events
        let count = AdopterRegister.activeCount reg
        count |> should equal 2
        
        let active = AdopterRegister.activeAdopters reg
        active |> should contain "bob"
        active |> should contain "charlie"
        active |> should not' (contain "alice")
        
    [<Fact>]
    let ``AdopterRegister - Gate refuses license when N_eff threshold not met`` () =
        let events = [
            for i in 1..9 do
                yield AdopterRegister.Adopted ($"user-{i}", Provenance.token $"prov-{i}")
        ]
        let reg = AdopterRegister.fold events
        
        // n = 9, rho = 0.0 -> N_eff = 9.0
        // Required is 10.0
        AdopterRegister.isPromotionLicensed reg |> should equal false

    [<Fact>]
    let ``AdopterRegister - Gate grants license when threshold met (independent)`` () =
        let events = [
            for i in 1..10 do
                yield AdopterRegister.Adopted ($"user-{i}", Provenance.token $"prov-{i}")
        ]
        let reg = AdopterRegister.fold events
        
        // n = 10, rho = 0.0 -> N_eff = 10.0
        // Required is 10.0
        AdopterRegister.isPromotionLicensed reg |> should equal true
        
    [<Fact>]
    let ``AdopterRegister - Gate refuses license when correlation drops N_eff below threshold`` () =
        let sharedLineage = Provenance.token "shared_prov"
        let events = [
            for i in 1..10 do
                yield AdopterRegister.Adopted ($"user-{i}", sharedLineage)
        ]
        let reg = AdopterRegister.fold events
        
        // n = 10, rho = 1.0 (clones) -> N_eff = 1.0
        AdopterRegister.isPromotionLicensed reg |> should equal false

    [<Fact>]
    let ``AdopterRegister - Gate is fooled by behaviourally identical adopters with laundered provenance`` () =
        // W3: Non-circular falsifier.
        // Two adopters with totally disjoint provenance tokens are treated as independent 
        // by the ancestry estimator, even if they are behaviourally identical clones in reality.
        let events = [
            for i in 1..10 do
                // "Laundering" provenance by using disjoint tokens
                yield AdopterRegister.Adopted ($"user-{i}", Provenance.token $"laundered_prov-{i}")
        ]
        let reg = AdopterRegister.fold events
        
        // n = 10, rho = 0.0 -> N_eff = 10.0 (granted!)
        // This falsifies the proxy: the gate fails to detect behavioral clones if they launder provenance.
        AdopterRegister.isPromotionLicensed reg |> should equal true

    [<Fact>]
    let ``AdopterRegister - Retraction semantics completely zero out weights to avoid memory leak`` () =
        // W4: Validate that retracting removes the adopter's weight completely.
        let lineage = Provenance.token "shared_prov"
        let events = [
            AdopterRegister.Adopted ("alice", lineage)
            AdopterRegister.Retracted ("alice", lineage)
        ]
        let reg = AdopterRegister.fold events
        
        // ZSetW sumBy should purge zero-weights. If the weight is exactly ring.Zero,
        // it shouldn't appear in the register.
        AdopterRegister.activeCount reg |> should equal 0

    [<Fact>]
    let ``AdopterRegister - Empty provenance sets fail closed (return 1.0 correlation)`` () =
        // W5: If an adopter has no provenance tokens, it should fail closed.
        let emptyLineage = Provenance.zero
        let events = [
            for i in 1..10 do
                yield AdopterRegister.Adopted ($"user-{i}", emptyLineage)
        ]
        let reg = AdopterRegister.fold events
        
        // Because the lineages are empty, Overlap Coefficient fails closed (rho = 1.0).
        // n = 10, rho = 1.0 -> N_eff = 1.0
        AdopterRegister.isPromotionLicensed reg |> should equal false
