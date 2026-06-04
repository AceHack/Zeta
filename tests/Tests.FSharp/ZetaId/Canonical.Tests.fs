module Zeta.Tests.FSharp.ZetaId.CanonicalTests
#nowarn "0893"

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core.FSharp.ZetaId

// ═══════════════════════════════════════════════════════════════════
// CANONICAL primitive candidate — ZetaId codec proven the GENERAL way.
// ZetaId already has the CONSENSUS axis (4-language byte-lock: TS/F#/C#/
// Rust agree on tests/cross-verification/zeta-id/vectors.yaml — see
// ZetaId/CrossVerifyTests.fs, which packs the 12 seed observations and
// checks `pack obs = expected_hex` AND `unpack ∘ pack = id` on each).
// That cross-verify IS the seed-lineage edge (half-b): the 4-language-
// agreed canonical hex, anchored to the seed. By transitivity
// (pack obs = seed_hex ∧ unpack ∘ pack = id ⟹ unpack seed_hex = obs),
// the seed's bytes decode to the seed's observation.
//
// This file adds the missing PROOF axis (half-a): the GENERAL round-trip
// LAW over ARBITRARY observations (not just the 12 seed vectors), plus
// env-invariance and field injectivity — making ZetaId a candidate to
// meet BOTH axes of the formal-proof-first canonical bar.
//
//   * unpack ∘ pack = id over the full valid field space (bijective
//     128-bit layout: 9 fields pack + unpack faithfully, no bleed)
//   * the unpacked observation is INVARIANT to env randomness (pack
//     injects 32 random bits via env.NextInt64(); unpack never reads
//     them back — they must not corrupt the field bits)
//   * distinct observations pack to distinct ids under the SAME env
//     (the field layout is injective — no two observations alias)
//
// FsCheck (the layout is a structural bijection; Z3 not needed). "The
// compilers don't lie."
// ═══════════════════════════════════════════════════════════════════

// generate a VALID ZetaObservation: in-width bytes for the enum fields
// (validateEnumField is width-only — any byte fitting the field round-trips
// via EnumOfValue), named DU cases for Authority/Momentum (Raw aliasing a
// named byte is rejected by pack), valid 48-bit timestamp.
let private genObs : Gen<ZetaObservation> =
    gen {
        let! ts =
            Gen.oneof
                [ Gen.choose (0, System.Int32.MaxValue) |> Gen.map int64
                  Gen.elements [ 0L; 281474976710655L ] ] // 0 .. 2^48-1 (48-bit field)
        let! chromo = Gen.choose (0, 31) |> Gen.map byte   // 5-bit
        let! cat = Gen.choose (0, 15) |> Gen.map byte       // 4-bit
        let! ff = Gen.elements [ Firefly.Off; Firefly.On ]  // 1-bit
        let! auth =
            Gen.elements
                [ Authority.HumanVerified; Authority.TrustedAgent; Authority.Standard
                  Authority.BestEffort; Authority.Simulated ]
        let! pers = Gen.choose (0, 255) |> Gen.map byte      // 8-bit
        let! mom =
            Gen.elements
                [ Momentum.Background; Momentum.Normal; Momentum.Elevated
                  Momentum.High; Momentum.Critical ]
        let! loc =
            Gen.elements
                [ Location.EastUsVa; Location.WestUsOr; Location.CentralUs; Location.CanadaToronto
                  Location.WestEurope; Location.NorthEurope; Location.SoutheastAsiaSg
                  Location.NortheastAsiaTk; Location.AustraliaSyd; Location.SouthAmericaSp
                  Location.MultiRegion ]
        return
            { Version = IdVersion.V1
              Timestamp = LanguagePrimitives.Int64WithMeasure<ms> ts
              Chromosome = LanguagePrimitives.EnumOfValue<byte, Chromosome> chromo
              Category = LanguagePrimitives.EnumOfValue<byte, Category> cat
              Firefly = ff
              Authority = auth
              Persona = LanguagePrimitives.EnumOfValue<byte, Persona> pers
              Momentum = mom
              Location = loc }
    }

type ZetaObsArb() =
    static member Obs() = Arb.fromGen genObs

/// a deterministic env returning a fixed randomness value (to probe that the
/// unpacked observation does not depend on the env's randomness).
let private mkEnv (n: int64) =
    { new ISimulationEnvironment with
        member _.NextInt64() = n }

[<Property(Arbitrary = [| typeof<ZetaObsArb> |])>]
let ``CANONICAL ZetaId: unpack ∘ pack = id (bijective 128-bit field layout, 9 fields)``
    (obs: ZetaObservation) =
    ZetaIdCodec.unpack (ZetaIdCodec.pack obs DeterministicEnv.Instance) = obs

[<Property(Arbitrary = [| typeof<ZetaObsArb> |])>]
let ``CANONICAL ZetaId: the unpacked observation is invariant to env randomness (32 random bits don't bleed into field bits)``
    (obs: ZetaObservation) (r1: int64) (r2: int64) =
    let a = ZetaIdCodec.unpack (ZetaIdCodec.pack obs (mkEnv r1))
    let b = ZetaIdCodec.unpack (ZetaIdCodec.pack obs (mkEnv r2))
    a = obs && b = obs && a = b

[<Property(Arbitrary = [| typeof<ZetaObsArb> |])>]
let ``CANONICAL ZetaId: distinct observations pack to distinct ids under the same env (field layout is injective)``
    (a: ZetaObservation) (b: ZetaObservation) =
    // same env ⇒ identical randomness bits ⇒ any id difference is in the field
    // region: pack a = pack b iff a = b (no two observations alias).
    let env = DeterministicEnv.Instance
    (ZetaIdCodec.pack a env = ZetaIdCodec.pack b env) = (a = b)

// THE KEY EMBEDS THE CLOCK (ties identity #2 to Clock.fs #1). Timestamp occupies
// bits 75-122 — just below Version, ABOVE every other field — so within a fixed
// Version + other fields, the packed id orders EXACTLY by timestamp. The
// time-ordered prefix IS the embedded clock: range-scanning the keyspace is
// range-scanning time. One key-type cell (V1); the per-version/category matrix
// reuses this since Timestamp's position is layout-invariant above the fields.
[<Property(Arbitrary = [| typeof<ZetaObsArb> |])>]
let ``CANONICAL ZetaId: id order respects timestamp order — the key embeds the clock``
    (obs: ZetaObservation) (a: int64) (b: int64) =
    let mask48 = (1L <<< 48) - 1L
    let t1 = a &&& mask48 // mask to the 48-bit field (always 0 .. 2^48-1; no overflow)
    let t2 = b &&& mask48
    let o1 = { obs with Timestamp = LanguagePrimitives.Int64WithMeasure<ms> t1 }
    let o2 = { obs with Timestamp = LanguagePrimitives.Int64WithMeasure<ms> t2 }
    let id1 = ZetaIdCodec.pack o1 DeterministicEnv.Instance
    let id2 = ZetaIdCodec.pack o2 DeterministicEnv.Instance
    compare t1 t2 = compare id1 id2
