using System;
using Xunit;
using Zeta.Core;
using Zeta.Core.CSharp;

namespace Zeta.Core.CSharp.Tests;

/// <summary>
/// Proves the declaration-site-variance contracts the shim adds over
/// the F# core. Each test below would fail to compile if the
/// <c>out</c>/<c>in</c> annotations were wrong.
/// </summary>
public class VarianceTests
{
    [Fact]
    public void CovariantSinkAssignmentCompiles()
    {
        ICovariantSink<string> stringSink = new StringSink();
        Assert.Equal(DeliveryMode.AtMostOnce, stringSink.Mode);
    }

    [Fact]
    public void ContravariantHashStrategyAcceptsBase()
    {
        IContravariantHashStrategy<object> universalHash = new UniversalHash();
        IContravariantHashStrategy<string> stringHash = universalHash;
        _ = stringHash.Hash("hello");
    }

    private sealed class StringSink : ICovariantSink<string>
    {
        public DeliveryMode Mode => DeliveryMode.AtMostOnce;
    }

    private sealed class UniversalHash : IContravariantHashStrategy<object>
    {
        public uint Hash(object key) => (uint)(key?.GetHashCode() ?? 0);
    }
}
