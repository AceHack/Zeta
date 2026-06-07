module Zeta.Tests.TensorRefTests

open global.Xunit
open Zeta.Core

module TR = Zeta.Core.TensorRef

let private addr () = MerkleHash(0xDEADBEEFUL, 0x0123456789ABCDEFUL)

[<Fact>]
let ``toDynamic then tryOfDynamic round-trips a dense reference`` () =
    let r = TR.create (addr ()) [ 4096; 4096 ] "f32" TR.Dense
    let dv = TR.toDynamic r
    Assert.True(TR.isTensorRef dv)
    Assert.Equal<TR.TensorRef option>(Some r, TR.tryOfDynamic dv)

[<Fact>]
let ``round-trips a sparse reference and a scalar (empty shape)`` () =
    let r1 = TR.create (addr ()) [ 1000000 ] "i64" TR.Sparse
    let r2 = TR.create (addr ()) [] "f64" TR.Dense // scalar
    Assert.Equal<TR.TensorRef option>(Some r1, TR.toDynamic r1 |> TR.tryOfDynamic)
    Assert.Equal<TR.TensorRef option>(Some r2, TR.toDynamic r2 |> TR.tryOfDynamic)

[<Fact>]
let ``a plain object / scalar is not mistaken for a tensor reference`` () =
    Assert.False(TR.isTensorRef (DynamicValue.String "not a tensor"))
    Assert.False(TR.isTensorRef (DynamicValue.Object [ "name", DynamicValue.String "Ada" ]))
    Assert.Equal<TR.TensorRef option>(None, TR.tryOfDynamic (DynamicValue.Int 42L))

[<Fact>]
let ``a tensor reference is navigable as a Globals leaf (state_dict shape)`` () =
    // model state_dict: encoder.layer.0.weight -> a dense tensor reference
    let wref = TR.create (addr ()) [ 768; 768 ] "f32" TR.Dense

    let model =
        Globals.empty
        |> Globals.set [ "encoder"; "layer"; "0"; "weight" ] (TR.toDynamic wref)

    // navigate to the leaf with MUMPS verbs, then decode the reference
    let leaf = Globals.get [ "encoder"; "layer"; "0"; "weight" ] model
    Assert.True(leaf.IsSome)
    Assert.Equal<TR.TensorRef option>(Some wref, leaf |> Option.bind TR.tryOfDynamic)

[<Fact>]
let ``tryResolve dereferences the blob from a content store`` () =
    // a content store of byte[] blobs keyed by content hash
    let store = ContentStore.create (fun (b: byte[]) -> MerkleHash.ofBytes (System.ReadOnlySpan<byte> b))
    let blob = [| 1uy; 2uy; 3uy; 4uy |]
    let h, store = ContentStore.put blob store
    let r = TR.create h [ 4 ] "u8" TR.Dense
    Assert.Equal<byte[] option>(Some blob, TR.tryResolve store r)
