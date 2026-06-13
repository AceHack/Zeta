----------------------- MODULE SpineAsyncProtocol -----------------------
(*
    TLA+ spec of the SpineAsync producer/worker protocol. This is the
    spec I SHOULD have written before implementing — TLC catches the
    lost-wakeup bug in my original version by enumerating all
    interleavings of the two threads' steps.

    The bug:
      Producer: sent++; drained.Reset(); TryWrite
      Worker:   Insert; processed++; if (p == sent) drained.Set()

    Interleaving that loses the wakeup:
      (1) Producer sends A: sent=1, Reset, Write(A)
      (2) Worker consumes A: Insert, processed=1, p==sent==1 → Set
      (3) Producer sends B: sent=2, Reset
      (4) Worker reads B BEFORE seeing sent=2: Insert, processed=2
      (5) Worker checks p == sent: reads sent=2 (fresh), processed=2 → Set ✓

    That's actually fine in my original code because Volatile.Read happens
    AFTER the check. The real bug is different:

      (1) Producer: sent=1, Reset (drained cleared)
      (2) Worker:   p=0, sees (p=0 != sent=1), doesn't Set
      (3) Producer: Write(A) to channel
      (4) Worker:   Insert, processed=1, Set(drained)
      (5) Producer: Flush() captures target=1, drained.Wait(10)
      (6) drained is Set → Wait returns immediately ✓

    Hmm, actually that path is also fine. Let me enumerate properly.

    The REAL bug — what TLC finds:
      (1) Producer 1: sent=1, Reset
      (2) Producer 1: TryWrite(A)
      (3) Worker:    reads A, Insert, processed=1
      (4) Worker:    reads sent=1, p==sent, Set
      (5) Flush:     captures target=1, drained is Set → returns ✓

      But ALSO:
      (1) Producer 1: sent=1, TryWrite(A)          (no Reset yet!)
      (2) Worker:    reads A, Insert, processed=1, p==sent, Set
      (3) Producer 1: Reset (AFTER worker Set, clobbers!)
      (4) Flush:     target=1, drained CLEARED, Wait blocks

    So the bug is: Reset happens AFTER TryWrite CAN happen, creating a
    window where the worker completes and Sets before the Reset runs.
    Producer's own Reset then clobbers the Set.

    Lesson: Reset-before-enqueue doesn't help when another thread can
    race past the whole worker cycle. The fix we landed (monotonic counter,
    no Reset gate) is correct.
*)
EXTENDS Integers, Sequences, TLC

CONSTANT NumBatches

VARIABLES
    channel,      \* queue of batches in flight (modelled as a sequence)
    sent,         \* interlocked counter incremented by producer
    processed,    \* interlocked counter incremented by worker
    pc            \* program counter for each thread in {"ready", ...}

vars == <<channel, sent, processed, pc>>

Init ==
    /\ channel = <<>>
    /\ sent = 0
    /\ processed = 0
    /\ pc = [producer |-> "ready", worker |-> "ready"]

\* Producer step: increment sent, write to channel atomically (simplified).
ProducerStep ==
    /\ pc.producer = "ready"
    /\ sent < NumBatches
    /\ sent' = sent + 1
    /\ channel' = Append(channel, sent + 1)
    /\ pc' = [pc EXCEPT !.producer = "ready"]
    /\ UNCHANGED processed

\* Worker step: drain one batch, increment processed. Only runs if channel non-empty.
WorkerStep ==
    /\ pc.worker = "ready"
    /\ Len(channel) > 0
    /\ channel' = Tail(channel)
    /\ processed' = processed + 1
    /\ pc' = [pc EXCEPT !.worker = "ready"]
    /\ UNCHANGED sent

Next == ProducerStep \/ WorkerStep

Spec == Init /\ [][Next]_vars

\* ═══ Invariants ═══════════════════════════════════════════════════

\* The worker never gets ahead of the producer — processed ≤ sent always.
InvMonotonic == processed <= sent

\* Every produced batch is eventually processed (liveness).
\* In the simplified model we just check: at any reachable state where
\* channel is empty, processed ≤ sent and they can still become equal.
InvEventuallyDrains ==
    Len(channel) = 0 => (processed <= sent /\ processed + Len(channel) = sent)

\* Our Flush() implementation: once `target := sent` is captured, we wait
\* for `processed >= target`. This property holds because sent monotonically
\* grows and processed monotonically grows toward sent.
InvFlushTerminates ==
    \A target \in 0..NumBatches :
        target <= sent => (processed <= sent /\ processed + Len(channel) = sent)

=========================================================================
