namespace Zeta.Core

/// **YinYang — the self-contained dynamical cell: "what remains" + "what acts" in one DynamicValue.**
/// (Aaron's 2026-06-05 breakthrough; the concrete encoding of the "single DynamicValue with Rx inside"
/// from the bifurcation/NCI synthesis — `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge.)
///
/// - **yin = `Remains`** — the static, canonical value tree (the data; what persists).
/// - **yang = `Acts`** — the reactive engine, a `Bonsai.Expr` (the operation; what acts on the data).
///
/// The cell serializes to a `DynamicValue.Object` with two reserved keys (the yin-yang "dots" — the
/// specific tag is not load-bearing; Aaron: "the discriminator can be anything", only the remains/acts
/// split is). The yang is carried as its **Bonsai-serialized string**, so the whole cell rides BOTH
/// proven serializers: Bonsai's `Expr ↔ string` AND `DynamicValue`'s 4-ser + Arrow. Because both halves
/// are `DynamicValue`s in one structure, each can represent the other — "the smallest little engine that
/// is actually complex."
///
/// This is the medium for **polymorphic diplomacy** (Eve, 081KT2T2J0008QG0R00301P27H, NCI-governed): an agent's static
/// identity (yin) + live behaviour (yang) in one structure other agents can read, interrogate, and
/// negotiate over. First slice (this module): the structure + its lossless round-trip, proven before any
/// agent touches it.
[<RequireQualifiedAccess>]
module YinYang =

    /// The reserved discriminator key for yin (what remains).
    [<Literal>]
    let RemainsKey = "remains"

    /// The reserved discriminator key for yang (what acts).
    [<Literal>]
    let ActsKey = "acts"

    /// A self-contained dynamical cell: yin (`Remains`, the value tree) + yang (`Acts`, the Bonsai engine).
    type Cell = { Remains: DynamicValue; Acts: Bonsai.Expr }

    /// Serialize a cell to its `DynamicValue` form — yin as itself, yang as its Bonsai-serialized string,
    /// under the two reserved keys. `None` only if the engine fails to serialize (a valid `Expr` always
    /// serializes, so this is `Some` in practice).
    let toDynamicValue (cell: Cell) : DynamicValue option =
        match Bonsai.serialize cell.Acts with
        | Ok s -> Some(DynamicValue.Object [ RemainsKey, cell.Remains; ActsKey, DynamicValue.String s ])
        | Error _ -> None

    /// Recover a cell from its `DynamicValue` form. `None` if the shape/keys are wrong or the carried
    /// engine string does not parse back to a `Bonsai.Expr`.
    let ofDynamicValue (dv: DynamicValue) : Cell option =
        match dv with
        | DynamicValue.Object kvs ->
            let find k = kvs |> List.tryPick (fun (key, v) -> if key = k then Some v else None)
            match find RemainsKey, find ActsKey with
            | Some remains, Some (DynamicValue.String s) ->
                match Bonsai.parse s with
                | Ok expr -> Some { Remains = remains; Acts = expr }
                | Error _ -> None
            | _ -> None
        | _ -> None
