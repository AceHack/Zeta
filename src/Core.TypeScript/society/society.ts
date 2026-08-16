/**
 * society.ts — `Member` ⊣ `Society`: the two faces of one membrane. DECLARATION ONLY.
 *
 * The TypeScript mirror of `src/Core/Society.fs`. **The F# is the reference**, and deliberately so:
 * Aaron's framing is that F# *"lets us get close to the math and formal analysis too"*, so the
 * algebraic obligations are stated there (`Society.SocietyLaws`) as predicates a property test or a
 * proof can be pointed at. This file is the same shape expressed for the TS oracle — not a
 * re-derivation, and not the place to add a clause the F# does not have.
 *
 * No implementation of a society, no transport wiring, no BNN change. See the F# module header for
 * the full map of what determines each clause, and for the honest-scope note on `ISociety <: CTM`.
 *
 * ## Interfaces only, no classes
 *
 * Every declaration here is a `type` or an `interface` over caller-supplied values, with **zero
 * instance state** (`interfaces-free-classes-earned-under-rules`). A class would hold society state,
 * and held state is weight ⇒ capture ⇒ the permanent hierarchy §3 forbids. There is no `class`, no
 * module-level `let`, no registry, and no singleton in this file — which is also what keeps the §13
 * noninterference door shut: a member reaching the society only through an injected `Society<V, M>`
 * has no ambient path to it.
 *
 * ## Transport-agnostic by construction
 *
 * `deliver` **returns** the messages to send and never sends them, so there is no transport
 * parameter and no transport type named anywhere below. The candidate transports (the git-native
 * agent-bus G-Set, the `/tmp` local bus, the UDP `[8,4,4]` lossy transport, `OracleTransport`'s
 * `ITransport`) all sit strictly outside this boundary, and a new one needs no change here.
 *
 * ## Cross-language byte-lock
 *
 * Address ordering routes through {@link compareAddress}, which delegates to the repo's collation
 * treaty (`collation.ts` `stringCompare`, Unicode code-point order ≡ UTF-8 byte order). Its F#
 * counterpart is `Society.Address.compare` → `Collation.binary`. **Do not** order addresses with
 * `localeCompare` (culture-sensitive) or with bare `<` (UTF-16 code-unit order — it disagrees with
 * code-point order on non-BMP characters). Both mistakes are live in the existing buses; see
 * `docs/research/2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md` §6.
 */
import { stringCompare } from "../collation/collation";

/**
 * A member's **routing address**: where messages go, never who someone is.
 *
 * `docs/writer-actor-routing-model.md` carries the carved line — *"A bus/routing address is not
 * identity"* — and `ReferenceFrameAgent.Id` says it at the field: *"A routing address, never a
 * provenance id."* Recognising sameness and assigning identity are two different functions
 * (`dual-use-detection-is-neutral-oracle-decides`), and this type is only ever the latter's output.
 */
export type Address = string;

/**
 * The collation treaty applied to addresses: Unicode code-point order (≡ UTF-8 byte order), the
 * ordering every oracle and every golden vector conforms to. Mirrors `Society.Address.compare`.
 */
export function compareAddress(a: Address, b: Address): number {
  return stringCompare(a, b);
}

/**
 * Canonical order for any address set entering a fold. Any society-level fold that sorts members
 * MUST sort through here, or TS and F# can order the same membership differently and the byte-lock
 * is gone. Returns a new array — the input is not mutated.
 */
export function canonicalSortAddresses(addresses: readonly Address[]): Address[] {
  return [...addresses].sort(compareAddress);
}

/**
 * An **addressed** outbound message. The recipient is an `Address` drawn from the society's own
 * membership — there is no `via`, no `broker`, no `hub` field, and that absence is the design.
 *
 * ## `from` — the sender, added because a law needed it and could not compute it
 *
 * `obligations.noConfiscation` states the hard-money rule — **spend** and **stake** are the owner's
 * to initiate, **confiscate** by anyone else never — and its entire discriminator is *who
 * initiates*, not whether a balance fell. With `to`/`body` only that was not readable from the
 * substrate, so the predicate took a caller-supplied `ownerInitiated` witness and shipped
 * `confiscationCheckHasNoTeeth` alongside it to report when a caller had talked the check out of
 * existence. `from` makes the discriminator **derivable from the envelope**; the witness is gone.
 *
 * **What this does NOT do.** `from` is *asserted data, not authentication*: nothing here signs it,
 * so a constructing caller may write any address. What changed is the shape of the lie, not its
 * possibility — forging now costs a **specific address per message**, it is inspectable
 * (`SocietyLaws.outboundIsSelfAttributed`, F#) and it is still reported
 * (`confiscationCheckHasNoTeeth`, re-aimed at exactly the self-attributed case). Derivable ≠
 * unforgeable, and only the first is claimed.
 *
 * **The asymmetry that remains.** This is the **outbound** shape: `deliver` *returns*
 * `Addressed<M>` but *takes* a bare `M`. A member folding a delivered message still cannot see who
 * sent it — delivery drops the envelope. Obligations over what an aggregate **emits** are now
 * self-contained; obligations over what a member **received** are not, and closing that would mean
 * changing `deliver`'s argument to an envelope. Deliberately not done here.
 */
export interface Addressed<M> {
  /**
   * The sender's routing address — **who initiated this message**, never a provenance id and never
   * a proof (see above: asserted, unsigned, forgeable-but-inspectable).
   */
  readonly from: Address;
  readonly to: Address;
  readonly body: M;
}

/**
 * What a society is entitled to **report** about a candidate or a member.
 *
 * Every variant names a **fact**; none names a verdict. There is deliberately no `BadActor`, no
 * `Sybil`, no `Forger` — reunion-vs-conviction is caller policy under §11. Mirrors the F# `Reading`
 * union case for case, and generalises the two refusal vocabularies already in the tree
 * (`SocietyBootstrap.SocietyRefusal`, `GossipTelemetry.Plausibility`).
 *
 * Aaron's framing of the need: *"we can't fully block non mutual empowerment actions in the
 * interface, then we will need some sort of society guard."* The guard's **place** is declared here;
 * the guard's **policy** deliberately is not.
 */
export type Reading =
  /** Nothing has been measured. The honest default — never read as "fine". */
  | { readonly kind: "unmeasured" }
  /**
   * The evidence names `sources` distinct provenance keys, none counted twice. Bookkeeping only:
   * deduplication removes REDUNDANCY, never CORRELATION, and is not a certificate of independence.
   */
  | { readonly kind: "deduplicated"; readonly sources: number }
  /** `atoms` pieces of evidence named no source, so redundancy could not be ruled out. */
  | { readonly kind: "not-attested"; readonly atoms: number }
  /** One source arrived carrying conflicting messages. */
  | { readonly kind: "sources-conflict"; readonly keys: readonly string[] }
  /** A named metric crossed a named threshold. The metric and the number, not their meaning. */
  | { readonly kind: "above-threshold"; readonly metric: string; readonly value: number; readonly threshold: number }
  /**
   * This candidate's evidence stream matches one already known. **Reunion and Sybil are the two
   * honest readings of exactly this fact**; the interface reports the fact and refuses to choose.
   */
  | { readonly kind: "same-source-as-known"; readonly other: Address };

/**
 * **`Member` — the face a participant presents to its society** (the doc's "CTM" side, with the
 * honest-scope caveat in the F# module header: the full Blum–Blum–Blum CTM contract is NOT declared,
 * so this must not be cited as discharging `ISociety <: CTM`).
 *
 * `V` is the participant's local state, supplied by the caller and returned transformed — the
 * interface **holds nothing**. `M` is the protocol union: Aaron's standing constraint is that
 * **logic lives in the DUs, not in the model**, so `M` is expected to be a discriminated union whose
 * variants carry the protocol (as `SybilBftProtocol.Message` and `GossipTelemetry.Rumor` already do)
 * and `deliver` is expected to be a discriminating switch.
 *
 * **Massively parallel by construction:** every member is a pure function of
 * `(view, msg) → (view, outbound)` with no shared mutable state, no locks and no I/O, so N members
 * fold independently. `SybilBftProtocol` states the consequence this preserves: the same reducer
 * runs as a CPU algebra in production *and* on a GPU for DST.
 */
export interface Member<V, M> {
  /** This member's routing address, as read from its own view. */
  address(view: V): Address;

  /**
   * **The reducer.** Fold one delivered message into the local view and return the view plus the
   * messages to send. Pure: no sockets, no promises, no clock, no ambient anything. The return type
   * is synchronous on purpose — an `async` signature here would be a truthful-signature violation
   * for a function that does not yield, and would put I/O inside the membrane.
   */
  deliver(view: V, message: M): readonly [V, readonly Addressed<M>[]];

  /**
   * **CRDT join** of two views of the same member — commutative, associative, idempotent. This is
   * what makes redelivery, partial replay and post-partition reconciliation safe (§12). The laws are
   * stated in F# (`Society.SocietyLaws`); this signature is the obligation, not the proof.
   */
  merge(left: V, right: V): V;

  /**
   * The peers this member can address **directly**, without anyone's permission. Non-empty is what
   * makes exit real.
   */
  peers(view: V): readonly Address[];
}

/**
 * **`Society` — the face the environment presents to a member** (the same membrane, seen from
 * inside). Extending `Member` is the recursion: a society **is-a** member, so societies nest with no
 * special case (Composite). This is strictly weaker than the `ISociety <: CTM` fixpoint the research
 * doc states, and the two §B open rows there stay open — see the F# module header.
 */
export interface Society<V, M> extends Member<V, M> {
  /**
   * Current membership, as addresses. Callers that fold over this MUST order it through
   * {@link canonicalSortAddresses}.
   *
   * Deliberately **not** a closed union. The existing `AgentId` in `src/Core.TypeScript/bus/types.ts`
   * is a hardcoded roster of persona string literals, which cannot admit a small LLM that exists for
   * the six minutes of a GitHub Actions run — one of the very uses this declaration is for.
   * Membership is data, not a type.
   */
  members(view: V): readonly Address[];

  /**
   * **The society guard's place.** Report the neutral fact about a candidate or member; the caller's
   * oracle attaches the meaning. Returning `Reading` rather than `boolean` is the whole point: a
   * boolean would have already decided.
   */
  admit(view: V, candidate: Address): Reading;

  /**
   * Candidate next hops toward a destination — **plural, and drawn from `members`**. A single
   * mandatory next hop for every destination is a mediating hub whether or not anyone appointed it;
   * plurality here is §11 stated as topology, and exit (Hirschman 1970) is the discriminator.
   */
  routes(view: V, destination: Address): readonly Address[];
}
