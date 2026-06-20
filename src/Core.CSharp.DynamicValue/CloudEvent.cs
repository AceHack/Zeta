using System;
using System.Collections.Generic;
using System.Collections.Immutable;

namespace Zeta.Core.CSharp;

/// <summary>
/// A CloudEvents v1.0 event.
/// </summary>
public sealed record CloudEvent
{
    /// <summary>Gets the unique event identifier.</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>Gets the event source URI.</summary>
    public string Source { get; init; } = string.Empty;

    /// <summary>Gets the spec version (always "1.0").</summary>
    public string SpecVersion { get; init; } = "1.0";

    /// <summary>Gets the event type.</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>Gets the optional event timestamp.</summary>
    public string? Time { get; init; }

    /// <summary>Gets the optional event subject.</summary>
    public string? Subject { get; init; }

    /// <summary>Gets the optional data content type.</summary>
    public string? DataContentType { get; init; }

    /// <summary>Gets the optional data schema.</summary>
    public string? DataSchema { get; init; }

    /// <summary>Gets the list of extension attributes.</summary>
    public ImmutableArray<KeyValuePair<string, string>> Extensions { get; init; } = ImmutableArray<KeyValuePair<string, string>>.Empty;

    /// <summary>Gets the optional event payload.</summary>
    public DynamicValue? Data { get; init; }

    /// <summary>Structural equality for CloudEvent.</summary>
    public bool Equals(CloudEvent? other)
    {
        if (other is null) return false;
        if (!string.Equals(Id, other.Id, StringComparison.Ordinal)) return false;
        if (!string.Equals(Source, other.Source, StringComparison.Ordinal)) return false;
        if (!string.Equals(SpecVersion, other.SpecVersion, StringComparison.Ordinal)) return false;
        if (!string.Equals(Type, other.Type, StringComparison.Ordinal)) return false;
        if (!string.Equals(Time, other.Time, StringComparison.Ordinal)) return false;
        if (!string.Equals(Subject, other.Subject, StringComparison.Ordinal)) return false;
        if (!string.Equals(DataContentType, other.DataContentType, StringComparison.Ordinal)) return false;
        if (!string.Equals(DataSchema, other.DataSchema, StringComparison.Ordinal)) return false;
        if (Data is null ? other.Data is not null : !Data.Equals(other.Data)) return false;

        if (Extensions.Length != other.Extensions.Length) return false;
        for (int i = 0; i < Extensions.Length; i++)
        {
            if (!string.Equals(Extensions[i].Key, other.Extensions[i].Key, StringComparison.Ordinal)
                || !string.Equals(Extensions[i].Value, other.Extensions[i].Value, StringComparison.Ordinal))
            {
                return false;
            }
        }
        return true;
    }

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        var hash = default(HashCode);
        hash.Add(Id, StringComparer.Ordinal);
        hash.Add(Source, StringComparer.Ordinal);
        hash.Add(SpecVersion, StringComparer.Ordinal);
        hash.Add(Type, StringComparer.Ordinal);
        hash.Add(Time, StringComparer.Ordinal);
        hash.Add(Subject, StringComparer.Ordinal);
        hash.Add(DataContentType, StringComparer.Ordinal);
        hash.Add(DataSchema, StringComparer.Ordinal);
        hash.Add(Data);
        foreach (var ext in Extensions)
        {
            hash.Add(ext.Key, StringComparer.Ordinal);
            hash.Add(ext.Value, StringComparer.Ordinal);
        }
        return hash.ToHashCode();
    }
}
