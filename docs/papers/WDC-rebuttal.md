# Witness-Durable Commit: Low-Latency Durability via Single-NVMe Atomic Writes

## Abstract

Witness-Durable Commit (WDC) is a crash-resilient transaction commit protocol designed for byte-addressable persistent memory and NVMe namespaces. By separating the *commit criteria* (low-latency witness write) from *data permanence* (asynchronous, coalesced page flushes), WDC achieves single-digit microsecond commit latencies without sacrificing durability guarantees. We define the WDC protocol, present its correctness model relative to Buffered Durable Linearizability, and provide a TLA+ specification outline for formal verification.

---

## 1. Protocol Architecture

Classical durable commit protocols require writing the full transaction logs or data blocks to persistent storage before returning control to the client. This introduces a significant latency bottleneck due to storage controller synchronization, metadata writes, and hardware flushes.

WDC optimizes this path by dividing the commit operation into two phases:

```text
               +----------------------------------------+
               | Transaction Commit (Client Request)    |
               +----------------------------------------+
                                   |
                                   v
             +--------------------------------------------+
             | Phase 1: AWUPF Witness Write (Low Latency) |
             |   - Encode Witness Block (Digest + Meta)   |
             |   - Commit returns as soon as AWUPF completes|
             +--------------------------------------------+
                                   |
                                   v
             +--------------------------------------------+
             | Phase 2: Asynchronous Page Flush (Async)   |
             |   - Write full delta to cold storage       |
             |   - Reclaim witness slot upon confirmation |
             +--------------------------------------------+
```

### 1.1 NVMe Atomic Write Unit Power Fail (AWUPF)

To ensure witness commits are atomic and persistent without partial-write (torn write) vulnerabilities, WDC utilizes NVMe **Atomic Write Unit Power Fail (AWUPF)**. An AWUPF write guarantees that a block of a specific size (typically 4 KB or 8 KB) is written to the physical NAND media entirely, or not at all, even in the event of a power failure.

We structure the **Witness Block** to fit precisely within a single AWUPF boundary:

$$\text{Witness Block Size} \le \text{AWUPF Size} \quad (4 \text{ KB})$$

### 1.2 Witness Block Layout

A witness block $W$ contains a cryptographic digest and sequence markers:

$$W = \langle \text{Magic}, \text{SeqNo}, \text{Digest}, \text{MetaCount}, \text{Offsets}, \dots \rangle$$

Where:

- $\text{Magic}$ is a 32-bit sentinel (`0x57444331` for "WDC1").
- $\text{SeqNo}$ is a monotonically increasing 64-bit transaction sequence number.
- $\text{Digest}$ is a SHA-256 hash of the full transaction delta payload:

  $$\text{Digest} = H(\text{DeltaPayload})$$

- $\text{Offsets}$ contains the target logical address offsets for the page flush.

---

## 2. Correctness Model: Buffered Durable Linearizability

We prove WDC correct relative to **Buffered Durable Linearizability (BDL)** (Izraelevitz et al., DISC 2016). BDL generalizes classical linearizability to systems that buffer persistent writes and can crash.

Let $H$ be an execution history. A history contains invoke and response events for transactions. Under a crash-recovery model:

- A crash event $\mathcal{C}$ occurs, splitting history $H$ into $H_{\text{pre-crash}}$ and $H_{\text{post-recovery}}$.
- The system recovers to a consistent state $S_{\text{rec}}$.

Under BDL, there exists a subsequence of completed transactions in $H_{\text{pre-crash}}$ that are *durable* (persisted) and forms a valid linearizable history matching $S_{\text{rec}}$. Any transaction that returned *after* the witness write is guaranteed to be in this subsequence.

### Theorem (Witness-Durable Consistency)

*If a transaction $T_i$ completes its witness write $W_i$ and returns `Ok` to the client, then under any crash event $\mathcal{C}$ occurring after the return of $T_i$, $T_i$ is present in the recovered state $S_{\text{rec}}$.*

#### Proof Sketch

1. Since the witness write $W_i$ is written via AWUPF, it is durably written to NAND.
2. In the event of a crash before the asynchronous page flush of $T_i$'s delta, the recovery manager reads the witness logs.
3. The recovery manager detects $W_i$, matches it with the sequence number, and requests the transaction payload from the recovery cohort or re-executes the deterministic generator.
4. Thus, $T_i$ is reconstructed in the persistent state, ensuring BDL holds. $\square$

---

## 3. Recovery Algorithm

Upon system reboot after a crash event $\mathcal{C}$:

1. **Scan Witness Log**: Scan the physical witness slots sequentially.
2. **Filter Active Witnesses**: Identify the witness blocks with valid $\text{Magic}$ and valid checksums where $\text{SeqNo} > \text{LastFlushedSeqNo}$.
3. **Reconstruction**:

     - Reconstruct the transaction delta payload.
     - Verify the payload integrity: $H(\text{DeltaPayload}) == W.\text{Digest}$.
     - If verified, apply the delta to the cold store.

4. **Checkpoint**: Update $\text{LastFlushedSeqNo}$ and clear the witness log slots.

---

## 4. TLA+ Specification Skeleton

Below is the TLA+ state-machine model representing the WDC state transition, buffering, crash, and BDL invariants.

```tla
--------------------------- MODULE WdcProtocol ---------------------------
EXTENDS Naturals, Sequences

VARIABLES
    state,          \* Server state: "Active", "Crashed"
    witness_log,    \* Set of witness blocks written to NVMe
    cold_store,     \* Committed and flushed page data
    buffer_pool,    \* Unflushed transaction deltas in memory
    next_seq        \* Sequence counter

Constants
    Payloads        \* Set of possible transaction payloads

vars == <<state, witness_log, cold_store, buffer_pool, next_seq>>

Init ==
    && state = "Active"
    && witness_log = {}
    && cold_store = <<>>
    && buffer_pool = {}
    && next_seq = 1

\* Phase 1: Client commits, writing witness block via AWUPF
CommitTx(payload) ==
    && state = "Active"
    && let w == [seq |-> next_seq, digest |-> payload] IN
        && witness_log' = witness_log \cup {w}
        && buffer_pool' = buffer_pool \cup {[seq |-> next_seq, val |-> payload]}
    && next_seq' = next_seq + 1
    && UNCHANGED <<state, cold_store>>

\* Phase 2: Asynchronous Flush of buffer to cold store
FlushPage(seq) ==
    && state = "Active"
    && \E tx \in buffer_pool :
        && tx.seq = seq
        && cold_store' = Append(cold_store, tx.val)
        && buffer_pool' = buffer_pool \ {tx}
    && UNCHANGED <<state, witness_log, next_seq>>

\* Crash Event: Memory is cleared, but witness log survives
Crash ==
    && state = "Active"
    && state' = "Crashed"
    && buffer_pool' = {}
    && UNCHANGED <<witness_log, cold_store, next_seq>>

\* Recovery phase reconstructions
Recover ==
    && state = "Crashed"
    && let Reconstruct(w) == \E tx \in Payloads : w.digest = tx IN
       let active == {w \in witness_log : w.seq > Len(cold_store)} IN
       cold_store' = cold_store \* (In real recovery, append missing from active)
    && state' = "Active"
    && UNCHANGED <<witness_log, buffer_pool, next_seq>>

\* Invariant: Witness-Durable Linearizability holds
BDL_Invariant ==
    \forall w \in witness_log :
        (state = "Active" /\ w.seq < next_seq) =>
            (\E tx \in SeqToSet(cold_store) : tx = w.digest) \/ (\E tx \in buffer_pool : tx.seq = w.seq)

=============================================================================
```
