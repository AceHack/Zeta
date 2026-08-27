// full-ai-cluster/tools/cluster-bringup/sovereignty.ts
//
// THE PURE HALF of sovereign-by-default cluster shape. No filesystem, no network, no
// clock, no randomness — every door is a parameter, so this replays deterministically
// (§7 DST) and entropy enters only where declared (§13 noninterference).
//
// ---------------------------------------------------------------------------
// WHAT THIS REVERSES
// ---------------------------------------------------------------------------
//
// `estate.ts` (PR #15641) classifies an estate serving two distinct cluster CAs as
// `blocked / control-plane-split` — a real failure. Aaron 2026-08-26 reframed that
// finding:
//
//   "they should just be different clusters with the ability to join after the fact if
//    they want into one cluster, and also a cluster creator should be able to remove it."
//
// So N sovereign clusters is the CORRECT DEFAULT, not a defect. A node is complete on its
// own at boot (§1 scale-free: no appointed control plane), and joining is a LATER,
// VOLUNTARY, MUTUAL act. `clusterInit = lib.mkDefault true` in `k3s-server.nix` is
// therefore right and must not be changed.
//
// This module does not replace `estate.ts`. It answers a DIFFERENT question:
//
//     estate.ts   "is the estate ONE cluster?"          (bring-up readiness)
//     this file   "what SHAPE is the estate, and is     (sovereignty)
//                  that shape the one that was intended?"
//
// A count of clusters is not a verdict. Reporting the shape is the neutral fact; whether
// two clusters is right is the operator's oracle to attach
// (`dual-use-detection-is-neutral-oracle-decides`).
//
// ---------------------------------------------------------------------------
// THE TWO GUARDS, ENCODED AS TYPES
// ---------------------------------------------------------------------------
//
// Aaron 2026-08-26 supplied the discrimination rule: same creator + same network => join
// by default on network boot; different owners + different networks => federate. Two
// failure modes follow from it directly, and both are structural rather than incidental:
//
//   GUARD 1 — a join must never silently destroy state. `hasSomethingToLose` is measured
//             from the node's own datastore, never read from a policy flag. See
//             `privacy-budget-is-hard-money-earned-by-others`: spend yes, stake yes,
//             CONFISCATE never. A boot-time wipe is confiscation with no initiator at all.
//
//   GUARD 2 — "same owner" must be PROVEN cryptographically. The network answers
//             "who is nearby", NEVER "who is trusted". `NetworkLocality` is therefore a
//             discovery hint and is deliberately not an input to the trust decision;
//             `decideJoin` ignores it except to choose between two already-permitted
//             shapes. Unproven owner fails CLOSED, matching `DerivationProtocol`'s
//             precedent that unknown blocks rather than permits.
//
// NOTHING HERE PERFORMS ANYTHING. Every operation this module identifies is returned as a
// printed `Act` for a human to run, and each `Act` must declare what it DESTROYS.

// ---------------------------------------------------------------------------
// Acts — a named operation this tool will never run
// ---------------------------------------------------------------------------

/**
 * One step a human would perform.
 *
 * `destroys` is the field that distinguishes this from a generic remedy step, and it is
 * the whole reason this type is not `estate.ts`'s `RemedyStep`. An act that destroys
 * something must SAY SO at the point it is proposed, so a cost can never be discovered
 * after it has been paid. An empty array means "this act destroys nothing", which is a
 * claim the author is making on the record — not an absence of thought.
 */
export interface Act {
  readonly why: string;
  readonly command?: string;
  readonly note?: string;
  /** What is irrecoverably lost by running this. Empty = destroys nothing. */
  readonly destroys: readonly string[];
}

/**
 * Validate an act. Throws when the PROPOSING code is defective.
 *
 * An act with no `why`, or with neither a command nor a note, is the vacuity class: it
 * looks like a plan and instructs nobody. `destroys` is required to be present (TypeScript
 * enforces that) precisely so that omitting it is impossible rather than merely discouraged.
 */
export function act(a: Act): Act {
  if (a.why.trim() === "") throw new Error("act: `why` must be non-empty");
  if (a.command === undefined && a.note === undefined) {
    throw new Error("act: needs a command or a note");
  }
  if (a.command !== undefined && a.command.includes("\n")) {
    throw new Error("act: a command must be a single line");
  }
  for (const d of a.destroys) {
    if (d.trim() === "") throw new Error("act: a `destroys` entry must be non-empty");
  }
  return a;
}

/** True when running this act loses something that cannot be recovered afterwards. */
export function isDestructive(a: Act): boolean {
  return a.destroys.length > 0;
}

// ---------------------------------------------------------------------------
// Observation — structurally compatible with estate.ts's `ObservedNode`
// ---------------------------------------------------------------------------

/**
 * What a read-only probe saw at one address.
 *
 * Deliberately a SUBSET of `estate.ts`'s `ObservedNode` and structurally assignable from
 * it, so that when PR #15641 lands, `estate.ts` can hand its observations straight to this
 * module with no adapter and no import cycle. Absence is `undefined`, never a default — an
 * unrun check must not be able to wear the answer of a check that ran.
 */
export interface ObservedServer {
  readonly address: string;
  readonly apiServerResponded: boolean;
  /** The node's own claim about its name, from its API certificate SAN list. */
  readonly servedNodeName: string | undefined;
  /** SHA-256 of the cluster CA's SubjectPublicKeyInfo. THIS IS THE CLUSTER'S IDENTITY. */
  readonly caPublicKeySha256: string | undefined;
}

/** One sovereign cluster: a distinct trust root and the servers that present it. */
export interface SovereignCluster {
  readonly caPublicKeySha256: string;
  /** Addresses presenting this CA, sorted. */
  readonly members: readonly string[];
  /** Node names those servers claim for themselves, sorted. Absent names are omitted. */
  /** Each member's own claimed name, POSITIONALLY ALIGNED with `members`; `undefined`
   *  where the certificate carried only generic names. The alignment is why the two are
   *  sorted together as pairs — sorting them independently mispairs an address with
   *  another node's name, which is a wrong answer that looks like a right one. */
  readonly memberNames: readonly (string | undefined)[];
}

/** The estate's actual shape. A neutral report — it contains no verdict. */
export interface EstateShape {
  readonly clusters: readonly SovereignCluster[];
  /** Serving an API but presenting no readable CA: identity NOT established. */
  readonly unidentified: readonly string[];
  /** Probed and not serving a Kubernetes API at all. */
  readonly notServing: readonly string[];
}

/**
 * Partition observations into sovereign clusters by CA public key.
 *
 * Grouping is on the KEY, never on the issuer string. k3s writes
 * `CN=k3s-server-ca@<epoch>`, which is informative but is not a key: two clusters founded
 * in the same second would collide on the string and are distinct on the key.
 */
/** Ordinal (code-unit) string order. NOT `localeCompare`, which is linguistic and varies
 *  by locale — `culture-invariant-by-default` requires the canonical ordinal collation so
 *  two machines produce byte-identical reports. */
function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function partitionBySovereignty(observed: readonly ObservedServer[]): EstateShape {
  const byCa = new Map<string, { address: string; name: string | undefined }[]>();
  const unidentified: string[] = [];
  const notServing: string[] = [];

  for (const o of observed) {
    if (!o.apiServerResponded) {
      notServing.push(o.address);
      continue;
    }
    if (o.caPublicKeySha256 === undefined) {
      unidentified.push(o.address);
      continue;
    }
    const bucket = byCa.get(o.caPublicKeySha256) ?? [];
    bucket.push({ address: o.address, name: o.servedNodeName });
    byCa.set(o.caPublicKeySha256, bucket);
  }

  const clusters = [...byCa.entries()]
    .map(([caPublicKeySha256, pairs]) => {
      // Sorted as PAIRS so `members[i]` and `memberNames[i]` stay the same machine.
      const sorted = [...pairs].sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
      return {
        caPublicKeySha256,
        members: sorted.map((p) => p.address),
        memberNames: sorted.map((p) => p.name),
      };
    })
    .sort((a, b) =>
      a.caPublicKeySha256 < b.caPublicKeySha256 ? -1 : a.caPublicKeySha256 > b.caPublicKeySha256 ? 1 : 0,
    );

  return {
    clusters,
    unidentified: [...unidentified].sort(ordinal),
    notServing: [...notServing].sort(ordinal),
  };
}

// ---------------------------------------------------------------------------
// GUARD 1 — does this node have anything to lose?
// ---------------------------------------------------------------------------

/**
 * What a node is currently holding, as MEASURED on the node.
 *
 * Every field is an observation, not a policy declaration. This is the point: a
 * `join: true` flag in a manifest is an assertion by whoever wrote the manifest, and the
 * node it would wipe is not that person. The discriminator has to be a property of the
 * node itself, checkable by the node itself, before it consents to anything.
 */
export interface NodeHoldings {
  /** `/var/lib/rancher/k3s/server/db` exists. The single most important field: k3s
   *  IGNORES `--server`/`--cluster-init` entirely when this is true (see the research
   *  note), so a declarative "join" against such a node is a silent no-op. */
  readonly hasEtcdDatastore: boolean;
  /** etcd members this node knows about. >1 means other servers depend on it. */
  readonly etcdMemberCount: number;
  /** Namespaces outside the system set. >0 means someone has actually used this cluster. */
  readonly nonSystemNamespaces: number;
  /** Bound PVCs. Data on local disk that a wipe would orphan. */
  readonly boundPersistentVolumeClaims: number;
}

/** A node with nothing to lose: no datastore, no members, no namespaces, no volumes. */
export const EMPTY_HOLDINGS: NodeHoldings = {
  hasEtcdDatastore: false,
  etcdMemberCount: 0,
  nonSystemNamespaces: 0,
  boundPersistentVolumeClaims: 0,
};

/**
 * Does this node hold anything a join would destroy?
 *
 * Note that `hasEtcdDatastore` alone is sufficient. A freshly founded, entirely empty
 * cluster still holds its own CA and its own cluster identity, and destroying that IS a
 * loss — the node's name in every certificate it ever issued stops verifying. Treating an
 * empty-but-founded cluster as "nothing to lose" is the exact rounding-up this guard exists
 * to prevent.
 */
export function hasSomethingToLose(h: NodeHoldings): boolean {
  return (
    h.hasEtcdDatastore ||
    h.etcdMemberCount > 0 ||
    h.nonSystemNamespaces > 0 ||
    h.boundPersistentVolumeClaims > 0
  );
}

/** Everything a reset-and-join would destroy on this node, itemised for consent. */
export function whatAJoinWouldDestroy(h: NodeHoldings): readonly string[] {
  const out: string[] = [];
  if (h.hasEtcdDatastore) {
    out.push(
      "this node's own cluster CA and cluster identity — every certificate it issued stops verifying",
    );
    out.push("the embedded etcd datastore at /var/lib/rancher/k3s/server/db");
  }
  if (h.etcdMemberCount > 1) {
    out.push(
      `etcd membership for ${String(h.etcdMemberCount)} server(s) — the remaining members lose quorum`,
    );
  }
  if (h.nonSystemNamespaces > 0) {
    out.push(`${String(h.nonSystemNamespaces)} non-system namespace(s) and everything in them`);
  }
  if (h.boundPersistentVolumeClaims > 0) {
    out.push(`${String(h.boundPersistentVolumeClaims)} bound PersistentVolumeClaim(s)`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// GUARD 2 — owner identity is proven, never asserted
// ---------------------------------------------------------------------------

/**
 * Whether the OTHER side's owner has been cryptographically proven to this node.
 *
 * `proven` requires a signature verified against a key THIS NODE ALREADY HOLDS — the
 * ssh-CA trust anchor in `full-ai-cluster/nixos/modules/ssh-ca.nix`, or its successor. It
 * is not a hostname, not a manifest field, and not reachability.
 */
export type OwnerProof =
  | {
      readonly kind: "proven";
      readonly owner: string;
      /** Which trust anchor verified it. Named so the proof is auditable after the fact. */
      readonly verifiedAgainstKeyId: string;
    }
  | { readonly kind: "unproven"; readonly reason: string };

/**
 * Where the peer was discovered.
 *
 * THIS IS A DISCOVERY HINT AND NOTHING ELSE. It answers "who is nearby"; it never answers
 * "who is trusted". Anyone on the LAN can claim to be on the LAN, so if co-presence were
 * allowed to stand in for owner identity, any host on the segment could present itself as
 * the same owner and absorb a booting node. `decideJoin` consumes this only AFTER owner
 * identity is already proven, to choose between two shapes that are both permitted.
 *
 * The in-repo statement of the same distinction, made about git remotes rather than
 * subnets: "the repo says WHICH cluster, the key says WHETHER you're in it. Conflating
 * them would make every forker a member."
 * (docs/research/2026-08-09-every-node-is-its-own-identity-provider-*.md §A)
 */
export type NetworkLocality = "same-network" | "different-network" | "unknown";

export interface JoinCandidate {
  readonly node: ObservedServer;
  /** The BOOTING node's own holdings — what it would give up. */
  readonly holdings: NodeHoldings;
  /** The owner of the cluster being joined, as proven to the booting node. */
  readonly targetOwner: OwnerProof;
  /** The booting node's own owner, from a key it holds. */
  readonly selfOwner: string;
  readonly locality: NetworkLocality;
}

/**
 * What should happen when a sovereign node meets a cluster.
 *
 * Four dispositions, and the ordering of the checks that produce them is load-bearing:
 * the fail-closed case is decided FIRST, so no later branch can be reached with an
 * unproven counterparty.
 */
export type JoinDisposition =
  /** Fresh node, proven same owner, same network. Aaron's frictionless case. */
  | { readonly verdict: "join-automatically"; readonly owner: string; readonly why: string }
  /** Proven same owner, but the node holds state. Offer; require an explicit act. */
  | {
      readonly verdict: "offer-join-requires-consent";
      readonly owner: string;
      readonly why: string;
      readonly wouldDestroy: readonly string[];
      readonly acts: readonly Act[];
    }
  /** Proven DIFFERENT owner. Both stay sovereign; share across a boundary instead. */
  | { readonly verdict: "federate"; readonly theirOwner: string; readonly why: string }
  /** Owner not proven. Fail closed. */
  | { readonly verdict: "refuse"; readonly why: string; readonly acts: readonly Act[] };

/**
 * The discrimination rule.
 *
 * Aaron 2026-08-26: "if a cluster is by the same creator on the same network it should
 * assume join by default on network boot, but likely federate if by different owners on
 * different networks."
 *
 * Read literally that is a rule over (owner, network). Implemented literally it would be
 * unsafe, because `network` is attacker-supplied. So the rule is implemented as:
 *
 *   1. owner PROVEN?          no  -> refuse (guard 2; unknown blocks, never permits)
 *   2. owner the SAME?        no  -> federate (there is a second party to negotiate with)
 *   3. anything to lose?      yes -> offer, require consent (guard 1; never confiscate)
 *   4. same network?          no  -> offer, require consent (a WAN join is a real choice)
 *                             yes -> join automatically
 *
 * Network locality is consulted only at step 4, after trust is already settled, which is
 * exactly its status as a hint. Note what step 2 encodes: same owner means there is no
 * second party to negotiate with, so joining yourself needs no consent protocol; different
 * owner means there is one, and federation is what preserves both sovereignties instead of
 * one absorbing the other.
 */
export function decideJoin(c: JoinCandidate): JoinDisposition {
  if (c.targetOwner.kind === "unproven") {
    return {
      verdict: "refuse",
      why:
        `owner of the cluster at ${c.node.address} is not proven (${c.targetOwner.reason}). ` +
        "Network co-presence is a discovery hint, never a trust signal: anyone on this " +
        "segment can claim to be on this segment. Joining on an unproven claim would let " +
        "any host on the network absorb this node — and under join-by-default, absorb it " +
        "automatically. Unknown blocks rather than permits.",
      acts: [
        act({
          why: "Establish the trust anchor this node checks owner signatures against.",
          note:
            "full-ai-cluster/nixos/modules/ssh-ca.nix is the pre-cluster CA (currently " +
            "additive and inert; it activates when a CA pubkey is committed and the module " +
            "is imported).",
          destroys: [],
        }),
        act({
          why: "Until an owner is proven, the node stays sovereign. That is a safe state, not a stuck one.",
          note: "No act is required. A sovereign single-node cluster is fully functional.",
          destroys: [],
        }),
      ],
    };
  }

  const theirOwner = c.targetOwner.owner;
  if (theirOwner !== c.selfOwner) {
    return {
      verdict: "federate",
      theirOwner,
      why:
        `proven owner '${theirOwner}' differs from this node's owner '${c.selfOwner}'. ` +
        "There is a second party here, so absorbing one cluster into the other would " +
        "resolve by one sovereignty ending. Federation shares selected resources across a " +
        "boundary and both sides stay sovereign — agreement as pairwise overlap of local " +
        "policies, never a global one.",
    };
  }

  const toLose = whatAJoinWouldDestroy(c.holdings);
  if (hasSomethingToLose(c.holdings)) {
    return {
      verdict: "offer-join-requires-consent",
      owner: theirOwner,
      why:
        "owner is proven and matches, but this node is holding state. Joining resets its " +
        "datastore, so an automatic join here would be a boot-time wipe — confiscation " +
        "with no initiator at all, firing exactly when someone reboots a machine they " +
        "forgot was carrying something.",
      wouldDestroy: toLose,
      acts: [
        act({
          why: "Take a snapshot first. This is what makes the loss a spend rather than a confiscation.",
          command: "k3s etcd-snapshot save --name pre-join",
          destroys: [],
        }),
        act({
          why:
            "k3s IGNORES --server when a datastore exists on disk, so the datastore must be " +
            "removed for the join to take effect at all. This is the irreversible step.",
          command: "sudo rm -rf /var/lib/rancher/k3s/server/db",
          destroys: [...toLose],
        }),
        act({
          why: "Rejoin as a server against the surviving cluster, using its token.",
          command: `sudo k3s server --server https://${c.node.address}:6443 --token-file /var/lib/rancher/k3s/server/token`,
          destroys: [],
        }),
      ],
    };
  }

  if (c.locality !== "same-network") {
    return {
      verdict: "offer-join-requires-consent",
      owner: theirOwner,
      why:
        "owner is proven and matches and this node holds nothing, but the cluster is not " +
        "on this network. Aaron's automatic case is same-creator AND same-network; a join " +
        "across networks is a deliberate choice and is offered rather than taken.",
      wouldDestroy: [],
      acts: [
        act({
          why: "Join explicitly once the cross-network path is intended.",
          command: `sudo k3s server --server https://${c.node.address}:6443 --token-file /var/lib/rancher/k3s/server/token`,
          destroys: [],
        }),
      ],
    };
  }

  return {
    verdict: "join-automatically",
    owner: theirOwner,
    why:
      "proven same owner, same network, and this node holds nothing that a join would " +
      "destroy. There is no second party to negotiate with and nothing to lose, so no " +
      "consent protocol is owed to anyone.",
  };
}

// ---------------------------------------------------------------------------
// The three removal operations
// ---------------------------------------------------------------------------

/**
 * Aaron 2026-08-26: "a cluster creator should be able to remove it."
 *
 * "It" is ambiguous between a MEMBER and the CLUSTER, so all three operations are covered
 * rather than one being guessed at. They are genuinely distinct and must not be conflated:
 * they differ in who initiates, what survives, and who pays.
 */
export type RemovalOperation =
  /** (1) A member leaves of its own accord and becomes sovereign again. */
  | "member-secedes"
  /** (2) The creator removes a member from the cluster. */
  | "creator-evicts-member"
  /** (3) The creator dissolves the cluster; all members return to sovereignty. */
  | "creator-dissolves-cluster";

export interface RemovalPlan {
  readonly operation: RemovalOperation;
  /** Who starts it. The spend/stake/confiscate distinction turns on exactly this. */
  readonly initiator: "the member" | "the creator";
  /** What the departing node still has afterwards. Empty here would be confiscation. */
  readonly departingNodeRetains: readonly string[];
  readonly acts: readonly Act[];
  /** Stated limits and open questions, never silently omitted. */
  readonly caveats: readonly string[];
}

/**
 * The named acts for one removal operation. NOTHING IS RUN — this returns a printed plan.
 *
 * `address` is the departing node; `clusterAddress` is a surviving server of the cluster.
 * `nodeName` is the Kubernetes node name, which is what `kubectl delete node` takes.
 */
export function removalPlan(
  operation: RemovalOperation,
  subject: { readonly nodeName: string; readonly address: string; readonly clusterAddress: string },
): RemovalPlan {
  const { nodeName, address, clusterAddress } = subject;

  switch (operation) {
    case "member-secedes":
      return {
        operation,
        initiator: "the member",
        departingNodeRetains: [
          "its full datastore contents — `--cluster-reset` forgets peers, it does not wipe data",
          "the cluster CA it was issued (it keeps serving the SAME trust root, now alone)",
          "every workload and PVC that was scheduled on it",
        ],
        acts: [
          act({
            why: "Drain first so workloads reschedule rather than vanish.",
            command: `kubectl drain ${nodeName} --delete-emptydir-data --ignore-daemonsets`,
            destroys: [],
          }),
          act({
            why: "Stop k3s on the departing node BEFORE the cluster removes it, or etcd membership churns.",
            command: `ssh zeta@${address} sudo systemctl stop k3s`,
            destroys: [],
          }),
          act({
            why:
              "Remove it from the cluster and from etcd membership. k3s' controller does the " +
              "etcd member removal as a consequence of this.",
            command: `kubectl --server https://${clusterAddress}:6443 delete node ${nodeName}`,
            destroys: [`${nodeName}'s membership in the cluster (its LOCAL data is untouched)`],
          }),
          act({
            why:
              "Become sovereign again. The k3s flag is documented as 'Forget all peers and " +
              "become sole member of a new cluster' — membership resets, the datastore does not.",
            command: `ssh zeta@${address} sudo k3s server --cluster-reset`,
            destroys: ["knowledge of the former peers (the data they held on THIS node survives)"],
          }),
        ],
        caveats: [
          "MEASURED: `--cluster-reset` is documented as 'Forget all peers and become sole " +
            "member of a new cluster'. CONSISTENT WITH: it preserves the datastore and the CA, " +
            "since neither is named as removed. Not verified against a live node here.",
          "The seceding node keeps serving the ORIGINAL cluster CA, so it and its former " +
            "cluster now share a trust root while being separate clusters. That is a real and " +
            "unresolved property, not a wart to paper over — CA rotation on secession is an " +
            "open design question.",
        ],
      };

    case "creator-evicts-member":
      return {
        operation,
        initiator: "the creator",
        departingNodeRetains: [
          "its local datastore, untouched — eviction removes membership, not disk contents",
          "its own identity and its ability to `--cluster-reset` into a sovereign cluster",
        ],
        acts: [
          act({
            why: "Drain so the member's workloads move rather than disappear.",
            command: `kubectl drain ${nodeName} --delete-emptydir-data --ignore-daemonsets`,
            destroys: [],
          }),
          act({
            why: "Stop k3s on the member first; one node at a time, so the cluster keeps quorum.",
            command: `ssh zeta@${address} sudo systemctl stop k3s`,
            destroys: [],
          }),
          act({
            why: "Remove membership. This is the eviction.",
            command: `kubectl --server https://${clusterAddress}:6443 delete node ${nodeName}`,
            destroys: [`${nodeName}'s membership and its access to cluster-held secrets`],
          }),
          act({
            why:
              "Hand the evicted node back its sovereignty rather than leaving it stranded. " +
              "The creator may evict; the creator may NOT reach into the member's disk.",
            command: `ssh zeta@${address} sudo k3s server --cluster-reset`,
            destroys: [],
          }),
        ],
        caveats: [
          "THE CONFISCATION LINE: eviction is legitimate and destroying the evicted node's " +
            "local state is not. The creator's authority ends at cluster membership. Any " +
            "eviction procedure that also wipes the member's datastore is confiscation — the " +
            "operation this repo's economy forbids in every other currency (spend yes, stake " +
            "yes, confiscate never).",
          "OPEN — Aaron's call: whether an evicted node may retain data it replicated FROM the " +
            "cluster while a member. It holds an etcd copy of everything, including secrets. " +
            "Retention preserves its memory (§5); revocation protects the cluster. Both are " +
            "defensible and this is not an audit result.",
        ],
      };

    case "creator-dissolves-cluster":
      return {
        operation,
        initiator: "the creator",
        departingNodeRetains: [
          "every former member keeps its own datastore copy and returns to sovereignty",
          "the shared CA survives on each of them, which is what makes dissolution reversible-ish",
        ],
        acts: [
          act({
            why: "Snapshot before dissolving. Dissolution without a snapshot is unrecoverable.",
            command: `ssh zeta@${clusterAddress} sudo k3s etcd-snapshot save --name pre-dissolve`,
            destroys: [],
          }),
          act({
            why:
              "Each member forgets its peers and becomes its own cluster. Run per node; there " +
              "is no single 'dissolve' verb in k3s.",
            command: `ssh zeta@${address} sudo k3s server --cluster-reset`,
            destroys: ["the joint cluster as a coordinating entity"],
          }),
          act({
            why:
              "After dissolution every former member serves the SAME CA while being a separate " +
              "cluster. Decide whether to rotate CAs so the trust roots diverge with the clusters.",
            note:
              "k3s exposes `k3s certificate rotate-ca`. Untested here and named as a decision, " +
              "not a step.",
            destroys: [],
          }),
        ],
        caveats: [
          "Dissolution is the only one of the three where NOBODY is removed — every member is " +
            "restored to the state it would have had if it had never joined. That makes it the " +
            "cheapest of the three in state terms and the most expensive in coordination.",
          "CONSISTENT WITH, not measured: that N nodes each running `--cluster-reset` yields N " +
            "working sovereign clusters. The documented behaviour is per-node; the aggregate " +
            "claim has not been observed.",
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the estate's shape.
 *
 * Note what this does NOT do: it does not call two clusters a failure. Under
 * sovereign-by-default two clusters is a correct and expected reading, so the report
 * states the count and leaves the verdict to whoever declared an intent.
 */
export function renderEstateShape(shape: EstateShape): string {
  const rule = "-".repeat(78);
  const lines: string[] = [rule, "  estate sovereignty — what shape is this estate?", rule];

  const n = shape.clusters.length;
  lines.push(
    `  CLUSTERS    ${String(n)} sovereign cluster(s). This is a COUNT, not a verdict:`,
    "              a node is sovereign on boot by design (clusterInit defaults true),",
    "              so N clusters is the expected shape, never a defect by itself.",
    "",
  );

  for (const [i, c] of shape.clusters.entries()) {
    lines.push(`  cluster ${String(i + 1)}  ca=${c.caPublicKeySha256.slice(0, 16)}…`);
    for (const [j, m] of c.members.entries()) {
      lines.push(`              ${m.padEnd(16)} says "${c.memberNames[j] ?? "-"}"`);
    }
  }

  if (shape.unidentified.length > 0) {
    lines.push(
      "",
      `  UNIDENTIFIED ${shape.unidentified.join(", ")}`,
      "              serving an API but presenting no readable CA. Cluster identity is",
      "              NOT established for these — they are counted nowhere above.",
    );
  }
  if (shape.notServing.length > 0) {
    lines.push("", `  NOT SERVING ${shape.notServing.join(", ")} (no Kubernetes API answered)`);
  }

  lines.push(rule);
  return lines.join("\n");
}

/** Render a removal plan. The `destroys` lines are the point — they are never elided. */
export function renderRemovalPlan(plan: RemovalPlan): string {
  const rule = "-".repeat(78);
  const lines: string[] = [
    rule,
    `  removal plan — ${plan.operation}`,
    rule,
    `  INITIATOR   ${plan.initiator}`,
    "",
    "  THE DEPARTING NODE RETAINS",
  ];
  for (const r of plan.departingNodeRetains) lines.push(`    - ${r}`);
  lines.push("", "  ACTS (printed only — this tool runs none of them)");
  for (const [i, a] of plan.acts.entries()) {
    lines.push(`    ${String(i + 1)}. ${a.why}`);
    if (a.command !== undefined) lines.push(`       $ ${a.command}`);
    if (a.note !== undefined) lines.push(`       ${a.note}`);
    for (const d of a.destroys) lines.push(`       DESTROYS: ${d}`);
  }
  lines.push("", "  CAVEATS");
  for (const c of plan.caveats) lines.push(`    - ${c}`);
  lines.push(rule);
  return lines.join("\n");
}
