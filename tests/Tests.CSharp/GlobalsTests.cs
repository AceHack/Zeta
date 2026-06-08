#pragma warning disable CA1861

using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public class GlobalsTests
{
    private static DynamicValue.String S(string x) => new(x);

    private static DynamicValue Sample()
    {
        return Globals.Set(new[] { "patient", "2", "name" }, S("Grace"),
            Globals.Set(new[] { "patient", "1", "enc", "2" }, S("visit-b"),
            Globals.Set(new[] { "patient", "1", "enc", "1" }, S("visit-a"),
            Globals.Set(new[] { "patient", "1", "name" }, S("Ada"), Globals.Empty))));
    }

    [Fact]
    public void SetThenGetRoundtripsAValueAtASubscriptPath()
    {
        var g = Sample();
        Assert.Equal(S("Ada"), Globals.Get(new[] { "patient", "1", "name" }, g));
        Assert.Null(Globals.Get(new[] { "patient", "1", "missing" }, g));
        Assert.Null(Globals.Get(new[] { "patient", "1", "name", "deeper" }, g)); // through a leaf
    }

    [Fact]
    public void KillRemovesTheNodeAndAllDescendants()
    {
        var g = Globals.Kill(new[] { "patient", "1" }, Sample());
        Assert.Null(Globals.Get(new[] { "patient", "1", "name" }, g));
        Assert.Null(Globals.Get(new[] { "patient", "1", "enc", "1" }, g));
        Assert.Equal(S("Grace"), Globals.Get(new[] { "patient", "2", "name" }, g)); // sibling untouched
    }

    [Fact]
    public void DataReportsCorrectLeafStatus()
    {
        var g = Sample();
        Assert.Equal(0, Globals.Data(new[] { "patient", "9" }, g)); // undefined
        Assert.Equal(1, Globals.Data(new[] { "patient", "1", "name" }, g)); // scalar leaf
        Assert.Equal(10, Globals.Data(new[] { "patient", "1", "enc" }, g)); // object node (children)
        Assert.Equal(10, Globals.Data(new[] { "patient", "1" }, g)); // object node
    }

    [Fact]
    public void NextChildIteratesImmediateSubscriptsInOrdinalOrder()
    {
        var g = Sample();
        Assert.Equal("1", Globals.NextChild(new[] { "patient" }, null, g)); // first child
        Assert.Equal("2", Globals.NextChild(new[] { "patient" }, "1", g)); // next after "1"
        Assert.Null(Globals.NextChild(new[] { "patient" }, "2", g)); // end
        Assert.Equal("1", Globals.NextChild(new[] { "patient", "1", "enc" }, null, g));
        Assert.Equal("2", Globals.NextChild(new[] { "patient", "1", "enc" }, "1", g));
    }

    [Fact]
    public void NextNodeWalksEveryDefinedLeafDepthFirstAndTerminates()
    {
        var g = Sample();

        var acc = new List<IReadOnlyList<string>>();
        IReadOnlyList<string>? current = Array.Empty<string>();

        while (true)
        {
            current = Globals.NextNode(current, g);
            if (current == null)
            {
                break;
            }
            acc.Add(current);
        }

        Assert.Equal(4, acc.Count);
        // ordinal-path order: "enc" subscripts sort before "name" ('e' < 'n')
        Assert.Equal(new[] { "patient", "1", "enc", "1" }, acc[0]);
        Assert.Equal(new[] { "patient", "2", "name" }, acc[3]);
    }

    [Fact]
    public void ChildrenListsDedupedOrdinalImmediateSubscriptsCountIsLeafCount()
    {
        var g = Sample();
        Assert.Equal(new[] { "1", "2" }, Globals.Children(new[] { "patient" }, g));
        Assert.Equal(new[] { "1", "2" }, Globals.Children(new[] { "patient", "1", "enc" }, g));
        Assert.Empty(Globals.Children(new[] { "patient", "1", "name" }, g)); // leaf has no children
        Assert.Equal(4, Globals.Count(g));
    }

    [Fact]
    public void SetIsLeafAgnosticAndSetWinsReplacesAnObjectWithALeaf()
    {
        var g = Globals.Set(new[] { "w", "layer1", "bias" }, S("b"),
                Globals.Set(new[] { "w", "layer0" }, new DynamicValue.Int(42L), Globals.Empty));

        Assert.Equal(new DynamicValue.Int(42L), Globals.Get(new[] { "w", "layer0" }, g));
        // SET over an object path replaces it with the scalar (MUMPS SET wins)
        var g2 = Globals.Set(new[] { "w", "layer1" }, new DynamicValue.Int(7L), g);
        Assert.Equal(new DynamicValue.Int(7L), Globals.Get(new[] { "w", "layer1" }, g2));
        Assert.Null(Globals.Get(new[] { "w", "layer1", "bias" }, g2)); // children gone
    }
}
