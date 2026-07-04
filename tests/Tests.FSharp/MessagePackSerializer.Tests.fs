module Zeta.Tests.MessagePackSerializerTests

open Xunit
open Zeta.Core

type TestRecord = { Name: string; Age: int }

let private roundtrip<'T when 'T : comparison> (serializer: ISerializer<'T>) (zset: ZSet<'T>) =
    let bytes = Serializer.toBytes serializer zset
    let actual = Serializer.fromBytes serializer bytes
    Assert.Equal<ZEntry<'T>>(zset, actual)

[<Fact>]
let ``MessagePackSerializer can serialize and deserialize ints`` () =
    let serializer = MessagePackSerializer<int>()
    let entries = [| ZEntry(42, 1L); ZEntry(-7, 2L); ZEntry(1234567, -1L) |]
    let zset = ZSet(Pool.Freeze entries)
    roundtrip serializer zset

[<Fact>]
let ``MessagePackSerializer can serialize and deserialize strings`` () =
    let serializer = MessagePackSerializer<string>()
    let entries = [| ZEntry("hello", 10L); ZEntry("world", -3L); ZEntry("", 1L) |]
    let zset = ZSet(Pool.Freeze entries)
    roundtrip serializer zset

[<Fact>]
let ``MessagePackSerializer can serialize and deserialize records`` () =
    let serializer = MessagePackSerializer<TestRecord>()
    let entries = [|
        ZEntry({ Name = "Alice"; Age = 30 }, 1L)
        ZEntry({ Name = "Bob"; Age = 25 }, -2L)
    |]
    let zset = ZSet(Pool.Freeze entries)
    roundtrip serializer zset

[<Fact>]
let ``MessagePackSerializer can serialize and deserialize tuples`` () =
    let serializer = MessagePackSerializer<string * int64>()
    let entries = [|
        ZEntry(("a", 10L), 1L)
        ZEntry(("b", 20L), 5L)
    |]
    let zset = ZSet(Pool.Freeze entries)
    roundtrip serializer zset
