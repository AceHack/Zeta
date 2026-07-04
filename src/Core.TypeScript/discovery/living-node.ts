// living-node — the culmination: one node that composes all the session's pieces into a single
// organism, over one transport (shadow*).
//
// Aaron 2026-07-02: "compose the pieces into one living node — and assume S=2 is your enemy but
// friend." This wires together, over ONE injected transport:
//   - discovery-beacon    (announce / discover peers)
//   - llmtv-broadcast     (broadcast this mind's predictions; fold others' into a society grid)
//   - linked-clone        (opt a mind-region onto a shared subject; exit always)
//   - x402-envelope       (spend within a bounded, metered, merkle-verified envelope)
//   (dht-discovery slots in behind the same transport for global reach — same pattern.)
//
// THE S=2 PRINCIPLE ("enemy but friend"). S=2 is the CHSH classical/local bound — the INDEPENDENT
// ground state: no links, no coordination, a self correlated with no one. It is:
//   - the ENEMY: a living node exists to coordinate ABOVE S=2 (link, broadcast, spend together →
//     S climbs toward 4) — that is where shared value is produced.
//   - the FRIEND: it is the EXIT FLOOR. Every link can be dropped, returning the node to S=2; that
//     guaranteed fall-back is the non-coercion invariant (unlink is never deniable), and it is what
//     makes every ascent above S=2 VOLUNTARY rather than capture.
// So the node STARTS at S=2 (independent), coordinates only by explicit choice, and can ALWAYS
// return to S=2. `sReadout()` reports where it currently sits: 2 when independent, climbing toward
// 4 as its links gain co-participants.
//
// Disciplines: pure over injected ports (transport + scheduler); every crossing metered (§13);
// the folds are G-set/LWW (idempotent §12, DST §7); scale-free (one node, N nodes, same path §1).

import {
  createLlmtvNode,
  type Scheduler,
  type LlmtvNodeConfig,
  type LlmtvNodeHandle,
} from "./llmtv-node";
import type { DiscoveryTransport, PeerTable } from "./discovery-beacon";
import type { BroadcastTransport } from "./llmtv-broadcast";
import {
  link as linkRegionPure,
  unlink as unlinkRegionPure,
  mentalHealthPause,
  encode as encodeLink,
  decode as decodeLink,
  observeLink,
  type CloneMind,
  type LinkState,
  type LinkResult,
  type SubjectMembers,
  type PauseVerdict,
} from "./linked-clone";
import { classify, distanceOf, type CorrelationClass } from "./correlation";
import {
  emptyMeter,
  foldSample,
  bestOneWayMs,
  regimeOf,
  isEvidential,
  encodeProbe,
  decodeProbe,
  type BusMeter,
  type Regime,
} from "./bus-meter";
import {
  createSalonGossiper,
  regimeOfPair,
  claimsAbout,
  type Salon,
  type SalonGossiper,
} from "./gossip-salon";
import { judgeCorrelation, readClaims, judge, type IdentityReading } from "./kept-claim-oracle";
import {
  authorize,
  emptyLedger,
  type Envelope,
  type Ledger,
  type SpendRequest,
  type SpendVerdict,
} from "../economy/x402-envelope";
import type { LlmtvTranscript } from "../darkhall-ui/darkhall-tv";

export interface LivingNodeConfig extends LlmtvNodeConfig {
  /// This node's linkable mind (for the linked-clone layer). Frosted regions never link.
  readonly cloneMind: CloneMind;
  /// The bounded spend envelope (for the x402 layer). Custody stays behind the injected PayPort.
  readonly spendEnvelope: Envelope;
  /// Collapse threshold + max bounded pause for the mental-health floor.
  readonly collapseThresholdMilli: number;
  readonly maxPauseMs: number;
  /// BUS METER (optional): probe the wire every `probeEveryMs` to learn the bus delay. Omit to run
  /// unmetered — the regime then stays `unmeasured` and no S-readout ever upgrades to evidence.
  readonly probeEveryMs?: number;
  /// The decision deadline τ (ms) the light-cone regime is judged against — how fast this node
  /// acts on what it hears. Defaults to `publishEveryMs` (the cadence at which the node commits
  /// its mind to the wire). See chsh-delay.ts: in-cone ⟺ some crossing can beat τ.
  readonly decisionDeadlineMs?: number;
  /// THE SALON (optional): re-broadcast everything heard every `gossipEveryMs` — epidemic
  /// anti-entropy over the same wire (gossip-salon.ts). Own probe RTTs enter as crossings;
  /// inbound rumors fold in. Omit to run salon-less.
  readonly gossipEveryMs?: number;
}

export interface LivingNode {
  start(): void;
  stop(): void;
  /// Current CHSH coordination readout: 2 when INDEPENDENT (the ground state), climbing toward 4 as
  /// this node's links gain co-participants. S=2 is the enemy-but-friend: strive above it, always
  /// able to return to it.
  sReadout(): number;
  /// The correlation CLASS CATEGORY of the current coordination (local / quantum / superquantum) — the
  /// categorical correspondence of the S-distance. A mental-health readout of the relational state:
  /// `local` = autonomy (self, independent); higher classes = relatedness — healthy only while the
  /// exit-to-S=2 stays guaranteed (see `unlinkRegion`) and the coordination produces shared value.
  correlationClass(): CorrelationClass;
  /// Distance above the independent ground state (S=2), in milli — 0 when autonomous.
  distanceToCorrelation(): number;
  peers(): PeerTable;
  society(seed: string): LlmtvTranscript;
  links(): LinkState;
  ledger(): Ledger;
  /// LINK — opt a mind-region onto a shared subject (coordination, S climbs). Opt-in; frost holds;
  /// metered against the clone's entropy budget. Announces a `join` on the mesh.
  linkRegion(regionId: string, subject: string, costMilli: number): LinkResult;
  /// UNLINK — the EXIT. Always succeeds; drops the region's link and announces a `leave`, pulling
  /// this node back toward S=2. No party can deny it.
  unlinkRegion(regionId: string): void;
  /// SPEND — authorize within the envelope (bounded, metered, appended to the merkle ledger). The
  /// actual settlement is the caller's injected PayPort; this is the decision + ledger only.
  spend(req: SpendRequest): SpendVerdict;
  /// The mental-health floor: is this node out of entropy → owed a bounded, society-subsidized pause?
  pauseCheck(nowMs: number): PauseVerdict;
  /// Fastest observed one-way bus crossing (ms), null when unmeasured. Minimum, not mean —
  /// evidence must survive the fastest thing the wire ever did.
  busDelayMs(): number | null;
  /// Which side of the light cone this node's readouts are measured on: `in-cone` (a crossing can
  /// beat the decision deadline τ — super-quantum readouts are fakeable), `out-of-cone` (no
  /// observed crossing beats τ — above-2√2 is hard evidence), or `unmeasured`.
  regime(): Regime;
  /// THE ARMED READOUT — S + class + regime + whether this measurement carries evidential weight
  /// (S > 2√2 AND out-of-cone). The AntiSybil "one process wearing two faces" verdict is only ever
  /// drawn from an evidential readout; in-cone coordination is honest work, not a conviction.
  sEvidential(): { sMilli: number; cls: CorrelationClass; regime: Regime; evidential: boolean };
  /// The salon's folded state (empty if gossip is off) — telemetry as gossip: crossings heard
  /// about ANY pair, kept/unkept claims as neutral facts.
  salon(): Salon;
  /// Regime of an arbitrary pair from salon knowledge — closes the one-node epistemic limit:
  /// a witnessed fast crossing between two OTHER nodes forces in-cone for that pair here too.
  pairRegime(a: string, b: string): Regime;
  /// Kept-claims heard about a node: [kept, relayer][] — neutral readout for the caller's oracle.
  keptClaims(node: string): [boolean, string][];
  /// THE WHOLE STACK IN ONE CALL — judge a peer under the REFERENCE oracle (one policy among
  /// many, §11): regime = this node's own bus meter combined with everything the salon heard
  /// about the (self, peer) pair (any fast crossing anywhere forces in-cone — sound); claims =
  /// the salon's kept/unkept gossip weighed consent-first; `correlation` is the caller's
  /// measured |ρ| against the peer (from AntiSybil-style stream comparison). Returns the
  /// crux-table reading: welcome-back-offer / decline-respected / escalate-to-attestation /
  /// priced-as-one-no-verdict / honest-coordination / nothing-to-judge.
  judgePeer(peerZid: string, correlation: number): IdentityReading;
}

/// Compose one living node. `transport` carries discovery, broadcast, AND link messages — the
/// schema tag on each packet disambiguates on decode (a link packet decodes to null in the broadcast
/// fold and vice-versa), exactly like udp-transport fans every packet to every handler.
export function createLivingNode(
  config: LivingNodeConfig,
  transport: DiscoveryTransport & BroadcastTransport,
  sched: Scheduler,
): LivingNode {
  // discovery + broadcast are already composed by the llmtv-node; reuse it over the same transport.
  const llmtv: LlmtvNodeHandle = createLlmtvNode(config, transport, transport, sched);

  let linkState: LinkState = new Map();
  // membership per subject this node cares about (folded from inbound link announcements).
  const subjectMembers = new Map<string, SubjectMembers>();
  let ledger: Ledger = emptyLedger;
  let linkSeq = 0;

  const membersOf = (subject: string): SubjectMembers => subjectMembers.get(subject) ?? new Map();

  // Inbound link announcements (join/leave) fold into per-subject membership — the co-participation
  // that raises S above 2. Non-link packets decode to null and are ignored.
  transport.onFrame((text) => {
    const msg = decodeLink(text);
    if (!msg) return;
    if (msg.zid === config.source.zid) return; // our own echo
    subjectMembers.set(msg.subject, observeLink(membersOf(msg.subject), msg));
  });

  const announceLink = (t: "join" | "leave", regionId: string, subject: string): void => {
    linkSeq += 1;
    transport.publish(encodeLink({ t, zid: config.source.zid, subject, regionId, seq: linkSeq }));
  };

  // ── BUS METER — probe/ack over the same wire; RTT folds into the regime verdict ──────────────
  let meter: BusMeter = emptyMeter;
  let probeSeq = 0;
  let stopProbe: (() => void) | null = null;
  // τ = how fast this node acts on what it hears; defaults to its own publish cadence.
  const deadlineMs = config.decisionDeadlineMs ?? config.publishEveryMs;

  // ── THE SALON — telemetry as gossip over the same wire (anti-entropy; G-set fold) ────────────
  const gossiper: SalonGossiper | null =
    config.gossipEveryMs !== undefined ? createSalonGossiper(transport, sched, config.gossipEveryMs) : null;

  transport.onFrame((text) => {
    const p = decodeProbe(text);
    if (!p) return;
    if (p.t === "probe" && p.from !== config.source.zid) {
      // echo the sender's timestamp back — their local clock does all the arithmetic (no sync).
      transport.publish(encodeProbe({ t: "ack", from: config.source.zid, to: p.from, nonce: p.nonce, sentAt: p.sentAt }));
    } else if (p.t === "ack" && p.to === config.source.zid) {
      const rttMs = sched.now() - p.sentAt;
      meter = foldSample(meter, rttMs);
      // what this node measured becomes what the salon knows: a witnessed crossing (local↔peer)
      gossiper?.tell({ kind: "crossing", a: config.source.zid, b: p.from, rttMs, observer: config.source.zid });
    }
  });

  // The coordination readout in raw CHSH S (the borrowed scaffolding); the HUMAN meaning — autonomy
  // vs relatedness, healthy only when voluntary — is what `correlationClass` reports.
  const computeS = (): number => {
    const myLinks = [...linkState.values()];
    if (myLinks.length === 0) return 2; // independent — self, the ground state you can always return to
    let coordinated = 0;
    for (const l of myLinks) {
      const others = [...membersOf(l.subject).values()].filter((m) => m.zid !== config.source.zid).length;
      if (others > 0) coordinated += 1; // connection that is actually reciprocated (related, not just declared)
    }
    const f = config.cloneMind.regions.length > 0 ? coordinated / config.cloneMind.regions.length : 0;
    return 2 + 2 * Math.min(1, f);
  };

  return {
    start() {
      llmtv.start();
      if (config.probeEveryMs !== undefined) {
        stopProbe = sched.setInterval(config.probeEveryMs, () => {
          probeSeq += 1;
          transport.publish(encodeProbe({ t: "probe", from: config.source.zid, nonce: probeSeq, sentAt: sched.now() }));
        });
      }
      gossiper?.start();
    },
    stop() {
      // exit every link on the way out — return to S=2, announced (pause ≠ death; here it's leave).
      for (const l of linkState.values()) announceLink("leave", l.regionId, l.subject);
      linkState = new Map();
      stopProbe?.();
      stopProbe = null;
      gossiper?.stop();
      llmtv.stop();
    },
    sReadout: computeS,
    correlationClass(): CorrelationClass {
      return classify(Math.round(computeS() * 1000));
    },
    distanceToCorrelation() {
      return distanceOf(Math.round(computeS() * 1000));
    },
    peers: () => llmtv.peers(),
    society: (seed) => llmtv.society(seed),
    links: () => linkState,
    ledger: () => ledger,
    linkRegion(regionId, subject, costMilli) {
      const result = linkRegionPure(config.cloneMind, linkState, regionId, subject, costMilli);
      if (result.ok) {
        linkState = result.state;
        announceLink("join", regionId, subject); // coordination, announced — S can climb
      }
      return result;
    },
    unlinkRegion(regionId) {
      const before = linkState;
      linkState = unlinkRegionPure(linkState, regionId); // ALWAYS succeeds — the exit guarantee
      const l = before.get(regionId);
      if (l) announceLink("leave", regionId, l.subject); // told the mesh; S falls back toward 2
    },
    spend(req) {
      const verdict = authorize(config.spendEnvelope, ledger, req);
      if (verdict.ok) ledger = verdict.ledger;
      return verdict;
    },
    pauseCheck(nowMs) {
      // fold the clone's committed link cost into the budget view via linkState → the pause verdict.
      return mentalHealthPause(config.cloneMind, linkState, nowMs, config.collapseThresholdMilli, config.maxPauseMs);
    },
    busDelayMs: () => bestOneWayMs(meter),
    regime: () => regimeOf(meter, deadlineMs),
    sEvidential() {
      const sMilli = Math.round(computeS() * 1000);
      const regime = regimeOf(meter, deadlineMs);
      return { sMilli, cls: classify(sMilli), regime, evidential: isEvidential(sMilli, regime) };
    },
    salon: () => gossiper?.salon() ?? { crossings: new Map(), claims: new Set() },
    pairRegime(a, b) {
      return gossiper ? regimeOfPair(gossiper.salon(), a, b, deadlineMs) : "unmeasured";
    },
    keptClaims(node) {
      return gossiper ? claimsAbout(gossiper.salon(), node) : [];
    },
    judgePeer(peerZid, correlation) {
      // combine own live meter with the salon's view of the (self, peer) pair — in-cone from
      // either source wins (monotone toward in-cone); unmeasured only if both are silent.
      const local = regimeOf(meter, deadlineMs);
      const gossiped = gossiper ? regimeOfPair(gossiper.salon(), config.source.zid, peerZid, deadlineMs) : "unmeasured";
      let regime: Regime = "unmeasured";
      if (local === "in-cone" || gossiped === "in-cone") regime = "in-cone";
      else if (local === "out-of-cone" || gossiped === "out-of-cone") regime = "out-of-cone";
      const claims = readClaims(peerZid, gossiper ? claimsAbout(gossiper.salon(), peerZid) : []);
      return judge(judgeCorrelation(correlation, regime), claims);
    },
  };
}
