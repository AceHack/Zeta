module Zeta.Tests.Chip8ObserverTests

open global.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring
module RE = Zeta.Core.ReflectionEngine

// ═══════════════════════════════════════════════════════════════════
// Chip8Observer — first integration slice of the ray-trace observer (#7239): the ReflectionEngine observes
// the SoftChip8 soft-interrupt fork and predicts the input branch ("reflect downward into the soft
// interrupt handler"). Verifies: the fork observation is uniform exact-ℚ over the branch count; the
// observer's prediction is driven by its prior belief (uniform fork ⇒ argmax(prior)); the predicted branch
// maps back to the committed emu frame.
// ═══════════════════════════════════════════════════════════════════

let private r (n: int64) (d: int64) = PS.rat n d

/// A frame parked on an EX9E input branch: V0=0 (6000), then EX9E (E09E, skip-if-key-V0). After one step
/// V[0]=0 and PC sits at E09E — `SoftChip8.branchesOnInput` is true (the only genuine DST fork: input).
let private inputBranchFrame () =
    Chip8Cow.create 1UL
    |> Chip8Cow.loadRom [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |]
    |> Chip8Cow.step

[<Fact>]
let ``fork observation is uniform exact-rational over the branch count (2 at an input branch)`` () =
    let f = inputBranchFrame ()
    Assert.True(SoftChip8.branchesOnInput f) // precondition: we are at the soft fork
    let obs = Chip8Observer.forkObservation f
    Assert.Equal(2, obs.Length)
    Assert.Equal(0, PS.compare obs.[0] (r 1L 2L))
    Assert.Equal(0, PS.compare obs.[1] (r 1L 2L))

[<Fact>]
let ``observer prediction follows the prior belief under a uniform fork (down vs up)`` () =
    let f = inputBranchFrame ()
    // prior favouring key-DOWN (branch 0) ⇒ predicts 0; uniform fork must not flip it
    let _, idxDown = Chip8Observer.predict [| r 2L 3L; r 1L 3L |] f
    Assert.Equal(0, idxDown)
    // prior favouring key-UP (branch 1) ⇒ predicts 1
    let _, idxUp = Chip8Observer.predict [| r 1L 3L; r 2L 3L |] f
    Assert.Equal(1, idxUp)

[<Fact>]
let ``predicted frame maps the observer's branch back to the committed emu frame`` () =
    let f = inputBranchFrame ()
    let branches = SoftChip8.forkOnInput f
    Assert.Equal(2, List.length branches) // [down; up]
    // prior favouring down ⇒ predicted frame is the key-down branch
    let predicted = Chip8Observer.predictedFrame [| r 2L 3L; r 1L 3L |] f
    let expectedDown = fst (List.item 0 branches)
    Assert.Equal(expectedDown.PC, predicted.PC)
    // prior favouring up ⇒ predicted frame is the key-up branch
    let predictedUp = Chip8Observer.predictedFrame [| r 1L 3L; r 2L 3L |] f
    let expectedUp = fst (List.item 1 branches)
    Assert.Equal(expectedUp.PC, predictedUp.PC)
