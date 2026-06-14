namespace Zeta.Core

open System
open System.Runtime.CompilerServices

/// Thread-safe and GC-safe weak-keyed identity table for attaching state to objects.
type WeakMap<'Key, 'Value when 'Key : not struct and 'Key : not null and 'Value : not struct>() =
    let table = ConditionalWeakTable<'Key, 'Value>()

    /// Attach a state value to the key. Overwrites if it already exists.
    member _.Set(key: 'Key, value: 'Value) =
        table.AddOrUpdate(key, value)

    /// Try to get the state value associated with the key.
    member _.TryGet(key: 'Key) : 'Value option =
        match table.TryGetValue(key) with
        | true, value -> Some value
        | false, _ -> None

    /// Get the state value associated with the key, or construct it using the factory if absent.
    member _.Get(key: 'Key, factory: 'Key -> 'Value) : 'Value =
        table.GetValue(key, ConditionalWeakTable<'Key, 'Value>.CreateValueCallback(factory))

    /// Delete the entry associated with the key. Returns true if removed, false otherwise.
    member _.Delete(key: 'Key) : bool =
        table.Remove(key)
