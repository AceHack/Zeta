using System;
using System.Collections.Generic;
using System.Collections.Immutable;

namespace Zeta.Core.CSharp;

/// <summary>
/// CloudEvents mapper functions.
/// </summary>
public static class CloudEvents
{
    private static readonly ImmutableHashSet<string> CoreKeys = ImmutableHashSet.Create(
        StringComparer.Ordinal,
        "specversion", "id", "source", "type", "time", "subject", "datacontenttype", "dataschema", "data"
    );

    /// <summary>Create a minimal valid event.</summary>
    public static CloudEvent Create(string id, string source, string type, DynamicValue? data = null)
    {
        return new CloudEvent
        {
            Id = id,
            Source = source,
            SpecVersion = "1.0",
            Type = type,
            Data = data
        };
    }

    /// <summary>Validate required attributes.</summary>
    public static Result<bool, string> Validate(CloudEvent e)
    {
        var missing = new List<string>();
        if (string.IsNullOrEmpty(e.Id)) missing.Add("id");
        if (string.IsNullOrEmpty(e.Source)) missing.Add("source");
        if (string.IsNullOrEmpty(e.SpecVersion)) missing.Add("specversion");
        if (string.IsNullOrEmpty(e.Type)) missing.Add("type");

        if (missing.Count == 0)
        {
            return new Result<bool, string>.Ok(true);
        }
        return new Result<bool, string>.Err($"CloudEvent missing required attribute(s): {string.Join(", ", missing)}");
    }

    /// <summary>Serialize to DynamicValue.Object with stable order.</summary>
    public static DynamicValue ToDynamic(CloudEvent e)
    {
        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
        pairs.Add(new KeyValuePair<string, DynamicValue>("specversion", new DynamicValue.String(e.SpecVersion)));
        pairs.Add(new KeyValuePair<string, DynamicValue>("id", new DynamicValue.String(e.Id)));
        pairs.Add(new KeyValuePair<string, DynamicValue>("source", new DynamicValue.String(e.Source)));
        pairs.Add(new KeyValuePair<string, DynamicValue>("type", new DynamicValue.String(e.Type)));

        if (e.Time is not null)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>("time", new DynamicValue.String(e.Time)));
        }
        if (e.Subject is not null)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>("subject", new DynamicValue.String(e.Subject)));
        }
        if (e.DataContentType is not null)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>("datacontenttype", new DynamicValue.String(e.DataContentType)));
        }
        if (e.DataSchema is not null)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>("dataschema", new DynamicValue.String(e.DataSchema)));
        }

        foreach (var ext in e.Extensions)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>(ext.Key, new DynamicValue.String(ext.Value)));
        }

        if (e.Data is not null)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>("data", e.Data));
        }

        return new DynamicValue.Object(pairs.ToImmutable());
    }

    private static string? GetStr(DynamicValue.Object obj, string key)
    {
        foreach (var pair in obj.Pairs)
        {
            if (string.Equals(pair.Key, key, StringComparison.Ordinal) && pair.Value is DynamicValue.String strVal)
            {
                return strVal.Value;
            }
        }
        return null;
    }

    /// <summary>Parse from DynamicValue.Object.</summary>
    public static Result<CloudEvent, string> OfDynamic(DynamicValue dv)
    {
        if (dv is not DynamicValue.Object obj)
        {
            return new Result<CloudEvent, string>.Err("CloudEvent must be a DynamicValue.Object");
        }

        var id = GetStr(obj, "id");
        var source = GetStr(obj, "source");
        var type = GetStr(obj, "type");

        if (id is null || source is null || type is null)
        {
            return new Result<CloudEvent, string>.Err("CloudEvent object missing required attribute(s): id / source / type");
        }

        var extensionsBuilder = ImmutableArray.CreateBuilder<KeyValuePair<string, string>>();
        foreach (var pair in obj.Pairs)
        {
            if (!CoreKeys.Contains(pair.Key) && pair.Value is DynamicValue.String strVal)
            {
                extensionsBuilder.Add(new KeyValuePair<string, string>(pair.Key, strVal.Value));
            }
        }

        DynamicValue? data = null;
        foreach (var pair in obj.Pairs)
        {
            if (string.Equals(pair.Key, "data", StringComparison.Ordinal))
            {
                data = pair.Value;
                break;
            }
        }

        return new Result<CloudEvent, string>.Ok(new CloudEvent
        {
            Id = id,
            Source = source,
            SpecVersion = GetStr(obj, "specversion") ?? "1.0",
            Type = type,
            Time = GetStr(obj, "time"),
            Subject = GetStr(obj, "subject"),
            DataContentType = GetStr(obj, "datacontenttype"),
            DataSchema = GetStr(obj, "dataschema"),
            Extensions = extensionsBuilder.ToImmutable(),
            Data = data
        });
    }
}
