namespace Zeta.Tests

open Xunit
open System
open System.Runtime.CompilerServices
open Zeta.Core
open Zeta.Core.CSharp

type DummyKey(name: string) =
    member _.Name = name

type DummyValue(value: int) =
    member _.Value = value

type MixinTests() =

    [<Fact>]
    member _.``F# WeakMap basic set get delete operations`` () =
        let map = Zeta.Core.WeakMap<DummyKey, DummyValue>()
        let key1 = DummyKey("k1")
        let key2 = DummyKey("k2")
        let val1 = DummyValue(100)
        let val2 = DummyValue(200)

        // Set
        map.Set(key1, val1)
        map.Set(key2, val2)

        // TryGet
        Assert.Equal(Some val1, map.TryGet(key1))
        Assert.Equal(Some val2, map.TryGet(key2))

        // Get with factory
        let val3 = map.Get(key1, fun _ -> DummyValue(300))
        Assert.Equal(100, val3.Value) // Returns existing

        let key3 = DummyKey("k3")
        let val4 = map.Get(key3, fun _ -> DummyValue(400))
        Assert.Equal(400, val4.Value) // Invokes factory

        // Delete
        Assert.True(map.Delete(key1))
        Assert.Equal(None, map.TryGet(key1))
        Assert.False(map.Delete(key1)) // Already deleted

    [<Fact>]
    member _.``C# WeakMap basic set get delete operations`` () =
        let map = Zeta.Core.CSharp.WeakMap<DummyKey, DummyValue>()
        let key1 = DummyKey("k1")
        let key2 = DummyKey("k2")
        let val1 = DummyValue(100)
        let val2 = DummyValue(200)

        // Set
        map.Set(key1, val1)
        map.Set(key2, val2)

        // TryGet
        let (found, outVal) = map.TryGet(key1)
        Assert.True(found)
        Assert.Equal(val1, outVal)

        // Get with factory
        let val3 = map.Get(key1, fun _ -> DummyValue(300))
        Assert.Equal(100, val3.Value)

        let key3 = DummyKey("k3")
        let val4 = map.Get(key3, fun _ -> DummyValue(400))
        Assert.Equal(400, val4.Value)

        // Delete
        Assert.True(map.Delete(key1))
        let (foundAfterDelete, _) = map.TryGet(key1)
        Assert.False(foundAfterDelete)

    // Helper method marked with NoInlining to prevent key references from being held on the stack
    [<MethodImpl(MethodImplOptions.NoInlining)>]
    static member private RunGCScenario(map: Zeta.Core.WeakMap<DummyKey, DummyValue>) =
        let key = DummyKey("collectible")
        let value = DummyValue(999)
        map.Set(key, value)
        let weakRef = WeakReference(key)
        (weakRef, value)

    [<Fact>]
    member _.``F# WeakMap elements are garbage collected when key has no strong references`` () =
        let map = Zeta.Core.WeakMap<DummyKey, DummyValue>()
        let (weakRef, value) = MixinTests.RunGCScenario(map)

        // Key should be alive initially
        Assert.True(weakRef.IsAlive)

        // Trigger garbage collection
        GC.Collect()
        GC.WaitForPendingFinalizers()
        GC.Collect()

        // Verify key is collected
        Assert.False(weakRef.IsAlive)
