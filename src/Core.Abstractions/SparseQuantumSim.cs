using System.Numerics;

namespace Zeta.Core;

/// <summary>
/// Sparse statevector quantum simulator — the "bit-growing" quantum lane.
/// Support grows ONLY by actual uncertainty (branching ops), not by register width.
/// Same cost model as AmplitudeEmu (F#) and Q# modern sparse sim (Jaques &amp; Häner 2022).
///
/// Key property: permutation ops (mul, xorshr, join) NEVER grow support.
/// Only branch (Hadamard-like) ops grow support — by exactly 1 bit per fork.
/// </summary>
public sealed class SparseQuantumSim
{
    private Dictionary<ulong, Complex> _state;
    private readonly int _width;
    private readonly ulong _mask;
    private const double EPS = 1e-12;

    public SparseQuantumSim(int width)
    {
        _width = width;
        _mask = width >= 64 ? ulong.MaxValue : (1UL << width) - 1;
        _state = new Dictionary<ulong, Complex>();
    }

    /// <summary>Number of basis states with nonzero amplitude (the cost metric).</summary>
    public int Support => _state.Count;

    /// <summary>Initialize with a single basis state (classical input).</summary>
    public void Initialize(ulong basisState)
    {
        _state.Clear();
        _state[basisState & _mask] = Complex.One;
    }

    /// <summary>Apply mul(k): permutation — each basis state maps to exactly one output. No growth.</summary>
    public void ApplyMul(ulong k)
    {
        var next = new Dictionary<ulong, Complex>(_state.Count);
        foreach (var (key, amp) in _state)
        {
            var newKey = unchecked(key * k) & _mask;
            next.TryGetValue(newKey, out var existing);
            next[newKey] = existing + amp;
        }
        Prune(next);
        _state = next;
    }

    /// <summary>Apply xorshr(s): permutation — bijective. No growth.</summary>
    public void ApplyXorShr(int s)
    {
        var next = new Dictionary<ulong, Complex>(_state.Count);
        foreach (var (key, amp) in _state)
        {
            var newKey = (key ^ (key >> s)) & _mask;
            next.TryGetValue(newKey, out var existing);
            next[newKey] = existing + amp;
        }
        Prune(next);
        _state = next;
    }

    /// <summary>Apply branch(bit): fork each state into two. Support grows by factor 2 (1 bit).</summary>
    public void ApplyBranch(int bit)
    {
        var next = new Dictionary<ulong, Complex>(_state.Count * 2);
        foreach (var (key, amp) in _state)
        {
            // Equal superposition: amplitude / sqrt(2) for each branch
            var scaled = amp / Math.Sqrt(2);
            var flipped = (key ^ (1UL << bit)) & _mask;

            next.TryGetValue(key, out var ex1);
            next[key] = ex1 + scaled;

            next.TryGetValue(flipped, out var ex2);
            next[flipped] = ex2 + scaled;
        }
        Prune(next);
        _state = next;
    }

    /// <summary>Apply join(control, target): CNOT — permutation. No growth.</summary>
    public void ApplyJoin(int control, int target)
    {
        var next = new Dictionary<ulong, Complex>(_state.Count);
        foreach (var (key, amp) in _state)
        {
            var controlSet = ((key >> control) & 1) == 1;
            var newKey = controlSet ? (key ^ (1UL << target)) & _mask : key;
            next.TryGetValue(newKey, out var existing);
            next[newKey] = existing + amp;
        }
        Prune(next);
        _state = next;
    }

    /// <summary>Measure: collapse to a single basis state (Born rule). Returns the measured value.</summary>
    public ulong Measure()
    {
        // For deterministic inputs (support=1), this just returns the one state.
        if (_state.Count == 0) return 0;
        if (_state.Count == 1) return _state.Keys.First();

        // Probabilistic: pick by |amplitude|^2
        var totalProb = _state.Sum(kv => kv.Value.Magnitude * kv.Value.Magnitude);
        var r = Random.Shared.NextDouble() * totalProb;
        var cumulative = 0.0;
        foreach (var (key, amp) in _state)
        {
            cumulative += amp.Magnitude * amp.Magnitude;
            if (cumulative >= r) return key;
        }
        return _state.Keys.Last();
    }

    /// <summary>Get the amplitude for a specific basis state.</summary>
    public Complex GetAmplitude(ulong basisState) =>
        _state.TryGetValue(basisState & _mask, out var amp) ? amp : Complex.Zero;

    /// <summary>Get all basis states with nonzero amplitude.</summary>
    public IReadOnlyDictionary<ulong, Complex> GetState() => _state;

    private static void Prune(Dictionary<ulong, Complex> state)
    {
        var toRemove = state.Where(kv => kv.Value.Magnitude < EPS).Select(kv => kv.Key).ToList();
        foreach (var key in toRemove) state.Remove(key);
    }
}
