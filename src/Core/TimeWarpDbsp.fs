namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices

/// Represents a message in both the Time Warp actor system and the DBSP streams.
[<CustomComparison; CustomEquality>]
type DbspMessageKey =
    { Sender: string
      Receiver: string
      SendTime: int64
      ReceiveTime: int64
      Payload: int64 }

    interface IComparable<DbspMessageKey> with
        member this.CompareTo(other) =
            let c1 = this.ReceiveTime.CompareTo(other.ReceiveTime)
            if c1 <> 0 then c1
            else
                let c2 = this.SendTime.CompareTo(other.SendTime)
                if c2 <> 0 then c2
                else
                    let c3 = this.Sender.CompareTo(other.Sender)
                    if c3 <> 0 then c3
                    else
                        let c4 = this.Receiver.CompareTo(other.Receiver)
                        if c4 <> 0 then c4
                        else this.Payload.CompareTo(other.Payload)

    interface IComparable with
        member this.CompareTo(obj) =
            match obj with
            | :? DbspMessageKey as other -> (this :> IComparable<DbspMessageKey>).CompareTo(other)
            | _ -> invalidArg "obj" "not DbspMessageKey"

    override this.Equals(obj) =
        match obj with
        | :? DbspMessageKey as other ->
            this.ReceiveTime = other.ReceiveTime &&
            this.SendTime = other.SendTime &&
            this.Sender = other.Sender &&
            this.Receiver = other.Receiver &&
            this.Payload = other.Payload
        | _ -> false

    override this.GetHashCode() =
        HashCode.Combine(this.Sender, this.Receiver, this.SendTime, this.ReceiveTime, this.Payload)


/// Explicit Time Warp message type carrying anti-message flags.
type TimeWarpMessage =
    { Sender: string
      Receiver: string
      SendTime: int64
      ReceiveTime: int64
      Payload: int64
      IsAntiMessage: bool }


/// paradigm A: Stateful Time Warp Node (David Jefferson 1985).
/// Optimistically executes messages, keeps a history stack, and rolls back using anti-messages.
type TimeWarpNode(name: string, onSendMessage: TimeWarpMessage -> unit) =
    let stateHistory = ResizeArray<int64 * int64>() // (ReceiveTime, StateValue)
    let messageLog = ResizeArray<TimeWarpMessage>() // Processed messages log
    let sentLog = ResizeArray<TimeWarpMessage>()    // Messages sent log
    let mutable currentState = 0L
    let mutable localTime = 0L

    do
        stateHistory.Add(0L, 0L) // initial state

    member _.Name = name
    member _.CurrentState = currentState
    member _.LocalTime = localTime
    member _.StateHistory = stateHistory |> Seq.toArray
    member _.MessageLog = messageLog |> Seq.toArray
    member _.SentLog = sentLog |> Seq.toArray

    /// Reset node state.
    member _.Reset() =
        stateHistory.Clear()
        stateHistory.Add(0L, 0L)
        messageLog.Clear()
        sentLog.Clear()
        currentState <- 0L
        localTime <- 0L

    /// Receive a message (could be a straggler or an anti-message).
    member this.Receive(msg: TimeWarpMessage) =
        if msg.IsAntiMessage then
            // Jeffersonian anti-message: cancels out the matching positive message
            let matchIdx = messageLog.FindIndex(fun m ->
                not m.IsAntiMessage &&
                m.Sender = msg.Sender &&
                m.SendTime = msg.SendTime &&
                m.ReceiveTime = msg.ReceiveTime &&
                m.Payload = msg.Payload
            )
            if matchIdx >= 0 then
                let orig = messageLog.[matchIdx]
                messageLog.RemoveAt(matchIdx)
                this.Rollback(orig.ReceiveTime)
        else
            messageLog.Add(msg)
            if msg.ReceiveTime < localTime then
                // Straggler message from the virtual "past" triggers rollback
                this.Rollback(msg.ReceiveTime)
            else
                this.ProcessMessage(msg)

    member private this.Rollback(time: int64) =
        // 1. Rollback state to the last snapshot strictly before the rollback point
        let histIdx = stateHistory.FindLastIndex(fun (t, _) -> t < time)
        let rollbackState =
            if histIdx >= 0 then snd stateHistory.[histIdx]
            else 0L

        currentState <- rollbackState
        localTime <- if histIdx >= 0 then fst stateHistory.[histIdx] else 0L

        // Discard all state history snapshots starting from the rollback point
        stateHistory.RemoveAll(fun (t, _) -> t >= time) |> ignore
        if stateHistory.Count = 0 then
            stateHistory.Add(0L, 0L)

        // 2. Send anti-messages to cancel out any incorrect messages sent downstream
        let toCancel = sentLog |> Seq.filter (fun m -> m.SendTime >= time) |> Seq.toArray
        sentLog.RemoveAll(fun m -> m.SendTime >= time) |> ignore

        for m in toCancel do
            let anti = { m with IsAntiMessage = true }
            onSendMessage(anti)

        // 3. Re-process remaining non-cancelled messages in chronological order
        let remaining =
            messageLog
            |> Seq.filter (fun m -> m.ReceiveTime >= time)
            |> Seq.sortBy (fun m -> m.ReceiveTime)
            |> Seq.toArray

        messageLog.RemoveAll(fun m -> m.ReceiveTime >= time) |> ignore

        for m in remaining do
            messageLog.Add(m)
            this.ProcessMessage(m)

    member private this.ProcessMessage(msg: TimeWarpMessage) =
        localTime <- msg.ReceiveTime
        currentState <- currentState + msg.Payload
        stateHistory.Add(localTime, currentState)

        // Downstream propagation: if this node is not the final sink,
        // send a transformed message downstream.
        if name <> "sink" then
            let forwardMsg = {
                Sender = name
                Receiver = "sink"
                SendTime = localTime
                ReceiveTime = localTime + 2L // latency
                Payload = msg.Payload * 2L // transformation payload
                IsAntiMessage = false
            }
            sentLog.Add(forwardMsg)
            onSendMessage(forwardMsg)


/// paradigm B: DBSP Retraction Model.
/// Accumulates input Z-sets over time. Retractions are simple addition of negative-weight Z-sets.
type DbspNodeState(name: string) =
    let mutable accumulatedInputs = ZSet<DbspMessageKey>.Empty

    member _.Name = name
    member _.AccumulatedInputs = accumulatedInputs

    member _.Reset() =
        accumulatedInputs <- ZSet<DbspMessageKey>.Empty

    /// Receive a Z-set of new messages/retractions.
    member _.Receive(zset: ZSet<DbspMessageKey>) =
        accumulatedInputs <- accumulatedInputs + zset

    /// Computes the node's state at a specific virtual time T.
    member _.GetStateAt(t: int64) =
        let mutable sum = 0L
        for (entry: ZEntry<DbspMessageKey>) in accumulatedInputs do
            if entry.Key.ReceiveTime <= t then
                sum <- sum + (entry.Key.Payload * entry.Weight)
        sum

    /// Downstream projection: Maps inputs to downstream Z-sets (linear operator).
    member _.ProjectDownstream() : ZSet<DbspMessageKey> =
        if name = "sink" then
            ZSet<DbspMessageKey>.Empty
        else
            let mappedEntries =
                accumulatedInputs
                |> Seq.map (fun (entry: ZEntry<DbspMessageKey>) ->
                    let key = entry.Key
                    let mappedKey = {
                        Sender = name
                        Receiver = "sink"
                        SendTime = key.ReceiveTime
                        ReceiveTime = key.ReceiveTime + 2L
                        Payload = key.Payload * 2L
                    }
                    ZEntry(mappedKey, entry.Weight)
                )
                |> Seq.toArray
                |> ImmutableArray.CreateRange
            ZSet<DbspMessageKey>(mappedEntries)
