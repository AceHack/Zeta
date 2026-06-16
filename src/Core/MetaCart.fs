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

    /// Choose the child cart whose knowable future scores best under the
    /// existing CHIP-8 arcade reflection policy.
    let chooseSlot
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (children: Cart.Cart list)
        : ReflectedChoice option =
        let reflected = reflectChildren goal costPerStep tank seed children
        let reflections = reflected |> List.map (fun item -> item.Reflection)

        Chip8Arcade.choose reflections
        |> Option.bind (fun index -> reflected |> List.tryItem index)

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

    /// Commit a reflected choice into the parent VM's existing choice cell.
    /// This keeps the meta-cart ABI identical to `Chip8Arcade`: host-side
    /// reflection can assist, but the selected child still crosses the
    /// one-byte choice boundary.
    let commitChoice (choice: ReflectedChoice) (parent: Chip8Cow.Frame) : Chip8Cow.Frame =
        Chip8Arcade.commitChoice choice.Index parent

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
        match chooseSlot goal costPerStep tank seed children with
        | None -> Error(Feedback.NoSelection source)
        | Some choice ->
            let slots = slotsOfCarts children
            let parentWithChoice = commitChoice choice parent

            match playSelected source sink slots host parentWithChoice with
            | Ok play ->
                Ok
                    { Choice = choice
                      ParentWithChoice = parentWithChoice
                      Play = play }
            | Error feedback -> Error feedback

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
