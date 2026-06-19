namespace Zeta.Core

/// Host-assisted cart hosting for the first "cart that can play carts" slice.
///
/// The parent CHIP-8 room still chooses from inside the VM by writing the
/// existing `Chip8Arcade.choiceCell`. The host owns the bytes and execution
/// boundary: the parent selects an ordered `CartSlot`, the injected `ICartHost`
/// resolves and plays it, and any refusal emits heat through the injected
/// `IHeatSink`.
[<RequireQualifiedAccess>]
module MetaCart =

    let private inv = System.Globalization.CultureInfo.InvariantCulture

    /// The tiny ABI visible to the parent cart: a stable name and the child
    /// ROM's content fingerprint. Carrying vs referencing is a host concern.
    type CartSlot =
        { Name: string
          Fingerprint: GameFingerprint.Fingerprint }

    /// Host-visible rows returned from a child play. These are deliberately
    /// small observables, not a second serialized savestate format.
    type ObservableRow = { Key: string; Value: string }

    type PlayRequest =
        { Source: string
          Slot: CartSlot }

    type PlayResult =
        { Slot: CartSlot
          FinalFrame: Chip8Cow.Frame
          Rows: ObservableRow list }

    type ReflectedChoice =
        { Index: int
          Slot: CartSlot
          Reflection: Chip8Arcade.Reflection }

    type SelectionPolicyTrace =
        { PolicyName: string
          BaselineSelected: ReflectedChoice option
          PolicySelected: ReflectedChoice option
          ChangedSelection: bool }

    /// Source-owned selection readout for the host-assisted meta-cart boundary.
    ///
    /// Reflection remains a pure observation of candidate child futures. The
    /// selected child is only an ordering decision over those observations; the
    /// launch still crosses the one-byte CHIP-8 choice cell plus the injected
    /// `ICartHost` capability boundary.
    type SelectionReadout =
        { Goal: int
          ReflectedGoal: int
          Seed: uint64
          CostPerStep: float
          Tank: SoftThrottle.Tank
          Candidates: ReflectedChoice list
          Selected: ReflectedChoice option
          PolicyTrace: SelectionPolicyTrace option
          DeterministicRulesApplied: string list }

    /// Host/room policy hook for attention and gravity over already-observed
    /// child futures. Policies may reorder/select existing candidates only;
    /// `applySelectionPolicy` rejects invented children before execution.
    type SelectionPolicy = SelectionReadout -> ReflectedChoice option

    type ReflectedPlayResult =
        { Choice: ReflectedChoice
          ParentWithChoice: Chip8Cow.Frame
          Play: PlayResult }

    [<RequireQualifiedAccess>]
    type Feedback =
        | NoSelection of source: string
        | MissingCart of slot: CartSlot
        | HostDenied of slot: CartSlot * reason: string
        | HeatRejected of slot: CartSlot * feedback: HeatSinkFeedback

    /// Injected host boundary for child-cart resolution/execution.
    type ICartHost =
        abstract Play: request: PlayRequest -> Result<PlayResult, Feedback>

    let slotOfCart (cart: Cart.Cart) : CartSlot =
        { Name = cart.Meta.Title
          Fingerprint = GameFingerprint.fingerprint cart.Rom }

    let reference (name: string) (fingerprint: GameFingerprint.Fingerprint) : CartSlot =
        { Name = name
          Fingerprint = fingerprint }

    let slotsOfCarts (carts: Cart.Cart list) : CartSlot list = carts |> List.map slotOfCart

    let private libraryOfCarts (carts: Cart.Cart list) : Chip8Arcade.Library =
        carts |> List.map (fun cart -> (slotOfCart cart).Name, cart.Rom)

    /// Run the existing soft arcade self-reflection over child carts and attach
    /// each report to the fingerprint slot it would launch.
    let reflectChildren
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        : ReflectedChoice list =
        let slots = slotsOfCarts children

        Chip8Arcade.reflect goal costPerStep tank seed (libraryOfCarts children)
        |> List.mapi (fun index reflection ->
            { Index = index
              Slot = slots.[index]
              Reflection = reflection })

    let selectionReadout
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        : SelectionReadout =
        let reflected = reflectChildren goal costPerStep tank seed children

        let selected =
            reflected
            |> List.map (fun item -> item.Reflection)
            |> Chip8Arcade.choose
            |> Option.bind (fun index -> reflected |> List.tryItem index)

        { Goal = goal
          ReflectedGoal = goal
          Seed = seed
          CostPerStep = costPerStep
          Tank = tank
          Candidates = reflected
          Selected = selected
          PolicyTrace = None
          DeterministicRulesApplied =
            [ "metacart.children->fingerprint-slots"
              "chip8arcade.reflect equal-funds each candidate"
              "chip8arcade.choose max confidence, depth, then library order"
              "selection orders candidates only; launch still crosses choice-cell 0x1FF"
              "host capability gate remains authoritative" ] }

    /// Choose the child cart whose knowable future scores best under the
    /// existing CHIP-8 arcade reflection policy.
    let chooseSlot
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        : ReflectedChoice option =
        (selectionReadout goal costPerStep tank seed children).Selected

    let selectionReadoutWithCapabilities
        (goal: int)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (seed: uint64)
        (children: Cart.Cart list)
        : SelectionReadout =
        let reflectedGoal, costPerStep, tank = Chip9Capabilities.reflectionBudget goal parentCapabilities
        let readout = selectionReadout reflectedGoal costPerStep tank seed children

        { readout with
            Goal = goal
            ReflectedGoal = reflectedGoal
            DeterministicRulesApplied =
                readout.DeterministicRulesApplied
                @ [ sprintf "parent manifest %s supplies reflection budget" parentCapabilities.Name ] }

    let private sameChoice (left: ReflectedChoice) (right: ReflectedChoice) : bool =
        left.Index = right.Index
        && left.Slot.Fingerprint.Sha256 = right.Slot.Fingerprint.Sha256

    let private sameChoiceOption (left: ReflectedChoice option) (right: ReflectedChoice option) : bool =
        match left, right with
        | Some l, Some r -> sameChoice l r
        | None, None -> true
        | Some _, None
        | None, Some _ -> false

    let private normalizePolicyChoice (readout: SelectionReadout) (choice: ReflectedChoice) : ReflectedChoice option =
        readout.Candidates |> List.tryFind (sameChoice choice)

    let defaultSelectionPolicy (readout: SelectionReadout) : ReflectedChoice option = readout.Selected

    let applySelectionPolicy
        (policyName: string)
        (policy: SelectionPolicy)
        (readout: SelectionReadout)
        : SelectionReadout =
        let baselineSelected = readout.Selected
        let selected = policy readout |> Option.bind (normalizePolicyChoice readout)

        { readout with
            Selected = selected
            PolicyTrace =
                Some
                    { PolicyName = policyName
                      BaselineSelected = baselineSelected
                      PolicySelected = selected
                      ChangedSelection = not (sameChoiceOption baselineSelected selected) }
            DeterministicRulesApplied =
                readout.DeterministicRulesApplied
                @ [ sprintf "selection policy %s may reorder existing candidates only" policyName ] }

    let private finiteOrFloor (value: float) : float =
        if System.Double.IsNaN value || System.Double.IsInfinity value then
            System.Double.NegativeInfinity
        else
            value

    /// Attention changes ordering, not arithmetic truth. The byte/flux cost
    /// and host capability checks remain downstream; this only chooses which
    /// already-reflected child future boards first.
    let attentionSelectionPolicy (attention: CartSlot -> float) : SelectionPolicy =
        fun readout ->
            match readout.Candidates with
            | [] -> None
            | candidates ->
                candidates
                |> List.maxBy (fun choice ->
                    finiteOrFloor (attention choice.Slot),
                    choice.Reflection.Report.Confidence,
                    choice.Reflection.Report.Achieved,
                    -choice.Index)
                |> Some

    /// Choose under the parent room's declared CHIP-9 policy. The manifest
    /// does not change arithmetic truth: it only decides how much flux funds
    /// the reflection before the choice crosses the host boundary.
    let chooseSlotWithCapabilities
        (goal: int)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (seed: uint64)
        (children: Cart.Cart list)
        : ReflectedChoice option =
        (selectionReadoutWithCapabilities goal parentCapabilities seed children).Selected

    /// Read the parent VM's choice using the same one-byte treaty as
    /// `Chip8Arcade.readChoice`, but return the fingerprint slot rather than
    /// raw ROM bytes.
    let readSlot (slots: CartSlot list) (frame: Chip8Cow.Frame) : CartSlot option =
        Map.tryFind Chip8Arcade.choiceCell frame.Mem
        |> Option.bind (fun idx -> List.tryItem (int idx) slots)

    let private litPixels (frame: Chip8Cow.Frame) : int =
        seq {
            for y in 0 .. Chip8.DisplayH - 1 do
                for x in 0 .. Chip8.DisplayW - 1 do
                    if Chip8Cow.pixel x y frame then
                        1
        }
        |> Seq.sum

    let observableRows (slot: CartSlot) (frame: Chip8Cow.Frame) : ObservableRow list =
        [ { Key = "cart.name"; Value = slot.Name }
          { Key = "cart.sha256"; Value = slot.Fingerprint.Sha256 }
          { Key = "cart.crc32"; Value = slot.Fingerprint.Crc32.ToString("x8", inv) }
          { Key = "cart.size"; Value = slot.Fingerprint.Size.ToString(inv) }
          { Key = "frame.pc"; Value = frame.PC.ToString(inv) }
          { Key = "frame.i"; Value = frame.I.ToString(inv) }
          { Key = "display.lit"; Value = (litPixels frame).ToString(inv) } ]

    /// Local host: "carried" children are present in the parent bundle and
    /// resolved by fingerprint. A referenced-but-absent cart returns
    /// `MissingCart`; the caller decides how to surface that heat.
    [<Sealed>]
    type LocalCartHost(carried: Cart.Cart list) =
        let bySha =
            carried
            |> List.map (fun cart ->
                let slot = slotOfCart cart
                slot.Fingerprint.Sha256, cart)
            |> Map.ofList

        interface ICartHost with
            member _.Play request =
                match Map.tryFind request.Slot.Fingerprint.Sha256 bySha with
                | None -> Error(Feedback.MissingCart request.Slot)
                | Some cart ->
                    let finalFrame = Cart.playback cart

                    Ok
                        { Slot = request.Slot
                          FinalFrame = finalFrame
                          Rows = observableRows request.Slot finalFrame }

    /// Capability-aware local host: carried children still resolve by content
    /// fingerprint, but each child runs through its declared CHIP-9 capability
    /// manifest before playback. Missing capability is a host denial, not a VM
    /// exception and not silent downgrading.
    [<Sealed>]
    type CapabilityCartHost(carried: Cart.Cart list, capabilitiesBySha: Map<string, Chip9Capabilities.Manifest>) =
        let bySha =
            carried
            |> List.map (fun cart ->
                let slot = slotOfCart cart
                slot.Fingerprint.Sha256, cart)
            |> Map.ofList

        interface ICartHost with
            member _.Play request =
                match Map.tryFind request.Slot.Fingerprint.Sha256 bySha with
                | None -> Error(Feedback.MissingCart request.Slot)
                | Some cart ->
                    let manifest =
                        capabilitiesBySha
                        |> Map.tryFind request.Slot.Fingerprint.Sha256
                        |> Option.defaultValue Chip9Capabilities.chip8Default

                    match Chip9Capabilities.playback manifest cart with
                    | Error reason -> Error(Feedback.HostDenied(request.Slot, reason))
                    | Ok finalFrame ->
                        Ok
                            { Slot = request.Slot
                              FinalFrame = finalFrame
                              Rows = observableRows request.Slot finalFrame }

    let private feedbackHeat (source: string) (feedback: Feedback) : HeatSignature option =
        match feedback with
        | Feedback.MissingCart slot ->
            Some(
                HeatSignature.ofMass
                    source
                    "meta-cart.missing"
                    1
                    1.0
                    (sprintf "name=%s sha256=%s" slot.Name slot.Fingerprint.Sha256)
            )
        | Feedback.HostDenied(slot, reason) ->
            Some(
                HeatSignature.ofMass
                    source
                    "meta-cart.denied"
                    1
                    1.0
                    (sprintf "name=%s sha256=%s reason=%s" slot.Name slot.Fingerprint.Sha256 reason)
            )
        | Feedback.NoSelection _
        | Feedback.HeatRejected _ -> None

    let private failWithHeat (source: string) (sink: IHeatSink) (slot: CartSlot) (failure: Feedback) =
        match feedbackHeat source failure with
        | None -> Error failure
        | Some heat ->
            match sink.Emit heat with
            | Ok() -> Error failure
            | Error feedback -> Error(Feedback.HeatRejected(slot, feedback))

    let private choiceSummary (choice: ReflectedChoice option) : string =
        match choice with
        | None -> "none"
        | Some choice -> sprintf "%s@%d:%s" choice.Slot.Name choice.Index choice.Slot.Fingerprint.Sha256

    let private policyBackpressureHeat (source: string) (readout: SelectionReadout) (failure: Feedback) : HeatSignature option =
        let failedSlotAndReason =
            match failure with
            | Feedback.MissingCart slot -> Some(slot, "missing")
            | Feedback.HostDenied(slot, reason) -> Some(slot, reason)
            | Feedback.NoSelection _
            | Feedback.HeatRejected _ -> None

        match readout.PolicyTrace, readout.Selected, failedSlotAndReason with
        | Some trace, Some selected, Some(failedSlot, reason)
            when trace.ChangedSelection
                 && selected.Slot.Fingerprint.Sha256 = failedSlot.Fingerprint.Sha256 ->
            let detail =
                sprintf
                    "policy=%s baseline=%s selected=%s reason=%s"
                    trace.PolicyName
                    (choiceSummary trace.BaselineSelected)
                    (choiceSummary trace.PolicySelected)
                    reason

            Some(HeatSignature.ofMass source "meta-cart.policy-backpressure" 1 1.0 detail)
        | _ -> None

    let private emitPolicyBackpressureHeat
        (source: string)
        (sink: IHeatSink)
        (readout: SelectionReadout)
        (failure: Feedback)
        : Result<unit, Feedback> =
        match policyBackpressureHeat source readout failure, readout.Selected with
        | None, _ -> Ok()
        | Some heat, Some choice ->
            match sink.Emit heat with
            | Ok() -> Ok()
            | Error feedback -> Error(Feedback.HeatRejected(choice.Slot, feedback))
        | Some _, None -> Ok()

    /// Play the child selected by the parent VM. No selection is a cold refusal;
    /// missing/denied children emit heat before returning the typed failure.
    let playSelected
        (source: string)
        (sink: IHeatSink)
        (slots: CartSlot list)
        (host: ICartHost)
        (parent: Chip8Cow.Frame)
        : Result<PlayResult, Feedback> =
        match readSlot slots parent with
        | None -> Error(Feedback.NoSelection source)
        | Some slot ->
            match host.Play { Source = source; Slot = slot } with
            | Ok result -> Ok result
            | Error failure -> failWithHeat source sink slot failure

    /// Play the selected child only if the parent cart has the host-child-launch
    /// capability. The child host may still deny its own capabilities separately.
    let playSelectedWithCapabilities
        (source: string)
        (sink: IHeatSink)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (slots: CartSlot list)
        (host: ICartHost)
        (parent: Chip8Cow.Frame)
        : Result<PlayResult, Feedback> =
        match readSlot slots parent with
        | None -> Error(Feedback.NoSelection source)
        | Some slot when not (Chip9Capabilities.grants Chip9Capabilities.Capability.HostAssistedChildLaunch parentCapabilities) ->
            failWithHeat
                source
                sink
                slot
                (Feedback.HostDenied(slot, Chip9Capabilities.denied Chip9Capabilities.Capability.HostAssistedChildLaunch))
        | Some _ -> playSelected source sink slots host parent

    /// Convenience for the carried-cart mode: the parent bundle includes the
    /// child carts, so the local host can resolve the selected slot directly.
    let playSelectedCarried
        (source: string)
        (sink: IHeatSink)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<PlayResult, Feedback> =
        let slots = slotsOfCarts children
        let host = LocalCartHost children :> ICartHost
        playSelected source sink slots host parent

    /// Capability-aware carried-cart mode. Parent launch permission and child
    /// execution requirements are both explicit manifests.
    let playSelectedCarriedWithCapabilities
        (source: string)
        (sink: IHeatSink)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (childCapabilitiesBySha: Map<string, Chip9Capabilities.Manifest>)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<PlayResult, Feedback> =
        let slots = slotsOfCarts children
        let host = CapabilityCartHost(children, childCapabilitiesBySha) :> ICartHost
        playSelectedWithCapabilities source sink parentCapabilities slots host parent

    let capabilityMap (items: (Cart.Cart * Chip9Capabilities.Manifest) list) : Map<string, Chip9Capabilities.Manifest> =
        items
        |> List.map (fun (cart, manifest) ->
            let slot = slotOfCart cart
            slot.Fingerprint.Sha256, manifest)
        |> Map.ofList

    /// Commit a reflected choice into the parent VM's existing choice cell.
    /// This keeps the meta-cart ABI identical to `Chip8Arcade`: host-side
    /// reflection can assist, but the selected child still crosses the
    /// one-byte choice boundary.
    let commitChoice (choice: ReflectedChoice) (parent: Chip8Cow.Frame) : Chip8Cow.Frame =
        Chip8Arcade.commitChoice choice.Index parent

    let private slotsOfReadout (readout: SelectionReadout) : CartSlot list =
        readout.Candidates |> List.map (fun candidate -> candidate.Slot)

    /// Launch from an explicit selection readout. This is the testable
    /// observe/choose/execute boundary: callers may inspect or replace the
    /// readout before any child crosses the injected host.
    let playChosenFromSelectionReadout
        (source: string)
        (sink: IHeatSink)
        (readout: SelectionReadout)
        (host: ICartHost)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        match readout.Selected with
        | None -> Error(Feedback.NoSelection source)
        | Some choice ->
            let parentWithChoice = commitChoice choice parent

            match playSelected source sink (slotsOfReadout readout) host parentWithChoice with
            | Ok play ->
                Ok
                    { Choice = choice
                      ParentWithChoice = parentWithChoice
                      Play = play }
            | Error feedback ->
                match emitPolicyBackpressureHeat source sink readout feedback with
                | Ok() -> Error feedback
                | Error heatFeedback -> Error heatFeedback

    /// Capability-aware launch from an explicit selection readout. Parent
    /// attention/throttle may change ordering, but capability truth is checked
    /// here at the host boundary and still returns typed feedback/heat.
    let playChosenFromSelectionReadoutWithCapabilities
        (source: string)
        (sink: IHeatSink)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (readout: SelectionReadout)
        (host: ICartHost)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        match readout.Selected with
        | None -> Error(Feedback.NoSelection source)
        | Some choice ->
            let parentWithChoice = commitChoice choice parent

            match playSelectedWithCapabilities source sink parentCapabilities (slotsOfReadout readout) host parentWithChoice with
            | Ok play ->
                Ok
                    { Choice = choice
                      ParentWithChoice = parentWithChoice
                      Play = play }
            | Error feedback ->
                match emitPolicyBackpressureHeat source sink readout feedback with
                | Ok() -> Error feedback
                | Error heatFeedback -> Error heatFeedback

    /// Soft-select a child cart by reflection, write that selection into the
    /// parent choice cell, then launch through the injected host boundary.
    let playChosenByReflection
        (source: string)
        (sink: IHeatSink)
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        (host: ICartHost)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        playChosenFromSelectionReadout source sink (selectionReadout goal costPerStep tank seed children) host parent

    /// Capability-aware reflection path. The parent manifest funds the
    /// lookahead and gates host-child-launch; the child manifest gates the
    /// selected cart's own CHIP-9 extensions.
    let playChosenByReflectionWithCapabilities
        (source: string)
        (sink: IHeatSink)
        (goal: int)
        (seed: uint64)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (childCapabilitiesBySha: Map<string, Chip9Capabilities.Manifest>)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        let readout = selectionReadoutWithCapabilities goal parentCapabilities seed children
        let host = CapabilityCartHost(children, childCapabilitiesBySha) :> ICartHost
        playChosenFromSelectionReadoutWithCapabilities source sink parentCapabilities readout host parent

    /// Convenience for the common carried-cart mode: reflect over the bundled
    /// children and resolve the selected child from the same bundle.
    let playChosenCarried
        (source: string)
        (sink: IHeatSink)
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        let host = LocalCartHost children :> ICartHost
        playChosenByReflection source sink goal costPerStep tank seed children host parent

    /// Capability-aware carried-cart mode for the host-assisted meta-cart
    /// experiment. This is the source-owned room boundary: no file IO, no
    /// exceptions, and denied launch/extension asks become heat.
    let playChosenCarriedWithCapabilities
        (source: string)
        (sink: IHeatSink)
        (goal: int)
        (seed: uint64)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (childCapabilitiesBySha: Map<string, Chip9Capabilities.Manifest>)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<ReflectedPlayResult, Feedback> =
        playChosenByReflectionWithCapabilities
            source
            sink
            goal
            seed
            parentCapabilities
            childCapabilitiesBySha
            children
            parent
