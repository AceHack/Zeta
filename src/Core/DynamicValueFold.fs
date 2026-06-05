namespace Zeta.Core

open System.Collections.Immutable

/// **DynamicValueFold — the generic catamorphism (μF fold) over `DynamicValue`.**
///
/// `DynamicValue` is the initial algebra (μF) of the polynomial functor
/// `F X = 1 + Bool + Int + Float + String + Bytes + (List X) + (List (string×X))`.
/// A `DvAlgebra<'r>` is an F-algebra `F 'r -> 'r` packaged as one case per shape;
/// `cata` is the unique algebra homomorphism out of the initial algebra — the
/// fold (Meijer/Fokkinga/Paterson 1991, *Functional Programming with Bananas,
/// Lenses, Envelopes and Barbed Wire*). Children are folded first, so each
/// `Array`/`Object` case receives the ALREADY-folded `'r` results.
///
/// `bananaSplit` is the **banana-split law** made operational: two folds in ONE
/// traversal. Naively `(cata a dv, cata b dv)` walks the tree twice; the
/// banana-split law says the pair is itself a catamorphism, so we build a single
/// tupled `DvAlgebra<'a*'b>` and `cata` once. Same name, same theorem (FFP 1991).
[<RequireQualifiedAccess>]
module DynamicValueFold =

    /// An F-algebra over `DynamicValue`: one carrier case per shape. `cata` carries
    /// the recursion; the `Array`/`Object` cases receive children already folded to `'r`.
    type DvAlgebra<'r> =
        { Null: 'r
          Bool: bool -> 'r
          Int: int64 -> 'r
          Float: float -> 'r
          String: string -> 'r
          Bytes: ImmutableArray<byte> -> 'r
          Array: 'r list -> 'r
          Object: (string * 'r) list -> 'r }

    /// The catamorphism: fold a `DynamicValue` to `'r` under `alg`. Structural
    /// recursion — children are folded before their parent's case runs.
    let rec cata (alg: DvAlgebra<'r>) (value: DynamicValue) : 'r =
        match value with
        | DynamicValue.Null -> alg.Null
        | DynamicValue.Bool b -> alg.Bool b
        | DynamicValue.Int i -> alg.Int i
        | DynamicValue.Float f -> alg.Float f
        | DynamicValue.String s -> alg.String s
        | DynamicValue.Bytes b -> alg.Bytes b
        | DynamicValue.Array items -> alg.Array(items |> List.map (cata alg))
        | DynamicValue.Object pairs -> alg.Object(pairs |> List.map (fun (k, v) -> (k, cata alg v)))

    /// Banana-split: run two algebras in ONE traversal, returning the pair. Builds a
    /// single tupled `DvAlgebra<'a*'b>` and `cata`s exactly once — it does NOT call
    /// `cata` twice. The law it satisfies: `bananaSplit a b dv = (cata a dv, cata b dv)`.
    let bananaSplit (a: DvAlgebra<'a>) (b: DvAlgebra<'b>) (value: DynamicValue) : 'a * 'b =
        let tupled: DvAlgebra<'a * 'b> =
            { Null = (a.Null, b.Null)
              Bool = fun x -> (a.Bool x, b.Bool x)
              Int = fun x -> (a.Int x, b.Int x)
              Float = fun x -> (a.Float x, b.Float x)
              String = fun x -> (a.String x, b.String x)
              Bytes = fun x -> (a.Bytes x, b.Bytes x)
              // children arrive as already-folded ('a*'b) pairs; unzip, hand each
              // algebra its own projection.
              Array =
                fun children ->
                    let xs, ys = List.unzip children
                    (a.Array xs, b.Array ys)
              Object =
                fun children ->
                    let xs = children |> List.map (fun (k, (x, _)) -> (k, x))
                    let ys = children |> List.map (fun (k, (_, y)) -> (k, y))
                    (a.Object xs, b.Object ys) }
        cata tupled value

    // ───────────────────────── ShapeContext ─────────────────────────
    // The serialization-junction INPUT a structure policy sees. A policy that
    // selects per-node structure (e.g. XML named-vs-generic element) inspects
    // not just the value but WHERE it sits and under WHAT key. ShapeContext is
    // that view: the document-order path from the root, the immediate Object key
    // (if this node is an Object entry), and the value's coarse shape kind.

    /// One step in a `ShapePath`: into an Object under a `Key`, or into an Array
    /// at an `Index`.
    type ShapeStep =
        | Key of string
        | Index of int

    /// The path from the document root to a node, head = outermost (document
    /// order). `[]` is the root.
    type ShapePath = ShapeStep list

    /// The coarse shape kind of a `DynamicValue` — the "what type is this node"
    /// a structure policy keys on, independent of the value's contents.
    type ShapeKind =
        | NullK
        | BoolK
        | IntK
        | FloatK
        | StringK
        | BytesK
        | ArrayK
        | ObjectK

    /// The serialization-junction input a structure policy inspects: the
    /// document-order `Path` to this node, the immediate Object `Key` (if this
    /// node is an Object entry; `None` otherwise), and the node's `Kind`.
    type ShapeContext =
        { Path: ShapePath
          Key: string option
          Kind: ShapeKind }

    /// The coarse `ShapeKind` of a `DynamicValue`.
    let kindOf (value: DynamicValue) : ShapeKind =
        match value with
        | DynamicValue.Null -> NullK
        | DynamicValue.Bool _ -> BoolK
        | DynamicValue.Int _ -> IntK
        | DynamicValue.Float _ -> FloatK
        | DynamicValue.String _ -> StringK
        | DynamicValue.Bytes _ -> BytesK
        | DynamicValue.Array _ -> ArrayK
        | DynamicValue.Object _ -> ObjectK

    /// The identity algebra: rebuilds the value unchanged. Sanity anchor —
    /// `cata identityAlgebra dv = dv` (the catamorphism's reflection law).
    let identityAlgebra: DvAlgebra<DynamicValue> =
        { Null = DynamicValue.Null
          Bool = DynamicValue.Bool
          Int = DynamicValue.Int
          Float = DynamicValue.Float
          String = DynamicValue.String
          Bytes = DynamicValue.Bytes
          Array = DynamicValue.Array
          Object = DynamicValue.Object }
