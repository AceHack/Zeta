namespace Zeta.Core

/// **`MetaController` — the agent's own controller: traversals + map moves = the meta universal action grammar (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"traversals + some sort of navigable map = our Xbox controller — **not the actual game buttons** but
/// our **universal action grammar**. So you have top-k traversals available to you based on the current context
/// window and can move directionally within some map."*
///
/// There are **two** action grammars:
///   - the **game's** (object level) — the 16 CHIP-8 keys (`ActionGrammar`); and
///   - the **agent's** (meta level, *this*) — what the agent actually steers: **`Traverse`** (run an uncertainty-
///     reduction traversal = *sense*, resolve out-of-window clarity) or **`Move`** (a directional move in the map
///     = *act*, transition between attractors via a game-action). The agent's "Xbox controller" is this menu, and
///     **its available buttons are context-dependent**: the top-k *affordable* traversals (`Traversal.schedule`
///     by VOI under the budget) plus the directional moves available from the current map node (`StateSpace`
///     edges / `planTo` directions). Same algebra as `ActionGrammar`, lifted to the cognitive layer.
///
/// So the agent navigates its own **world-state map** (`observe.ts`, #7129): pick a `Traverse` to sharpen where
/// it's murky, or a `Move` to go toward a desired attractor — within liveness (survival subsumes, `ControlMerge`).
///
/// **Honest scope (peel):** `available` just assembles the menu (scheduled traversals + supplied map moves) — the
/// *choice* among them is the policy layer (`ControlMerge`/`SoftDrive` + the intrinsic objective). `Move` is a
/// raw game-action here; a higher-level "move toward attractor X" compiles to an action *sequence* via
/// `StateSpace.recoverPlan` (a future slice). Deterministic (DST).
[<RequireQualifiedAccess>]
module MetaController =

    /// A meta-action — the agent's own controller button: sense (a traversal) or act (a directional map move).
    type MetaAction<'r> =
        | Traverse of Traversal.Traversal<'r> // reduce out-of-window uncertainty (sense)
        | Move of bool[] // a directional move in the map (act / transition)

    /// **The agent's currently-available controller menu:** the top-k *affordable* traversals (scheduled by VOI
    /// under `budget`) plus the directional `mapMoves` available from the current node. Context-dependent buttons.
    let available (budget: float) (traversals: Traversal.Traversal<'r> list) (mapMoves: bool[] list) : MetaAction<'r> list =
        (Traversal.schedule budget traversals |> List.map Traverse)
        @ (mapMoves |> List.map Move)

    /// The traversal (sense) options in a menu.
    let senses (menu: MetaAction<'r> list) : Traversal.Traversal<'r> list =
        menu
        |> List.choose (function
            | Traverse t -> Some t
            | Move _ -> None)

    /// The directional move (act) options in a menu.
    let moves (menu: MetaAction<'r> list) : bool[] list =
        menu
        |> List.choose (function
            | Move m -> Some m
            | Traverse _ -> None)
