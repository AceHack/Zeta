namespace Zeta.Core

open System
open System.Globalization

/// **A content-addressed reference to *our* tensor (`ITensor`), carried inside a `DynamicValue` (Aaron
/// 2026-06-07: "we should allow tensors to be referenced from DynamicValue — our ITensor").** A tensor leaf
/// in a ragged `DynamicValue` tree (e.g. a model `state_dict` node) is **not** stored inline — the dense
/// buffer / sparse Z-set lives in the content-addressed store, and the `DynamicValue` holds a *reference*:
/// its content address (`MerkleHash`) plus shape + dtype + backing kind. So you **navigate to** the tensor
/// with the MUMPS verbs (`Globals`) and the leaf you reach is a `TensorRef`; you **dereference** it to get
/// the bytes, then **index into** the dense buffer with BLAS / `TensorPrimitives` (the dense-leaf compute
/// layer — Aaron's BLAS/Boost-uBLAS-at-MacVector anchor) or fold the sparse Z-set over a semiring.
///
/// **Additive — no change to the public `DynamicValue` DU.** The reference is encoded as a
/// `DynamicValue.Object` with reserved keys (sentinel `$tensor`), riding the canonical CBOR/JSON/XML codecs
/// like `CloudEvents`/`DvKey`. Content-addressing gives free dedup of identical tensor blobs across
/// checkpoints; `kind` is fork-agnostic about the `ITensor` backing (dense `Tensor<T>` vs sparse
/// `ZSet`/`WeightedSet`).
///
/// Anchors: content-addressed references (Git/IPFS); safetensors/GGUF (named-tensor model blobs the address
/// points at); BLAS / Boost uBLAS / `System.Numerics.Tensors` (the dense-leaf compute); `ContentStore`,
/// `MerkleHash`, `IContentHasher` (ours). ZetaId-pointer-not-authority: a `TensorRef` is a pointer.
[<RequireQualifiedAccess>]
module TensorRef =

    /// Which `ITensor` backing the reference resolves to.
    type Kind =
        | Dense // contiguous buffer → Tensor<T> / TensorPrimitives / BLAS
        | Sparse // coordinate→weight → ZSet / WeightedSet over a semiring

    let private kindToString =
        function
        | Dense -> "dense"
        | Sparse -> "sparse"

    let private kindOfString =
        function
        | "dense" -> Some Dense
        | "sparse" -> Some Sparse
        | _ -> None

    /// A reference to a content-addressed tensor: its address + shape (dims; `[]` = scalar) + dtype
    /// (ordinal token, e.g. "f32"/"f64"/"i64") + backing kind.
    [<NoComparison; CustomEquality>]
    type TensorRef =
        { Address: MerkleHash
          Shape: int list
          Dtype: string
          Kind: Kind }

        override this.Equals(o) =
            match o with
            | :? TensorRef as r ->
                this.Address.Equals r.Address
                && this.Shape = r.Shape
                && String.Equals(this.Dtype, r.Dtype, StringComparison.Ordinal)
                && this.Kind = r.Kind
            | _ -> false

        override this.GetHashCode() = this.Address.GetHashCode()

    /// The sentinel key that marks a `DynamicValue.Object` as a tensor reference.
    [<Literal>]
    let SentinelKey = "$tensor"

    let create (address: MerkleHash) (shape: int list) (dtype: string) (kind: Kind) : TensorRef =
        { Address = address
          Shape = shape
          Dtype = dtype
          Kind = kind }

    /// Parse a 32-char lowercase-hex `MerkleHash` (the `ToHex` form: Hi[16] ++ Lo[16]).
    let private parseHex (s: string) : MerkleHash option =
        if s.Length <> 32 then
            None
        else
            let tryU64 (sub: string) =
                match UInt64.TryParse(sub, NumberStyles.HexNumber, CultureInfo.InvariantCulture) with
                | true, v -> Some v
                | _ -> None

            match tryU64 (s.Substring(0, 16)), tryU64 (s.Substring(16, 16)) with
            | Some hi, Some lo -> Some(MerkleHash(hi, lo))
            | _ -> None

    /// Encode a `TensorRef` as a `DynamicValue.Object` (rides the canonical codecs). Key order is stable.
    let toDynamic (r: TensorRef) : DynamicValue =
        DynamicValue.Object
            [ SentinelKey, DynamicValue.String(r.Address.ToHex())
              "shape", DynamicValue.Array(r.Shape |> List.map (fun d -> DynamicValue.Int(int64 d)))
              "dtype", DynamicValue.String r.Dtype
              "kind", DynamicValue.String(kindToString r.Kind) ]

    /// Recognize + decode a tensor-reference leaf; `None` if `dv` is not a well-formed `$tensor` object.
    let tryOfDynamic (dv: DynamicValue) : TensorRef option =
        match dv with
        | DynamicValue.Object kvs ->
            let find k =
                kvs |> List.tryPick (fun (kk, v) -> if String.Equals(kk, k, StringComparison.Ordinal) then Some v else None)

            match find SentinelKey, find "shape", find "dtype", find "kind" with
            | Some(DynamicValue.String hex),
              Some(DynamicValue.Array dims),
              Some(DynamicValue.String dtype),
              Some(DynamicValue.String kindStr) ->
                let shape =
                    dims
                    |> List.choose (function
                        | DynamicValue.Int n -> Some(int n)
                        | _ -> None)

                match parseHex hex, kindOfString kindStr with
                | Some addr, Some kind when List.length shape = List.length dims ->
                    Some
                        { Address = addr
                          Shape = shape
                          Dtype = dtype
                          Kind = kind }
                | _ -> None
            | _ -> None
        | _ -> None

    /// True iff `dv` is a tensor-reference leaf.
    let isTensorRef (dv: DynamicValue) : bool = (tryOfDynamic dv).IsSome

    /// Dereference: fetch the tensor blob from a content store keyed by the reference's address.
    let tryResolve (store: ContentStore.Store<'V>) (r: TensorRef) : 'V option = ContentStore.get r.Address store
