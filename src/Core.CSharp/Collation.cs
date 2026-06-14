using System;
using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// Database-style named collation selection for C# (B-0969).
/// Maps database-style named collations to their corresponding .NET StringComparers.
/// </summary>
public static class Collation
{
    /// <summary>
    /// The default collation name we ship with.
    /// </summary>
    public const string DefaultName = "binary";

    /// <summary>
    /// The named string-collation catalog (DB-style).
    /// </summary>
    public static IReadOnlyDictionary<string, StringComparer> Catalog { get; } =
        new Dictionary<string, StringComparer>(StringComparer.OrdinalIgnoreCase)
        {
            ["binary"] = StringComparer.Ordinal,
            ["ordinal"] = StringComparer.Ordinal,
            ["ordinal-ci"] = StringComparer.OrdinalIgnoreCase,
            ["invariant"] = StringComparer.InvariantCulture,
            ["invariant-ci"] = StringComparer.InvariantCultureIgnoreCase,

            // Postgres / Standard SQL aliases
            ["C"] = StringComparer.Ordinal,
            ["POSIX"] = StringComparer.Ordinal,
            ["utf8_bin"] = StringComparer.Ordinal,
            ["utf8mb4_bin"] = StringComparer.Ordinal,

            // SQLite alias
            ["NOCASE"] = StringComparer.OrdinalIgnoreCase,

            // MySQL aliases
            ["utf8_general_ci"] = StringComparer.OrdinalIgnoreCase,
            ["utf8mb4_general_ci"] = StringComparer.OrdinalIgnoreCase,
            ["utf8_unicode_ci"] = StringComparer.InvariantCultureIgnoreCase,
            ["utf8mb4_unicode_ci"] = StringComparer.InvariantCultureIgnoreCase,

            // SQL Server aliases
            ["Latin1_General_BIN"] = StringComparer.Ordinal,
            ["Latin1_General_CI_AS"] = StringComparer.InvariantCultureIgnoreCase,
            ["Latin1_General_CS_AS"] = StringComparer.InvariantCulture
        };

    /// <summary>
    /// Resolve a named collation from the catalog, or null if unknown.
    /// </summary>
    /// <param name="name">The collation name.</param>
    /// <returns>The matching <see cref="StringComparer"/> or null.</returns>
    public static StringComparer? TryByName(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return Catalog.TryGetValue(name, out var comparer) ? comparer : null;
    }

    /// <summary>
    /// Resolve a named collation, falling back to the "binary" default.
    /// </summary>
    /// <param name="name">The collation name.</param>
    /// <returns>The matching <see cref="StringComparer"/> or the default.</returns>
    public static StringComparer ByNameOrDefault(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return TryByName(name) ?? StringComparer.Ordinal;
    }

    /// <summary>
    /// Resolves the default comparer for type <typeparamref name="T"/> given a named collation.
    /// If <typeparamref name="T"/> is string, uses the collation; otherwise, uses <see cref="Comparer{T}.Default"/>.
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="collationName">The collation name.</param>
    /// <returns>An <see cref="IComparer{T}"/> matching the collation name.</returns>
    public static IComparer<T> ForKey<T>(string collationName = DefaultName)
    {
        ArgumentNullException.ThrowIfNull(collationName);
        if (typeof(T) == typeof(string))
        {
            return (IComparer<T>)(TryByName(collationName) ?? StringComparer.Ordinal);
        }
        return Comparer<T>.Default;
    }
}
