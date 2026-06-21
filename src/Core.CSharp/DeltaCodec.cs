#pragma warning disable MA0048

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// ZSet ↔ DynamicValue mapping — the bridge that lets a Z-set ride all our
/// byte-verified serializers. A ZSet&lt;K&gt; becomes a DynamicValue.Array
/// of [keyDv; Int weight] pairs.
/// </summary>
public static class ZSetDynamic
{
    /// <summary>
    /// Encodes a ZSet to a DynamicValue.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="z">The ZSet to encode.</param>
    /// <returns>A DynamicValue representation of the ZSet.</returns>
    public static DynamicValue ToDynamicValue<TKey>(Func<TKey, DynamicValue> keyEnc, ZSet<TKey> z)
    {
        ArgumentNullException.ThrowIfNull(keyEnc);
        ArgumentNullException.ThrowIfNull(z);
        var entries = z.ToImmutableArray();
        var builder = ImmutableArray.CreateBuilder<DynamicValue>(entries.Length);
        foreach (var e in entries)
        {
            builder.Add(new DynamicValue.Array(ImmutableArray.Create(
                keyEnc(e.Key),
                new DynamicValue.Int(e.Weight)
            )));
        }
        return new DynamicValue.Array(builder.ToImmutable());
    }

    /// <summary>
    /// Decodes a ZSet from a DynamicValue.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="dv">The DynamicValue to decode.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The decoded ZSet.</returns>
    public static ZSet<TKey> OfDynamicValue<TKey>(Func<DynamicValue, TKey> keyDec, DynamicValue dv, IComparer<TKey>? comparer = null, string collation = Collation.DefaultName)
    {
        ArgumentNullException.ThrowIfNull(keyDec);
        ArgumentNullException.ThrowIfNull(dv);
        if (dv is not DynamicValue.Array arrayDv)
        {
            throw new ArgumentException($"ZSetDynamic: expected Array, got {dv.Type}", nameof(dv));
        }

        var list = new List<(TKey Key, long Weight)>(arrayDv.Items.Length);
        foreach (var item in arrayDv.Items)
        {
            if (item is not DynamicValue.Array pair || pair.Items.Length != 2)
            {
                throw new ArgumentException($"ZSetDynamic: expected [key, Int weight] pair, got {item}", nameof(dv));
            }
            if (pair.Items[1] is not DynamicValue.Int w)
            {
                throw new ArgumentException($"ZSetDynamic: expected [key, Int weight] pair, got {item}", nameof(dv));
            }
            list.Add((keyDec(pair.Items[0]), w.Value));
        }

        var cmp = comparer ?? Collation.ForKey<TKey>(collation);
        return ZSet.OfEntries(list, cmp, collation);
    }
}

/// <summary>
/// Byte-verified canonical CBOR codec. Maps ZSet ↔ DynamicValue via the supplied key codec,
/// then rides DynamicValue's golden-vector-locked CBOR.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public sealed class CborDeltaCodec<TKey> : IDeltaCodec<TKey, ZSet<TKey>>
{
    private readonly Func<TKey, DynamicValue> _keyEnc;
    private readonly Func<DynamicValue, TKey> _keyDec;
    private readonly IComparer<TKey>? _comparer;
    private readonly string _collation;

    /// <summary>
    /// Initializes a new instance of the <see cref="CborDeltaCodec{TKey}"/> class.
    /// </summary>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">Collation name.</param>
    public CborDeltaCodec(Func<TKey, DynamicValue> keyEnc, Func<DynamicValue, TKey> keyDec, IComparer<TKey>? comparer = null, string collation = Collation.DefaultName)
    {
        _keyEnc = keyEnc ?? throw new ArgumentNullException(nameof(keyEnc));
        _keyDec = keyDec ?? throw new ArgumentNullException(nameof(keyDec));
        _comparer = comparer;
        _collation = collation;
    }

    /// <summary>
    /// Encodes the ZSet to canonical CBOR bytes.
    /// </summary>
    /// <param name="state">The ZSet state to encode.</param>
    /// <returns>The encoded CBOR bytes.</returns>
    public byte[] Encode(ZSet<TKey> state)
    {
        var dv = ZSetDynamic.ToDynamicValue(_keyEnc, state);
        return DynamicValues.ToCanonicalCborOk(dv);
    }

    /// <summary>
    /// Decodes the ZSet from canonical CBOR bytes.
    /// </summary>
    /// <param name="bytes">The CBOR bytes to decode.</param>
    /// <returns>The decoded ZSet state.</returns>
    public ZSet<TKey> Decode(byte[] bytes)
    {
        var res = DynamicValues.FromCanonicalCbor(bytes);
        if (res is Result<DynamicValue, DecodeError>.Ok ok)
        {
            return ZSetDynamic.OfDynamicValue(_keyDec, ok.Value, _comparer, _collation);
        }
        else
        {
            var err = (Result<DynamicValue, DecodeError>.Err)res;
            throw new ArgumentException($"CborDeltaCodec.Decode: non-decodable CBOR: {err.Error}", nameof(bytes));
        }
    }
}

/// <summary>
/// DeltaLogEntry ↔ DynamicValue mapping — the canonical Log-entry envelope.
/// A whole entry { Seq; Delta; Captured } becomes a DynamicValue.Object with keys
/// "captured" / "delta" / "seq" (ordinal order).
/// </summary>
public static class DeltaLogEntryDynamic
{
    /// <summary>
    /// Encodes a DeltaLogEntry to a DynamicValue.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="entry">The DeltaLogEntry to encode.</param>
    /// <returns>A DynamicValue representation of the entry.</returns>
    public static DynamicValue ToDynamicValue<TKey>(Func<TKey, DynamicValue> keyEnc, DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        ArgumentNullException.ThrowIfNull(keyEnc);
        ArgumentNullException.ThrowIfNull(entry);

        var sortedPairs = entry.Captured
            .OrderBy(kv => kv.Key, StringComparer.Ordinal)
            .Select(kv => new KeyValuePair<string, DynamicValue>(kv.Key, new DynamicValue.String(kv.Value)))
            .ToImmutableArray();

        var fields = ImmutableArray.Create(
            new KeyValuePair<string, DynamicValue>("captured", new DynamicValue.Object(sortedPairs)),
            new KeyValuePair<string, DynamicValue>("delta", ZSetDynamic.ToDynamicValue(keyEnc, entry.Delta)),
            new KeyValuePair<string, DynamicValue>("seq", new DynamicValue.Int(entry.Seq))
        );

        return new DynamicValue.Object(fields);
    }

    /// <summary>
    /// Decodes a DeltaLogEntry from a DynamicValue.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="dv">The DynamicValue to decode.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    /// <returns>The decoded DeltaLogEntry.</returns>
    public static DeltaLogEntry<TKey, ZSet<TKey>> OfDynamicValue<TKey>(
        Func<DynamicValue, TKey> keyDec,
        DynamicValue dv,
        IComparer<TKey>? comparer = null,
        string collation = Collation.DefaultName)
    {
        ArgumentNullException.ThrowIfNull(keyDec);
        ArgumentNullException.ThrowIfNull(dv);

        if (dv is not DynamicValue.Object objDv)
        {
            throw new ArgumentException($"DeltaLogEntryDynamic: expected Object, got {dv.Type}", nameof(dv));
        }

        DynamicValue? FindField(string name)
        {
            foreach (var pair in objDv.Pairs)
            {
                if (string.Equals(pair.Key, name, StringComparison.Ordinal))
                {
                    return pair.Value;
                }
            }
            return null;
        }

        var seqDv = FindField("seq") ?? throw new ArgumentException("DeltaLogEntryDynamic: missing field 'seq'", nameof(dv));
        if (seqDv is not DynamicValue.Int seqInt)
        {
            throw new ArgumentException($"DeltaLogEntryDynamic: 'seq' not Int: {seqDv.Type}", nameof(dv));
        }
        long seq = seqInt.Value;

        var deltaDv = FindField("delta") ?? throw new ArgumentException("DeltaLogEntryDynamic: missing field 'delta'", nameof(dv));
        var delta = ZSetDynamic.OfDynamicValue(keyDec, deltaDv, comparer, collation);

        var capturedDv = FindField("captured") ?? throw new ArgumentException("DeltaLogEntryDynamic: missing field 'captured'", nameof(dv));
        if (capturedDv is not DynamicValue.Object capturedObj)
        {
            throw new ArgumentException($"DeltaLogEntryDynamic: 'captured' not Object: {capturedDv.Type}", nameof(dv));
        }

        var capturedDict = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in capturedObj.Pairs)
        {
            if (pair.Value is not DynamicValue.String strVal)
            {
                throw new ArgumentException($"DeltaLogEntryDynamic: captured['{pair.Key}'] not String: {pair.Value.Type}", nameof(dv));
            }
            capturedDict[pair.Key] = strVal.Value;
        }

        return new DeltaLogEntry<TKey, ZSet<TKey>>(seq, delta, capturedDict);
    }
}

/// <summary>
/// Format-parameterized canonical codec for a whole DeltaLogEntry (Seq + Delta + Captured).
/// </summary>
public static class DeltaLogEntryCodec
{
    /// <summary>
    /// Encodes the entry to CBOR bytes.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="entry">The DeltaLogEntry to encode.</param>
    /// <returns>The encoded CBOR bytes.</returns>
    public static byte[] EncodeCbor<TKey>(Func<TKey, DynamicValue> keyEnc, DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        var dv = DeltaLogEntryDynamic.ToDynamicValue(keyEnc, entry);
        return DynamicValues.ToCanonicalCborOk(dv);
    }

    /// <summary>
    /// Decodes the entry from CBOR bytes.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="bytes">The CBOR bytes to decode.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    /// <returns>The decoded DeltaLogEntry.</returns>
    public static DeltaLogEntry<TKey, ZSet<TKey>> DecodeCbor<TKey>(
        Func<DynamicValue, TKey> keyDec,
        byte[] bytes,
        IComparer<TKey>? comparer = null,
        string collation = Collation.DefaultName)
    {
        var res = DynamicValues.FromCanonicalCbor(bytes);
        if (res is Result<DynamicValue, DecodeError>.Ok ok)
        {
            return DeltaLogEntryDynamic.OfDynamicValue(keyDec, ok.Value, comparer, collation);
        }
        else
        {
            var err = (Result<DynamicValue, DecodeError>.Err)res;
            throw new ArgumentException($"DeltaLogEntryCodec.DecodeCbor: non-decodable CBOR: {err.Error}", nameof(bytes));
        }
    }

    /// <summary>
    /// Encodes the entry to a JSON string.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="entry">The entry to encode.</param>
    /// <returns>The encoded JSON result.</returns>
    public static Result<string, EncodeError> EncodeJson<TKey>(Func<TKey, DynamicValue> keyEnc, DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        var dv = DeltaLogEntryDynamic.ToDynamicValue(keyEnc, entry);
        return DynamicValues.ToCanonicalJson(dv);
    }

    /// <summary>
    /// Decodes the entry from a JSON string.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="json">The JSON string.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    /// <returns>The decoded DeltaLogEntry.</returns>
    public static DeltaLogEntry<TKey, ZSet<TKey>> DecodeJson<TKey>(
        Func<DynamicValue, TKey> keyDec,
        string json,
        IComparer<TKey>? comparer = null,
        string collation = Collation.DefaultName)
    {
        var res = DynamicValues.FromCanonicalJson(json);
        if (res is Result<DynamicValue, DecodeError>.Ok ok)
        {
            return DeltaLogEntryDynamic.OfDynamicValue(keyDec, ok.Value, comparer, collation);
        }
        else
        {
            var err = (Result<DynamicValue, DecodeError>.Err)res;
            throw new ArgumentException($"DeltaLogEntryCodec.DecodeJson: non-decodable JSON: {err.Error}", nameof(json));
        }
    }

    /// <summary>
    /// Encodes the entry to a YAML string.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="entry">The entry to encode.</param>
    /// <returns>The encoded YAML result.</returns>
    public static Result<string, EncodeError> EncodeYaml<TKey>(Func<TKey, DynamicValue> keyEnc, DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        var dv = DeltaLogEntryDynamic.ToDynamicValue(keyEnc, entry);
        return DynamicValues.ToYaml(dv);
    }

    /// <summary>
    /// Decodes the entry from a YAML string.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="yaml">The YAML string.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    /// <returns>The decoded DeltaLogEntry.</returns>
    public static DeltaLogEntry<TKey, ZSet<TKey>> DecodeYaml<TKey>(
        Func<DynamicValue, TKey> keyDec,
        string yaml,
        IComparer<TKey>? comparer = null,
        string collation = Collation.DefaultName)
    {
        var res = DynamicValues.FromYaml(yaml);
        if (res is Result<DynamicValue, DecodeError>.Ok ok)
        {
            return DeltaLogEntryDynamic.OfDynamicValue(keyDec, ok.Value, comparer, collation);
        }
        else
        {
            var err = (Result<DynamicValue, DecodeError>.Err)res;
            throw new ArgumentException($"DeltaLogEntryCodec.DecodeYaml: non-decodable YAML: {err.Error}", nameof(yaml));
        }
    }
}

/// <summary>
/// Canonical CBOR whole-entry codec — rides DeltaLogEntryCodec.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public sealed class CborEntryCodec<TKey> : IEntryCodec<TKey, ZSet<TKey>>
{
    private readonly Func<TKey, DynamicValue> _keyEnc;
    private readonly Func<DynamicValue, TKey> _keyDec;
    private readonly IComparer<TKey>? _comparer;
    private readonly string _collation;

    /// <summary>
    /// Initializes a new instance of the <see cref="CborEntryCodec{TKey}"/> class.
    /// </summary>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    public CborEntryCodec(Func<TKey, DynamicValue> keyEnc, Func<DynamicValue, TKey> keyDec, IComparer<TKey>? comparer = null, string collation = Collation.DefaultName)
    {
        _keyEnc = keyEnc ?? throw new ArgumentNullException(nameof(keyEnc));
        _keyDec = keyDec ?? throw new ArgumentNullException(nameof(keyDec));
        _comparer = comparer;
        _collation = collation;
    }

    /// <summary>
    /// Encodes a DeltaLogEntry to bytes.
    /// </summary>
    public byte[] Encode(DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        return DeltaLogEntryCodec.EncodeCbor(_keyEnc, entry);
    }

    /// <summary>
    /// Decodes a DeltaLogEntry from bytes.
    /// </summary>
    public DeltaLogEntry<TKey, ZSet<TKey>> Decode(byte[] bytes)
    {
        return DeltaLogEntryCodec.DecodeCbor(_keyDec, bytes, _comparer, _collation);
    }
}

/// <summary>
/// Canonical YAML whole-entry codec — rides DeltaLogEntryCodec.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public sealed class YamlEntryCodec<TKey> : IEntryCodec<TKey, ZSet<TKey>>
{
    private readonly Func<TKey, DynamicValue> _keyEnc;
    private readonly Func<DynamicValue, TKey> _keyDec;
    private readonly IComparer<TKey>? _comparer;
    private readonly string _collation;

    /// <summary>
    /// Initializes a new instance of the <see cref="YamlEntryCodec{TKey}"/> class.
    /// </summary>
    /// <param name="keyEnc">The key encoder function.</param>
    /// <param name="keyDec">The key decoder function.</param>
    /// <param name="comparer">Optional key comparer.</param>
    /// <param name="collation">The collation name.</param>
    public YamlEntryCodec(Func<TKey, DynamicValue> keyEnc, Func<DynamicValue, TKey> keyDec, IComparer<TKey>? comparer = null, string collation = Collation.DefaultName)
    {
        _keyEnc = keyEnc ?? throw new ArgumentNullException(nameof(keyEnc));
        _keyDec = keyDec ?? throw new ArgumentNullException(nameof(keyDec));
        _comparer = comparer;
        _collation = collation;
    }

    /// <summary>
    /// Encodes a DeltaLogEntry to UTF-8 YAML bytes.
    /// </summary>
    public byte[] Encode(DeltaLogEntry<TKey, ZSet<TKey>> entry)
    {
        var res = DeltaLogEntryCodec.EncodeYaml(_keyEnc, entry);
        if (res is Result<string, EncodeError>.Ok ok)
        {
            return System.Text.Encoding.UTF8.GetBytes(ok.Value);
        }
        else
        {
            var err = (Result<string, EncodeError>.Err)res;
            throw new InvalidOperationException($"YamlEntryCodec.Encode failed: {err.Error}");
        }
    }

    /// <summary>
    /// Decodes a DeltaLogEntry from UTF-8 YAML bytes.
    /// </summary>
    public DeltaLogEntry<TKey, ZSet<TKey>> Decode(byte[] bytes)
    {
        var yaml = System.Text.Encoding.UTF8.GetString(bytes);
        return DeltaLogEntryCodec.DecodeYaml(_keyDec, yaml, _comparer, _collation);
    }
}
