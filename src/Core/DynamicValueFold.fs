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

    // ───────────────────────── Fusion law (cata-fusion) ─────────────────────────
    // The banana-split's sibling law (FFP 1991). Banana-split fuses two folds INTO one
    // traversal; cata-fusion fuses a fold followed by a post-map INTO one fold.

    /// **Cata-fusion / deforestation law.** If `h : 'a -> 'b` is an F-algebra homomorphism
    /// from `f` to `g` — it commutes with both algebras shape-by-shape — then folding under
    /// `f` and post-composing `h` fuses into a single fold under `g`:
    ///
    ///     h (cata f dv) = cata g dv          for every `dv`.
    ///
    /// The win is **deforestation**: `h ∘ cata f` materialises the intermediate `'a` and then
    /// maps; `cata g` never builds it. Fusion is *conditional* on the homomorphism, so this
    /// module supplies the certifier `isHom` (cf. `AdinkraCode.isSelfDual`) rather than an
    /// unconditional constructor; the law itself is proven in `DynamicValueFold.Tests`. This
    /// is the value-tree-level law that `Fusion.fs` realises at the circuit-operator level
    /// (same deforestation, two layers).

    /// The cata-fusion homomorphism condition: does `h` carry algebra `f` to algebra `g`?
    /// Leaf cases `h (f.Leaf x) = g.Leaf x`; parent cases `h (f.Array xs) = g.Array (List.map h xs)`
    /// and the Object analogue. Checked on the supplied samples (leaf payloads + already-folded
    /// child lists). When this holds for ALL inputs, `h ∘ cata f = cata g` (the fusion law).
    let isHom
        (h: 'a -> 'b)
        (f: DvAlgebra<'a>)
        (g: DvAlgebra<'b>)
        (bl: bool)
        (i: int64)
        (fl: float)
        (s: string)
        (by: ImmutableArray<byte>)
        (kids: 'a list)
        (okids: (string * 'a) list)
        : bool =
        h f.Null = g.Null
        && h (f.Bool bl) = g.Bool bl
        && h (f.Int i) = g.Int i
        && h (f.Float fl) = g.Float fl
        && h (f.String s) = g.String s
        && h (f.Bytes by) = g.Bytes by
        && h (f.Array kids) = g.Array(List.map h kids)
        && h (f.Object okids) = g.Object(okids |> List.map (fun (k, v) -> (k, h v)))

    /// Deforestation example (the fusion law made concrete): collect every scalar leaf into a
    /// document-order list. `List.length ∘ cata collectLeaves` counts leaves by BUILDING the
    /// list; the fused `leafCount` counts them in one pass with no intermediate list. The
    /// fusion law says the two agree (`List.length` is a `collectLeaves → leafCount` hom).
    let collectLeaves: DvAlgebra<DynamicValue list> =
        { Null = [ DynamicValue.Null ]
          Bool = fun b -> [ DynamicValue.Bool b ]
          Int = fun i -> [ DynamicValue.Int i ]
          Float = fun f -> [ DynamicValue.Float f ]
          String = fun s -> [ DynamicValue.String s ]
          Bytes = fun b -> [ DynamicValue.Bytes b ]
          Array = List.concat
          Object = fun kvs -> kvs |> List.collect snd }

    /// The fused leaf-count — `g` such that `List.length (cata collectLeaves dv) = cata leafCount dv`.
    /// A parent contributes only its children's leaves (it is not itself a leaf).
    let leafCount: DvAlgebra<int> =
        { Null = 1
          Bool = fun _ -> 1
          Int = fun _ -> 1
          Float = fun _ -> 1
          String = fun _ -> 1
          Bytes = fun _ -> 1
          Array = List.sum
          Object = fun kvs -> kvs |> List.sumBy snd }
