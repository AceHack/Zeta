namespace Zeta.Core

/// Source-owned tiny carts for tests and experiments.
///
/// These are not downloaded games. They are hand-authored CHIP-8/CHIP-9
/// programs small enough to inspect in a diff, with deterministic metadata and
/// no external license surface. Real game ROMs can stay optional demo inputs;
/// these carts are the CI proof substrate.
[<RequireQualifiedAccess>]
module CartFixtures =

    [<RequireQualifiedAccess>]
    type Dialect =
        | Chip8
        | Chip9

    type Fixture =
        { Dialect: Dialect
          Capabilities: Chip9Capabilities.Manifest
          Cart: Cart.Cart }

    let private b (value: int) : byte = byte (value &&& 0xFF)

    let op (hi: int) (lo: int) : byte[] = [| b hi; b lo |]

    let assemble (parts: byte[] list) : byte[] =
        parts |> Array.concat

    let cls: byte[] = op 0x00 0xE0

    let jp (addr: int) : byte[] =
        op (0x10 ||| ((addr >>> 8) &&& 0x0F)) addr

    let ldV (register: int) (value: int) : byte[] =
        op (0x60 ||| (register &&& 0x0F)) value

    let addV (register: int) (value: int) : byte[] =
        op (0x70 ||| (register &&& 0x0F)) value

    let ldI (addr: int) : byte[] =
        op (0xA0 ||| ((addr >>> 8) &&& 0x0F)) addr

    let draw (xRegister: int) (yRegister: int) (rows: int) : byte[] =
        op (0xD0 ||| (xRegister &&& 0x0F)) (((yRegister &&& 0x0F) <<< 4) ||| (rows &&& 0x0F))

    let skipKeyPressed (register: int) : byte[] =
        op (0xE0 ||| (register &&& 0x0F)) 0x9E

    let waitKey (register: int) : byte[] =
        op (0xF0 ||| (register &&& 0x0F)) 0x0A

    /// CHIP-9 plane select. Classic CHIP-8 programs never emit this encoding.
    let selectPlane (mask: int) : byte[] =
        op (0xF0 ||| (mask &&& 0x0F)) 0x01

    let private cartWith
        (dialect: Dialect)
        (capabilities: Chip9Capabilities.Manifest)
        (title: string)
        (rom: byte[])
        (cyclesPerTick: int)
        (ticks: int)
        : Fixture =
        { Dialect = dialect
          Capabilities = capabilities
          Cart =
            { Meta =
                { Title = title
                  Author = "Zeta source fixture"
                  Description = "Hand-authored deterministic cart fixture for CI and room experiments." }
              Seed = 1UL
              Rom = rom
              CyclesPerTick = cyclesPerTick
              Ticks = ticks
              Recording = { Crossings = Map.empty } } }

    /// A deterministic loop. Under a small soft tank this starves before the
    /// requested lookahead depth, so it is useful as the "less knowable" child.
    let loopRom: byte[] =
        assemble [ ldV 0xA 0x0C; jp 0x202 ]

    /// Branches on key 0 immediately because VA defaults to 0. The soft
    /// reflector sees the branch boundary honestly and scores confidence 1.
    let inputForkRom: byte[] =
        assemble [ skipKeyPressed 0xA; jp 0x200 ]

    /// Waits for any key into V0. Useful when a test needs a genuine FX0A wait.
    let keyWaitRom: byte[] =
        assemble [ waitKey 0x0 ]

    /// CHIP-9: select an RGB plane mask, point I at the inline sprite byte, draw
    /// one pixel row, then park on a self-loop. The extension lives in the
    /// emulator, not behind a host-injected effect.
    let colorDotRom (planeMask: int) : byte[] =
        assemble
            [ selectPlane planeMask
              ldI 0x208
              draw 0 0 1
              jp 0x206
              [| 0x80uy |] ]

    let loop: Fixture = cartWith Dialect.Chip8 Chip9Capabilities.chip8Default "fixture-loop" loopRom 1 1

    let inputFork: Fixture =
        cartWith Dialect.Chip8 Chip9Capabilities.chip8Default "fixture-input-fork" inputForkRom 1 1

    let keyWait: Fixture =
        cartWith Dialect.Chip8 Chip9Capabilities.chip8Default "fixture-key-wait" keyWaitRom 1 1

    let chip9GreenDot: Fixture =
        cartWith Dialect.Chip9 Chip9Capabilities.chip9ColorUnthrottled "fixture-chip9-green-dot" (colorDotRom 2) 3 1

    let chip9WhiteDot: Fixture =
        cartWith Dialect.Chip9 Chip9Capabilities.chip9ColorUnthrottled "fixture-chip9-white-dot" (colorDotRom 7) 3 1

    let cart (fixture: Fixture) : Cart.Cart = fixture.Cart

    let classicChildren: Cart.Cart list =
        [ cart loop; cart inputFork ]

    let chip9Children: Cart.Cart list =
        [ cart chip9GreenDot; cart chip9WhiteDot ]
