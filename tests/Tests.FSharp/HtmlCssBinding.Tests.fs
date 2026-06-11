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
