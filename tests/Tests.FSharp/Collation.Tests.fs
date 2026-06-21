module Zeta.Tests.CollationTests

open System
open global.Xunit
open Zeta.Core

// DB-style collation selection (081KT07NV0008QG0R001YDB73K). The shipped default is BINARY code-point order; the bug fix is
// that forKey<string> resolves to that treaty comparer, never the culture-sensitive
// Comparer<string>.Default.

[<Fact>]
let ``binary default is code-point order and is the shipped default name`` () =
    Assert.Equal("binary", Collation.defaultName)
    Assert.Same(Collation.binary, Collation.byNameOrDefault Collation.defaultName)
    Assert.True(Collation.binary.Compare("�", "𠜎") < 0)

[<Fact>]
let ``catalog resolves named collations; unknown falls back to binary`` () =
    Assert.Same(Collation.binary, Collation.byNameOrDefault "ordinal")
    Assert.Same(UnicodeCodePointComparer.OrdinalIgnoreCase, Collation.byNameOrDefault "ordinal-ci")
    Assert.Equal(None, Collation.tryByName "no-such-collation")
    Assert.Same(Collation.binary, Collation.byNameOrDefault "no-such-collation") // fallback

[<Fact>]
let ``catalog name lookup is itself case-insensitive`` () =
    // selecting a collation by name shouldn't be culture/case-fragile
    Assert.Same(Collation.binary, Collation.byNameOrDefault "BINARY")

[<Fact>]
let ``forKey string is binary code-point order, not culture-sensitive (the 081KT07NV0008QG0R001YDB73K fix)`` () =
    let c = Collation.forKey<string> ()
    // binary: 'B'(66) < 'a'(97) => "B" sorts before "a". Culture-sensitive would put "a" first.
    Assert.True(c.Compare("B", "a") < 0)
    Assert.True(c.Compare("a", "B") > 0)
    Assert.True(c.Compare("�", "𠜎") < 0)
    Assert.Equal(0, c.Compare("abc", "abc"))

[<Fact>]
let ``forKey non-string uses the default ordinal-equivalent comparer`` () =
    let c = Collation.forKey<int> ()
    Assert.True(c.Compare(1, 2) < 0)
    Assert.True(c.Compare(2, 1) > 0)
    Assert.Equal(0, c.Compare(7, 7))
