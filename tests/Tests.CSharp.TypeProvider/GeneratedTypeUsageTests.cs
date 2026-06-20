using System;
using Xunit;
using Zeta.Generated;

namespace Zeta.Tests.CSharp.TypeProvider;

/// <summary>
/// Proof that approach A's Roslyn <c>IIncrementalGenerator</c> ran at compile time. There is no
/// <c>ImdbName.cs</c> anywhere in this project — the <c>Zeta.Generated.ImdbName</c> record below is
/// emitted by <c>Zeta.Core.CSharp.TypeProvider.SchemaSourceGenerator</c> from
/// <c>ImdbName.zetaschema.json</c> (an <c>&lt;AdditionalFiles&gt;</c>) during THIS project's
/// compile. If the generator hadn't run, the <c>using Zeta.Generated;</c> and every reference to
/// <see cref="ImdbName"/> would fail to compile — so the fact this test builds at all is the proof,
/// and the asserts confirm the generated shape matches approach B's.
/// </summary>
public class GeneratedTypeUsageTests
{
    [Fact]
    public void GeneratedRecordIsConstructibleWithSchemaFields()
    {
        var name = new ImdbName("nm0000001", "Fred Astaire", 1899, 1987);

        Assert.Equal("nm0000001", name.Nconst);
        Assert.Equal("Fred Astaire", name.PrimaryName);
        Assert.Equal(1899, name.BirthYear);
        Assert.Equal(1987, name.DeathYear);
    }

    [Fact]
    public void NullableYearFieldsAcceptNull()
    {
        // BirthYear/DeathYear are emitted as int? — proving the generator preserved nullability
        // from the schema's "int?" csType (same shape approach B produces).
        var living = new ImdbName("nm9999999", "Someone Living", 1990, null);

        Assert.Null(living.DeathYear);
        Assert.Equal(1990, living.BirthYear);
    }

    [Fact]
    public void GeneratedRecordHasValueEquality()
    {
        // record => value equality for free; a second proof the emitted type is a `record`.
        var a = new ImdbName("nm0000002", "Lauren Bacall", 1924, 2014);
        var b = new ImdbName("nm0000002", "Lauren Bacall", 1924, 2014);

        Assert.Equal(a, b);
    }
}
