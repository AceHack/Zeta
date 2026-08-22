/**
 * full-ai-cluster/nixos/cluster-discovery/decide.ts
 *
 * BOOTSTRAP OR JOIN -- the decision, as a pure function over a discovery
 * result. 081KSE6WT0008QG0R000CV98PV; R3 of the USB design document.
 *
 * Nothing in this file touches a network, a clock, a file, or a process. The
 * probe is somewhere else (`probe.ts`), and it hands this function a VALUE.
 * That split is the whole point: discovery is exactly the class of thing that
 * works in a lab and quietly does nothing in the field, and a decision buried
 * inside an I/O path cannot be tested for the cases that matter -- two
 * clusters answering, a wrong trust domain, a probe that failed and reported
 * silence. Here every one of those is a unit test with no network.
 *
 * THE FOUR OUTCOMES, AND WHY REFUSING IS ONE OF THEM
 * -------------------------------------------------
 *   bootstrap  nothing answered, and the silence is trustworthy
 *   join       exactly one cluster answered, and we hold a credential for it
 *   refuse     the situation is ambiguous, or the silence is not trustworthy
 *   (override) the operator already said which, and that always wins
 *
 * A node that guesses wrong is worse than a node that stops and asks. The
 * expensive error is not "waited too long" -- it is "started a second cluster
 * on a network that already had one", which produces two healthy-looking
 * clusters, splits the operator attention, and is undone by hand. So every
 * ambiguity resolves to `refuse`, and `bootstrap` is reachable only from a
 * silence that passed an explicit honesty check.
 */

import { joinServerUrlFor, type MalformedAdvertisement, type ZetaClusterAdvertisement } from "./advertisement";

/**
 * HOW LONG TO WAIT BEFORE CONCLUDING "NO CLUSTER" -- the crux, justified.
 *
 * The network component is small and is bounded by the protocol, not by
 * guesswork. RFC 6762 section 5.2 requires a continuous multicast query to
 * retransmit with an interval that at least doubles, starting at one second,
 * so query bursts land at t = 0, 1, 3, 7, 15 seconds; five bursts inside the
 * first 15 s. RFC 6762 section 6 has a responder answer a shared-record query
 * after a randomised 20-120 ms delay. So packet loss is covered within about
 * three seconds, and everything past that is buying against something else.
 *
 * What it is buying against is the PATH not being ready. A booting node races
 * its own switch port: 802.1D spanning tree holds a port in listening then
 * learning for two forward delays (2 x 15 s by default); 802.1w rapid STP
 * usually converges in a few seconds; an edge/portfast port forwards
 * immediately. A node that queries before its port forwards hears nothing --
 * and under a short dwell that silence reads as "no cluster here", which is
 * how a second cluster gets founded on a network that already had one.
 *
 * 30 s therefore: five RFC-scheduled bursts, a full 15 s of answer window
 * after the last one, and coverage of a legacy forward-delay window.
 *
 * THE COST COMPARISON, stated so it can be argued with:
 *   waiting 30 s  -- paid once, by a genuine first node, inside an install
 *                    whose own stages are measured in minutes.
 *   deciding too early -- a split-brain second cluster: two healthy-looking
 *                    control planes, an operator teardown, and data on
 *                    whichever one was wrong.
 * The second is not 60x the first; it is a different category of cost. That
 * asymmetry, not a measurement, is what picks this number.
 *
 * UNMETERED (`.claude/rules/toy-is-free-metered-must-be-earned.md`). No two
 * nodes have ever run this probe near each other. The number is derived from
 * the protocol timers above and from the cost asymmetry; it is not validated,
 * and it stays unvalidated until two machines boot on one segment and the
 * dwell is measured against the observed time-to-first-answer.
 */
export const DEFAULT_DWELL_MS = 30_000;

/**
 * Floor below which a silence is not accepted as evidence of absence.
 *
 * An operator may dial the dwell down; what they may not do is have a
 * two-second silence read as "there is no cluster here". Below this floor the
 * decision refuses unless the policy carries an explicit acknowledgement, so
 * a shortened dwell costs a message rather than a cluster.
 */
export const MIN_HONEST_DWELL_MS = 30_000;

/**
 * Minimum query bursts a silence must have behind it.
 *
 * A dwell measured in wall-clock time alone can be satisfied by a probe that
 * sent one query and then slept, which is indistinguishable from a probe that
 * queried properly -- until the day the one query is the one that is lost.
 * Five is the count RFC 6762 section 5.2 schedules inside the dwell above.
 */
export const MIN_QUERY_BURSTS = 5;

/** Why a probe could not produce a usable observation. */
export type ProbeFailureReason =
  | "browser-missing"
  | "responder-unavailable"
  | "no-carrier"
  | "browser-error"
  | "unparseable-output"
  | "interrupted";

/**
 * What a probe observed.
 *
 * THREE variants, not two, and the third is the load-bearing one: a probe
 * that cannot run must NOT be representable as a probe that heard nothing.
 * An adapter that swallowed its errors and returned "silence" would make
 * every node on a broken network found its own cluster -- the exact failure
 * this whole module exists to prevent, arriving through the back door.
 */
export type DiscoveryProbeOutcome =
  | {
      readonly kind: "responded";
      readonly advertisements: readonly ZetaClusterAdvertisement[];
      readonly malformed: readonly MalformedAdvertisement[];
      readonly elapsedMs: number;
      readonly dwellMs: number;
      readonly queryBursts: number;
    }
  | {
      readonly kind: "silence";
      readonly elapsedMs: number;
      readonly dwellMs: number;
      readonly queryBursts: number;
    }
  | {
      readonly kind: "probe-failed";
      readonly reason: ProbeFailureReason;
      readonly detail: string;
      readonly elapsedMs: number;
    };

/**
 * The role the operator already declared, if any.
 *
 * Sources, in the shapes that exist today: the 10-second tty keystroke, the
 * ESP `/zeta-firstboot.conf` a flash writes, and the ISO copy baked at build
 * time. Discovery is the DEFAULT, never the authority -- a node the operator
 * declared a control plane must not become an agent because something
 * answered on the segment.
 */
export interface ExplicitRoleDeclaration {
  /** `first-control-plane` or `joiner`; anything else is refused, not ignored. */
  readonly role: string;
  /** Where it came from, for the operator-facing line. */
  readonly source: string;
  /** k3s `--server` URL, when the declaration carried one. */
  readonly joinServerUrl?: string;
}

/**
 * What credential the node holds for joining, described WITHOUT the secret.
 *
 * Discovery finding an address does not solve credentials, and this module
 * does not pretend otherwise. The k3s node-token still comes from the ESP or
 * from an operator -- exactly as it does today -- and nothing here reads it,
 * carries it, or logs it.
 *
 * What the public half buys is real, though. A k3s token is
 * `K10<sha256 of the server CA cert>::<credential>`, so the medium that
 * carries the token also carries a PUBLIC pin for the cluster it belongs to.
 * Passing that pin in as `expectedClusterId` turns discovery from "dial
 * whatever answered" into "dial the thing that answered IF it is the cluster
 * this token was minted by". An attacker on the segment can answer; it cannot
 * make its answer match a hash it does not hold.
 */
export interface JoinCredentialState {
  /** True when a token file is present and non-empty. Never the token. */
  readonly tokenAvailable: boolean;
  /** Public CA-hash pin read out of the token prefix, when derivable. */
  readonly expectedClusterId?: string;
  /** Where the credential came from, for the operator-facing line. */
  readonly source?: string;
}

/** Operator policy the decision consults. All of it optional, none of it ambient. */
export interface DiscoveryPolicy {
  /**
   * Trust domain this node is allowed to join. Set, a cluster answering with
   * any other trust domain is refused rather than joined.
   */
  readonly expectedTrustDomain?: string;
  /**
   * Explicit acknowledgement that a dwell below MIN_HONEST_DWELL_MS is
   * intended. Absent, a short dwell makes a silence inadmissible.
   */
  readonly acknowledgedShortDwell?: boolean;
}

/** Everything the decision reads. No globals, no clock, no filesystem. */
export interface ClusterBootDecisionInput {
  readonly probe: DiscoveryProbeOutcome;
  readonly explicitRole?: ExplicitRoleDeclaration;
  readonly credentials: JoinCredentialState;
  readonly policy?: DiscoveryPolicy;
}

export type BootstrapReason = "explicit-override" | "no-cluster-answered";

export type JoinReason = "explicit-override" | "single-cluster-answered";

/** Every way the decision declines to act. Each is a message, never a silent default. */
export type RefusalReason =
  | "override-unrecognised"
  | "override-joiner-without-endpoint"
  | "probe-failed"
  | "dwell-too-short"
  | "multiple-clusters-answered"
  | "malformed-advertisement"
  | "trust-domain-mismatch"
  | "trust-domain-disagreement"
  | "cluster-id-does-not-match-token"
  | "join-token-unavailable";

export type ClusterBootDecision =
  | {
      readonly action: "bootstrap";
      readonly reason: BootstrapReason;
      readonly notes: readonly string[];
    }
  | {
      readonly action: "join";
      readonly reason: JoinReason;
      /** k3s `--server` value. A NAME, so the API certificate verifies. */
      readonly serverUrl: string;
      /** Cluster identity that was joined, when discovery supplied one. */
      readonly clusterId?: string;
      /** Address behind the name, for the injected /etc/hosts entry. */
      readonly endpointAddress?: string;
      readonly notes: readonly string[];
    }
  | {
      readonly action: "refuse";
      readonly reason: RefusalReason;
      readonly detail: string;
      /** What a human should do next. A refusal with no next step is a hang. */
      readonly operatorAction: string;
      readonly notes: readonly string[];
    };

/** The two roles the medium can declare. Matches zflash `ZetaFirstbootRole`. */
export const ROLE_FIRST_CONTROL_PLANE = "first-control-plane";
export const ROLE_JOINER = "joiner";

/**
 * Ordinal string comparison, by UTF-16 code unit.
 *
 * Deliberately NOT `localeCompare`: culture-sensitive collation would let two
 * nodes with different locales pick different endpoints from the same set of
 * answers, which breaks deterministic replay of the decision.
 * (`.claude/rules/culture-invariant-by-default.md`.)
 */
function compareOrdinal(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a >= b ? 1 : -1;
}

function refuse(
  reason: RefusalReason,
  detail: string,
  operatorAction: string,
  notes: readonly string[],
): ClusterBootDecision {
  return { action: "refuse", reason, detail, operatorAction, notes };
}

/**
 * Is this silence admissible as evidence that no cluster exists?
 *
 * Returns the problem, or null when the silence stands. Three independent
 * conditions, because they fail for three different reasons: a dwell
 * configured below the floor, a probe that returned early, and a probe that
 * waited long enough while sending almost no queries.
 */
export function silenceProblem(
  probe: { readonly elapsedMs: number; readonly dwellMs: number; readonly queryBursts: number },
  policy: DiscoveryPolicy | undefined,
): string | null {
  const acknowledged = policy?.acknowledgedShortDwell === true;
  const dwellBelowFloor = probe.dwellMs <= MIN_HONEST_DWELL_MS - 1;
  if (dwellBelowFloor) {
    if (!acknowledged) {
      return `dwell was ${String(probe.dwellMs)} ms, below the ${String(MIN_HONEST_DWELL_MS)} ms floor`;
    }
  }
  if (probe.elapsedMs <= probe.dwellMs - 1) {
    return `probe returned after ${String(probe.elapsedMs)} ms of a ${String(probe.dwellMs)} ms dwell`;
  }
  if (probe.queryBursts <= MIN_QUERY_BURSTS - 1) {
    return `probe sent ${String(probe.queryBursts)} query bursts, fewer than ${String(MIN_QUERY_BURSTS)}`;
  }
  return null;
}

/**
 * Choose one endpoint from the answers of a SINGLE cluster.
 *
 * Several answers for one cluster id is the normal HA case -- three control
 * planes all advertising the same cluster -- not an ambiguity. The pick is a
 * total order over published values so two nodes hearing the same set choose
 * the same endpoint, which is what makes the decision replayable.
 */
export function pickEndpoint(
  advertisements: readonly ZetaClusterAdvertisement[],
): ZetaClusterAdvertisement | undefined {
  const sorted = [...advertisements].sort((a, b) => {
    const byNode = compareOrdinal(a.nodeName, b.nodeName);
    if (byNode !== 0) {
      return byNode;
    }
    const byHost = compareOrdinal(a.hostname, b.hostname);
    if (byHost !== 0) {
      return byHost;
    }
    const byAddress = compareOrdinal(a.address, b.address);
    if (byAddress !== 0) {
      return byAddress;
    }
    return a.port - b.port;
  });
  return sorted[0];
}

/** Distinct cluster ids among the answers, ordinal-sorted for a stable message. */
export function distinctClusterIds(advertisements: readonly ZetaClusterAdvertisement[]): readonly string[] {
  const ids = new Set(advertisements.map((a) => a.clusterId));
  return [...ids].sort(compareOrdinal);
}

/** Distinct trust domains among the answers, ordinal-sorted. */
export function distinctTrustDomains(advertisements: readonly ZetaClusterAdvertisement[]): readonly string[] {
  const domains = new Set(advertisements.map((a) => a.trustDomain));
  return [...domains].sort(compareOrdinal);
}

/** Human-readable one-liner about what discovery heard, for the notes. */
function describeProbe(probe: DiscoveryProbeOutcome): string {
  if (probe.kind === "probe-failed") {
    return `discovery could not run (${probe.reason}: ${probe.detail})`;
  }
  if (probe.kind === "silence") {
    return `discovery heard nothing in ${String(probe.elapsedMs)} ms over ${String(probe.queryBursts)} query bursts`;
  }
  const ids = distinctClusterIds(probe.advertisements);
  return `discovery heard ${String(probe.advertisements.length)} answer(s) from ${String(ids.length)} cluster(s)`;
}

/**
 * THE DECISION.
 *
 * Evaluation order is the design, not an implementation detail:
 *   1. an explicit declaration wins, always, in every branch below it;
 *   2. a probe that FAILED refuses -- it never reads as an empty network;
 *   3. an inadmissible silence refuses;
 *   4. an admissible silence bootstraps;
 *   5. answers are checked for ambiguity, trust domain and credential pin
 *      before any join is emitted.
 */
export function decideClusterBoot(input: ClusterBootDecisionInput): ClusterBootDecision {
  const { probe, explicitRole, credentials, policy } = input;
  const notes: string[] = [describeProbe(probe)];

  if (explicitRole !== undefined) {
    return decideWithExplicitRole(explicitRole, input, notes);
  }

  if (probe.kind === "probe-failed") {
    return refuse(
      "probe-failed",
      `discovery did not complete: ${probe.reason} (${probe.detail})`,
      "fix the probe path or declare the role explicitly; a failed probe is not an empty network",
      notes,
    );
  }

  if (probe.kind === "silence") {
    const problem = silenceProblem(probe, policy);
    if (problem !== null) {
      return refuse(
        "dwell-too-short",
        `silence is not admissible as absence: ${problem}`,
        "raise the dwell, or acknowledge the short dwell explicitly in policy",
        notes,
      );
    }
    notes.push("silence passed the admissibility check (dwell, elapsed, query count)");
    return { action: "bootstrap", reason: "no-cluster-answered", notes };
  }

  return decideFromAnswers(probe.advertisements, probe.malformed, credentials, policy, notes);
}

/**
 * The override branch. Discovery is consulted for CONTEXT only.
 *
 * A declared control plane stays a control plane even when a cluster answers,
 * and the contradiction is recorded rather than acted on. A declared joiner
 * never falls back to founding a cluster: if it has no endpoint and discovery
 * gives it none, that is a refusal, because the operator already said this
 * node is not a founder.
 */
function decideWithExplicitRole(
  declaration: ExplicitRoleDeclaration,
  input: ClusterBootDecisionInput,
  notes: string[],
): ClusterBootDecision {
  const { probe, credentials, policy } = input;
  notes.push(`explicit role ${JSON.stringify(declaration.role)} from ${declaration.source} overrides discovery`);

  if (declaration.role === ROLE_FIRST_CONTROL_PLANE) {
    if (probe.kind === "responded") {
      const ids = distinctClusterIds(probe.advertisements);
      notes.push(
        `CONTRADICTION: ${String(ids.length)} cluster(s) answered but the operator declared this node a founder`,
      );
    }
    return { action: "bootstrap", reason: "explicit-override", notes };
  }

  if (declaration.role !== ROLE_JOINER) {
    return refuse(
      "override-unrecognised",
      `declared role ${JSON.stringify(declaration.role)} (from ${declaration.source}) is not a role this node knows`,
      "fix the role on the medium; an unreadable declaration is not an absent one, so discovery is NOT consulted",
      notes,
    );
  }

  const declaredUrl = declaration.joinServerUrl?.trim();
  const hasDeclaredUrl = declaredUrl !== undefined;
  if (hasDeclaredUrl) {
    if (declaredUrl.length !== 0) {
      if (!credentials.tokenAvailable) {
        return refuse(
          "join-token-unavailable",
          "the medium declares this node a joiner and names an endpoint, but carries no k3s token",
          "flash the medium with a join token, or provision one at the ESP path the installer reads",
          notes,
        );
      }
      notes.push("endpoint came from the medium, not from discovery");
      return { action: "join", reason: "explicit-override", serverUrl: declaredUrl, notes };
    }
  }

  notes.push("declared joiner with no endpoint on the medium; discovery may supply the ADDRESS only");
  if (probe.kind === "probe-failed") {
    return refuse(
      "probe-failed",
      `declared joiner, and discovery did not complete: ${probe.reason} (${probe.detail})`,
      "give the medium an explicit join server URL, or fix the probe path",
      notes,
    );
  }
  if (probe.kind === "silence") {
    return refuse(
      "override-joiner-without-endpoint",
      "the medium declares this node a joiner, names no endpoint, and nothing answered on the segment",
      "point the medium at a control plane, or re-flash it as a founder if this really is the first node",
      notes,
    );
  }
  return decideFromAnswers(probe.advertisements, probe.malformed, credentials, policy, notes);
}

/**
 * Answers in hand. Every check here can refuse; none of them can guess.
 */
function decideFromAnswers(
  advertisements: readonly ZetaClusterAdvertisement[],
  malformed: readonly MalformedAdvertisement[],
  credentials: JoinCredentialState,
  policy: DiscoveryPolicy | undefined,
  notes: string[],
): ClusterBootDecision {
  if (malformed.length !== 0) {
    const first = malformed[0];
    return refuse(
      "malformed-advertisement",
      `${String(malformed.length)} answer(s) on the Zeta service type did not validate; first: ${first?.source ?? "unknown"} (${first?.problem ?? "unknown"})`,
      "look at what is advertising on the segment; a malformed answer is either a version skew or something that is not us",
      notes,
    );
  }

  if (advertisements.length === 0) {
    return refuse(
      "probe-failed",
      "probe reported answers and then supplied none, which is a contradiction in its own output",
      "treat the probe as broken; do not read this as an empty network",
      notes,
    );
  }

  const clusterIds = distinctClusterIds(advertisements);
  if (clusterIds.length !== 1) {
    return refuse(
      "multiple-clusters-answered",
      `${String(clusterIds.length)} distinct clusters answered on this segment: ${clusterIds.join(", ")}`,
      "declare the role and endpoint explicitly on the medium; two clusters on one segment is not something a node may resolve by picking",
      notes,
    );
  }

  const trustDomains = distinctTrustDomains(advertisements);
  if (trustDomains.length !== 1) {
    return refuse(
      "trust-domain-disagreement",
      `one cluster id advertised ${String(trustDomains.length)} trust domains: ${trustDomains.join(", ")}`,
      "the answers disagree about their own identity namespace; investigate before joining anything",
      notes,
    );
  }

  const clusterId = clusterIds[0] ?? "";
  const trustDomain = trustDomains[0] ?? "";
  const expectedDomain = policy?.expectedTrustDomain?.trim();
  if (expectedDomain !== undefined) {
    if (expectedDomain.length !== 0) {
      if (expectedDomain !== trustDomain) {
        return refuse(
          "trust-domain-mismatch",
          `the answering cluster serves trust domain ${JSON.stringify(trustDomain)}, this node expects ${JSON.stringify(expectedDomain)}`,
          "this is a different tenancy; join it only by declaring the role and endpoint explicitly",
          notes,
        );
      }
    }
  }
  if (expectedDomain === undefined) {
    notes.push(
      `trust domain ${JSON.stringify(trustDomain)} was NOT checked against an expectation (policy carries none)`,
    );
  }

  const expectedClusterId = credentials.expectedClusterId?.trim();
  if (expectedClusterId !== undefined) {
    if (expectedClusterId.length !== 0) {
      if (expectedClusterId !== clusterId) {
        return refuse(
          "cluster-id-does-not-match-token",
          `the answering cluster is ${clusterId}, the token on this medium pins ${expectedClusterId}`,
          "the credential belongs to a different cluster; re-flash with the right token or declare the endpoint explicitly",
          notes,
        );
      }
      notes.push("answering cluster matches the CA pin carried in the token prefix");
    }
  }
  if (expectedClusterId === undefined) {
    notes.push("token carried no CA pin, so the answering cluster identity is UNVERIFIED");
  }

  if (!credentials.tokenAvailable) {
    return refuse(
      "join-token-unavailable",
      `cluster ${clusterId} answered, and this node holds no k3s token for it`,
      "provision the join token on the medium; discovery finds an address, it does not mint credentials",
      notes,
    );
  }

  const endpoint = pickEndpoint(advertisements);
  if (endpoint === undefined) {
    return refuse(
      "probe-failed",
      "no endpoint could be chosen from a non-empty answer set",
      "treat the probe output as broken",
      notes,
    );
  }
  notes.push(
    `endpoint chosen deterministically from ${String(advertisements.length)} answer(s) for cluster ${clusterId}`,
  );
  return {
    action: "join",
    reason: "single-cluster-answered",
    serverUrl: joinServerUrlFor(endpoint),
    clusterId,
    endpointAddress: endpoint.address,
    notes,
  };
}
