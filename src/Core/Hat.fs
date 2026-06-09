namespace Zeta.Core

/// **`Hat` — a role-scoped bundle of the whole clarity engine (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"hats have **lenses**, **suggested landmarks for lens parameters**, **action restrictions**,
/// **uncertainty-reduction traversals**, and **control of other hats/agents wearing those hats**."* A hat (a
/// persona/role) is the engine, scoped to a role — every piece we built, packaged:
///   - **`Lenses`** — the role's `LensRouter` views (what this role attends to);
///   - **`Landmarks`** — suggested **solid ground** (`SolidGround`) the hat's lenses are parameterized by (the
///     role's constants/clocks to navigate by);
///   - **`AllowedActions`** — **action restrictions**: the permitted `ActionGrammar` subset (the role's
///     authority/permissions; empty = unrestricted). Ties to standing-authorization / gated-classes governance;
///   - **`Traversals`** — the role's uncertainty-reduction repertoire (`Traversal`s it can run);
///   - **`Controls`** — names of other hats/agents this hat **controls/coordinates** (the architect-hat-orchestrates
///     / delegation pattern; the meta-control edge).
///
/// Hats **compose** (qubit combinations of hats, #7140): a multi-agent fleet's joint state is the tensor of its
/// agents' worn hats; a hat's `Controls` is the coordination edge between them. So the world-state clarity engine,
/// the meta-controller, and the fleet are the same machinery viewed at the role layer.
///
/// **Honest scope (peel):** a hat is a *declarative bundle* — it says what the role attends to / may do / can run
/// / controls; the *policy* (which lens/traversal/action to pick) is `Salience`/`MetaController`/`ControlMerge`
/// under the intrinsic objective. `AllowedActions` is a structural allow-list (empty = unrestricted), not a proof
/// of authority — real authorization stays the human-gated governance model. `Controls` is a name edge, not an
/// enforcement mechanism. Deterministic (DST).
[<RequireQualifiedAccess>]
module Hat =

    /// A role/persona bundle: lenses + landmarks + action restrictions + traversals + control edges.
    type Hat<'r> =
        { Name: string
          Lenses: LensRouter.Lens list
          /// Suggested solid-ground landmarks for lens parameters (cell → its ground kind).
          Landmarks: (string * SolidGround.Ground) list
          /// The permitted action subset (action restriction). Empty = unrestricted.
          AllowedActions: bool[] list
          /// The role's uncertainty-reduction traversals.
          Traversals: Traversal.Traversal<'r> list
          /// Names of other hats/agents this hat controls/coordinates.
          Controls: string list }

    /// Does this hat permit `action`? (Empty `AllowedActions` ⇒ unrestricted ⇒ always true.)
    let permits (action: bool[]) (hat: Hat<'r>) : bool =
        List.isEmpty hat.AllowedActions || List.contains action hat.AllowedActions

    /// Filter a candidate action list to those this hat permits (the role's action restriction applied).
    let restrict (actions: bool[] list) (hat: Hat<'r>) : bool[] list =
        if List.isEmpty hat.AllowedActions then actions
        else actions |> List.filter (fun a -> List.contains a hat.AllowedActions)

    /// Does this hat control the named other hat/agent?
    let controls (other: string) (hat: Hat<'r>) : bool = List.contains other hat.Controls

    /// The solid-ground landmark cells this hat suggests as lens parameters (just the names).
    let landmarkCells (hat: Hat<'r>) : string list = hat.Landmarks |> List.map fst
