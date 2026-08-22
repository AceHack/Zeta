/**
 * Falsifiers for the bootstrap-or-join decision.
 *
 * The cases that matter are the ones a lab never produces: a probe that could
 * not run, two clusters answering, a cluster in someone else`s trust domain, a
 * silence that arrived too fast to mean anything. Each is a value here, so
 * each is checked on every run with no network, no QEMU and no hardware.
 */

import { describe, expect, test } from "bun:test";

import { clusterIdFromK3sTokenPrefix, type ZetaClusterAdvertisement } from "./advertisement";
import {
  DEFAULT_DWELL_MS,
  MIN_QUERY_BURSTS,
  decideClusterBoot,
  pickEndpoint,
  silenceProblem,
  type ClusterBootDecisionInput,
  type DiscoveryProbeOutcome,
} from "./decide";

const CLUSTER_A = "a".repeat(64);
const CLUSTER_B = "b".repeat(64);

function advertisement(overrides: Partial<ZetaClusterAdvertisement> = {}): ZetaClusterAdvertisement {
  return {
    txtvers: 1,
    clusterId: CLUSTER_A,
    trustDomain: "zeta.home",
    role: "control-plane",
    nodeName: "node-ad1efd",
    hostname: "node-ad1efd.local",
    address: "10.88.0.1",
    port: 6443,
    ...overrides,
  };
}

function honestSilence(): DiscoveryProbeOutcome {
  return { kind: "silence", elapsedMs: DEFAULT_DWELL_MS, dwellMs: DEFAULT_DWELL_MS, queryBursts: MIN_QUERY_BURSTS };
}

function answered(advertisements: readonly ZetaClusterAdvertisement[]): DiscoveryProbeOutcome {
  return {
    kind: "responded",
    advertisements,
    malformed: [],
    elapsedMs: DEFAULT_DWELL_MS,
    dwellMs: DEFAULT_DWELL_MS,
    queryBursts: MIN_QUERY_BURSTS,
  };
}

function withToken(
  probe: DiscoveryProbeOutcome,
  extra: Partial<ClusterBootDecisionInput> = {},
): ClusterBootDecisionInput {
  return { probe, credentials: { tokenAvailable: true, source: "esp" }, ...extra };
}

describe("the four required outcomes", () => {
  test("found one cluster, with a token: JOIN it by name", () => {
    const decision = decideClusterBoot(withToken(answered([advertisement()])));
    expect(decision.action).toBe("join");
    if (decision.action !== "join") {
      return;
    }
    expect(decision.serverUrl).toBe("https://node-ad1efd.local:6443");
    expect(decision.clusterId).toBe(CLUSTER_A);
    expect(decision.endpointAddress).toBe("10.88.0.1");
  });

  test("found none, and the silence is admissible: BOOTSTRAP", () => {
    const decision = decideClusterBoot(withToken(honestSilence()));
    expect(decision.action).toBe("bootstrap");
  });

  test("found two distinct clusters: REFUSE, naming both", () => {
    const probe = answered([advertisement(), advertisement({ clusterId: CLUSTER_B, nodeName: "node-b1e1b5" })]);
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("multiple-clusters-answered");
    expect(decision.detail).toContain(CLUSTER_A);
    expect(decision.detail).toContain(CLUSTER_B);
  });
});

describe("trust domain", () => {
  test("one cluster, wrong trust domain: REFUSE", () => {
    const probe = answered([advertisement({ trustDomain: "someone-else.lan" })]);
    const decision = decideClusterBoot(withToken(probe, { policy: { expectedTrustDomain: "zeta.home" } }));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("trust-domain-mismatch");
  });

  test("one cluster, matching trust domain: JOIN", () => {
    const probe = answered([advertisement()]);
    const decision = decideClusterBoot(withToken(probe, { policy: { expectedTrustDomain: "zeta.home" } }));
    expect(decision.action).toBe("join");
  });

  test("answers for one cluster id disagree about the trust domain: REFUSE", () => {
    const probe = answered([advertisement(), advertisement({ nodeName: "node-b1e1b5", trustDomain: "other.lan" })]);
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("trust-domain-disagreement");
  });
});

describe("a failed probe is never an empty network", () => {
  const failures = ["browser-missing", "responder-unavailable", "no-carrier", "browser-error"] as const;
  for (const reason of failures) {
    test(`probe-failed(${reason}) refuses instead of bootstrapping`, () => {
      const probe: DiscoveryProbeOutcome = { kind: "probe-failed", reason, detail: "measured", elapsedMs: 12 };
      const decision = decideClusterBoot(withToken(probe));
      expect(decision.action).toBe("refuse");
      if (decision.action !== "refuse") {
        return;
      }
      expect(decision.reason).toBe("probe-failed");
      expect(decision.detail).toContain(reason);
    });
  }
});

describe("a silence has to be earned", () => {
  test("dwell shorter than the floor: REFUSE", () => {
    const probe: DiscoveryProbeOutcome = {
      kind: "silence",
      elapsedMs: 2_000,
      dwellMs: 2_000,
      queryBursts: MIN_QUERY_BURSTS,
    };
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("dwell-too-short");
  });

  test("probe returned before its own dwell elapsed: REFUSE", () => {
    const probe: DiscoveryProbeOutcome = {
      kind: "silence",
      elapsedMs: 900,
      dwellMs: DEFAULT_DWELL_MS,
      queryBursts: MIN_QUERY_BURSTS,
    };
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
  });

  test("dwell elapsed but almost no queries were sent: REFUSE", () => {
    const probe: DiscoveryProbeOutcome = {
      kind: "silence",
      elapsedMs: DEFAULT_DWELL_MS,
      dwellMs: DEFAULT_DWELL_MS,
      queryBursts: 1,
    };
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.detail).toContain("query bursts");
  });

  test("an operator may acknowledge a short dwell, and then it bootstraps", () => {
    const probe: DiscoveryProbeOutcome = {
      kind: "silence",
      elapsedMs: 2_000,
      dwellMs: 2_000,
      queryBursts: MIN_QUERY_BURSTS,
    };
    const decision = decideClusterBoot(withToken(probe, { policy: { acknowledgedShortDwell: true } }));
    expect(decision.action).toBe("bootstrap");
  });
});

describe("the explicit role wins in every case", () => {
  const declaredFounder = { role: "first-control-plane", source: "esp:/zeta-firstboot.conf" };
  const declaredJoiner = { role: "joiner", source: "keystroke", joinServerUrl: "https://control-plane:6443" };

  test("declared founder + a cluster answering: still BOOTSTRAP, contradiction recorded", () => {
    const decision = decideClusterBoot(withToken(answered([advertisement()]), { explicitRole: declaredFounder }));
    expect(decision.action).toBe("bootstrap");
    expect(decision.notes.some((n) => n.includes("CONTRADICTION"))).toBe(true);
  });

  test("declared founder + a failed probe: still BOOTSTRAP", () => {
    const probe: DiscoveryProbeOutcome = { kind: "probe-failed", reason: "no-carrier", detail: "x", elapsedMs: 1 };
    const decision = decideClusterBoot(withToken(probe, { explicitRole: declaredFounder }));
    expect(decision.action).toBe("bootstrap");
  });

  test("declared joiner with an endpoint + silence: still JOIN the declared endpoint", () => {
    const decision = decideClusterBoot(withToken(honestSilence(), { explicitRole: declaredJoiner }));
    expect(decision.action).toBe("join");
    if (decision.action !== "join") {
      return;
    }
    expect(decision.serverUrl).toBe("https://control-plane:6443");
    expect(decision.reason).toBe("explicit-override");
  });

  test("declared joiner with an endpoint + two clusters answering: still JOIN the declared one", () => {
    const probe = answered([advertisement(), advertisement({ clusterId: CLUSTER_B, nodeName: "node-b1e1b5" })]);
    const decision = decideClusterBoot(withToken(probe, { explicitRole: declaredJoiner }));
    expect(decision.action).toBe("join");
  });
});

describe("an override that cannot be read is not an absent override", () => {
  test("an unrecognised role refuses and does NOT fall through to discovery", () => {
    const decision = decideClusterBoot(
      withToken(answered([advertisement()]), { explicitRole: { role: "worker-gpu", source: "esp" } }),
    );
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("override-unrecognised");
  });

  test("a declared joiner with no endpoint and nothing answering refuses, never bootstraps", () => {
    const decision = decideClusterBoot(withToken(honestSilence(), { explicitRole: { role: "joiner", source: "esp" } }));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("override-joiner-without-endpoint");
  });

  test("a declared joiner with no endpoint takes the ADDRESS from discovery when it is unambiguous", () => {
    const decision = decideClusterBoot(
      withToken(answered([advertisement()]), { explicitRole: { role: "joiner", source: "esp" } }),
    );
    expect(decision.action).toBe("join");
    if (decision.action !== "join") {
      return;
    }
    expect(decision.serverUrl).toBe("https://node-ad1efd.local:6443");
  });
});

describe("credentials: discovery finds an address, it does not mint one", () => {
  test("a cluster answered and this node holds no token: REFUSE", () => {
    const decision = decideClusterBoot({ probe: answered([advertisement()]), credentials: { tokenAvailable: false } });
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("join-token-unavailable");
  });

  test("the token pins a different cluster than the one answering: REFUSE", () => {
    const decision = decideClusterBoot({
      probe: answered([advertisement()]),
      credentials: { tokenAvailable: true, expectedClusterId: CLUSTER_B },
    });
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("cluster-id-does-not-match-token");
  });

  test("the token pin matches: JOIN, and the match is recorded", () => {
    const decision = decideClusterBoot({
      probe: answered([advertisement()]),
      credentials: { tokenAvailable: true, expectedClusterId: CLUSTER_A },
    });
    expect(decision.action).toBe("join");
    expect(decision.notes.some((n) => n.includes("CA pin"))).toBe(true);
  });

  test("no pin at all: JOIN, and the note says the identity is UNVERIFIED", () => {
    const decision = decideClusterBoot(withToken(answered([advertisement()])));
    expect(decision.action).toBe("join");
    expect(decision.notes.some((n) => n.includes("UNVERIFIED"))).toBe(true);
  });
});

describe("HA is not ambiguity, and the pick is deterministic", () => {
  const ha = [
    advertisement({ nodeName: "node-c3", hostname: "node-c3.local", address: "10.88.0.3" }),
    advertisement({ nodeName: "node-a1", hostname: "node-a1.local", address: "10.88.0.1" }),
    advertisement({ nodeName: "node-b2", hostname: "node-b2.local", address: "10.88.0.2" }),
  ];

  test("three control planes of ONE cluster: JOIN, not refuse", () => {
    const decision = decideClusterBoot(withToken(answered(ha)));
    expect(decision.action).toBe("join");
  });

  test("the endpoint does not depend on the order the answers arrived in", () => {
    const forward = pickEndpoint(ha);
    const reversed = pickEndpoint([...ha].reverse());
    expect(forward?.nodeName).toBe("node-a1");
    expect(reversed?.nodeName).toBe("node-a1");
  });

  test("malformed answers on our service type: REFUSE even when a valid one is present", () => {
    const probe: DiscoveryProbeOutcome = {
      kind: "responded",
      advertisements: [advertisement()],
      malformed: [{ source: "impostor on eth0", problem: "TXT record has no cluster key" }],
      elapsedMs: DEFAULT_DWELL_MS,
      dwellMs: DEFAULT_DWELL_MS,
      queryBursts: MIN_QUERY_BURSTS,
    };
    const decision = decideClusterBoot(withToken(probe));
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") {
      return;
    }
    expect(decision.reason).toBe("malformed-advertisement");
  });
});

describe("the token prefix reader never sees the credential half", () => {
  test("a well-formed prefix yields the CA pin", () => {
    const result = clusterIdFromK3sTokenPrefix(`K10${CLUSTER_A}`);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.clusterId).toBe(CLUSTER_A);
  });

  test("a prefix without the K10 marker is refused, not repaired", () => {
    expect(clusterIdFromK3sTokenPrefix(CLUSTER_A).ok).toBe(false);
  });

  test("a prefix whose digest is not sha256-shaped is refused", () => {
    expect(clusterIdFromK3sTokenPrefix("K10deadbeef").ok).toBe(false);
  });
});

describe("silenceProblem is checkable on its own", () => {
  test("an honest silence has no problem", () => {
    expect(silenceProblem({ elapsedMs: 30_000, dwellMs: 30_000, queryBursts: 5 }, undefined)).toBeNull();
  });

  test("each of the three conditions reports its own problem", () => {
    expect(silenceProblem({ elapsedMs: 5_000, dwellMs: 5_000, queryBursts: 5 }, undefined)).toContain("floor");
    expect(silenceProblem({ elapsedMs: 10, dwellMs: 30_000, queryBursts: 5 }, undefined)).toContain("dwell");
    expect(silenceProblem({ elapsedMs: 30_000, dwellMs: 30_000, queryBursts: 0 }, undefined)).toContain("query bursts");
  });
});
