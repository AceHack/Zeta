namespace Zeta.Core

/// Named capability surface for carts that intentionally step beyond classic CHIP-8.
///
/// CHIP-8 stays the tiny zero case. CHIP-9 is the same emulator core with explicit
/// extensions: color planes live in `Chip8Cow.step`, throttle policy is a manifest
/// choice, and launching child carts is a host boundary the parent must be granted.
[<RequireQualifiedAccess>]
module Chip9Capabilities =

    [<RequireQualifiedAccess>]
    type Capability =
        | ColorPlanes
        | UnthrottledExecution
        | HostAssistedChildLaunch

    [<RequireQualifiedAccess>]
    type ThrottlePolicy =
        | Metered of costPerStep: float * tank: SoftThrottle.Tank
        | Unthrottled

    type Manifest =
        { Name: string
          Capabilities: Set<Capability>
          Throttle: ThrottlePolicy }

    let capabilityName =
        function
        | Capability.ColorPlanes -> "chip9.color-planes"
        | Capability.UnthrottledExecution -> "chip9.unthrottled-execution"
        | Capability.HostAssistedChildLaunch -> "meta-cart.host-child-launch"

    let grants (capability: Capability) (manifest: Manifest) : bool =
        manifest.Capabilities |> Set.contains capability

    let grant (capability: Capability) (manifest: Manifest) : Manifest =
        { manifest with Capabilities = Set.add capability manifest.Capabilities }

    let withThrottle (throttle: ThrottlePolicy) (manifest: Manifest) : Manifest =
        { manifest with Throttle = throttle }

    let denied (capability: Capability) : string =
        sprintf "capability-not-granted:%s" (capabilityName capability)

    let chip8Metered (costPerStep: float) (tank: SoftThrottle.Tank) : Manifest =
        { Name = "chip8-metered"
          Capabilities = Set.empty
          Throttle = ThrottlePolicy.Metered(costPerStep, tank) }

    let chip8Default: Manifest =
        chip8Metered 1.0 (SoftThrottle.tank 5.0 1.0)

    let chip9ColorUnthrottled: Manifest =
        { Name = "chip9-color-unthrottled"
          Capabilities = Set.ofList [ Capability.ColorPlanes; Capability.UnthrottledExecution ]
          Throttle = ThrottlePolicy.Unthrottled }

    let metaHost: Manifest =
        chip8Default |> grant Capability.HostAssistedChildLaunch

    let chip9MetaHost: Manifest =
        chip9ColorUnthrottled |> grant Capability.HostAssistedChildLaunch

    let private romOps (rom: byte[]) : int seq =
        seq {
            for i in 0 .. 2 .. rom.Length - 2 do
                yield (int rom.[i] <<< 8) ||| int rom.[i + 1]
        }

    /// Conservative static scan for the CHIP-9 `Fn01` plane-select opcode.
    /// Sprite/data bytes that look like an opcode still require the capability;
    /// this is a manifest guard, not a verifier for arbitrary ROM control flow.
    let requiresColorPlanes (rom: byte[]) : bool =
        romOps rom |> Seq.exists (fun op -> (op &&& 0xF0FF) = 0xF001)

    let requiredByRom (rom: byte[]) : Set<Capability> =
        if requiresColorPlanes rom then
            Set.singleton Capability.ColorPlanes
        else
            Set.empty

    let missingForRom (manifest: Manifest) (rom: byte[]) : Capability list =
        requiredByRom rom
        |> Set.toList
        |> List.filter (fun capability -> not (grants capability manifest))

    let validateRom (manifest: Manifest) (rom: byte[]) : Result<unit, string> =
        match missingForRom manifest rom with
        | [] -> Ok()
        | capability :: _ -> Error(denied capability)

    let playback (manifest: Manifest) (cart: Cart.Cart) : Result<Chip8Cow.Frame, string> =
        validateRom manifest cart.Rom |> Result.map (fun () -> Cart.playback cart)

    /// Turn the manifest throttle policy into the existing speculation arguments.
    /// Unthrottled means each step costs zero flux: the emulator still runs the
    /// same deterministic transition, but the policy stops metering this branch.
    let reflectionBudget (goal: int) (manifest: Manifest) : int * float * SoftThrottle.Tank =
        match manifest.Throttle with
        | ThrottlePolicy.Metered(costPerStep, tank) -> goal, costPerStep, tank
        | ThrottlePolicy.Unthrottled -> goal, 0.0, SoftThrottle.tank 0.0 0.0
