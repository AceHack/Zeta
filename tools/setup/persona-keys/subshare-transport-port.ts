// subshare-transport-port.ts — THE PORT. What a subshare channel must provide,
// stated independently of any channel that might provide it.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// WHAT THIS UNBLOCKS
// ============================================================================
//
// frost-reshare.ts header caveat 2: "SUBSHARE TRANSPORT IS CONFIDENTIAL-OR-BUST,
// AND THIS MODULE DOES NOT PROVIDE THE TRANSPORT ... a three-house ceremony must
// not be attempted until the confidential channel exists."
//
// This file is the contract half of that channel. subshare-envelope.ts is the
// one working implementation of everything the contract says must sit ABOVE the
// port; subshare-spool-adapter.ts is the one working implementation of the port
// itself. The contract outlives both.
//
// ============================================================================
// WHY A PORT AND NOT A WIREGUARD INTEGRATION
// ============================================================================
//
// Aaron 2026-08-14: "we will likely use our own alternative to wireguard based on
// my tcp hole punching and websocket reverse tunneling and dht transport
// eventually ... this should be a hexagonal interface, we don't want to fully
// depend on wireguard interfaces, we need our own ports."
//
// The rule version is interfaces-free-classes-earned-under-rules.md: the
// interface is the free default, a concrete implementation is earned. So the
// five properties below are stated as requirements ON THE PORT. WireGuard's
// coverage is adapter detail, recorded in the `wireguardCoverage` field of each
// property because it is load-bearing for the decision to build the envelope --
// not because WireGuard is the contract.
//
// The consequence is sharp and it decides where code lives: everything WireGuard
// does NOT cover lives ABOVE the port, in the envelope, never inside an adapter.
// If cross-session replay resistance lived in a WireGuard adapter, a DHT adapter
// would have to reimplement it and would get it subtly different.
//
// ============================================================================
// THE BASELINE IS STORE-AND-FORWARD, NOT A SESSION
// ============================================================================
//
// A DHT transport has no session. Reticulum and LoRa are closer to store-and-
// forward than to a tunnel. Sneakernet is store-and-forward by definition. So
// the port's baseline is EVENTUAL DELIVERY: no live session, no ordering, no
// exactly-once, no rendezvous. `offer` may be called when the recipient does not
// exist yet; `collect` may return nothing, may return duplicates, may return
// anything in any order. Live connectivity is an adapter CAPABILITY, advertised
// and never depended on.
//
// FROST makes this affordable rather than merely tolerable: subshares are SUMMED
// (reshareCombine), and addition is commutative and associative, so the fold has
// no order to preserve. What the ceremony needs is COMPLETENESS (exactly one
// subshare per contributor -- reshareCombine enforces it), not order.
//
// TWO THINGS THE SESSIONLESS BASELINE COSTS, both paid locally, neither by the
// channel -- these are the constraints on any future adapter:
//
//   1. The RECIPIENT must have durable local storage, because replay resistance
//      without a session is a seen-log (ReplayGuard) rather than a sequence
//      window. The channel needs no memory; the recipient does.
//   2. The ceremony has TWO asynchronous phases, because forward secrecy without
//      a session needs the recipient's per-ceremony KEM public key published
//      BEFORE holders seal. That is a happens-before at the application layer,
//      not liveness: both phases can be sneakernet, days apart.
//
// No property below requires a session. Stated plainly so that a DHT/hole-punch
// adapter can be built against this file without discovering a hidden tunnel
// assumption late.
//
// Disciplines: TEXT wire, hex-in-JSON (no-binary-in-proof-lineage); the fold is
// order-independent + duplicate-tolerant (§12 idempotency, §7 DST); the port is
// the only door the ceremony's entropy crosses (§13 noninterference); pure
// interfaces, no classes (interfaces-free-classes-earned).
//
// Anchors (Beacon): Cockburn, "Hexagonal Architecture / Ports and Adapters"
// (2005) -- the port/adapter split. Needham & Schroeder (1978) + Denning & Sacco
// (1981) -- replay of a recorded key-distribution message is the classical
// attack this file's P3 exists for. Gunther (1990) / Diffie, van Oorschot &
// Wiener (1992) -- forward secrecy. Marlinspike & Perrin, X3DH (2016) -- the
// published-prekey construction that buys forward secrecy WITHOUT liveness,
// which is the only reason P4 and P5 can both hold. Goguen & Meseguer (1982) --
// noninterference.

import type { ReshareSubshare } from "./frost-reshare.ts";

/**
 * Ordinal string comparison, and NOT `localeCompare`.
 *
 * Lives in the port because every layer above and below needs it and none of
 * them may disagree: canonical JSON key order, spool file order and replay-guard
 * serialisation all feed signed or replayed bytes. A linguistic comparison
 * orders differently per locale, so a signature made on one host would fail to
 * verify on another (culture-invariant-by-default.md).
 */
export function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ============================================================================
// THE WIRE UNIT
// ============================================================================

export const SUBSHARE_DATAGRAM_SCHEMA = "zeta.frost.subshare-datagram.v1";

/**
 * One sealed subshare in flight.
 *
 * `body` is opaque self-protecting text. The port MUST NOT interpret it, and no
 * adapter may require it to be anything but a string -- that is what lets the
 * same datagram ride a WireGuard mesh, a DHT put, a Reticulum text frame, or a
 * USB stick without re-encoding.
 *
 * The exterior fields (`ceremonyId`, `fromX`, `toX`) are ROUTING HINTS and are
 * UNAUTHENTICATED. They exist so an adapter can address a datagram without
 * opening it. The security layer re-derives all three from the authenticated
 * interior and rejects any datagram whose exterior disagrees. This is
 * writer-actor-routing-model.md at wire level: a routing address is not
 * identity, so the exterior never decides anything.
 */
export interface SealedDatagram {
  readonly schema: string;
  readonly ceremonyId: string;
  readonly fromX: number;
  readonly toX: number;
  readonly body: string;
}

/** Where a datagram is collected from: one new participant in one ceremony. */
export interface CeremonyAddress {
  readonly ceremonyId: string;
  readonly toX: number;
}

// ============================================================================
// THE PORT
// ============================================================================

/**
 * What an adapter may advertise. NONE of these may be depended on by the
 * ceremony -- they exist so an operator can pick a carrier, and so a future
 * adapter can say honestly what it is. A conformance run treats every one of
 * them as false.
 */
export interface AdapterCapabilities {
  /** Can both ends be online at once? Irrelevant to correctness; nice for latency. */
  readonly liveSession: boolean;
  /** Does the carrier preserve order? The ceremony does not care (the fold commutes). */
  readonly orderedDelivery: boolean;
  /** Does the carrier suppress duplicates? The ceremony tolerates them (idempotent open). */
  readonly deduplicates: boolean;
  /** Does the carrier hide who-talked-to-whom from a network observer? WireGuard: yes. */
  readonly metadataConcealment: boolean;
  /** Does the carrier survive with no IP connectivity at all (sneakernet, LoRa)? */
  readonly offlineCapable: boolean;
}

/**
 * THE PORT. Two verbs, both total, neither promising anything.
 *
 * `offer` is named for what it is: handing a datagram to a carrier. It is not
 * `send`, because no adapter can promise delivery and the contract must not
 * imply one. `collect` is a pull, because a push requires a session.
 */
export interface SubshareTransportPort {
  readonly adapterName: string;
  readonly capabilities: AdapterCapabilities;

  /**
   * Hand a datagram to the carrier. MUST succeed whether or not the recipient
   * exists, is online, or ever will be. MUST be idempotent: offering the same
   * datagram twice is not an error and does not corrupt the recipient's view.
   */
  offer(datagram: SealedDatagram): Promise<void>;

  /**
   * Collect whatever has arrived for this address. MUST return `[]` rather than
   * throwing or blocking when nothing has arrived. MAY return duplicates. MAY
   * return in any order. MUST NOT require that `offer` happened in this process,
   * on this host, or during this decade.
   */
  collect(address: CeremonyAddress): Promise<readonly SealedDatagram[]>;
}

// ============================================================================
// THE SECURITY LAYER -- ABOVE THE PORT, INHERITED BY EVERY ADAPTER
// ============================================================================

/** A pinned holder or participant: an index bound to a long-term identity key. */
export interface RosterEntry {
  /** FROST participant index. Identity is the KEY; this is which seat it holds. */
  readonly x: number;
  /** hex ed25519 public key. Pinned out of band, NOT learned from the mesh. */
  readonly identityPublicKey: string;
  /** Human label for ceremony transcripts. Carries no authority. */
  readonly label: string;
}

/**
 * The independent pin. Compromising the mesh control plane cannot edit this,
 * because it does not live in the mesh -- see the control-plane section of the
 * research note. Mesh admission and ceremony admission are two gates.
 */
export interface CeremonyRoster {
  readonly ceremonyId: string;
  /** hex. The key being reshared; binds every datagram to THIS group. */
  readonly groupPublicKey: string;
  /** Current holders authorised to contribute (the `fromX` side). */
  readonly holders: readonly RosterEntry[];
  /** New participants authorised to receive (the `toX` side). */
  readonly participants: readonly RosterEntry[];
}

/**
 * A new participant's per-ceremony KEM public key, signed by its ROSTERED
 * long-term identity key.
 *
 * Published in phase 1, before any holder seals. Signed because an unsigned
 * pre-key is a man-in-the-middle's substitution slot -- P1 dies silently if a
 * holder will seal to whatever key it is handed.
 */
export interface CeremonyPreKey {
  readonly ceremonyId: string;
  readonly toX: number;
  /** hex KEM public key, valid for THIS ceremony only. */
  readonly kemPublicKey: string;
  /** hex ed25519 signature by roster.participants[toX].identityPublicKey. */
  readonly signature: string;
}

/**
 * Opaque handle to the per-ceremony KEM secret. A CLOSURE, not a class: the
 * secret is captured, never a field, so there is no instance state to reflect
 * over or serialise (interfaces-free-classes-earned; §3 weight-free).
 *
 * `destroy()` is what makes forward secrecy TRUE rather than claimed. It is the
 * operational half of P4 and the reason P4 is testable at all.
 */
export interface RecipientKeyHandle {
  readonly ceremonyId: string;
  readonly toX: number;
  readonly isDestroyed: () => boolean;
  /** Irreversible. After this, recorded datagrams for this ceremony are dead bytes. */
  destroy: () => void;
}

export interface MintedPreKey {
  readonly preKey: CeremonyPreKey;
  readonly handle: RecipientKeyHandle;
}

export interface SealRequest {
  readonly roster: CeremonyRoster;
  /** The recipient's phase-1 pre-key. Its signature is verified before sealing. */
  readonly preKey: CeremonyPreKey;
  /** The subshare g_i(x'_j). SECRET. Never logged, never persisted in the clear. */
  readonly subshare: ReshareSubshare;
  /** The contributing holder's long-term ed25519 secret, for authenticity only. */
  readonly holderIdentitySecret: Uint8Array;
  readonly random?: () => number;
}

export interface OpenContext {
  readonly roster: CeremonyRoster;
  readonly handle: RecipientKeyHandle;
  readonly guard: ReplayGuard;
}

export type OpenRejection =
  | "schema"
  | "malformed"
  | "routing-mismatch"
  | "wrong-ceremony"
  | "wrong-group-key"
  | "unknown-sender"
  | "bad-signature"
  | "conflicting-replay"
  | "key-destroyed"
  | "undecryptable";

export type OpenOutcome =
  | {
      readonly ok: true;
      readonly subshare: ReshareSubshare;
      /** True when this exact datagram was already opened. Idempotent, not an error. */
      readonly duplicate: boolean;
    }
  | { readonly ok: false; readonly reason: OpenRejection };

/**
 * The recipient's durable seen-log: (ceremonyId, fromX, toX) -> datagram digest.
 *
 * Grow-only, so the join is union and redelivery converges (§12 idempotency, the
 * same G-set shape as the Reticulum relay dedup set). This is the local cost of
 * having no session: the channel keeps no sequence state, the recipient does.
 *
 * Serialisable to text on purpose -- a recipient that reboots mid-ceremony must
 * reload this or it loses replay resistance across the reboot.
 */
export interface ReplayGuard {
  readonly seen: (key: string) => string | undefined;
  readonly record: (key: string, digest: string) => void;
  readonly toJSON: () => Record<string, string>;
}

export function createReplayGuard(initial?: Record<string, string>): ReplayGuard {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    seen: (key) => map.get(key),
    record: (key, digest) => {
      map.set(key, digest);
    },
    toJSON: () => Object.fromEntries([...map.entries()].sort((a, b) => ordinalCompare(a[0], b[0]))),
  };
}

/**
 * Everything the port contract requires that a carrier cannot supply. One
 * implementation ships (subshare-envelope.ts); the interface is what adapters
 * are written against.
 */
export interface SubshareSecurityLayer {
  readonly name: string;
  /** Phase 1, recipient side. Fresh per ceremony -- see P4. */
  mintRecipientPreKey(
    roster: CeremonyRoster,
    toX: number,
    participantIdentitySecret: Uint8Array,
    random?: () => number,
  ): MintedPreKey;
  /** Phase 2, holder side. */
  seal(request: SealRequest): SealedDatagram;
  /** Phase 3, recipient side. Result-over-exception: rejections are values. */
  open(datagram: SealedDatagram, context: OpenContext): OpenOutcome;
}

// ============================================================================
// THE FIVE PROPERTIES
// ============================================================================

export type PropertyId = "P1" | "P2" | "P3" | "P4" | "P5";

export interface TransportProperty {
  readonly id: PropertyId;
  readonly name: string;
  /** What must be true. The contract sentence. */
  readonly requirement: string;
  /** Who is obliged to provide it. `above-port` code is inherited by every adapter. */
  readonly providedBy: "above-port" | "port";
  /** What breaks when it does not hold. Every one of these is a real attack. */
  readonly consequenceIfBroken: string;
  /** Adapter detail, recorded because it is what decided `providedBy`. */
  readonly wireguardCoverage: string;
}

export const SUBSHARE_TRANSPORT_PROPERTIES: readonly TransportProperty[] = [
  {
    id: "P1",
    name: "Confidentiality to the addressee",
    requirement:
      "Only the addressed new participant j can recover g_i(x'_j). No carrier, relay, " +
      "coordinator, or fellow participant can, even holding every datagram addressed to j.",
    providedBy: "above-port",
    consequenceIfBroken:
      "A party that collects k datagrams addressed to the same j sums them and HAS s'_j. " +
      "That is the entire reconstruction -- the single point of failure resharing exists to " +
      "remove, restored while the ceremony still looks distributed.",
    wireguardCoverage:
      "PARTIAL, and only against a network eavesdropper. WireGuard is point-to-point between " +
      "NODES; any relaying coordinator terminates the tunnel and reads the subshare in the " +
      "clear. A DHT adapter has untrusted intermediaries by construction. Not sufficient.",
  },
  {
    id: "P2",
    name: "Holder authenticity, bound to a pinned key and not to a route",
    requirement:
      "The recipient learns which CURRENT HOLDER INDEX i produced the subshare, bound to i's " +
      "pinned long-term identity key. A node identity, mesh IP, or routing address is never " +
      "accepted as the answer, and the datagram's unauthenticated exterior never decides.",
    providedBy: "above-port",
    consequenceIfBroken:
      "reshareCombine requires exactly one subshare per contributor and sums them. An " +
      "unauthenticated sender injects a term and the recipient computes a share of a " +
      "DIFFERENT secret -- which the Feldman check catches only if the attacker also cannot " +
      "supply the matching commitment, i.e. authenticity is what makes the public verifier " +
      "load-bearing rather than a formality.",
    wireguardCoverage:
      "PARTIAL and of the wrong thing. WireGuard authenticates the peer's static NODE key. " +
      "Node identity is not holder identity (writer-actor-routing-model.md): one node may " +
      "host several personas, a share may move hosts, and headscale can admit a new node. " +
      "Not sufficient.",
  },
  {
    id: "P3",
    name: "Ceremony binding and replay resistance",
    requirement:
      "A datagram is valid for exactly one (ceremonyId, fromX, toX) against one group public " +
      "key. Redelivery of the IDENTICAL datagram is idempotent; a DIFFERENT datagram at the " +
      "same coordinate, or any datagram from another ceremony, is rejected.",
    providedBy: "above-port",
    consequenceIfBroken:
      "Replaying ceremony A's subshares into ceremony B makes the new share set NOT " +
      "independent of the old one. Proactive refresh's whole guarantee -- that k-1 old plus " +
      "k-1 new shares reveal nothing -- is exactly the independence being destroyed. So a " +
      "replay does not merely corrupt a ceremony; it silently downgrades the security of " +
      "every refresh that follows.",
    wireguardCoverage:
      "NO, at the scale that matters. WireGuard's sliding-window counter suppresses replay " +
      "WITHIN a session; a datagram replayed in a later session, after a reboot, or into a " +
      "later ceremony is a fresh valid packet. A sessionless adapter has no window at all.",
  },
  {
    id: "P4",
    name: "Forward secrecy under later endpoint compromise",
    requirement:
      "An adversary who records every datagram and LATER compromises every long-term key of " +
      "every party must still not recover any subshare. The per-ceremony KEM key is fresh per " +
      "ceremony and destroyed after reshareCombine.",
    providedBy: "above-port",
    consequenceIfBroken:
      "A subshare is SECRET-EQUIVALENT IN TRANSIT: k of them addressed to j reconstruct s'_j, " +
      "and s'_j stays live for as long as the group key does -- years. So a recording made " +
      "today is worth a break made at any later date, which is what makes forward secrecy a " +
      "REQUIREMENT here and not a nicety, and is also why the KEM is post-quantum: " +
      "harvest-now-decrypt-later is the literal threat model.",
    wireguardCoverage:
      "YES in flight, and it EVAPORATES at rest. Noise_IK rekeys every ~2 minutes, so recorded " +
      "tunnel traffic survives a later node-key theft. But forward secrecy is a property of a " +
      "CHANNEL, and a store-and-forward datagram spends most of its life outside one -- in a " +
      "spool, a DHT, a USB stick. Not sufficient for the baseline this port targets.",
  },
  {
    id: "P5",
    name: "Eventual delivery, without liveness, order, or exactly-once",
    requirement:
      "The port requires no live session, no rendezvous, no ordering and no deduplication. " +
      "`offer` succeeds when the recipient does not exist; `collect` returns [] rather than " +
      "blocking; datagrams may be delayed, reordered, duplicated, and re-offered after loss, " +
      "and the ceremony still completes with a byte-identical group public key.",
    providedBy: "port",
    consequenceIfBroken:
      "A contract that assumes a session deletes the offline story -- sneakernet, LoRa, " +
      "Reticulum, and the planned DHT adapter all lose. It also re-introduces a coordination " +
      "point at ceremony time, which is the failure mode geographic distribution exists to " +
      "avoid.",
    wireguardCoverage:
      "NO. WireGuard needs both endpoints reachable over UDP; tailscale additionally needs the " +
      "control plane reachable to establish or refresh. There is no store-and-forward in it at " +
      "all. This is the property that most clearly makes WireGuard a CARRIER, not the contract.",
  },
];

export function propertyById(id: PropertyId): TransportProperty {
  const p = SUBSHARE_TRANSPORT_PROPERTIES.find((q) => q.id === id);
  if (p === undefined) throw new Error(`subshare-transport-port: unknown property ${id}`);
  return p;
}

/** Coordinate key for the replay guard. Authenticated values only. */
export function replayKey(ceremonyId: string, fromX: number, toX: number): string {
  return `${ceremonyId}|${String(fromX)}|${String(toX)}`;
}
