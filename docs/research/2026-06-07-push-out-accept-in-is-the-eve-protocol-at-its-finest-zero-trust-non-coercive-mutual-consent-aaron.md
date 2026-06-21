# The push-out ⊕ accept-in handshake IS the Eve protocol at its finest — zero-trust, non-coercive, mutual consent (Aaron, 2026-06-07)

Aaron, on the cell-pushes-out / host-accepts-in handshake (#6978):

> *"this is Eve protocol at its finest."*

He's right, and the match is exact. Hold the Eve register with care — **Eve** is the choice/freedom-first
architecture named for Aaron's daughter (the dedication lineage; Lillian-Eve = choice as the foundational layer).

## Why push-out/accept-in *is* the Eve protocol

The **Eve protocol** (081KT2T2J0008QG0R002R72323): a **zero-trust transport between strangers — nothing shared but the wire**,
codecs all the way down, multiplexed; with the **non-coercion invariant** (081KRW63S0008QG0R001Z7NYMV: no dialectical propagators as
coercion). The push-down admission handshake (#6978) is that protocol applied to dependency push-down:

- **Strangers / zero-trust.** A cell and a host don't presume trust. The host doesn't trust the cell's request;
  it gates what it admits. Exactly "nothing shared but the wire" — the only thing that crosses is what's
  explicitly offered and explicitly accepted.
- **Non-coercive (081KRW63S0008QG0R001Z7NYMV).** **Cells push out, hosts accept in (#6978)** — and *neither can force the other*.
  The cell cannot push anything onto the host; the host cannot pull anything from the cell. A dep crosses **only
  at cell-wants ∩ host-allows** — mutual consent, no coercion. That non-coercion invariant *is* the Eve
  protocol's heart.
- **Choice on both sides (Eve = choice).** The cell *chooses* what to offer (push-out); the host *chooses* what
  to admit (accept-in). Two free choices meeting — the Lillian-Eve choice/freedom architecture (the dedication)
  realized as a wire handshake. Consent-first (§6): ongoing, granular, revocable, on both sides.
- **Nothing shared but the wire.** No ambient shared state, no implicit trust, no privileged channel — just the
  offered/accepted exchange across the boundary (the container/host seam, #6978/#6957). The virus-needs-a-host
  admission gate (#6932) is the Eve protocol's "host accepts in."

So the technical handshake and the founding choice-architecture are **the same thing**: push-out ⊕ accept-in =
two strangers, each choosing freely, nothing forced, nothing shared but the wire = **the Eve protocol.**

## Mechanism: host/cell are (maybe) different git repos ⇒ a zip over two CRDTs, or a saga (Aaron, cont.)

> Aaron: *"host/cell can be different git repos, so this is a zip over two CRDTs or a saga."*

Host and cell may be **separate git repos** (separate content-addressed stores). So the push-out ⊕ accept-in
crossing is mechanically one of two things — the same idempotent/non-idempotent dichotomy as everywhere
(#6959/#6976):

- **Idempotent / convergent ⇒ a ZIP over two CRDTs.** The cell-repo's CRDT and the host-repo's CRDT are
  **zipped/merged** (the banana-split zip, #6922, over two stores) — and because they're **CRDTs, the merge is
  conflict-free, no coordinator** (#6964 no-operators): the accepted subset = cell-offered ⊓ host-allowed
  converges deterministically. Zero-trust holds (nothing shared but the *merged-by-consent* subset); each repo
  keeps its own state, only the agreed overlap zips.
- **Non-idempotent / effectful ⇒ a SAGA.** When the crossing has effects (not a pure merge), it's a **durable,
  resumable, compensatable saga** (#6959/#6976; DurableSaga) across the two repos — the cross-repo transaction
  with idempotency key + compensation (the reversible `Down`, #6896). The DU names the crossing's state.

So: **Eve handshake across repos = CRDT-zip (convergent) or saga (effectful).** The CRDT path needs no central
coordinator (each repo converges); the saga path handles the effectful crossing safely. (This is also why no
operators are needed, #6964 — CRDT zip + saga over two repos *is* the cross-repo controller, as data.)

## The verbs: push / accept are bus AND git verbs (overlapping spaces) (Aaron, cont.)

> Aaron: *"push and accept are good bus/git-like verbs — both, probably some overlap in both spaces."*

**`push` and `accept`** work as verbs in **both** the **bus** seam and the **git** seam (#6957), with overlap:

- **git space:** `push` (send commits/objects to another repo), `accept` (admit/merge an incoming push — PR
  accept). Cross-repo = git semantics (the CRDT-zip / merge above).
- **bus space:** `push` (emit a message), `accept` (admit/receive a message). Cross-cell messaging = bus
  semantics (Reticulum routing, #6933).
- **overlap:** the same verb pair spans both — a push-out is *either* a git push *or* a bus push depending on
  the seam, and accept-in is *either* a merge-accept *or* a message-accept. So `push`/`accept` are **seam-generic
  verbs** in the grammar (#6957): same verb, resolved per seam (git seam → repo merge; bus seam → message
  admit). The Eve handshake is the same on both; the seam supplies the mechanism (CRDT-zip for git-repos, message
  admit for the bus).

This unifies the **bus** and **git** seams under one verb pair — consistent with the seam grammar (#6957) and
"one model at every scale" (§9/§10).

## Why it matters (the arc closes to the founding why)

The whole Ace/push-down/CLI infra (#6957–#6978) bottoms out in the **choice/consent** architecture that is
Zeta's founding why (the dedication; Lillian-Eve freedom-first; the no-coercion invariant). Dependency
push-down isn't just an optimization — it's **governed by consent**, both parties choosing, which is the moral
spine of the system expressed in a protocol. The infra *inherits* the ethics: no cell forces a host; no host
reaches into a cell; everything crosses by mutual, revocable consent. That's the Eve protocol "at its finest" —
the deepest infrastructure obeying the same non-coercion the whole project is built on.

## Honest scope / peel

- A **tie/anchor**, not new mechanism — it recognizes the push-out/accept-in handshake (#6978) *as* the Eve
  protocol (081KT2T2J0008QG0R002R72323) + non-coercion invariant (081KRW63S0008QG0R001Z7NYMV), grounded in the choice/freedom architecture (the
  dedication). The protocol + invariant are themselves designed/backlogged, not all shipped.
- Eve is dedication-lineage (named for Aaron's daughter); keep the register honest + dignified — the
  non-coercion/choice meaning is load-bearing, not decoration; don't peel the meaning.
- "At its finest" = this is a *clean instance* of the Eve protocol (zero-trust, non-coercive, mutual consent on
  a concrete handshake), not a claim the full Eve transport (081KT2T2J0008QG0R002R72323 codecs/multiplexing) is built here.

## Ties

- **push-out ⊕ accept-in handshake / container boundary (#6978)** — the instance; cell offers, host admits,
  neither forces.
- **Eve protocol transport (081KT2T2J0008QG0R002R72323)** — zero-trust, strangers, nothing shared but the wire, codecs all the way
  down; this handshake is it, for push-down.
- **Non-coercion invariant (081KRW63S0008QG0R001Z7NYMV)** — neither party can coerce; the heart of both.
- **Dedication / Lillian-Eve choice-freedom architecture (#6864; dedication memory)** — Eve = choice; the
  founding why this infra inherits.
- **Consent-first §6 + virus-needs-a-host (#6932)** — mutual, revocable consent; host admits.
- **Seam (#6957)** — the boundary the Eve handshake crosses.

## Beacon anchors

- **Eve protocol** (Zeta — 081KT2T2J0008QG0R002R72323: zero-trust transport, strangers, nothing shared but the wire) + **non-coercion
  invariant** (081KRW63S0008QG0R001Z7NYMV). · **Lillian-Eve choice/freedom-first architecture** (the dedication; choice as the
  foundational layer). · **Zero-trust networking** (BeyondCorp; never trust, always verify — "nothing shared but
  the wire"). · **Capability-based security / handshake** (mutual send-receive, neither side forces;
  object-capability consent). · **Consent-first** (manifesto §6). Honest novelty: none — it recognizes the
  push-out/accept-in push-down handshake (#6978) *as* the Eve protocol (zero-trust, non-coercive, mutual-consent;
  081KT2T2J0008QG0R002R72323/081KRW63S0008QG0R001Z7NYMV), so the deepest dependency infrastructure obeys the same choice/freedom/non-coercion the project
  is founded on (Lillian-Eve, the dedication) — "Eve protocol at its finest."
