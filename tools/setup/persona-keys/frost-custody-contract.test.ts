// frost-custody-contract.ts — gate-not-type, two quorums, structural amendment.
// Run: bun test frost-custody-contract.test.ts
import { describe, expect, test } from "bun:test";
import { frostKeygen, frostThresholdSign } from "./frost.ts";
import {
  CAPABILITY_GRANT_SCHEMA,
  CUSTODY_GATES,
  SHARE_CONTRACT_SCHEMA,
  assertOneTokenOneRole,
  authorizeOperation,
  capabilityGrantSignable,
  declineIsCostFree,
  quorumAvailability,
  validateContractSet,
  validateShareContract,
  verifyCapabilityGrant,
  type CapabilityGrant,
  type ShareContract,
} from "./frost-custody-contract.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const human = (x: number, holder: string, serial: string): ShareContract => ({
  schema: SHARE_CONTRACT_SCHEMA,
  x,
  role: "creation",
  holder,
  holderKind: "human",
  gate: "human-touch-present",
  tokenSerial: serial,
});

const agent = (x: number, site: string, serial: string, slotId: number): ShareContract => ({
  schema: SHARE_CONTRACT_SCHEMA,
  x,
  role: "operating",
  holder: `${site}-hsm`,
  holderKind: "agent",
  gate: "autonomous-hsm",
  slotId,
  tokenSerial: serial,
  site,
});

/** The three-house layout: humans carry creation shares, sites hold operating shares. */
const CONTRACTS: readonly ShareContract[] = [
  human(1, "aaron", "yk-aaron-zeta"),
  human(2, "max", "yk-max-zeta"),
  human(3, "addison", "yk-addison-zeta"),
  agent(1, "aaron-house", "hsm-1", 0),
  agent(2, "max-house", "hsm-2", 0),
  agent(3, "addison-house", "hsm-3", 0),
];

describe("the gate is not a type", () => {
  test("CG-1: CustodyGate has EXACTLY two members — no remote-human value", () => {
    // If a third gate is ever added this fails, forcing the argument to be made
    // rather than the property being lost quietly. A remotely-exercisable human
    // share would mean an attacker with full remote access to every site could
    // produce a human signature.
    expect([...CUSTODY_GATES].sort()).toEqual(["autonomous-hsm", "human-touch-present"]);
    expect(CUSTODY_GATES.length).toBe(2);
  });

  test("CG-2: a valid three-house contract set has no problems", () => {
    expect(validateContractSet(CONTRACTS)).toEqual([]);
  });

  test("CG-3: a human share gated autonomously is REFUSED", () => {
    // This is the "agent holds the human's share as fallback" shape.
    const bad: ShareContract = { ...human(1, "aaron", "yk-a"), gate: "autonomous-hsm" };
    expect(validateShareContract(bad).join(" ")).toMatch(/must gate on human-touch-present/);
  });

  test("CG-4: an AGENT in the creation quorum is refused — the fleet must not be able to amend itself", () => {
    const bad: ShareContract = {
      ...agent(1, "aaron-house", "hsm-1", 0),
      role: "creation",
    };
    expect(validateShareContract(bad).join(" ")).toMatch(/creation quorum is human-only/);
  });

  test("CG-5: a touch-gated OPERATING share is refused — it cannot sign headlessly", () => {
    const bad: ShareContract = {
      ...agent(1, "aaron-house", "hsm-1", 0),
      gate: "human-touch-present",
    };
    expect(validateShareContract(bad).join(" ")).toMatch(/must gate autonomously/);
  });

  test("CG-6: two shares bound to the SAME token+slot are flagged as one custody unit", () => {
    // The per-share slot binding point: without distinct slots, "three shares"
    // can resolve to one physical custody unit and the threshold is fiction.
    const collided = [agent(1, "site-a", "hsm-1", 0), agent(2, "site-a2", "hsm-1", 0)];
    expect(validateContractSet(collided).map((p) => p.problem).join(" ")).toMatch(
      /same token\+slot/,
    );
  });

  test("CG-7: participant index 0 and a blank holder are refused", () => {
    expect(validateShareContract({ ...human(0, "aaron", "yk") }).join(" ")).toMatch(/>= 1/);
    expect(validateShareContract({ ...human(1, "  ", "yk") }).join(" ")).toMatch(/non-empty/);
  });
});

describe("one token, one role", () => {
  test("CG-8: a clean pack has no collisions", () => {
    expect(assertOneTokenOneRole(CONTRACTS, ["yk-aaron-openai"])).toEqual([]);
  });

  test("CG-9: the SAME token in both quorums is caught", () => {
    const reused = [...CONTRACTS, { ...agent(4, "aaron-house", "yk-aaron-zeta", 1) }];
    expect(assertOneTokenOneRole(reused).join(" ")).toMatch(/BOTH the creation and operating/);
  });

  test("CG-10: a Zeta identity share on a token also used for EXTERNAL access is caught", () => {
    // The concrete case: the YubiKey that is Aaron's model-provider access
    // credential must not also be his Zeta creation share. Losing it would take
    // out both at once, and an adversary wanting either gains a reason to
    // target the other.
    const problems = assertOneTokenOneRole(CONTRACTS, ["yk-aaron-zeta"]);
    expect(problems.join(" ")).toMatch(/external-access credential/);
  });
});

describe("quorum sizing — the two 2-of-3s are not the same 2-of-3", () => {
  test("CG-11: the OPERATING quorum survives one dead SITE with no human path", () => {
    const a = quorumAvailability(CONTRACTS, "operating", 2, ["max-house-hsm"]);
    expect(a.satisfiable).toBe(true);
    expect(a.slack).toBe(0); // one site down consumes the entire tolerance
  });

  test("CG-12: the operating quorum does NOT survive two dead sites — replacement is urgent", () => {
    const a = quorumAvailability(CONTRACTS, "operating", 2, ["max-house-hsm", "addison-house-hsm"]);
    expect(a.satisfiable).toBe(false);
  });

  test("CG-13: 3-of-3 operating would halt on ANY single site outage", () => {
    expect(quorumAvailability(CONTRACTS, "operating", 3, ["max-house-hsm"]).satisfiable).toBe(false);
  });

  test("CG-14: at 2-of-3 ANY ONE person may decline at no cost — the consent property", () => {
    expect(declineIsCostFree(CONTRACTS, 2)).toBe(true);
  });

  test("CG-15: at 3-of-3 one refusal is a VETO — the consent gate has become a coercion gate", () => {
    // This is the check that makes "unwilling must remain a valid, cost-free
    // state" falsifiable rather than aspirational.
    expect(declineIsCostFree(CONTRACTS, 3)).toBe(false);
  });

  test("CG-16: a lost token is the same shape as a decline for availability purposes", () => {
    // Travel is NOT the outage — the token is portable (USB/NFC). Token loss is.
    expect(quorumAvailability(CONTRACTS, "creation", 2, ["aaron"]).satisfiable).toBe(true);
    expect(quorumAvailability(CONTRACTS, "creation", 2, ["aaron", "max"]).satisfiable).toBe(false);
  });

  test("CG-17: declineIsCostFree is false when there is no creation quorum at all", () => {
    expect(declineIsCostFree([], 1)).toBe(false);
  });
});

describe("capability grants — amendment is structurally the creation quorum's", () => {
  // Two INDEPENDENT FROST groups, as they would be on real hardware.
  const creation = frostKeygen(2, 3, lcg(1001)); // humans, carried tokens
  const operating = frostKeygen(2, 3, lcg(1002)); // agents, site HSMs

  const unsigned = {
    schema: CAPABILITY_GRANT_SCHEMA,
    capabilityId: "cap-001",
    creationGroupPublicKeyHex: bytesToHex(creation.groupPublicKey),
    operatingGroupPublicKeyHex: bytesToHex(operating.groupPublicKey),
    bounds: {
      notBefore: "2026-08-14T00:00:00Z",
      notAfter: "2026-09-14T00:00:00Z",
      budgetMinorUnits: 500_00,
      currency: "USD",
      scopes: ["x402.pay", "cert.sign"],
    },
  } as const;

  function signedByCreation(u: Omit<CapabilityGrant, "signatureHex">, seed = 2001): CapabilityGrant {
    const sig = frostThresholdSign(
      creation.groupPublicKey,
      creation.shares.slice(0, 2),
      capabilityGrantSignable(u),
      lcg(seed),
      2,
    );
    return { ...u, signatureHex: bytesToHex(sig) };
  }

  test("CAP-1: a grant signed by the CREATION quorum verifies", () => {
    const g = signedByCreation(unsigned);
    expect(verifyCapabilityGrant(g, creation.groupPublicKey)).toEqual({ ok: true });
  });

  test("CAP-2: the OPERATING quorum CANNOT mint a grant — this is the whole safety property", () => {
    // The agent quorum signs the very same document with its own key. It holds
    // no creation share, so what it produces is not a grant. Not "is not
    // permitted to" — cannot.
    const sig = frostThresholdSign(
      operating.groupPublicKey,
      operating.shares.slice(0, 2),
      capabilityGrantSignable(unsigned),
      lcg(2002),
      2,
    );
    const forged: CapabilityGrant = { ...unsigned, signatureHex: bytesToHex(sig) };
    const verdict = verifyCapabilityGrant(forged, creation.groupPublicKey);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/not by the creation quorum/);
  });

  test("CAP-3: an AMENDMENT that raises its own budget also fails without a creation signature", () => {
    // The concrete self-amendment attack: the fleet re-signs the grant with a
    // bigger number. Amendment is a grant, so it needs the creation key.
    const amended = {
      ...unsigned,
      capabilityId: "cap-002",
      amendsCapabilityId: "cap-001",
      bounds: { ...unsigned.bounds, budgetMinorUnits: 5_000_000_00 },
    };
    const sig = frostThresholdSign(
      operating.groupPublicKey,
      operating.shares.slice(0, 2),
      capabilityGrantSignable(amended),
      lcg(2003),
      2,
    );
    const forged: CapabilityGrant = { ...amended, signatureHex: bytesToHex(sig) };
    expect(verifyCapabilityGrant(forged, creation.groupPublicKey).ok).toBe(false);

    // ...and the SAME amendment signed by the creation quorum is valid. The
    // mechanism blocks the actor, not the operation.
    expect(verifyCapabilityGrant(signedByCreation(amended, 2004), creation.groupPublicKey)).toEqual({
      ok: true,
    });
  });

  test("CAP-4: a grant that NAMES ITSELF as its own creation group does not self-verify", () => {
    // The subtle escalation: the operating quorum mints a grant declaring the
    // operating key to be the creation key. It is internally consistent and
    // would pass any verifier that trusted the grant's own claim. The verifier
    // takes the trusted key as a parameter precisely so this fails.
    const selfNamed = {
      ...unsigned,
      capabilityId: "cap-self",
      creationGroupPublicKeyHex: bytesToHex(operating.groupPublicKey),
    };
    const sig = frostThresholdSign(
      operating.groupPublicKey,
      operating.shares.slice(0, 2),
      capabilityGrantSignable(selfNamed),
      lcg(2005),
      2,
    );
    const forged: CapabilityGrant = { ...selfNamed, signatureHex: bytesToHex(sig) };
    const verdict = verifyCapabilityGrant(forged, creation.groupPublicKey);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/different creation group/);
  });

  test("CAP-5: every bound is INSIDE the signature — tampering any one invalidates it", () => {
    const g = signedByCreation(unsigned);
    const mutations: readonly CapabilityGrant[] = [
      { ...g, bounds: { ...g.bounds, budgetMinorUnits: g.bounds.budgetMinorUnits + 1 } },
      { ...g, bounds: { ...g.bounds, notAfter: "2027-09-14T00:00:00Z" } },
      { ...g, bounds: { ...g.bounds, notBefore: "2020-01-01T00:00:00Z" } },
      { ...g, bounds: { ...g.bounds, scopes: [...g.bounds.scopes, "admin.everything"] } },
      { ...g, bounds: { ...g.bounds, currency: "BTC" } },
      { ...g, capabilityId: "cap-999" },
      { ...g, operatingGroupPublicKeyHex: bytesToHex(creation.groupPublicKey) },
      { ...g, amendsCapabilityId: "cap-000" },
    ];
    for (const m of mutations) {
      expect(verifyCapabilityGrant(m, creation.groupPublicKey).ok).toBe(false);
    }
  });

  test("CAP-6: the canonical encoding is injective ACROSS FIELD BOUNDARIES", () => {
    // Comparing capabilityId "ab" vs "a" alone proves nothing about the
    // separator — those differ under any join, so a mutant joining on ""
    // survives it. The property under test is that moving a character ACROSS a
    // field boundary changes the bytes. Under a "" join these two grants encode
    // identically, so ONE creation signature would cover BOTH of them.
    const a = capabilityGrantSignable({
      ...unsigned,
      capabilityId: "ab",
      creationGroupPublicKeyHex: "cc",
    });
    const b = capabilityGrantSignable({
      ...unsigned,
      capabilityId: "a",
      creationGroupPublicKeyHex: "bcc",
    });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);

    // Scope-list boundaries likewise: ["a","b"] must not encode as ["a b"].
    const s1 = capabilityGrantSignable({
      ...unsigned,
      bounds: { ...unsigned.bounds, scopes: ["a", "b"] },
    });
    const s2 = capabilityGrantSignable({
      ...unsigned,
      bounds: { ...unsigned.bounds, scopes: ["a b"] },
    });
    expect(Buffer.from(s1).equals(Buffer.from(s2))).toBe(false);
  });

  test("CAP-7: an absent amendsCapabilityId does not encode like an empty one", () => {
    const absent = capabilityGrantSignable(unsigned);
    const empty = capabilityGrantSignable({ ...unsigned, amendsCapabilityId: "" });
    expect(Buffer.from(absent).equals(Buffer.from(empty))).toBe(false);
  });

  test("CAP-8: a malformed signature encoding is refused, not thrown", () => {
    const g: CapabilityGrant = { ...unsigned, signatureHex: "not-hex" };
    expect(verifyCapabilityGrant(g, creation.groupPublicKey).ok).toBe(false);
  });
});

describe("operating within the bounds", () => {
  const creation = frostKeygen(2, 3, lcg(3001));
  const operating = frostKeygen(2, 3, lcg(3002));
  const opHex = bytesToHex(operating.groupPublicKey);

  const unsigned = {
    schema: CAPABILITY_GRANT_SCHEMA,
    capabilityId: "cap-op",
    creationGroupPublicKeyHex: bytesToHex(creation.groupPublicKey),
    operatingGroupPublicKeyHex: opHex,
    bounds: {
      notBefore: "2026-08-14T00:00:00Z",
      notAfter: "2026-09-14T00:00:00Z",
      budgetMinorUnits: 500_00,
      currency: "USD",
      scopes: ["x402.pay"],
    },
  } as const;
  const sig = frostThresholdSign(
    creation.groupPublicKey,
    creation.shares.slice(0, 2),
    capabilityGrantSignable(unsigned),
    lcg(3003),
    2,
  );
  const grant: CapabilityGrant = { ...unsigned, signatureHex: bytesToHex(sig) };
  const verdict = verifyCapabilityGrant(grant, creation.groupPublicKey);

  test("CAP-9: an in-bounds operation is authorized with NO human in the loop", () => {
    expect(
      authorizeOperation(grant, verdict, {
        operatingGroupPublicKeyHex: opHex,
        scope: "x402.pay",
        amountMinorUnits: 100_00,
        at: "2026-08-20T12:00:00Z",
      }),
    ).toEqual({ ok: true });
  });

  test("CAP-10: over budget, out of scope, expired, early, and wrong-group are each refused", () => {
    const base = {
      operatingGroupPublicKeyHex: opHex,
      scope: "x402.pay",
      amountMinorUnits: 100_00,
      at: "2026-08-20T12:00:00Z",
    };
    const cases: readonly (readonly [Record<string, unknown>, RegExp])[] = [
      [{ amountMinorUnits: 500_01 }, /exceeds the granted budget/],
      [{ scope: "admin.everything" }, /outside the grant/],
      [{ at: "2026-09-14T00:00:00Z" }, /expired/],
      [{ at: "2026-08-13T23:59:59Z" }, /precedes the window/],
      [{ operatingGroupPublicKeyHex: bytesToHex(creation.groupPublicKey) }, /does not empower/],
      [{ amountMinorUnits: -1 }, /non-negative integer/],
      [{ at: "not-a-time" }, /RFC 3339/],
    ];
    for (const [patch, re] of cases) {
      const r = authorizeOperation(grant, verdict, { ...base, ...patch } as never);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toMatch(re);
    }
  });

  test("CAP-11: the boundary is exact — exactly-at-budget passes, notBefore passes, notAfter does not", () => {
    const at = (t: string, amt: number) =>
      authorizeOperation(grant, verdict, {
        operatingGroupPublicKeyHex: opHex,
        scope: "x402.pay",
        amountMinorUnits: amt,
        at: t,
      }).ok;
    expect(at("2026-08-20T12:00:00Z", 500_00)).toBe(true); // exactly the ceiling
    expect(at("2026-08-14T00:00:00Z", 1)).toBe(true); // notBefore is inclusive
    expect(at("2026-09-13T23:59:59Z", 1)).toBe(true); // just inside
    expect(at("2026-09-14T00:00:00Z", 1)).toBe(false); // notAfter is exclusive
  });

  test("CAP-12: an UNVERIFIED grant authorizes nothing, whatever its contents say", () => {
    // authorizeOperation takes the verdict as an argument so a caller cannot
    // reach it without having checked the creation signature.
    expect(
      authorizeOperation(grant, { ok: false, reason: "signature is not by the creation quorum" }, {
        operatingGroupPublicKeyHex: opHex,
        scope: "x402.pay",
        amountMinorUnits: 1,
        at: "2026-08-20T12:00:00Z",
      }).ok,
    ).toBe(false);
  });
});
