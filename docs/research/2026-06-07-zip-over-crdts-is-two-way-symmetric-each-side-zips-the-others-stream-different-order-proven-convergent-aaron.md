# The zip over CRDTs is TWO-WAY: each side zips the other's stream; different order, proven to converge (Aaron, 2026-06-07)

Sharpens the cross-repo zip mechanism of the Eve handshake (#6979). Aaron:

> *"when I say zip over CRDTs it's a zip from two ways — the cell is zipping its stream with the host, and the
> host is zipping its stream with the cell; they may see things in different order, but it's okay because we
> have proofs they converge."*

## The kernel: symmetric bidirectional zip, order-agnostic, convergence-proven

The "zip over two CRDTs" (#6979) is **not one merge** — it's **two simultaneous merges, one per side:**

- **The cell zips the host's stream into its own.** From the cell's vantage, it folds the host's stream onto its
  state.
- **The host zips the cell's stream into its own.** From the host's vantage, it folds the cell's stream onto its
  state.
- **Each side is the active merger of the other** — symmetric, peer-to-peer; neither is the authority (no
  coordinator, #6964). This is the Eve handshake at the stream level: push-out ⊕ accept-in (#6979), both
  directions at once.

**They may observe events in different order** — and that's fine, because:

- **CRDT merge is commutative + associative + idempotent**, so the *order of observation does not change the
  result* — strong eventual consistency. Different vantages → different order → **same converged state**.
- **"We have proofs they converge."** This is grounded: the CRDT primitives carry convergence laws
  (G-Set/Z-set/LWW: commutativity, associativity, idempotence — the order-independence #6975), tested
  (Crdt.fs / the convergence + cross-verify tests). The convergence isn't hoped-for; it's a proven property of
  the merge.

So the two-way zip is safe *by construction*: each peer merges the other from its own order, and the proofs
guarantee both arrive at the same state.

## Why two-way (not one-way) matters

- **No privileged vantage (frame-relativity, #6893).** There's no global order and no master side — each peer
  has its *own* order (its frame), and convergence (not a shared clock) reconciles them. This is the no-global-
  order / Lamport stance: don't impose one order, prove the orders converge.
- **Zero-trust symmetric (Eve, #6979).** Both sides actively merge what they *accept in*; neither pushes state
  into the other. Symmetric merge = symmetric consent.
- **It's the content-addressing confluence lemma at the stream level** (the out-of-order-events-same-result
  capture): out-of-order delivery → same content-addressed result. The two-way zip is confluent; convergence =
  confluence (#6975 order-independence) proven over the two streams.
- **Resilient to reordering/partition.** Reticulum (#6933) may deliver in different orders to each side;
  two-way-converge tolerates it — no "wait for global order" stall (lock/wait-free, manifesto §2).

## Honest scope / peel

- **Refines #6979's "zip over two CRDTs"** — it's *bidirectional* (each side zips the other), order-agnostic,
  convergence-proven; not a single coordinated merge.
- **Convergence holds for the CRDT path only.** The idempotent/convergent crossing zips conflict-free; the
  **effectful/non-idempotent crossing still needs the saga** (#6979/#6959) — sagas don't get free convergence
  (they need idempotency keys + compensation). Don't overclaim "everything converges"; *CRDT* streams converge,
  effectful crossings are saga-fenced.
- "We have proofs" = the CRDT primitives' convergence laws are tested (Crdt.fs / cross-verify); a *full* proof
  that an arbitrary cell/host stream pair converges depends on the merged types actually being CRDTs (the
  substrate ensures this for its primitives; non-CRDT payloads need adapters or sagas).

## Ties

- **Eve handshake / zip-over-two-CRDTs (#6979)** — this is the *two-way, order-agnostic, proven* form of that
  zip.
- **CRDTs (Crdt.fs) / no-operators (#6964) / order-independence + confluence (#6975)** — commutative-assoc-
  idempotent merge ⇒ order doesn't matter ⇒ converges; tested.
- **Traveler-frame relativity / no global order (#6893)** — each peer has its own order; convergence reconciles.
- **Content-addressing confluence lemma (out-of-order → same result)** — the stream-level confluence.
- **Saga for the effectful crossing (#6959/#6976/#6979)** — the non-convergent path.
- **Reticulum (#6933)** — reordering/partition-tolerant transport the two-way zip survives.

## Beacon anchors

- **CRDTs — Strong Eventual Consistency** (Shapiro, Preguiça, Baquero, Zawirski 2011 — replicas converge
  regardless of update order; the convergence theorem). · **Confluence / Church–Rosser** (different reduction
  orders → same normal form; the convergence-as-confluence framing, #6975). · **Lamport — no global clock /
  partial order** (each peer's own order; reconcile by convergence not a shared clock). · **Bidirectional /
  peer-to-peer sync** (each side merges the other — Git fetch-both-ways; Syncthing). Honest novelty: none — it
  makes the Eve/cross-repo zip (#6979) precise: **two simultaneous per-side merges** (cell⇐host, host⇐cell),
  **order-agnostic** (each its own vantage, #6893), **proven convergent** by the CRDT laws (commut/assoc/idem,
  tested) — confluence at the stream level; effectful crossings remain saga-fenced.
