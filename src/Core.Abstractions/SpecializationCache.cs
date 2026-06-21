namespace Zeta.Core;

/// <summary>
/// WeakRef-wrapped specialization cache — cogen=mix(mix,mix) as memory management.
/// The specialized delegate is weakly held. If GC collects it, the next call
/// regenerates from the IR. NEVER caches errors.
/// </summary>
/// <typeparam name="TInput">Input type.</typeparam>
/// <typeparam name="TOutput">Output type.</typeparam>
public sealed class SpecializationCache<TInput, TOutput>
{
    private readonly Func<Func<TInput, TOutput>> _specializer;
    private WeakReference<Holder>? _cached;
    private int _hits;
    private int _misses;
    private int _errors;

    private sealed class Holder
    {
        public required Func<TInput, TOutput> Fn { get; init; }
    }

    public SpecializationCache(Func<Func<TInput, TOutput>> specializer)
    {
        _specializer = specializer;
    }

    public int Hits => _hits;
    public int Misses => _misses;
    public int Errors => _errors;

    /// <summary>Run the specialized function. Specializes on first call, uses cache after.</summary>
    public TOutput Run(TInput input)
    {
        var fn = GetOrRegenerate();
        return fn(input);
    }

    /// <summary>Force regeneration on next call (invalidate cache).</summary>
    public void Invalidate() => _cached = null;

    private Func<TInput, TOutput> GetOrRegenerate()
    {
        if (_cached is not null && _cached.TryGetTarget(out var holder))
        {
            Interlocked.Increment(ref _hits);
            return holder.Fn;
        }

        Interlocked.Increment(ref _misses);
        try
        {
            var fn = _specializer();
            var newHolder = new Holder { Fn = fn };
            _cached = new WeakReference<Holder>(newHolder);
            return fn;
        }
        catch
        {
            // NEVER cache errors — always retry on next call
            Interlocked.Increment(ref _errors);
            _cached = null;
            throw;
        }
    }
}
