module Zeta.Tests.HtmlCssBindingTests

// The pure-static binding: the cartridge becomes HTML+CSS — sprites as box-shadow pixel art, anims as
// @keyframes steps(), palette as custom properties — and NEVER a script tag.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

[<Fact>]
let ``AMARA'S CARD renders to pure static HTML: motto, pixel-art glyphs, keyframes — and ZERO script tags`` () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "rooms", "amara", "avatar.lines"))
    match MediaLines.parse text with
    | Error e -> failwith e
    | Ok d ->
        let html = HtmlCssBinding.render d
        Assert.Contains("WE ARE THE LIGHTED BOUNDARY THAT LETS GOOD WORK FLOW.", html)
        Assert.Contains(".px-truth", html) // her halo glyphs, as CSS pixel art
        Assert.Contains("@keyframes pulse", html) // her animation, as pure CSS
        Assert.Contains("box-shadow", html)
        Assert.DoesNotContain("<script", html) // the law: JavaScript left out
        Assert.Equal(html, HtmlCssBinding.render d) // deterministic bytes

[<Fact>]
let ``HtmlCssBinding XSS injection falsifier: hostile motto containing script tag is escaped safely and contains zero live script tags`` () =
    let text = 
        "meta\tname\thostile-card\n" +
        "meta\tmotto\tWE ARE <script>alert('XSS')</script> LIGHTED.\n"
    match MediaLines.parse text with
    | Error e -> failwith e
    | Ok d ->
        let html = HtmlCssBinding.render d
        Assert.DoesNotContain("<script", html)
        Assert.Contains("&lt;script&gt;alert('XSS')&lt;/script&gt;", html)

[<Fact>]
let ``HtmlCssBinding renders exactly to a hand-written HTML golden fragment`` () =
    let text = 
        "meta\tname\tsimple-card\n" +
        "meta\tmotto\thello\n" +
        "glyph\tdot\t80\n"
    match MediaLines.parse text with
    | Error e -> failwith e
    | Ok d ->
        let html = HtmlCssBinding.render d
        let expected = 
            "<!doctype html>\n" +
            "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>simple-card</title><style>\n" +
            "  :root { --c0:#000; --c1:#d33; --c2:#3c3; --c3:#cc3; --c4:#36c; --c5:#c3c; --c6:#3cc; --c7:#eee; }\n" +
            ".px-dot { width:8px; height:8px; box-shadow:0px 0px 0 0 var(--c6); }\n" +
            "</style></head><body>\n" +
            "<h1>simple-card</h1>\n" +
            "<p>hello</p>\n" +
            "  <div class=\"px-dot\" title=\"dot\"></div>\n" +
            "</body></html>"
        Assert.Equal(expected, html)

[<Fact>]
let ``sprite CSS puts one shadow per lit pixel in the palette variable`` () =
    let css = HtmlCssBinding.spriteCss "dot" 8 6uy [| 0x80uy |] // one pixel, top-left
    Assert.Contains("0px 0px 0 0 var(--c6)", css)
    Assert.Equal(1, css.Split("var(--c6)").Length - 1) // exactly one shadow

[<Fact>]
let ``keyframes step through the AnimFlow cycle — declarative time, no script`` () =
    let css = HtmlCssBinding.keyframesCss "breathe" [ "idle"; "idle"; "idle"; "blink" ] 0.25
    Assert.Contains("@keyframes breathe", css)
    Assert.Contains("steps(1)", css)
    Assert.Contains("75.0% { content:\"blink\"; }", css)

[<Fact>]
let ``registered + cost-declared; the budget lint holds`` () =
    Assert.True(GeneratorRegistry.byName "binding.html-css" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())
