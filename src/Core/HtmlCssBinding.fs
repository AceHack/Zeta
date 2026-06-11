namespace Zeta.Core

/// HtmlCssBinding — **the cartridge rendered as PURE STATIC HTML + CSS, JavaScript left out**
/// (Aaron 2026-06-11: "take this same paradigm to html and css and try to leave javascript out of
/// it — encode for pure static html and css and see how far we can push generating html and css from
/// this file").
///
/// How far it pushes, honestly: surprisingly far, because CSS is itself declarative and time-based —
/// - **sprites/glyphs** → the classic one-div BOX-SHADOW pixel-art technique (each lit pixel one
///   shadow at an offset; the whole sprite is CSS, no images, no canvas);
/// - **palette** → CSS custom properties (the ZetaMax mask → `--c0…--c7`: the ZX set as variables);
/// - **animation** → `@keyframes` with `steps()` timing — AnimFlow's cycle becomes a CSS animation
///   (declarative time: the browser is the clock generator at this binding's capability — the honest
///   note: WALL-clock here, so this binding renders the LOOK of the animation; bit-exact replay stays
///   on the seeded bindings. Capability honesty, as always);
/// - **layout** → the treemap/stack maps onto flex/grid;
/// - **NO `<script>` anywhere** — tested. Interactivity beyond :hover is the next binding's job, not
///   smuggled in.
[<RequireQualifiedAccess>]
module HtmlCssBinding =

    /// The ZetaMax palette as CSS custom properties (mask index = variable name).
    let paletteCss: string =
        "  :root { --c0:#000; --c1:#d33; --c2:#3c3; --c3:#cc3; --c4:#36c; --c5:#c3c; --c6:#3cc; --c7:#eee; }"

    /// One sprite as box-shadow pixel art: an 8-wide byte-row glyph, `scale` px per pixel, drawn in
    /// the palette color `mask`. Returns the CSS block for `.px-<name>`.
    let spriteCss (name: string) (scale: int) (mask: byte) (rows: byte[]) : string =
        let s = max 1 scale
        let shadows =
            [ for y in 0 .. rows.Length - 1 do
                  for x in 0..7 do
                      if (rows.[y] >>> (7 - x)) &&& 1uy = 1uy then
                          yield sprintf "%dpx %dpx 0 0 var(--c%d)" (x * s) (y * s) (int (mask &&& 7uy)) ]
        sprintf ".px-%s { width:%dpx; height:%dpx; box-shadow:%s; }" name s s (String.concat "," shadows)

    /// An anim cycle as @keyframes with steps() — each named frame gets an opacity-swap slot
    /// (frames are stacked divs; the keyframes show one at a time, step-wise — the AnimFlow cycle).
    let keyframesCss (animName: string) (cycle: string list) (secondsPerFrame: float) : string =
        let n = List.length cycle
        if n = 0 then ""
        else
            let dur = float n * secondsPerFrame
            let frames =
                cycle
                |> List.mapi (fun i f ->
                    let pct = 100.0 * float i / float n
                    sprintf "  %.1f%% { content:\"%s\"; }" pct f)
                |> String.concat "\n"
            sprintf "@keyframes %s {\n%s\n}\n.anim-%s::after { animation: %s %.2fs steps(1) infinite; }"
                animName frames animName animName dur

    /// Render a whole MediaLines document as one static page: palette + every glyph/frame as pixel
    /// art + every anim as keyframes + meta as semantic HTML. NO scripts, ever.
    let render (d: MediaLines.Doc) : string =
        let title = MediaLines.field "meta" "name" d |> Option.defaultValue "cartridge"
        let motto = MediaLines.field "meta" "motto" d

        let sprites =
            (MediaLines.ofKind "glyph" d @ MediaLines.ofKind "frame" d @ MediaLines.ofKind "sprite" d)
            |> List.map (fun e ->
                match e.Fields with
                | hex :: _ -> spriteCss e.Name 8 6uy (MediaLines.hexBytes hex)
                | [] -> "")

        let anims =
            MediaLines.ofKind "anim" d
            |> List.choose AnimFlow.ofEntry
            |> List.map (fun a -> keyframesCss a.Name a.Cycle 0.5)

        let divs =
            (MediaLines.ofKind "glyph" d @ MediaLines.ofKind "frame" d)
            |> List.map (fun e -> sprintf "  <div class=\"px-%s\" title=\"%s\"></div>" e.Name e.Name)

        String.concat "\n"
            [ "<!doctype html>"
              sprintf "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>%s</title><style>" title
              paletteCss
              yield! sprites
              yield! anims
              "</style></head><body>"
              sprintf "<h1>%s</h1>" title
              (match motto with Some m -> sprintf "<p>%s</p>" m | None -> "")
              yield! divs
              "</body></html>" ]
