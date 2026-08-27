namespace Zeta.Core

/// **Lineage Disjointness Estimator (ρ proxy)**
///
/// Estimates the pairwise lineage disjointness between adopters based on their
/// provenance polynomials. This acts as a proxy for independence in the N_eff gate.
///
/// A Jaccard score over provenance tokens measures ancestry, not correlation. Real measurement
/// on the F3 population shows that this proxy overstates independence (e.g. producing N_eff=16
/// for disjoint lineages when behavioral N_eff is ~1.2) when provenance is disjoint but behavioral
/// correlation remains high.
module LineageDisjointnessEstimator =

    /// Calculate the size-robust Overlap Coefficient between two provenance polynomials
    /// based on their base tokens (support).
    ///
    /// O = |A ∩ B| / min(|A|, |B|)
    /// If either support is empty, returns 1.0 (fails closed to prevent laundering).
    let overlapCoefficient (a: ProvenancePoly) (b: ProvenancePoly) : float =
        let supportA = Provenance.support a
        let supportB = Provenance.support b
        if Set.isEmpty supportA || Set.isEmpty supportB then
            1.0
        else
            let inter = Set.intersect supportA supportB
            let minSize = min (Set.count supportA) (Set.count supportB)
            float (Set.count inter) / float minSize

    /// Calculate the average pairwise lineage disjointness for a group of adopters.
    ///
    /// For n adopters, there are n(n-1)/2 pairs. The overall proxy ρ is the
    /// arithmetic mean of their Overlap Coefficients.
    let lineageDisjointness (adopters: seq<ProvenancePoly>) : float =
        let arr = Seq.toArray adopters
        let n = arr.Length
        if n < 2 then
            if n = 1 then
                if Set.isEmpty (Provenance.support arr.[0]) then 1.0 else 0.0
            else
                1.0 // Empty set fails closed
        else
            let mutable sum = 0.0
            for i in 0 .. n - 1 do
                for j in i + 1 .. n - 1 do
                    sum <- sum + overlapCoefficient arr.[i] arr.[j]
            
            let pairCount = float (n * (n - 1)) / 2.0
            sum / pairCount
