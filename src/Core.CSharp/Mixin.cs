#pragma warning disable MA0048

using System;
using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace Zeta.Core.CSharp;

/// <summary>
/// Thread-safe and GC-safe weak-keyed identity table for attaching state to objects.
/// </summary>
[DebuggerDisplay("Count = {DebuggerCount}")]
[DebuggerTypeProxy(typeof(WeakMapDebugView<,>))]
public sealed class WeakMap<TKey, TValue>
    where TKey : class
    where TValue : class
{
    private readonly ConditionalWeakTable<TKey, TValue> _table = new();

    /// <summary>
    /// Attach a state value to the key. Overwrites if it already exists.
    /// </summary>
    public void Set(TKey key, TValue value)
    {
        _table.AddOrUpdate(key, value);
    }

    /// <summary>
    /// Try to get the state value associated with the key.
    /// </summary>
    public bool TryGet(TKey key, out TValue? value)
    {
        return _table.TryGetValue(key, out value);
    }

    /// <summary>
    /// Get the state value associated with the key, or construct it using the factory if absent.
    /// </summary>
    public TValue Get(TKey key, Func<TKey, TValue> factory)
    {
        return _table.GetValue(key, k => factory(k));
    }

    /// <summary>
    /// Delete the entry associated with the key. Returns true if removed, false otherwise.
    /// </summary>
    public bool Delete(TKey key)
    {
        return _table.Remove(key);
    }

    internal ConditionalWeakTable<TKey, TValue> InternalTable => _table;

    private int DebuggerCount
    {
        get
        {
            int count = 0;
            foreach (var _ in _table)
            {
                count++;
            }
            return count;
        }
    }
}

internal sealed class WeakMapDebugView<TKey, TValue>
    where TKey : class
    where TValue : class
{
    private readonly WeakMap<TKey, TValue> _weakMap;

    public WeakMapDebugView(WeakMap<TKey, TValue> weakMap)
    {
        _weakMap = weakMap ?? throw new ArgumentNullException(nameof(weakMap));
    }

    [DebuggerBrowsable(DebuggerBrowsableState.RootHidden)]
    public System.Collections.Generic.KeyValuePair<TKey, TValue>[] Items
    {
        get
        {
            var list = new System.Collections.Generic.List<System.Collections.Generic.KeyValuePair<TKey, TValue>>();
            foreach (var kvp in _weakMap.InternalTable)
            {
                list.Add(kvp);
            }
            return list.ToArray();
        }
    }
}
