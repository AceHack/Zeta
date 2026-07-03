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
}

export interface LivingNode {
  start(): void;
  stop(): void;
  /// Current CHSH coordination readout: 2 when INDEPENDENT (the ground state), climbing toward 4 as
  /// this node's links gain co-participants. S=2 is the enemy-but-friend: strive above it, always
  /// able to return to it.
  sReadout(): number;
  /// The correlation CLASS CATEGORY of the current coordination (local / quantum / signaling) — the
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
    },
    stop() {
      // exit every link on the way out — return to S=2, announced (pause ≠ death; here it's leave).
      for (const l of linkState.values()) announceLink("leave", l.regionId, l.subject);
      linkState = new Map();
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
  };
}
