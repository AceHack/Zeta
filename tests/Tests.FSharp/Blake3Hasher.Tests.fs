module Zeta.Tests.Blake3HasherTests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

module CH = Zeta.Core.ContentHasher

[<Fact>]
let ``blake3 adapter conforms to the port: named, deterministic, distinct from xxhash128`` () =
    let h = Blake3Hasher.hasher
    Assert.Equal("blake3", h.Name)
    let bytes = [| 1uy; 2uy; 3uy; 4uy |]
    Assert.Equal(h.Hash bytes, h.Hash bytes) // deterministic
    Assert.NotEqual(CH.defaultHasher.Hash bytes, h.Hash bytes) // really BLAKE3, not the xxhash default

[<Fact>]
let ``blake3 known-answer: empty input → first 16 bytes of the BLAKE3-256 digest (cross-language byte-lock)`` () =
    // BLAKE3("") = af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262
    // MerkleHash = hi(LE bytes[8..16)) ++ lo(LE bytes[0..8)) via ToHex → locks the truncation for all oracles.
    let mh = Blake3Hasher.hasher.Hash([||])
    Assert.Equal("49c9dc36ea4d40a0a6a1f9f5b94913af", mh.ToHex())
    Assert.Equal(mh.ToHex(), OwnBlake3Hasher.hasher.Hash([||]).ToHex())

let private toHex (bytes: byte[]) =
    System.BitConverter.ToString(bytes).Replace("-", "", System.StringComparison.Ordinal).ToLowerInvariant()

let private officialHashHex (inputLen: int) (expected32: string) =
    let input = Array.init inputLen (fun i -> byte (i % 251))
    let digest = Blake3Spec.hash input
    Assert.Equal(expected32, toHex digest)
    let nuget = Blake3.Hasher.Hash(System.ReadOnlySpan<byte> input)
    let nuget32 = nuget.AsSpan().Slice(0, 32).ToArray()
    Assert.Equal(expected32, toHex nuget32)

[<Fact>]
let ``own spec matches official vectors and the nuget oracle (hash mode)`` () =
    // BLAKE3-team test_vectors.json — first 32 bytes of each `hash` field.
    officialHashHex 0 "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
    officialHashHex 1 "2d3adedff11b61f14c886e35afa036736dcd87a74d27b5c1510225d0f592e213"
    officialHashHex 64 "4eed7141ea4a5cd4b788606bd23f46e212af9cacebacdc7d1f4c6dc7f2511b98"
    officialHashHex 65 "de1e5fa0be70df6d2be8fffd0e99ceaa8eb6e8c93a63f2d8d1c30ecb6b263dee"
    officialHashHex 1023 "10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11"
    officialHashHex 1024 "42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7"
    officialHashHex 1025 "d00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444"
    officialHashHex 2048 "e776b6028c7cd22a4d0ba182a8bf62205d2ef576467e838ed6f2529b85fba24a"
    officialHashHex 2049 "5f4d72f40d7a5f82b15ca2b2e44b1de3c2ef86c426c95c1af0b6879522563030"

[<Fact>]
let ``ZetaFsStore.deltaLog addresses objects with blake3, not Core's xxhash default`` () =
    let fresh () =
        let d =
            System.IO.Path.Combine(
                System.IO.Path.GetTempPath(),
                sprintf "zetafs-b3-%s" (System.Guid.NewGuid().ToString("N"))
            )
        System.IO.Directory.CreateDirectory d |> ignore
        d

    let codec =
        CborEntryCodec<string>((fun s -> DynamicValue.String s), function
            | DynamicValue.String s -> s
            | _ -> "")

    let dirB3 = fresh ()
    let dirXx = fresh ()
    try
        let logB3 = ZetaFsStore.deltaLog dirB3 codec :> IDeltaLog<string>
        let logXx = ZetaFsDeltaLog<string>(dirXx, codec) :> IDeltaLog<string>
        let delta = ZSet.ofSeq [ "x", 1L ]
        logB3.AppendAsync(delta, Map.empty, System.Threading.CancellationToken.None).AsTask().Result
        |> ignore
        logXx.AppendAsync(delta, Map.empty, System.Threading.CancellationToken.None).AsTask().Result
        |> ignore

        let names (root: string) =
            System.IO.Directory.GetFiles(System.IO.Path.Combine(root, "objects"), "*", System.IO.SearchOption.AllDirectories)
            |> Array.map System.IO.Path.GetFileName
            |> Array.sortWith (fun a b -> System.String.CompareOrdinal(a, b))
            |> String.concat ","

        Assert.Equal("blake3", Blake3Hasher.hasher.Name)
        Assert.Equal("xxhash128", CH.defaultHasher.Name)
        Assert.False((names dirB3).Equals(names dirXx, System.StringComparison.Ordinal))
    finally
        System.IO.Directory.Delete(dirB3, true)
        System.IO.Directory.Delete(dirXx, true)
