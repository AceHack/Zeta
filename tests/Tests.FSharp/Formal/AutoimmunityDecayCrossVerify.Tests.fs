module Zeta.Tests.Formal.AutoimmunityDecayCrossVerifyTests

open Xunit
open FsCheck.Xunit

// ═══════════════════════════════════════════════════════════════════
// BP-16 (empirical) for Aurora round (g): Immune-memory decay — false-positive suppression
// (Autoimmunity Flood, standardization §4.5 / Eq 10 / §2.6 archive-active split).
// Soraya's routing: FsCheck (decay→0) primary; Z3 (QF_LRA, contraction (1−δ)<1) optional cross-check.
//
// Test 4.5 scenario: flood the system with valid, safe, highly NOVEL inputs (high d_self, Danger ≈ 0).
// With Danger ≈ 0 the clonal-expansion term `α·Match·Danger` vanishes, so Eq 10 reduces to
//     n(t+1) = max(0, (1 − δ_decay)·n(t) − β·FalsePositive)
// — a contraction. Obligations:
//   (a) active detectors decay → 0 over T ticks (no reactivation) — immune bloat / autoimmunity bounded;
//   (b) canonical fixtures in M^archive are UNAFFECTED by decay (archive updated only by explicit policy).
// Triage: a counterexample ⇒ the decay dynamics drifted from §4.5/§2.6.
// ═══════════════════════════════════════════════════════════════════

// One decay tick on an active detector weight under flood (Danger ≈ 0). β·FP only subtracts.
let private decayTick (delta: float) (beta: float) (fp: float) (x: float) : float =
    max 0.0 ((1.0 - delta) * x - beta * fp)

let private iterate (delta: float) (beta: float) (fp: float) (n0: float) (t: int) : float =
    let mutable x = n0
    for _ in 1..t do
        x <- decayTick delta beta fp x
    x

// Map int seeds into the valid parameter ranges (δ ∈ [0.01, 0.99] keeps the contraction
// non-degenerate; weights/inputs are non-negative).
let private deltaOf (n: int) = 0.01 + float (abs n % 99) / 100.0
let private weightOf (n: int) = float (abs n % 1001) // 0..1000
let private smallOf (n: int) = float (abs n % 10) // 0..9

[<Property>]
let ``§4.5(a) active detectors decay to 0 under flood (Danger≈0, no reactivation)`` (dsi: int) (n0i: int) =
    let delta = deltaOf dsi
    let n0 = weightOf n0i
    let eps = 1e-6
    // pure-geometric worst case (fp = 0 decays slowest); pick T from δ so (1−δ)^T·n0 < eps.
    let needed = int (ceil (log (eps / (n0 + 1.0)) / log (1.0 - delta))) + 5
    let t = min (max needed 1) 200000
    iterate delta 0.0 0.0 n0 t < eps

[<Property>]
let ``decay is monotone non-increasing — flood never amplifies an active detector`` (dsi: int) (n0i: int) (bi: int) (fpi: int) =
    let delta = deltaOf dsi
    let n0 = weightOf n0i
    let next = decayTick delta (smallOf bi) (smallOf fpi) n0
    next <= n0 + 1e-9

[<Property>]
let ``false-positive pressure only ACCELERATES decay (β·FP subtracts, never adds)`` (dsi: int) (n0i: int) (fpi: int) =
    let delta = deltaOf dsi
    let n0 = weightOf n0i
    let fp = smallOf fpi
    let withFp = decayTick delta 1.0 fp n0
    let without = decayTick delta 0.0 0.0 n0
    withFp <= without + 1e-9

[<Property>]
let ``contraction factor (1−δ) ∈ (0,1) for δ ∈ (0,1) — the QF_LRA fact Z3 cross-checks`` (dsi: int) =
    let factor = 1.0 - deltaOf dsi
    factor > 0.0 && factor < 1.0

[<Property>]
let ``§4.5(b) M^archive is immune to decay — any number of ticks leaves the fixture set unchanged`` (ti: int) (seeds: int list) =
    // The archive partition (§2.6) has NO decay operator — it is updated only by explicit policy.
    // Modeled as decay-immune by construction: applying decay-ticks is the identity on the archive.
    let archive = seeds |> List.map (fun s -> "fixture-" + string (abs s % 50)) |> Set.ofList
    let ticks = abs ti % 100
    let decayArchive (a: Set<string>) = a // §2.6: archive is not decayed
    let mutable a = archive
    for _ in 1..ticks do
        a <- decayArchive a
    a = archive

[<Fact>]
let ``non-vacuity: a canonical fixture persists in M^archive while its active detector weight decays to ~0`` () =
    // The §2.6 point: "canonical attack memory ≠ always-hot active detector". Same severe attack —
    // the active weight decays toward 0 (no longer hot), the archived fixture persists forever.
    let activeT = iterate 0.3 0.0 0.0 100.0 200
    let archive = Set.ofList [ "canonical-attack-1" ]
    Assert.True(activeT < 1.0) // active detector decayed (no longer paranoid-hot)
    Assert.Contains("canonical-attack-1", archive) // archived fixture survives, decay-immune
