// full-ai-cluster/tools/cluster-bringup/estate.ts
//
// THE PURE HALF of the cluster bring-up ladder. No filesystem, no network, no clock.
// Every door this module needs is a parameter, so the whole ladder is testable offline
// and replays deterministically (§7 DST, §13 noninterference).
//
// WHAT THIS ANSWERS, and why nothing answered it before:
//
//   "Is the node estate ONE cluster?"
//
// `audit-vault-topology-coherence.ts` checks that the Vault Application's *values* are
// self-consistent, and it is honest that it reads the values rather than a cluster. So a
// manifest can declare `cluster.zeta.io/topology: single-node`, pass every one of its
// twelve rules, and still be pointed at an estate that is two clusters wearing one name.
// That is exactly the state measured on 2026-08-26 (see the research note beside this
// file). Initialising Vault against such an estate mints a root token on whichever of the
// two clusters the operator's kubeconfig happened to name — an irreversible act taken
// against an unidentified subject.
//
// THE LADDER deliberately mirrors `Readiness<TStage>` in
// `tools/setup/persona-keys/ceremony-handoff.ts` — same three rungs, same exit codes
// (ready 0 / actionable 3 / blocked 1), same rule that a blocked stage MUST carry a
// remedy. It is mirrored rather than imported on purpose: that module's dependency graph
// reaches `biometric.ts`, and a read-only prober must not have a biometric door anywhere
// on its graph. When the *apply* half of Vault bring-up is written it belongs in
// `tools/setup/persona-keys/` and must call `runGatedCeremony` directly rather than
// re-deriving any of this.
//
// THERE IS NO APPLY PATH IN THIS DIRECTORY, BY CONSTRUCTION. This module and its CLI
// read and classify. Every act they identify is printed for a human to run.

/** A single-line, paste-able command, or a note. At least one of `command` / `note`. */
export interface RemedyStep {
  readonly why: string;
  readonly command?: string;
  readonly note?: string;
}

/** A refusal that says what, why, and how to get past it. `remedy` is never empty. */
export interface Refusal {
  readonly code: string;
  readonly what: string;
  readonly why: string;
  readonly remedy: readonly RemedyStep[];
}

/**
 * ready      — the estate is one identified cluster and the operator can address it.
 * actionable — the subject ANSWERED and lacks a prerequisite. Expected. One act away.
 * blocked    — something is actually wrong; `stage` names which, and carries its remedy.
 */
export type Readiness<TStage extends string> =
  | { readonly rung: "ready"; readonly detail: string }
  | { readonly rung: "actionable"; readonly detail: string; readonly nextAct: readonly RemedyStep[] }
  | { readonly rung: "blocked"; readonly stage: TStage; readonly refusal: Refusal };

/** Every way the estate can be genuinely wrong. Adding a member forces a remedy, because
 *  `blocked()` validates the refusal it is handed. */
export type ClusterBringupStage =
  | "no-node-records"
  | "duplicate-mac-in-inventory"
  | "no-node-answered"
  | "control-plane-split"
  | "inventory-disagrees-with-reality";

/** Validate a refusal. Throws when the *refusing code* is defective — an empty remedy is
 *  the same defect as a check that cannot fail: it looks like a refusal and helps nobody. */
export function refusal(r: Refusal): Refusal {
  if (r.code.trim() === "") throw new Error("refusal: `code` must be non-empty");
  if (r.what.trim() === "") throw new Error("refusal: `what` must be non-empty");
  if (r.why.trim() === "") throw new Error("refusal: `why` must be non-empty");
  if (r.remedy.length === 0) throw new Error(`refusal(${r.code}): remedy must be non-empty`);
  for (const step of r.remedy) {
    if (step.why.trim() === "") throw new Error(`refusal(${r.code}): a remedy step needs a why`);
    if (step.command === undefined && step.note === undefined) {
      throw new Error(`refusal(${r.code}): a remedy step needs a command or a note`);
    }
    if (step.command !== undefined && step.command.includes("\n")) {
      throw new Error(`refusal(${r.code}): a remedy command must be a single line`);
    }
  }
  return r;
}

export function blocked<TStage extends string>(stage: TStage, r: Refusal): Readiness<TStage> {
  return { rung: "blocked", stage, refusal: refusal(r) };
}

/** The middle rung. Validated by the same rules as a remedy: an `actionable` rung that
 *  does not say what the remaining act IS has thrown away its entire reason to exist. */
export function actionable<TStage extends string>(
  detail: string,
  nextAct: readonly RemedyStep[],
): Readiness<TStage> {
  refusal({ code: "actionable", what: detail, why: "middle rung", remedy: nextAct });
  return { rung: "actionable", detail, nextAct };
}

/** The exit-code mapping, total and in one place so a caller cannot quietly collapse
 *  `3` into `1` and lose the distinction between "not yet" and "broken". */
export function readinessExitCode(r: Readiness<string>): 0 | 1 | 3 {
  switch (r.rung) {
    case "ready":
      return 0;
    case "actionable":
      return 3;
    case "blocked":
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Records (what the repo believes) and observations (what the network says)
// ---------------------------------------------------------------------------

/** One `maintainers/<who>/cluster-nodes/<node>/node.yaml`, reduced to the fields that
 *  decide cluster identity. */
export interface NodeRecord {
  readonly name: string;
  readonly hostname: string;
  readonly mac: string;
  readonly maintainer: string;
  /** The nixos flake host this machine was flashed from. `control-plane` on two machines
   *  is the mechanism behind `control-plane-split`, because `k3s-server.nix` sets
   *  `clusterInit = lib.mkDefault true`: every machine flashed that way FOUNDS a cluster. */
  readonly flakeHost: string | undefined;
  readonly sourcePath: string;
}

/** What a probe actually saw at one address. Every field is what was measured; absence is
 *  represented as `undefined` rather than a default, so an unrun check cannot wear the
 *  answer of a check that ran. */
export interface ObservedNode {
  readonly address: string;
  readonly mac: string | undefined;
  readonly icmpResponded: boolean;
  readonly apiServerResponded: boolean;
  /** The node name in the API server certificate's SAN list. This is the machine's own
   *  claim about who it is, and is the thing to reconcile the inventory against. */
  readonly servedNodeName: string | undefined;
  /** SHA-256 of the cluster CA's SubjectPublicKeyInfo. THIS IS THE CLUSTER'S IDENTITY:
   *  two k3s servers sharing a cluster share this value, and two servers that each ran
   *  `--cluster-init` never do. Comparing issuer *strings* is not enough — the string is
   *  attacker-chosen and, more mundanely, could collide. */
  readonly caPublicKeySha256: string | undefined;
}

export interface EstateInput {
  readonly records: readonly NodeRecord[];
  readonly observed: readonly ObservedNode[];
  /** Local kubeconfig contexts, as `name -> server URL`. Used only to decide whether the
   *  operator can address the cluster at all; never to decide what the cluster IS. */
  readonly kubeContexts: readonly { readonly name: string; readonly server: string }[];
}

/**
 * Normalise a MAC address for comparison.
 *
 * This exists because it bit the measurement that produced this module: `arp -n` prints
 * `80:84:89:1:c5:16` while the node record stores `80:84:89:01:c5:16`. A naive string
 * compare reports the node as absent from the ARP table — a false negative that reads
 * exactly like "the machine is off".
 */
export function normaliseMac(mac: string): string {
  return mac
    .trim()
    .toLowerCase()
    .split(":")
    .map((octet) => octet.padStart(2, "0"))
    .join(":");
}

/** Extract the fields that decide identity from one `node.yaml`.
 *
 *  A targeted reader rather than a YAML parse: these files are generated by
 *  `full-ai-cluster/tools/cluster-inventory/capture.ts` in a fixed shape, and adding a
 *  YAML dependency to a bring-up prober buys nothing. The honest limit: a hand-edited
 *  record in a different shape reads as missing fields, which surfaces as
 *  `no-node-records` rather than as a silent wrong answer. */
export function parseNodeRecord(yamlText: string, sourcePath: string): NodeRecord | undefined {
  const one = (re: RegExp): string | undefined => {
    const m = re.exec(yamlText);
    return m?.[1]?.replace(/^["']|["']$/g, "").trim();
  };
  const name = one(/^\s{2}name:\s*(.+)$/m);
  const hostname = one(/^\s{2}hostname:\s*(.+)$/m);
  const mac = one(/^\s*mac:\s*(.+)$/m);
  const maintainer = one(/maintainer:\s*(.+)$/m);
  // The key appears both bare (`    flake-host: "x"`) and annotation-prefixed
  // (`    zeta.lucent-financial-group.com/flake-host: "x"`). Anchoring on the bare form
  // alone silently returned undefined for every real record — caught by the test below.
  const flakeHost = one(/(?:^|\/)flake-host:\s*(.+)$/m);
  if (name === undefined || hostname === undefined || mac === undefined || mac === "") {
    return undefined;
  }
  return {
    name,
    hostname,
    mac: normaliseMac(mac),
    maintainer: maintainer ?? "unknown",
    flakeHost,
    sourcePath,
  };
}

/** MAC addresses claimed by more than one record. A duplicate means the inventory cannot
 *  identify a machine, which makes every downstream reconciliation meaningless. */
export function duplicateMacs(records: readonly NodeRecord[]): readonly string[] {
  const seen = new Map<string, number>();
  for (const r of records) seen.set(r.mac, (seen.get(r.mac) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([mac]) => mac).sort();
}

/** The distinct cluster identities among nodes that actually served the API. More than
 *  one means the estate is not a cluster; it is several. */
export function distinctClusterIdentities(observed: readonly ObservedNode[]): readonly string[] {
  const keys = new Set<string>();
  for (const o of observed) {
    if (o.apiServerResponded && o.caPublicKeySha256 !== undefined) keys.add(o.caPublicKeySha256);
  }
  return [...keys].sort();
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

/**
 * Classify the estate.
 *
 * Order is load-bearing. `actionable` is reachable only after every check that COULD have
 * failed has run and passed — except where a check is not merely unrun but inapplicable,
 * and in that one case (nothing serves an API, so there is no cluster identity to compare)
 * the rung says so in its own text rather than implying the comparison happened.
 */
export function classifyEstate(input: EstateInput): Readiness<ClusterBringupStage> {
  const { records, observed, kubeContexts } = input;

  if (records.length === 0) {
    return blocked("no-node-records", {
      code: "no-node-records",
      what: "refusing to classify an estate with no node records",
      why:
        "With no inventory there is nothing to reconcile the network against, so any node " +
        "that answers is an unidentified machine. Bring-up decisions — above all Vault " +
        "initialisation — would be taken against an unknown subject.",
      remedy: [
        {
          why: "Node records are written at provisioning time under each maintainer's directory.",
          command: "ls maintainers/*/cluster-nodes/*/node.yaml",
        },
        {
          why: "If the estate genuinely has no provisioned nodes, provisioning comes first.",
          note: "See full-ai-cluster/PROVISIONING.md.",
        },
      ],
    });
  }

  const dupes = duplicateMacs(records);
  if (dupes.length > 0) {
    return blocked("duplicate-mac-in-inventory", {
      code: "duplicate-mac-in-inventory",
      what: `refusing to trust an inventory in which ${dupes.length} MAC address(es) name more than one node`,
      why:
        "A MAC is how an observation on the wire is tied back to a record. When two records " +
        "claim one MAC the mapping is ambiguous, so 'which machine is this' has no answer " +
        "and every later reconciliation is decorative.",
      remedy: [
        {
          why: "Find the colliding records and decide which one is real.",
          command: `grep -rl '${dupes[0]}' maintainers/*/cluster-nodes/*/node.yaml`,
        },
        {
          why: "A record can be re-captured from the live machine rather than hand-edited.",
          note: "full-ai-cluster/tools/cluster-inventory/capture.ts writes the hardware inventory.",
        },
      ],
    });
  }

  const answered = observed.filter((o) => o.icmpResponded || o.apiServerResponded);
  if (answered.length === 0) {
    return blocked("no-node-answered", {
      code: "no-node-answered",
      what: "refusing to report on an estate where no recorded node answered",
      why:
        "Every recorded node is unreachable from here. That is a real failure rather than a " +
        "missing prerequisite: the machines may be powered off, or this workstation may be " +
        "on a different subnet than the one the nodes are on.",
      remedy: [
        {
          why: "Confirm which subnet this workstation is on before concluding the nodes are down.",
          command: "ipconfig getifaddr en0",
        },
        {
          why: "The nodes advertise over mDNS when the discovery module is active.",
          command: "dns-sd -B _zeta-k3s._tcp local",
        },
        {
          why: "A node that answers ICMP but not the API is a different, milder state.",
          note: "Re-run this command once the machines are known to be powered on.",
        },
      ],
    });
  }

  const serving = observed.filter((o) => o.apiServerResponded);
  if (serving.length === 0) {
    // NOT a failure: machines are up and no Kubernetes API is listening. This is the
    // ordinary state of provisioned-but-not-started hardware. The cluster-identity checks
    // below have NOT run, and this rung says so rather than implying they passed.
    return actionable(
      `${answered.length} node(s) answered; none is serving a Kubernetes API. ` +
        "The cluster-identity checks have NOT run yet — re-run status after k3s is up.",
      [
        {
          why: "k3s is declared by the nixos host config; confirm the unit is running on the node.",
          command: "ssh zeta@<node-address> systemctl status k3s",
        },
        {
          why: "A host flashed from a worker config joins a server; it does not start one.",
          note:
            "full-ai-cluster/nixos/modules/k3s-agent.nix points at https://control-plane:6443, " +
            "which must resolve from the node for a join to succeed.",
        },
        {
          why: "Re-run this ladder afterwards: cluster identity is unverified until an API answers.",
          command: "bun full-ai-cluster/tools/cluster-bringup/cli.ts status",
        },
      ],
    );
  }

  const identities = distinctClusterIdentities(serving);
  if (identities.length > 1) {
    const where = serving
      .filter((o) => o.caPublicKeySha256 !== undefined)
      .map((o) => `${o.address} -> ${o.caPublicKeySha256?.slice(0, 16)}`)
      .join(", ");
    return blocked("control-plane-split", {
      code: "control-plane-split",
      what: `refusing to call this estate one cluster: ${identities.length} distinct cluster CAs are serving (${where})`,
      why:
        "Each key is a separate trust root, so these are independent clusters that each " +
        "believe they are the control plane. Nothing that is applied to one is visible to " +
        "the other. Initialising Vault here would mint a root token and unseal shares on " +
        "whichever cluster the operator's kubeconfig happens to name — an irreversible act " +
        "against an unidentified subject. Which cluster survives is a human decision.",
      remedy: [
        {
          why: "See which machine each cluster CA belongs to before choosing.",
          command: "bun full-ai-cluster/tools/cluster-bringup/cli.ts status --verbose",
        },
        {
          why:
            "The mechanism is that k3s-server.nix sets clusterInit = lib.mkDefault true, so " +
            "every machine flashed from the control-plane host founds its own cluster.",
          command: "grep -n clusterInit full-ai-cluster/nixos/modules/k3s-server.nix",
        },
        {
          why: "Choosing which cluster is THE cluster is a maintainer decision, not an audit result.",
          note:
            "The others are then re-provisioned as agents (k3s-agent.nix) against the chosen " +
            "server, which destroys their local cluster state. That is not reversible either, " +
            "so it is named here and not performed.",
        },
      ],
    });
  }

  const byMac = new Map(records.map((r) => [r.mac, r]));
  for (const o of serving) {
    if (o.servedNodeName === undefined) continue;
    const record = o.mac === undefined ? undefined : byMac.get(normaliseMac(o.mac));
    const disagrees =
      record === undefined
        ? !records.some((r) => r.hostname === o.servedNodeName)
        : record.hostname !== o.servedNodeName;
    if (disagrees) {
      const recorded = record === undefined ? "no record for this MAC" : record.hostname;
      return blocked("inventory-disagrees-with-reality", {
        code: "inventory-disagrees-with-reality",
        what: `refusing to proceed: ${o.address} calls itself '${o.servedNodeName}' but the inventory says '${recorded}'`,
        why:
          "The machine's own certificate is the stronger evidence, so the record is stale — " +
          "most likely the machine was re-provisioned and the record never followed. Acting " +
          "on a stale inventory is how an irreversible command lands on the wrong box.",
        remedy: [
          {
            why: "Re-capture the record from the live machine rather than editing it by hand.",
            command: "bun full-ai-cluster/tools/cluster-inventory/capture.ts",
          },
          {
            why: "Confirm the machine's own claim first.",
            command: `echo | openssl s_client -connect ${o.address}:6443 2>/dev/null | openssl x509 -noout -ext subjectAltName`,
          },
        ],
      });
    }
  }

  const servingAddresses = new Set(serving.map((o) => o.address));
  const addressable = kubeContexts.filter((c) =>
    [...servingAddresses].some((a) => c.server.includes(a)),
  );
  if (addressable.length === 0) {
    return actionable(
      `one cluster identified (${identities[0]?.slice(0, 16)}) at ` +
        `${serving.map((o) => o.address).join(", ")}, but no local kubeconfig context addresses it`,
      [
        {
          why:
            "k3s writes the admin kubeconfig on the server at /etc/rancher/k3s/k3s.yaml, mode " +
            "0640, group wheel — so a wheel member can read it over SSH.",
          command: `ssh zeta@${serving[0]?.address} sudo cat /etc/rancher/k3s/k3s.yaml`,
        },
        {
          why:
            "That file names the server as 127.0.0.1; it must be rewritten to the node address " +
            "before it works from this workstation.",
          note:
            "Merging it into ~/.kube/config is an operator act with a credential in it. It is " +
            "named here and deliberately not performed by this tool.",
        },
      ],
    );
  }

  return {
    rung: "ready",
    detail:
      `one cluster (${identities[0]?.slice(0, 16)}) served by ${serving.length} node(s); ` +
      `inventory agrees; ${addressable.length} local context(s) address it`,
  };
}

/** Render a rung for an operator. `blocked` puts the remedy LAST so it survives a long
 *  scrollback, and looks the same as any other refusal in the repo. */
export function renderReadiness(title: string, r: Readiness<string>): string {
  const rule = "-".repeat(78);
  if (r.rung === "blocked") {
    const steps = r.refusal.remedy
      .map((s, i) => {
        const lines = [`  ${i + 1}. ${s.why}`];
        if (s.command !== undefined) lines.push(`     $ ${s.command}`);
        if (s.note !== undefined) lines.push(`     ${s.note}`);
        return lines.join("\n");
      })
      .join("\n");
    return [
      rule,
      `  ${title}`,
      rule,
      `  STATE       blocked — a real failure, not a missing prerequisite.`,
      `  STAGE       ${r.stage}`,
      `  WHAT        ${r.refusal.what}`,
      `  WHY         ${r.refusal.why}`,
      "",
      "  REMEDY",
      steps,
      rule,
    ].join("\n");
  }
  const lines = [rule, `  ${title}`, rule, `  STATE       ${r.rung}`, `  DETAIL      ${r.detail}`];
  if (r.rung === "ready") {
    lines.push("  NEXT        Nothing. The estate is one identified, addressable cluster.");
  } else {
    lines.push("  NEXT        EXPECTED. This is not a failure. The remaining act(s):");
    for (const [i, s] of r.nextAct.entries()) {
      lines.push(`    ${i + 1}. ${s.why}`);
      if (s.command !== undefined) lines.push(`       $ ${s.command}`);
      if (s.note !== undefined) lines.push(`       ${s.note}`);
    }
  }
  lines.push(rule);
  return lines.join("\n");
}
