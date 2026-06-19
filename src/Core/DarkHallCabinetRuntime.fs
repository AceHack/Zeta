namespace Zeta.Core

open System.Threading.Tasks

/// Source-owned controller/runtime for Dark Hall cabinets.
///
/// `Arcade` is the door/signage. This module is the observe.ts-shaped control
/// surface: observe the room into a 4x4 action menu, then execute the selected
/// cell through owned emulator interfaces. The menu is deliberately DU/feedback
/// shaped so later dynamic/soft-value policies can replace the chooser without
/// changing the machine boundary.
[<RequireQualifiedAccess>]
module DarkHallCabinetRuntime =

    [<RequireQualifiedAccess>]
    type ActionGate =
        | AppendOnly
        | PrGated

    [<RequireQualifiedAccess>]
    type ActionClass =
        | Transition
        | EscapeHatch
        | GrammarExtension
        | MenuContribution
        | OperatorDecision
        | AgentDecision

    type MachineAddress =
        { CabinetName: string
          MachineName: string }

    type CabinetAction =
        { Id: string
          Class: ActionClass
          Gate: ActionGate
          Label: string
          Description: string
          ComposesWith: string list
          FeedbackVariants: string list
          Address: MachineAddress option }

    /// The Dark Hall's projection onto the universal controller surface.
    ///
    /// `Grid` is the 4x4 placement primitive (`GridBinding`). The readout is the
    /// larger controller/menu observation: available action grammar entries,
    /// deterministic construction rules, and the room being observed.
    type ControllerReadout =
        { RoomName: string
          Grid: GridBinding.GridBinding<CabinetAction>
          Actions: CabinetAction list
          DeterministicRulesApplied: string list }

    type Readout = ControllerReadout

    type MetaCartLaunch =
        { Goal: int
          Seed: uint64
          ParentCapabilities: Chip9Capabilities.Manifest
          ChildCapabilitiesBySha: Map<string, Chip9Capabilities.Manifest>
          Children: Cart.Cart list
          Parent: Chip8Cow.Frame }

    type RunRequest =
        | RunSoftChip8 of seed: uint64 * rom: byte[] * frames: int
        | RunDarkHallCpu of program: byte[] * budget: int
        | RunChip9Cart of cart: Cart.Cart * manifest: Chip9Capabilities.Manifest
        | RunMetaCart of MetaCartLaunch

    type RunResult =
        | SoftChip8Frame of Chip8Cow.Frame
        | DarkHallCpuState of DarkHall.EmuState
        | Chip9Frame of Chip8Cow.Frame
        | MetaCartResult of MetaCart.ReflectedPlayResult

    [<RequireQualifiedAccess>]
    type Feedback =
        | CellUnbound of cell: int
        | CabinetMissing of cabinetName: string
        | MachineMissing of cabinetName: string * machineName: string
        | CabinetOffline of cabinetName: string
        | MachineOffline of cabinetName: string * machineName: string
        | CapabilityDenied of address: MachineAddress * capability: Chip9Capabilities.Capability
        | HeatRejected of address: MachineAddress * feedback: HeatSinkFeedback
        | UnsupportedMachine of address: MachineAddress * core: DarkHall.MachineCore
        | RequestMismatch of address: MachineAddress * expectedCore: DarkHall.MachineCore * request: string
        | SchedulerFeedback of InterruptFeedback
        | MetaCartFeedback of MetaCart.Feedback
        | Chip9Feedback of address: MachineAddress * reason: string

    let defaultPriority: Map<string, float> =
        Map.ofList
            [ "liveness", 10.0
              "execution", 5.0
              "capability", 2.0
              "diagnostic", 1.0
              "grammar", 1.0 ]

    let private coreName (core: DarkHall.MachineCore) : string =
        match core with
        | DarkHall.MachineCore.DarkHallCpu -> "darkhall-cpu"
        | DarkHall.MachineCore.Chip8Cow -> "chip8-cow"
        | DarkHall.MachineCore.SoftChip8Scheduler -> "soft-chip8-scheduler"
        | DarkHall.MachineCore.SoftChip8Predictor -> "soft-chip8-predictor"
        | DarkHall.MachineCore.Chip9ColorPlanes -> "chip9-color-planes"
        | DarkHall.MachineCore.MetaCartHost -> "meta-cart-host"
        | DarkHall.MachineCore.FingerprintPrism -> "fingerprint-prism"
        | DarkHall.MachineCore.GameCatalog -> "game-catalog"
        | DarkHall.MachineCore.SimLoop -> "sim-loop"

    let private requestName =
        function
        | RunSoftChip8 _ -> "run-soft-chip8"
        | RunDarkHallCpu _ -> "run-darkhall-cpu"
        | RunChip9Cart _ -> "run-chip9-cart"
        | RunMetaCart _ -> "run-meta-cart"

    let private isExecutableCore =
        function
        | DarkHall.MachineCore.DarkHallCpu
        | DarkHall.MachineCore.SoftChip8Scheduler
        | DarkHall.MachineCore.Chip9ColorPlanes
        | DarkHall.MachineCore.MetaCartHost -> true
        | DarkHall.MachineCore.Chip8Cow
        | DarkHall.MachineCore.SoftChip8Predictor
        | DarkHall.MachineCore.FingerprintPrism
        | DarkHall.MachineCore.GameCatalog
        | DarkHall.MachineCore.SimLoop -> false

    let private feedbackVariants (machine: DarkHall.Machine) =
        [ "cell-unbound"
          "cabinet-missing"
          "machine-missing"
          "cabinet-offline"
          "machine-offline"
          if not (Set.isEmpty machine.RequiredCapabilities) then
              "capability-denied"
              "heat-rejected"
          if isExecutableCore machine.Core then
              "request-mismatch"
          else
              "unsupported-machine" ]

    let private actionForMachine (cabinet: DarkHall.Cabinet) (machine: DarkHall.Machine) : CabinetAction =
        { Id = sprintf "darkhall.%s.%s" cabinet.Name machine.Name
          Class = ActionClass.Transition
          Gate = ActionGate.AppendOnly
          Label = sprintf "%s/%s" cabinet.Name machine.Name
          Description = machine.Does
          ComposesWith = [ cabinet.Module; machine.Module ]
          FeedbackVariants = feedbackVariants machine
          Address =
            Some
                { CabinetName = cabinet.Name
                  MachineName = machine.Name } }

    let private escapeHatch: CabinetAction =
        { Id = "darkhall.escape-hatch"
          Class = ActionClass.EscapeHatch
          Gate = ActionGate.PrGated
          Label = "escape-hatch"
          Description = "surface a cabinet pattern that does not fit the current Dark Hall machine grammar"
          ComposesWith = [ "src/Core/ActionGrammar.fs"; "src/Core/GridBinding.fs" ]
          FeedbackVariants = [ "operator-attention-requested" ]
          Address = None }

    let private editGrammar: CabinetAction =
        { Id = "darkhall.edit-grammar"
          Class = ActionClass.GrammarExtension
          Gate = ActionGate.PrGated
          Label = "edit-grammar"
          Description = "propose a new cabinet action or machine kind instead of trapping the room in the current DU"
          ComposesWith = [ "src/Core.TypeScript/observe/observe.ts"; "src/Core/WorkflowEngine.fs" ]
          FeedbackVariants = [ "grammar-extension-proposed" ]
          Address = None }

    let private salienceItem (cabinet: DarkHall.Cabinet) (machine: DarkHall.Machine) : Salience.Item<CabinetAction> =
        { Payload = actionForMachine cabinet machine
          LivenessCritical = cabinet.Live && machine.Live
          Objectives =
            Map.ofList
                [ "liveness", if cabinet.Live && machine.Live then 1.0 else 0.0
                  "execution", if isExecutableCore machine.Core then 1.0 else 0.0
                  "capability", float machine.RequiredCapabilities.Count
                  "diagnostic", if machine.Core = DarkHall.MachineCore.FingerprintPrism then 1.0 else 0.0 ] }

    let private machineActions (priority: Map<string, float>) (room: DarkHall.Room) : CabinetAction list =
        room.Cabinets
        |> List.collect (fun cabinet -> cabinet.Machines |> List.map (salienceItem cabinet))
        |> Salience.display (GridBinding.Size - 2) priority

    /// observe.ts-shaped readout: reduce the whole room to the 4x4 controller
    /// labels plus the deterministic rules used to build that menu.
    let observeWithPriority (priority: Map<string, float>) (room: DarkHall.Room) : ControllerReadout =
        let actions = machineActions priority room @ [ escapeHatch; editGrammar ]

        { RoomName = room.Name
          Grid = GridBinding.ofLabels actions
          Actions = actions
          DeterministicRulesApplied =
            [ "darkhall.cabinets->machines"
              "salience.display top-14 machines"
              "escape-hatch always available"
              "grammar-extension always available"
              "actiongrid 4x4 geometry"
              "gridbinding labels controller cells"
              "gridbinding 4x4" ] }

    let observe (room: DarkHall.Room) : ControllerReadout =
        observeWithPriority defaultPriority room

    let actionAt (cell: int) (readout: ControllerReadout) : CabinetAction option =
        GridBinding.labelAt cell readout.Grid

    /// Sub-readout for the host-assisted meta-cart machine. The Dark Hall
    /// controller observes the cabinet action; this readout observes the child
    /// cart selection inside that action before the host boundary executes.
    let observeMetaCartLaunch (launch: MetaCartLaunch) : MetaCart.SelectionReadout =
        MetaCart.selectionReadoutWithCapabilities
            launch.Goal
            launch.ParentCapabilities
            launch.Seed
            launch.Children

    let observeMetaCartLaunchWithPolicy
        (policyName: string)
        (policy: MetaCart.SelectionPolicy)
        (launch: MetaCartLaunch)
        : MetaCart.SelectionReadout =
        launch
        |> observeMetaCartLaunch
        |> MetaCart.applySelectionPolicy policyName policy

    let private findCabinet (room: DarkHall.Room) (cabinetName: string) =
        room.Cabinets |> List.tryFind (fun cabinet -> cabinet.Name = cabinetName)

    let private findMachine (cabinet: DarkHall.Cabinet) (machineName: string) =
        cabinet.Machines |> List.tryFind (fun machine -> machine.Name = machineName)

    let private emitDeniedHeat
        (source: string)
        (sink: IHeatSink)
        (address: MachineAddress)
        (capability: Chip9Capabilities.Capability)
        : Result<unit, Feedback> =
        let detail =
            sprintf
                "cabinet=%s machine=%s capability=%s"
                address.CabinetName
                address.MachineName
                (Chip9Capabilities.capabilityName capability)

        let heat = HeatSignature.ofMass source "darkhall.machine.denied" 1 1.0 detail

        match sink.Emit heat with
        | Ok() -> Ok()
        | Error feedback -> Error(Feedback.HeatRejected(address, feedback))

    let private validateAddress
        (source: string)
        (sink: IHeatSink)
        (manifest: Chip9Capabilities.Manifest)
        (room: DarkHall.Room)
        (address: MachineAddress)
        : Result<DarkHall.Machine, Feedback> =
        result {
            let! cabinet =
                match findCabinet room address.CabinetName with
                | None -> Error(Feedback.CabinetMissing address.CabinetName)
                | Some cabinet -> Ok cabinet

            if not cabinet.Live then
                return! Error(Feedback.CabinetOffline cabinet.Name)

            let! machine =
                match findMachine cabinet address.MachineName with
                | None -> Error(Feedback.MachineMissing(address.CabinetName, address.MachineName))
                | Some machine -> Ok machine

            if not machine.Live then
                return! Error(Feedback.MachineOffline(address.CabinetName, address.MachineName))

            match
                machine.RequiredCapabilities
                |> Set.toList
                |> List.tryFind (fun capability -> not (Chip9Capabilities.grants capability manifest))
            with
            | Some capability ->
                do! emitDeniedHeat source sink address capability
                return! Error(Feedback.CapabilityDenied(address, capability))
            | None -> return machine
        }

    let private executeMachine
        (source: string)
        (sink: IHeatSink)
        (address: MachineAddress)
        (machine: DarkHall.Machine)
        (request: RunRequest)
        : Task<Result<RunResult, Feedback>> =
        task {
            match machine.Core, request with
            | DarkHall.MachineCore.SoftChip8Scheduler, RunSoftChip8(seed, rom, frames) ->
                let! result = SoftChip8Scheduler.run seed rom frames

                return
                    result
                    |> Result.map SoftChip8Frame
                    |> Result.mapError Feedback.SchedulerFeedback

            | DarkHall.MachineCore.DarkHallCpu, RunDarkHallCpu(program, budget) ->
                return Ok(DarkHallCpuState(DarkHall.run program budget))

            | DarkHall.MachineCore.Chip9ColorPlanes, RunChip9Cart(cart, cartManifest) ->
                return
                    Chip9Capabilities.playback cartManifest cart
                    |> Result.map Chip9Frame
                    |> Result.mapError (fun reason -> Feedback.Chip9Feedback(address, reason))

            | DarkHall.MachineCore.MetaCartHost, RunMetaCart launch ->
                let readout = observeMetaCartLaunch launch
                let host = MetaCart.CapabilityCartHost(launch.Children, launch.ChildCapabilitiesBySha) :> MetaCart.ICartHost

                return
                    MetaCart.playChosenFromSelectionReadoutWithCapabilities
                        source
                        sink
                        launch.ParentCapabilities
                        readout
                        host
                        launch.Parent
                    |> Result.map MetaCartResult
                    |> Result.mapError Feedback.MetaCartFeedback

            | core, _ when not (isExecutableCore core) ->
                return Error(Feedback.UnsupportedMachine(address, core))

            | core, _ ->
                return Error(Feedback.RequestMismatch(address, core, requestName request))
        }

    let executeAddress
        (source: string)
        (sink: IHeatSink)
        (manifest: Chip9Capabilities.Manifest)
        (room: DarkHall.Room)
        (address: MachineAddress)
        (request: RunRequest)
        : Task<Result<RunResult, Feedback>> =
        task {
            match validateAddress source sink manifest room address with
            | Error feedback -> return Error feedback
            | Ok machine -> return! executeMachine source sink address machine request
        }

    /// Execute the action bound to a selected 4x4 controller cell.
    let executeCell
        (source: string)
        (sink: IHeatSink)
        (manifest: Chip9Capabilities.Manifest)
        (room: DarkHall.Room)
        (cell: int)
        (request: RunRequest)
        : Task<Result<RunResult, Feedback>> =
        task {
            let readout = observe room

            match actionAt cell readout with
            | None -> return Error(Feedback.CellUnbound cell)
            | Some { Address = None } -> return Error(Feedback.CellUnbound cell)
            | Some { Address = Some address } -> return! executeAddress source sink manifest room address request
        }
