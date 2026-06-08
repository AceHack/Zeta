namespace Zeta.Core

/// **`ActionGrammar` — the universal action algebra/grammar of the 4×4 controller (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we're using the controller interface [as] the universal action grammar?"* — yes, and this names it.
/// The 16-key hex keypad is a **4×4 grid** = the finite **action alphabet** every CHIP-8 program's controls map
/// onto. This module makes its structure explicit (the pieces existed scattered across `SoftController` /
/// `SoftDashboard.keypad`; here they are one named object):
///
///   - **Alphabet** — 16 keys (the 4×4 grid). `single k`, grid geometry `ofGrid` / `toGrid`.
///   - **Algebra** — held-key *sets* form a **Boolean lattice** (the powerset of 16): `bottom` = ⊥ (no keys),
///     `top` = ⊤ (all keys held = the Boolean *join*: a single classical **product** action, "press everything
///     at once" — this is an AND/conjunction, **NOT** the superposition), `join` (hold both), `meet`,
///     `complement`, `leq` (⊑).
///   - **Superposition (distinct from ⊤ — the classical/quantum line):** the *controller-in-superposition* is a
///     weighted **sum** over the *basis* actions (each single button = a basis vector), each explored in its own
///     **branch / timeslice** — `SoftController.inputSuperposition` (a *distribution* over the alphabet) realized
///     as the soft ensemble's input fork (`SoftEmu`/`AmplitudeEmu` branches). A linear combination, not the
///     lattice ⊤. ⊤ = "all buttons held in one timeline"; superposition = "each button in a different timeline."
///   - **Grammar** — action *sequences over time* (`Word` = `Action list`) = strings over the alphabet; the soft
///     branch-tree is their parse tree; the game logic is the grammar's constraint on meaningful sequences.
///
/// **Why it is the substrate's common action surface:** `SoftController` distributes over this alphabet,
/// `SoftDrive` selects words from it, the hard emulator executes them, and **empowerment** (Klyubin–Polani)
/// measures it exactly — empowerment is the channel capacity from **actions → future states**, so this alphabet
/// is the channel input and empowerment is *how expressive this action grammar is* from a state.
///
/// **Honest scope (peel):** "universal" is concrete *for CHIP-8* (all CHIP-8 controls live in these 16). A
/// *cross-domain* universal action grammar (map any domain's actions onto the 4×4 grid as a shared action
/// embedding — the RL universal-action-space idea) is the aspiration, not proven here. Geometry is row-major
/// (`k = 4·row + col`); the *hardware* hex layout (1 2 3 C / …) is `SoftDashboard.keypad` — this module is the
/// abstract grid/lattice, not the hardware key positions. An `Action` is a 16-bool; not validated for length at
/// the type level (a debt — a fixed-width type would enforce it).
[<RequireQualifiedAccess>]
module ActionGrammar =

    /// An action = a held-key set: a 16-bool (one element of the Boolean lattice). `Action.[k]` = key k held.
    type Action = bool[]

    /// A word = an action sequence over time (a string over the alphabet) — what the soft layer explores.
    type Word = Action list

    /// The alphabet size (the grid is 4×4).
    [<Literal>]
    let AlphabetSize = 16

    // ---- alphabet + geometry ----

    /// The bottom element ⊥ — no keys held (`SoftController.none`).
    let bottom: Action = SoftController.none

    /// The top element ⊤ — every key held at once: a single classical **product** action (an AND/conjunction),
    /// NOT the superposition (`SoftController.allButtons`). The superposition is a weighted sum over basis
    /// actions, each in its own branch — `SoftController.inputSuperposition` / the soft fork, not this.
    let top: Action = SoftController.allButtons

    /// A single key held (`SoftController.singleKey`).
    let single (k: int) : Action = SoftController.singleKey k

    /// Grid coord (row, col) ∈ 0..3 × 0..3 → key index (row-major). Out-of-range clamps into the grid.
    let ofGrid (row: int) (col: int) : int = (max 0 (min 3 row)) * 4 + (max 0 (min 3 col))

    /// Key index → grid coord (row, col).
    let toGrid (k: int) : int * int = (k / 4, k % 4)

    // ---- Boolean lattice on held-key sets ----

    /// Is key `k` held in `a`?
    let holds (k: int) (a: Action) : bool = k >= 0 && k < AlphabetSize && a.[k]

    /// The held keys, as indices.
    let keys (a: Action) : int list = [ for k in 0 .. AlphabetSize - 1 do if a.[k] then k ]

    /// Join (∨) — hold the union of both action's keys.
    let join (a: Action) (b: Action) : Action = Array.init AlphabetSize (fun k -> a.[k] || b.[k])

    /// Meet (∧) — the keys held by both.
    let meet (a: Action) (b: Action) : Action = Array.init AlphabetSize (fun k -> a.[k] && b.[k])

    /// Complement (¬) — the keys NOT held.
    let complement (a: Action) : Action = Array.init AlphabetSize (fun k -> not a.[k])

    /// Lattice order: `a ⊑ b` iff every key of `a` is also in `b` (subset).
    let leq (a: Action) (b: Action) : bool =
        seq { 0 .. AlphabetSize - 1 } |> Seq.forall (fun k -> not a.[k] || b.[k])

    /// Build an action from a set of held keys.
    let ofKeys (ks: int seq) : Action =
        let a = Array.zeroCreate AlphabetSize
        for k in ks do
            if k >= 0 && k < AlphabetSize then a.[k] <- true
        a

    /// The number of keys held (the "weight" / grade of the action — 0 at ⊥, 16 at ⊤).
    let weight (a: Action) : int = a |> Array.sumBy (fun b -> if b then 1 else 0)

    // ---- grammar: words (action sequences) ----

    /// The empty word (no actions).
    let emptyWord: Word = []

    /// A one-action word.
    let wordOf (a: Action) : Word = [ a ]

    /// Word length (number of time-steps).
    let wordLength (w: Word) : int = List.length w

    /// Concatenate action sequences.
    let concat (u: Word) (v: Word) : Word = u @ v
