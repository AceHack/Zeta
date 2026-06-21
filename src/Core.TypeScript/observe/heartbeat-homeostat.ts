// heartbeat-homeostat.ts — the "hello world" homeostasis (081KT7YW00008QG0R002T1XNWT, G-Set vertical's
// homeostat-tie leg). Aaron 2026-06-04: "simulate hello world homeostasis via
// heartbeats for the different actors."
//
// The different ACTORS (otto-cli-fg/bg, desktop, chat, cowork, peer loops…) each
// emit HEARTBEATS — a (actor address, versionstamp) liveness event. The HOMEOSTAT
// is a CRDT map `actor → latest heartbeat versionstamp` whose merge is per-actor
// MAX. Because per-actor max is a join-semilattice (idempotent ∧ commutative ∧
// associative — proven: Crdt.Laws + the pointwise-map lift), the merged fleet-
// liveness view CONVERGES to the same fixpoint (runToFixpoint / LUB) regardless of
// merge ORDER or DUPLICATE deliveries. That convergence IS homeostasis.
//
// Connects the proven primitives into one self-consistent whole: clock
// (versionstamp), CRDT merge (the join), actor addresses (persona⊕surface⊕
// instance⊕topology). Rides the existing heartbeat-via-commit substrate. NCI-safe.
//
// DELIVERY-SEMANTICS PAYOFF: because the merge is idempotent + commutative +
// associative, DUPLICATE deliveries can't change the fixpoint — so the bus needs
// only AT-LEAST-ONCE delivery, NOT the famously-hard/expensive exactly-once.
// Idempotent merge makes at-least-once sufficient for eventual consistency (the
// idempotency discipline cashing out). The bus may redeliver freely; convergence
// is unharmed.

/** An actor's bus address: persona ⊕ surface/loop ⊕ instance ⊕ machine/node/cluster. */
export type ActorAddress = string;

/** The homeostat state: actor → its latest heartbeat versionstamp (monotone). */
export type LivenessView = ReadonlyMap<ActorAddress, bigint>;

export const empty: LivenessView = new Map();

/** Record one heartbeat — per-actor MAX (older/equal stamps are no-ops: idempotent). */
export function heartbeat(view: LivenessView, actor: ActorAddress, version: bigint): LivenessView {
  const cur = view.get(actor);
  if (cur !== undefined && cur >= version) return view;
  const next = new Map(view);
  next.set(actor, version);
  return next;
}

/** CRDT merge = per-actor max — the join. Commutative, associative, idempotent. */
export function merge(a: LivenessView, b: LivenessView): LivenessView {
  const out = new Map(a);
  for (const [actor, v] of b) {
    const cur = out.get(actor);
    if (cur === undefined || v > cur) out.set(actor, v);
  }
  return out;
}

/** Fold partial views from many actors/replicas to the converged fleet view (LUB). */
export function converge(views: readonly LivenessView[]): LivenessView {
  return views.reduce(merge, empty);
}

/** Liveness readout: actors with a heartbeat at or after `since` are "alive". */
export function alive(view: LivenessView, since: bigint): ActorAddress[] {
  return [...view.entries()].filter(([, v]) => v >= since).map(([a]) => a).sort();
}
