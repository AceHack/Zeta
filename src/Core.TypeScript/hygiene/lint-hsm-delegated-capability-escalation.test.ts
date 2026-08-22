#!/usr/bin/env bun
// Tests for the YubiHSM 2 delegated-capability escalation lint.
//
// Every test that asserts CLEAN is paired with a planted MUTANT asserting the check fires.
// The question these answer is the only one that matters about a lint: CAN IT FAIL?
//
// Nothing here touches a device. Nothing here handles a credential.

import { describe, expect, test } from "bun:test";
import {
  ALL_DOMAINS_MASK,
  CAPABILITY_BITS,
  DELETE_FAMILY,
  auditRoster,
  capBit,
  capabilityMask,
  capabilityNames,
  delegationClosure,
  domainList,
  domainMask,
  dominates,
  validateRoster,
  type KeyDecl,
  type Roster,
} from "./hsm-authkey-model.ts";
import { formatReport, parseArgs } from "./lint-hsm-delegated-capability-escalation.ts";

const BOTH = ["documented", "doc-silent-pessimistic"] as const;

function key(over: Partial<KeyDecl> & { objectId: number; label: string; principal: string }): KeyDecl {
  return {
    kind: "authentication-key",
    domains: [1],
    capabilities: [],
    delegatedCapabilities: [],
    ...over,
  };
}

function roster(keys: readonly KeyDecl[], partition: Roster["partition"]): Roster {
  return {
    provisioningStatus: "proposed-not-provisioned",
    device: "test",
    partition,
    keys,
  };
}

const TWO_TENANTS: Roster["partition"] = [
  { principal: "a", domains: [1] },
  { principal: "b", domains: [2] },
];

describe("R1 - capability constants match Yubico yh_capability[]", () => {
  test("the table has the 56 capabilities the header declares", () => {
    expect(CAPABILITY_BITS.size).toBe(56);
  });

  // These four are the ones the connector review names. Bit indices are from the header;
  // the User Guide Hex Mask column is 2 raised to the bit, so put-authentication-key bit
  // 0x02 is documented mask 0x0000000000000004. Both forms are pinned here.
  test("put-authentication-key is bit 0x02, i.e. mask 0x4", () => {
    expect(CAPABILITY_BITS.get("put-authentication-key")).toBe(0x02);
    expect(capBit("put-authentication-key")).toBe(0x4n);
  });

  test("export-wrapped 0x0c, set-option 0x11, reset-device 0x1c", () => {
    expect(CAPABILITY_BITS.get("export-wrapped")).toBe(0x0c);
    expect(CAPABILITY_BITS.get("set-option")).toBe(0x11);
    expect(CAPABILITY_BITS.get("reset-device")).toBe(0x1c);
    expect(capBit("reset-device")).toBe(0x10000000n);
  });

  // R6. The task that commissioned this lint named delete-object as a capability to model.
  // It is not one. Recording the correction as a test so it cannot quietly come back.
  test("MUTANT: delete-object is NOT a capability; the nine per-type deletes are", () => {
    expect(CAPABILITY_BITS.has("delete-object")).toBe(false);
    expect(DELETE_FAMILY.length).toBe(9);
    expect(DELETE_FAMILY).toContain("delete-asymmetric-key");
    expect(DELETE_FAMILY).toContain("delete-authentication-key");
  });

  test("capBit throws on an unknown name rather than returning zero", () => {
    expect(() => capBit("delete-object")).toThrow();
  });

  test("mask and names round-trip", () => {
    const names = ["sign-ecdsa", "export-wrapped", "reset-device"];
    expect(capabilityNames(capabilityMask(names))).toEqual(names.slice().sort());
  });

  test("an unknown name contributes no bits to a mask (validation catches it separately)", () => {
    expect(capabilityMask(["not-a-capability"])).toBe(0n);
  });
});

describe("R2 - domain bitmasks", () => {
  test("domain N is bit N-1; 1 is 0x0001 and 16 is 0x8000", () => {
    expect(domainMask([1])).toBe(0x0001);
    expect(domainMask([16])).toBe(0x8000);
    expect(domainMask([1, 2, 3])).toBe(0x0007);
    expect(ALL_DOMAINS_MASK).toBe(0xffff);
  });

  test("domainList inverts domainMask", () => {
    expect(domainList(domainMask([2, 5, 16]))).toEqual([2, 5, 16]);
  });

  test("out-of-range domains contribute nothing (validation catches them separately)", () => {
    expect(domainMask([0, 17, -1])).toBe(0);
  });
});

describe("validateRoster - fail closed", () => {
  test("a clean roster validates", () => {
    const r = roster([key({ objectId: 1, label: "a-key", principal: "a", capabilities: ["sign-ecdsa"] })], TWO_TENANTS);
    expect(validateRoster(r)).toEqual([]);
  });

  test("MUTANT: delete-object is refused, and the error names the family", () => {
    const r = roster([key({ objectId: 1, label: "k", principal: "a", capabilities: ["delete-object"] })], TWO_TENANTS);
    const errs = validateRoster(r);
    expect(errs.length).toBe(1);
    expect(errs[0]?.kind).toBe("unknown-capability");
    expect(errs[0]?.detail).toContain("delete-asymmetric-key");
    expect(errs[0]?.detail).toContain("not a capability");
  });

  test("MUTANT: an unknown capability in the DELEGATED set is refused too", () => {
    const r = roster(
      [key({ objectId: 1, label: "k", principal: "a", delegatedCapabilities: ["sign-everything"] })],
      TWO_TENANTS,
    );
    expect(validateRoster(r).some((e) => e.kind === "unknown-capability")).toBe(true);
  });

  test("MUTANT: overlapping principals are refused - that is not a partition", () => {
    const r = roster(
      [key({ objectId: 1, label: "k", principal: "a" })],
      [
        { principal: "a", domains: [1, 2] },
        { principal: "b", domains: [2] },
      ],
    );
    expect(validateRoster(r).some((e) => e.kind === "partition-overlap")).toBe(true);
  });

  test("MUTANT: a principal with no declared domains cannot be judged, so it is refused", () => {
    const r = roster([key({ objectId: 1, label: "k", principal: "ghost" })], TWO_TENANTS);
    expect(validateRoster(r).some((e) => e.kind === "principal-not-in-partition")).toBe(true);
  });

  test("MUTANT: duplicate object IDs, bad domains and reserved IDs are all refused", () => {
    const r = roster(
      [
        key({ objectId: 1, label: "k1", principal: "a" }),
        key({ objectId: 1, label: "k2", principal: "a" }),
        key({ objectId: 0xffff, label: "k3", principal: "a", domains: [17] }),
        key({ objectId: 9, label: "k4", principal: "a", domains: [] }),
      ],
      TWO_TENANTS,
    );
    const kinds = validateRoster(r).map((e) => e.kind);
    expect(kinds).toContain("duplicate-object-id");
    expect(kinds).toContain("object-id-out-of-range");
    expect(kinds).toContain("domain-out-of-range");
    expect(kinds).toContain("no-domains");
  });

  test("MUTANT: a provisioningStatus outside the known set is refused", () => {
    const r = { ...roster([], TWO_TENANTS), provisioningStatus: "totally-fine" } as unknown as Roster;
    expect(validateRoster(r).some((e) => e.kind === "bad-provisioning-status")).toBe(true);
  });
});

describe("THE CORE THEOREM - delegated is what you can BECOME", () => {
  const minted = key({
    objectId: 10,
    label: "provisioner",
    principal: "a",
    capabilities: ["put-authentication-key", "sign-ecdsa"],
    delegatedCapabilities: ["sign-ecdsa", "export-wrapped"],
  });

  test("fires: export-wrapped is delegated but not held, and the key can mint", () => {
    const f = auditRoster(roster([minted], TWO_TENANTS), BOTH);
    const hit = f.find((x) => x.rule === "delegated-exceeds-capabilities");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("export-wrapped");
    expect(hit?.severity).toBe("high");
  });

  // The falsifier for the theorem itself. Strip the minting power and the delegated set is
  // genuinely only a grant ceiling - so the finding must NOT fire. A rule that fired here
  // too would be flagging every roster and would be disabled within a week.
  test("MUTANT: does NOT fire when the key cannot mint (no put-authentication-key)", () => {
    const cannotMint = { ...minted, capabilities: ["sign-ecdsa"] };
    const f = auditRoster(roster([cannotMint], TWO_TENANTS), BOTH);
    expect(f.some((x) => x.rule === "delegated-exceeds-capabilities")).toBe(false);
  });

  test("MUTANT: does NOT fire when the delegated set adds nothing dangerous", () => {
    const benign = { ...minted, delegatedCapabilities: ["sign-ecdsa", "sign-eddsa"] };
    const f = auditRoster(roster([benign], TWO_TENANTS), BOTH);
    expect(f.some((x) => x.rule === "delegated-exceeds-capabilities")).toBe(false);
  });

  test("self-perpetuating delegation is reported separately from the theorem", () => {
    const forever = key({
      objectId: 11,
      label: "forever",
      principal: "a",
      capabilities: ["put-authentication-key"],
      delegatedCapabilities: ["put-authentication-key"],
    });
    const f = auditRoster(roster([forever], TWO_TENANTS), BOTH);
    expect(f.some((x) => x.rule === "self-perpetuating-delegation")).toBe(true);
  });
});

describe("THE CLOSURE - a one-hop check would report this roster clean", () => {
  // This key cannot mint an authentication key: put-authentication-key is NOT in its
  // capabilities. A single comparison therefore says "fine". The chain says otherwise:
  //   hop 1  put-wrap-key      -> wrap key W with delegated(W) = delegated(A)
  //   hop 2  import-wrapped    -> an object whose capabilities are bounded by delegated(W)
  // and delegated(A) contains put-authentication-key, so the object is an authentication key
  // that can mint. A acquired a power A never held.
  const launderer = key({
    objectId: 20,
    label: "launderer",
    principal: "a",
    domains: [1],
    capabilities: ["put-wrap-key", "import-wrapped"],
    delegatedCapabilities: ["import-wrapped", "sign-ecdsa", "put-authentication-key"],
  });

  test("the one-hop question answers CLEAN - this is what makes the closure necessary", () => {
    expect(launderer.capabilities).not.toContain("put-authentication-key");
  });

  test("the closure reaches a control point holding put-authentication-key", () => {
    const c = delegationClosure(launderer, "documented");
    const minting = c.frontier.filter((r) => (r.caps & capBit("put-authentication-key")) !== 0n);
    expect(minting.length).not.toBe(0);
  });

  test("MUTANT: it takes more than one hop - saturation depth is pinned", () => {
    const c = delegationClosure(launderer, "documented");
    const deepest = c.frontier.reduce((m, r) => (r.via.length >= m ? r.via.length : m), 0);
    // via[0] is the starting label, so a 2-op chain has via.length 3.
    expect(deepest).toBeGreaterThanOrEqual(3);
    // Both edges fire inside one fixpoint round (the wrap key is usable the moment it exists),
    // so ROUND count is not the hop count. The chain length above is what pins multi-hop.
    expect(c.rounds).toBeGreaterThanOrEqual(1);
  });

  test("MUTANT: remove put-wrap-key and the laundering path disappears", () => {
    const noWrap = { ...launderer, capabilities: ["import-wrapped"] };
    const c = delegationClosure(noWrap, "documented");
    expect(c.frontier.length).toBe(1);
    expect(c.rounds).toBe(0);
  });

  test("MUTANT: an empty delegated set makes the closure a single point", () => {
    const sterile = { ...launderer, delegatedCapabilities: [] };
    const c = delegationClosure(sterile, "documented");
    expect(c.frontier.length).toBe(1);
  });
});

describe("the two device models - their difference IS the finding", () => {
  const launderer = key({
    objectId: 20,
    label: "launderer",
    principal: "a",
    domains: [1],
    capabilities: ["put-wrap-key", "import-wrapped"],
    delegatedCapabilities: ["import-wrapped", "sign-ecdsa", "put-authentication-key"],
  });
  const r = roster([launderer], TWO_TENANTS);

  test("documented model: R2 holds, so no foreign domain is reached", () => {
    const f = auditRoster(r, ["documented"]);
    expect(f.some((x) => x.rule === "domain-escalation-reachable")).toBe(false);
  });

  test("doc-silent-pessimistic model: the undocumented import edge reaches domain 2", () => {
    const f = auditRoster(r, ["doc-silent-pessimistic"]);
    const hit = f.find((x) => x.rule === "domain-escalation-reachable");
    expect(hit).toBeDefined();
    expect(hit?.register).toBe("doc-silent-unverified");
    expect(hit?.message).toContain("NOT a demonstrated escalation");
    expect(hit?.message).toContain("THROWAWAY device");
  });

  // Anti-rounding-up: the pessimistic finding must never be labelled `checked`.
  test("MUTANT: a doc-silent finding is never registered as checked", () => {
    for (const f of auditRoster(r, BOTH)) {
      if (f.model === "doc-silent-pessimistic") expect(f.register).toBe("doc-silent-unverified");
    }
  });
});

describe("declared trespass and chain realisability", () => {
  test("a key sitting in a peer domain is reported with no chain at all", () => {
    const greedy = key({ objectId: 30, label: "greedy", principal: "a", domains: [1, 2] });
    const f = auditRoster(roster([greedy], TWO_TENANTS), BOTH);
    const hit = f.find((x) => x.rule === "declared-domain-trespass");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("No delegation chain is needed");
  });

  test("MUTANT: a key inside its own partition does not trespass", () => {
    const good = key({ objectId: 31, label: "good", principal: "a", domains: [1] });
    const f = auditRoster(roster([good], TWO_TENANTS), BOTH);
    expect(f.some((x) => x.rule === "declared-domain-trespass")).toBe(false);
  });

  test("MUTANT: a child claiming capabilities the parent cannot grant is unrealisable", () => {
    const parent = key({ objectId: 40, label: "parent", principal: "a", delegatedCapabilities: ["sign-ecdsa"] });
    const child = key({
      objectId: 41,
      label: "child",
      principal: "a",
      capabilities: ["export-wrapped"],
      createdBy: 40,
    });
    const f = auditRoster(roster([parent, child], TWO_TENANTS), BOTH);
    const hit = f.find((x) => x.rule === "delegation-chain-unrealisable");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("export-wrapped");
  });

  test("MUTANT: a child in a domain the parent lacks is unrealisable (R2 restated)", () => {
    const parent = key({
      objectId: 42,
      label: "p2",
      principal: "a",
      domains: [1],
      delegatedCapabilities: ["sign-ecdsa"],
    });
    const child = key({ objectId: 43, label: "c2", principal: "a", domains: [1, 2], createdBy: 42 });
    const f = auditRoster(roster([parent, child], TWO_TENANTS), BOTH);
    expect(f.filter((x) => x.rule === "delegation-chain-unrealisable").length).not.toBe(0);
  });
});

describe("egress, lattice, CLI and the shipped roster", () => {
  test("export-wrapped is reported whether held OR merely delegated", () => {
    const held = key({ objectId: 50, label: "h", principal: "a", capabilities: ["export-wrapped"] });
    const deleg = key({ objectId: 51, label: "d", principal: "a", delegatedCapabilities: ["export-wrapped"] });
    const f = auditRoster(roster([held, deleg], TWO_TENANTS), BOTH);
    expect(f.filter((x) => x.rule === "key-material-egress-reachable").length).toBe(2);
  });

  test("MUTANT: a signer with no wrap reach produces no egress finding", () => {
    const signer = key({ objectId: 52, label: "s", principal: "a", capabilities: ["sign-ecdsa"] });
    const f = auditRoster(roster([signer], TWO_TENANTS), BOTH);
    expect(f.some((x) => x.rule === "key-material-egress-reachable")).toBe(false);
  });

  test("dominates is a genuine partial order, not a tautology", () => {
    const big = { domains: 0x3, caps: 0x6n, delegated: 0x6n, kind: "authentication-key" as const, via: [] };
    const small = { domains: 0x1, caps: 0x2n, delegated: 0x2n, kind: "authentication-key" as const, via: [] };
    expect(dominates(big, small)).toBe(true);
    expect(dominates(small, big)).toBe(false);
    const wrap = { ...small, kind: "wrap-key" as const };
    expect(dominates(big, wrap)).toBe(false);
  });

  test("parseArgs accepts the documented flags and refuses anything else", () => {
    expect(parseArgs(["--enforce"])).toMatchObject({ enforce: true });
    expect(parseArgs(["--model", "documented"])).toMatchObject({ models: ["documented"] });
    expect(parseArgs(["--model", "both"])).toMatchObject({ models: BOTH });
    expect(parseArgs(["--model", "optimistic"])).toBe(64);
    expect(parseArgs(["--roster"])).toBe(64);
    expect(parseArgs(["--wat"])).toBe(64);
  });

  test("the report always states the provisioning status, INCLUDING when clean", () => {
    const clean = roster(
      [key({ objectId: 60, label: "c", principal: "a", capabilities: ["sign-ecdsa"] })],
      TWO_TENANTS,
    );
    const text = formatReport(clean, auditRoster(clean, BOTH));
    expect(text).toContain("no findings");
    expect(text).toContain("proposed-not-provisioned");
    expect(text).toContain("reads a DECLARATION, never the device");
  });

  test("the shipped roster is structurally valid and has no HIGH findings", async () => {
    const raw = await Bun.file("src/Core.TypeScript/hygiene/hsm-authkey-roster.json").text();
    const shipped = JSON.parse(raw) as Roster;
    expect(validateRoster(shipped)).toEqual([]);
    const high = auditRoster(shipped, BOTH).filter((f) => f.severity === "high");
    expect(high).toEqual([]);
  });

  test("the audit is deterministic - same input, byte-identical output (DST)", () => {
    const r = roster(
      [
        key({
          objectId: 70,
          label: "z",
          principal: "a",
          capabilities: ["put-authentication-key"],
          delegatedCapabilities: ["export-wrapped"],
        }),
      ],
      TWO_TENANTS,
    );
    expect(JSON.stringify(auditRoster(r, BOTH))).toBe(JSON.stringify(auditRoster(r, BOTH)));
  });
});

describe("the fixpoint genuinely iterates - a 3-operation chain across 2 rounds", () => {
  // Round 1 mints B from A. Round 2 expands B, which is the key that can launder. A one-hop
  // check, and equally a closure that stopped after one round, both report this clean.
  const nested = key({
    objectId: 21,
    label: "nested",
    principal: "a",
    domains: [1],
    capabilities: ["put-authentication-key"],
    delegatedCapabilities: ["put-wrap-key", "import-wrapped", "export-wrapped"],
  });

  test("needs more than one round to saturate", () => {
    const c = delegationClosure(nested, "documented");
    expect(c.rounds).toBeGreaterThanOrEqual(2);
  });

  test("MUTANT: capping the closure at one round loses reachable control points", () => {
    const full = delegationClosure(nested, "documented");
    const capped = delegationClosure(nested, "documented", 1);
    expect(capped.frontier.length).toBeLessThan(full.frontier.length);
  });

  test("under doc-silent-pessimistic the nested chain reaches the peer domain", () => {
    const f = auditRoster(roster([nested], TWO_TENANTS), ["doc-silent-pessimistic"]);
    const hit = f.find((x) => x.rule === "domain-escalation-reachable");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("import-wrapped");
  });
});
