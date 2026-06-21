namespace Zeta.Core

/// Chip9Board — **the chip9-board HOST for sim·mea·cut loops** (081KTSZN10008QG0R002J0GE0Z's last named slice): a
/// test loop hosted ON the machine that already has exact ticks, color planes, and the fault
/// register. Sim loads the ROM into a fresh frame (the rom bytes are CONSTANTS — solid ground;
/// the seed remains the replay tag the boundary requires); Mea runs the program and banks the
/// FULL observable state (color grid rows + plane + fault + pc — the same canonical text form
/// the four-oracle treaty locks); Cut is whatever the room asserts — `TestLoop.cutGolden` makes
/// a board loop a treaty replay for free. Everything in here is deterministic by construction:
/// the board host is sealed-room eligible with zero waivers.
[<RequireQualifiedAccess>]
module Chip9Board =

    /// The banked measurement: the machine's observable state as canonical text rows —
    /// plane line, 32 color-grid rows, then the fault and pc lines (everything the treaty sees).
    let render (f: Chip8Cow.Frame) : string list =
        [ yield sprintf "plane\t%d" f.Plane
          for y in 0 .. Chip8.DisplayH - 1 do
              yield
                  [| for x in 0 .. Chip8.DisplayW - 1 -> sprintf "%x" (Chip8Cow.colorAt x y f) |]
                  |> String.concat ""
          yield sprintf "fault\t%s" (f.Fault |> Option.defaultValue "none")
          yield sprintf "pc\t%04x" (int f.PC) ]

    /// Host a loop on the board: ROM in, `steps` instructions, the rendered state out.
    /// `extraMem` seeds fixed data (sprites) outside the ROM window — constants, like the ROM.
    let loop
        (name: string)
        (seed: uint64)
        (rom: byte[])
        (extraMem: (int * byte) list)
        (steps: int)
        (cut: string list -> Result<unit, string>)
        : ITestLoop<Chip8Cow.Frame, string list> =
        TestLoop.make
            name
            seed
            (fun s ->
                let f0 = Chip8Cow.create s |> Chip8Cow.loadRom rom
                { f0 with Mem = extraMem |> List.fold (fun m (k, v) -> Map.add k v m) f0.Mem })
            (fun f0 -> [ 1..steps ] |> List.fold (fun f _ -> Chip8Cow.step f) f0 |> render)
            cut
