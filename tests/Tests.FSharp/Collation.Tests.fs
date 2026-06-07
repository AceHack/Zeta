module Zeta.Tests.CollationTests

open System
open global.Xunit
open Zeta.Core

// DB-style collation selection (B-0969). The shipped default is BINARY/ordinal; the bug fix is that
// forKey<string> resolves to ORDINAL, never the culture-sensitive Comparer<string>.Default.

[<Fact>]
let ``binary default is ordinal and is the shipped default name`` () =
    Assert.Same(StringComparer.Ordinal, Collation.binary)
    Assert.Equal("binary", Collation.defaultName)
    Assert.Same(StringComparer.Ordinal, Collation.byNameOrDefault Collation.defaultName)

[<Fact>]
let ``catalog resolves named collations; unknown falls back to binary`` () =
    Assert.Same(StringComparer.Ordinal, Collation.byNameOrDefault "ordinal")
    Assert.Same(StringComparer.OrdinalIgnoreCase, Collation.byNameOrDefault "ordinal-ci")
    Assert.Equal(None, Collation.tryByName "no-such-collation")
    Assert.Same(StringComparer.Ordinal, Collation.byNameOrDefault "no-such-collation") // fallback

[<Fact>]
let ``catalog name lookup is itself case-insensitive`` () =
    // selecting a collation by name shouldn't be culture/case-fragile
    Assert.Same(StringComparer.Ordinal, Collation.byNameOrDefault "BINARY")

[<Fact>]
let ``forKey string is ORDINAL, not culture-sensitive (the B-0969 fix)`` () =
    let c = Collation.forKey<string> ()
    // ordinal: 'B'(66) < 'a'(97) => "B" sorts before "a". Culture-sensitive would put "a" first.
    Assert.True(c.Compare("B", "a") < 0)
    Assert.True(c.Compare("a", "B") > 0)
    Assert.Equal(0, c.Compare("abc", "abc"))

[<Fact>]
let ``forKey non-string uses the default ordinal-equivalent comparer`` () =
    let c = Collation.forKey<int> ()
    Assert.True(c.Compare(1, 2) < 0)
    Assert.True(c.Compare(2, 1) > 0)
    Assert.Equal(0, c.Compare(7, 7))
