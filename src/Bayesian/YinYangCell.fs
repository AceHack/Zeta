namespace Zeta.Bayesian

open Zeta.Core

/// **YinYangCell — the 1000-brains yin-yang cell seeded by Adinkra codewords.**
///
/// This is the synthesis of three proven layers:
///   1. **Adinkra [8,4] self-dual code** (Core) — the T0 common seed. `gen(gen) = gen`.
///      The code is its own dual; the description of the code is an element of the code.
///      This is minimal reflection: the smallest structure that can represent itself.
///   2. **YinYang.Cell** (Core) — yin = what remains (static identity); yang = what acts (live engine).
///      The cell is the medium for polymorphic diplomacy (Eve protocol, NCI-governed).
///   3. **ThousandBrains.Column** (Bayesian) — the live belief engine. Observes sensory inputs,
///      accumulates IV, casts IV-weighted votes to the lateral consensus pool.
///
/// **The cell structure:**
///   - **yin** = the Adinkra codeword (the T0 seed, the static identity anchor).
///              Serialized as a `DynamicValue.Array` of `DynamicValue.Int` (8 GF(2) bits as 0/1).
///   - **yang** = the ThousandBrains.Column belief state (the live engine).
///              Serialized as a `Bonsai.Expr.Const (Bonsai.CStr json)` carrying the column state.
///
/// **The ana coalgebra (unfolding from seed):**
///   `seed : AdinkraCodeword → YinYangCell`
///   At each step: the column observes a sensory input, updates its belief (yang), and
///   the yin (Adinkra codeword) remains invariant — it is the identity anchor.
///   The cell is self-modelling: the yin is the seed that generated the yang.
///
/// **The gen(gen) = gen fixed point:**
///   `seed(cell.yin) = cell` — the cell seeded by its own yin produces the same cell.
///   This is the operational realization of minimal reflection at the Bayesian layer.
///
/// **Connection to EVE / hidden-shape:**
///   The yin is the public identity (the Adinkra codeword = the E8 root = the public key).
///   The yang is the private belief state (the column's Gaussian = the hidden shape).
///   The EVE protocol reads the hidden shape through the public interface.
///   The NCI boundary prevents coercive reads (the yang is only revealed under consent).
[<RequireQualifiedAccess>]
module YinYangCell =

    // ── Adinkra codeword serialization ──────────────────────────────────────────────────────────
    // AdinkraCode.isCodeword takes int[] (GF(2) values: 0 or 1).
    // We store as DynamicValue.Array of DynamicValue.Int.

    /// Serialize an Adinkra codeword (int[8], GF(2)) to a DynamicValue.Array of DynamicValue.Int.
    let private codewordToDv (cw: int[]) : DynamicValue =
        DynamicValue.Array(cw |> Array.toList |> List.map (fun b -> DynamicValue.Int(int64 b)))

    /// Deserialize a DynamicValue.Array of DynamicValue.Int back to an int[8].
    let private dvToCodeword (dv: DynamicValue) : int[] option =
        match dv with
        | DynamicValue.Array items when items.Length = 8 ->
            let bits =
                items
                |> List.choose (function
                    | DynamicValue.Int i when i = 0L || i = 1L -> Some(int i)
                    | _ -> None)
            if bits.Length = 8 then Some(List.toArray bits) else None
        | _ -> None

    // ── Column belief serialization via Bonsai.Expr.Const (CStr) ────────────────────────────────
    //
    // Bonsai.Expr only supports: Const(CInt|CStr|CBool|CNull), Param, Lambda, Binary, Call, Cond.
    // We serialize the column state as a compact JSON string in a CStr literal.
    // Format: "id|pm|p|iv" (pipe-separated, all floats as decimal strings).

    let private serializeColumn (col: ThousandBrains.Column) : string =
        sprintf "%s|%g|%g|%g" col.Id col.Belief.PrecisionMean col.Belief.Precision (float col.AccumulatedIV)

    let private deserializeColumn (s: string) : ThousandBrains.Column option =
        let parts = s.Split('|')
        if parts.Length = 4 then
            match System.Double.TryParse(parts.[1]), System.Double.TryParse(parts.[2]), System.Double.TryParse(parts.[3]) with
            | (true, pm), (true, p), (true, iv) ->
                Some
                    { ThousandBrains.Column.Id = parts.[0]
                      Belief = { Gaussian.PrecisionMean = pm; Precision = p }
                      AccumulatedIV = iv * 1.0<InformationValue.iv> }
            | _ -> None
        else None

    /// Serialize a ThousandBrains.Column to a Bonsai.Expr (the yang).
    let private columnToExpr (col: ThousandBrains.Column) : Bonsai.Expr =
        Bonsai.Expr.Const(Bonsai.CStr(serializeColumn col))

    /// Deserialize a Bonsai.Expr back to a ThousandBrains.Column.
    let private exprToColumn (expr: Bonsai.Expr) : ThousandBrains.Column option =
        match expr with
        | Bonsai.Expr.Const (Bonsai.CStr s) -> deserializeColumn s
        | _ -> None

    // ── The YinYangCell type ─────────────────────────────────────────────────────────────────────

    /// A 1000-brains yin-yang cell: Adinkra codeword (yin) + ThousandBrains.Column (yang).
    type Cell =
        { /// The Adinkra codeword — the T0 seed, the static identity anchor (int[8], GF(2)).
          Codeword: int[]
          /// The ThousandBrains.Column — the live belief engine.
          Column: ThousandBrains.Column }

    /// Serialize a YinYangCell to a YinYang.Cell (and then to DynamicValue).
    let toYinYang (cell: Cell) : YinYang.Cell =
        { YinYang.Cell.Remains = codewordToDv cell.Codeword
          YinYang.Cell.Acts = columnToExpr cell.Column }

    /// Deserialize a YinYang.Cell back to a YinYangCell.
    let ofYinYang (yy: YinYang.Cell) : Cell option =
        match dvToCodeword yy.Remains, exprToColumn yy.Acts with
        | Some cw, Some col -> Some { Codeword = cw; Column = col }
        | _ -> None

    /// Serialize to DynamicValue (via YinYang.toDynamicValue).
    let toDynamicValue (cell: Cell) : DynamicValue option =
        YinYang.toDynamicValue (toYinYang cell)

    /// Deserialize from DynamicValue (via YinYang.ofDynamicValue).
    let ofDynamicValue (dv: DynamicValue) : Cell option =
        YinYang.ofDynamicValue dv |> Option.bind ofYinYang

    // ── The ana coalgebra (seed → cell) ─────────────────────────────────────────────────────────

    /// Seed a new YinYangCell from an Adinkra codeword (int[8], GF(2)).
    /// The column is initialized with the codeword's binary string as its ID and an uninformative prior.
    /// This is the `ana coalg seed` operation: the cell unfolds from the seed.
    let seed (codeword: int[]) : Cell =
        let id = codeword |> Array.map string |> String.concat ""
        { Codeword = codeword
          Column = ThousandBrains.createColumn id }

    /// Observe a sensory input: update the yang (column belief) while the yin (codeword) remains.
    /// This is the coalgebra step: `Column → (Column × DynamicValue)`.
    /// The yin is invariant — it is the identity anchor. Only the yang evolves.
    let observe (sensoryInput: Gaussian) (cell: Cell) : Cell =
        { cell with Column = ThousandBrains.observe cell.Column sensoryInput }

    /// Cast a vote from the yang (column) to the lateral consensus pool.
    let castVote (cell: Cell) : ThousandBrains.Vote =
        ThousandBrains.castVote cell.Column

    // ── The gen(gen) = gen fixed point ───────────────────────────────────────────────────────────

    /// The self-modelling fixed point: seed the cell from its own yin (codeword).
    /// If `gen(gen) = gen` holds, then `reseed cell` has the same yin as `cell`.
    /// The yang is reset to the uninformative prior (the yang evolves; the yin is invariant).
    /// This is the operational test of minimal reflection at the Bayesian layer:
    ///   cell.Codeword = (reseed cell).Codeword  ← the yin is preserved
    ///   (reseed cell).Column = createColumn(id)  ← the yang is fresh
    let reseed (cell: Cell) : Cell =
        seed cell.Codeword

    /// Check the self-dual property: the cell's yin is a valid Adinkra codeword (syndrome = 0).
    /// This is the T0 guarantee: the yin is always in the E8 lattice (normSq = 4 via CliffordE8Bridge).
    let isValidSeed (cell: Cell) : bool =
        AdinkraCode.isCodeword cell.Codeword

    // ── ZSet reversibility (the +1/-1 retraction property) ──────────────────────────────────────

    /// Encode the cell as a ZSet entry with weight +1 (the cell is "present").
    let toZSetEntry (cell: Cell) : (DynamicValue * int64) option =
        toDynamicValue cell |> Option.map (fun dv -> dv, 1L)

    /// Retract the cell from a ZSet (weight -1, the cell is "absent").
    let toZSetRetraction (cell: Cell) : (DynamicValue * int64) option =
        toDynamicValue cell |> Option.map (fun dv -> dv, -1L)
