using System;
using System.Collections.Generic;
using System.Text;

namespace Zeta.Core.CSharp;

/// <summary>
/// Database-style named collation selection for C# (B-0969).
/// Maps database-style named collations to their corresponding .NET StringComparers.
/// </summary>
public static class Collation
{
    /// <summary>
    /// A StringComparer that orders strings ordinally by Unicode code point (Rune) value (B-0969).
    /// Matches TS's true Unicode code point comparison, resolving the UTF-16 surrogate pair discrepancy.
    /// </summary>
    public sealed class UnicodeCodePointComparer : StringComparer
    {
        /// <summary>
        /// Gets a UnicodeCodePointComparer that performs a case-sensitive ordinal comparison.
        /// </summary>
        public static new UnicodeCodePointComparer Ordinal { get; } = new(false);

        /// <summary>
        /// Gets a UnicodeCodePointComparer that performs a case-insensitive ordinal comparison.
        /// </summary>
        public static new UnicodeCodePointComparer OrdinalIgnoreCase { get; } = new(true);

        private readonly bool _ignoreCase;

        private UnicodeCodePointComparer(bool ignoreCase)
        {
            _ignoreCase = ignoreCase;
        }

        /// <summary>
        /// Compares two strings ordinally by Unicode code points.
        /// </summary>
        /// <param name="x">The first string to compare.</param>
        /// <param name="y">The second string to compare.</param>
        /// <returns>A signed integer indicating the relative values of x and y.</returns>
        public override int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y)) return 0;
            if (x == null) return -1;
            if (y == null) return 1;

            var enumX = x.EnumerateRunes();
            var enumY = y.EnumerateRunes();

            while (true)
            {
                var hasX = enumX.MoveNext();
                var hasY = enumY.MoveNext();

                if (!hasX && !hasY) return 0;
                if (!hasX) return -1;
                if (!hasY) return 1;

                var runeX = enumX.Current;
                var runeY = enumY.Current;

                if (_ignoreCase)
                {
                    runeX = Rune.ToLowerInvariant(runeX);
                    runeY = Rune.ToLowerInvariant(runeY);
                }

                if (runeX.Value < runeY.Value) return -1;
                if (runeX.Value > runeY.Value) return 1;
            }
        }

        /// <summary>
        /// Determines whether two strings are equal based on ordinal comparison.
        /// </summary>
        /// <param name="x">The first string to compare.</param>
        /// <param name="y">The second string to compare.</param>
        /// <returns>true if the strings are equal; otherwise, false.</returns>
        public override bool Equals(string? x, string? y)
        {
            if (ReferenceEquals(x, y)) return true;
            if (x == null || y == null) return false;
            return string.Equals(x, y, _ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }

        /// <summary>
        /// Serves as the default hash function.
        /// </summary>
        /// <param name="obj">The string for which a hash code is to be returned.</param>
        /// <returns>A hash code for the specified string.</returns>
        public override int GetHashCode(string obj)
        {
            ArgumentNullException.ThrowIfNull(obj);
            return string.GetHashCode(obj, _ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }
    }

    /// <summary>
    /// The default collation name we ship with.
    /// </summary>
    public const string DefaultName = "binary";

    /// <summary>
    /// The canonical default for string keys: Unicode code-point / UTF-8 byte order.
    /// </summary>
    public static StringComparer Binary { get; } = UnicodeCodePointComparer.Ordinal;

    /// <summary>
    /// The named string-collation catalog (DB-style).
    /// </summary>
    public static IReadOnlyDictionary<string, StringComparer> Catalog { get; } =
        new Dictionary<string, StringComparer>(StringComparer.OrdinalIgnoreCase)
        {
            ["binary"] = Binary,
            ["ordinal"] = Binary,
            ["ordinal-ci"] = UnicodeCodePointComparer.OrdinalIgnoreCase,
            ["invariant"] = StringComparer.InvariantCulture,
            ["invariant-ci"] = StringComparer.InvariantCultureIgnoreCase,

            // Postgres / Standard SQL aliases
            ["C"] = Binary,
            ["POSIX"] = Binary,
            ["utf8_bin"] = Binary,
            ["utf8mb4_bin"] = Binary,

            // SQLite alias
            ["NOCASE"] = UnicodeCodePointComparer.OrdinalIgnoreCase,

            // MySQL aliases
            ["utf8_general_ci"] = UnicodeCodePointComparer.OrdinalIgnoreCase,
            ["utf8mb4_general_ci"] = UnicodeCodePointComparer.OrdinalIgnoreCase,
            ["utf8_unicode_ci"] = StringComparer.InvariantCultureIgnoreCase,
            ["utf8mb4_unicode_ci"] = StringComparer.InvariantCultureIgnoreCase,

            // SQL Server aliases. See
            // docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md
            //
            // EXACT: _BIN2_UTF8 stores as UTF-8, which has no surrogates, so its BIN2 sort is TRUE
            // code-point order (Unicode Standard 2.5.3). This is the one SQL Server name that
            // denotes exactly our canonical collation — it is what a DBA should be told to use.
            ["Latin1_General_100_BIN2_UTF8"] = Binary,
            // APPROXIMATE — agrees on the BMP, DIVERGES above it. BIN2 over nvarchar (UTF-16)
            // compares per WCHAR, i.e. by UTF-16 code UNIT, not code point. Legacy _BIN is weaker
            // still: first character by code point, then raw byte-by-byte.
            ["Latin1_General_100_BIN2"] = Binary,
            ["Latin1_General_BIN"] = Binary,
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
        return TryByName(name) ?? Binary;
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
            return (IComparer<T>)(TryByName(collationName) ?? Binary);
        }
        return Comparer<T>.Default;
    }
}
