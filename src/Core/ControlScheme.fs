namespace Zeta.Core

/// ControlScheme — **control schemes are ZetaId-addressed artifacts, and every device is SECOND to
/// the universal action grammar** (Aaron 2026-06-11: "make sure our zetaids are capable of expressing
/// control schemes — gamepad, keyboard — all are 2nd to our universal action grammar; that's where
/// the mappings come from").
///
/// The law: the GRAMMAR owns the action set (the canonical things a citizen can MEAN — the compass
/// from the four corners, select/back, conference, the raw CHIP-9 pad); a SCHEME is a total mapping
/// from one device's physical inputs INTO that set — never past it. Schemes are registered with
/// content-addressed ZetaIds (GeneratorRegistry — same id everywhere; version bump = new id), so a
/// cartridge's `io`/`button` lines can reference a control scheme BY ID and any host resolves the
/// same mapping. Portability is the theorem: dpad-up ≡ 'w' ≡ pad-5 — different fingers, one meaning.
[<RequireQualifiedAccess>]
module ControlScheme =

    /// THE GRAMMAR'S ACTION SET — the canonical meanings (devices map into these, the wire form is
    /// the crossing payload the rooms already speak).
    type Action =
        | Go of string // the compass: "n" | "s" | "e" | "w" (the four corners) | "hottest" | "self"
        | Select
        | Back
        | Conference
        | Pad of int // the raw CHIP-9 16-key pass-through (0x0..0xF)

    /// The crossing payload an action means (the wire the rooms speak — go:/key: precedents).
    let payload (a: Action) : string =
        match a with
        | Go d -> "go:" + d
        | Select -> "ui:select"
        | Back -> "ui:back"
        | Conference -> "ui:conference"
        | Pad k -> SoftChip8Flux.encodeKey (k &&& 0xF) true

    /// A scheme: a named, versioned, ZetaId-addressed device mapping into the grammar.
    type Scheme =
        { Name: string
          Version: int
          ZetaId: string
          Map: Map<string, Action> }

    let private mk (name: string) (version: int) (map: (string * Action) list) : Scheme =
        { Name = name
          Version = version
          ZetaId = GeneratorRegistry.idOf name version
          Map = Map.ofList map }

    /// The CHIP-9 16-key pad (the atom's native scheme — keys pass through; 5/8/7/9 double as compass).
    let chip9Pad: Scheme =
        mk "control.chip9-pad" 1
            ([ for k in 0..15 -> sprintf "%x" k, Pad k ]
             @ [ "5", Go "n"; "8", Go "s"; "7", Go "w"; "9", Go "e" ])

    /// Keyboard WASD (+ enter/esc/c/h/.) — the desk scheme.
    let keyboardWasd: Scheme =
        mk "control.keyboard-wasd" 1
            [ "w", Go "n"; "s", Go "s"; "a", Go "w"; "d", Go "e"
              "h", Go "hottest"; ".", Go "self"
              "enter", Select; "esc", Back; "c", Conference ]

    /// The standard gamepad — dpad to the compass, face buttons to the verbs.
    let gamepadStandard: Scheme =
        mk "control.gamepad-standard" 1
            [ "dpad-up", Go "n"; "dpad-down", Go "s"; "dpad-left", Go "w"; "dpad-right", Go "e"
              "a", Select; "b", Back; "y", Conference; "x", Go "hottest" ]

    /// The registered schemes (the shelf — each referenceable by its ZetaId from io/button lines).
    let known: Scheme list = [ chip9Pad; keyboardWasd; gamepadStandard ]

    /// Resolve a scheme by ZetaId (the cartridge's direction).
    let byId (zetaId: string) : Scheme option =
        known |> List.tryFind (fun s -> s.ZetaId = zetaId)

    /// Translate one physical input under a scheme — None = unmapped (honest; never invented).
    let translate (s: Scheme) (input: string) : Action option = Map.tryFind input s.Map

    /// The wire crossing for a physical input under a scheme (the whole pipeline in one call).
    let crossing (s: Scheme) (input: string) : string option =
        translate s input |> Option.map payload
