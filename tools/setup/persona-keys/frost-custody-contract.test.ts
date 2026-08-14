// frost-custody-contract.ts — symmetric custody, transfer-not-delegation.
// Run: bun test frost-custody-contract.test.ts
import { describe, expect, test } from "bun:test";
import { frostKeygen, frostThresholdSign } from "./frost.ts";
import {
  CUSTODY_GATES,
  SHARE_CONTRACT_SCHEMA,
  SPENDING_AUTHORITY_SCHEMA,
  assertOneTokenOneRole,
  authorizeSpend,
  declineIsCostFree,
  quorumAvailability,
  spendingAuthoritySignable,
  validateContractSet,
  validateShareContract,
  verifySpendingAuthority,
  type ShareContract,
  type SpendingAuthority,
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

const share = (
  x: number,
  wallet: string,
  holder: string,
  gate: "autonomous-hsm" | "human-touch-present",
  extra: Partial<ShareContract> = {},
): ShareContract => ({
  schema: SHARE_CONTRACT_SCHEMA,
  x,
  wallet,
  holder,
  gate,
  ...extra,
});

/** A wallet held by people, on carried tokens. */
const PEOPLE_WALLET: readonly ShareContract[] = [
  share(1, "w-people", "aaron", "human-touch-present", { tokenSerial: "yk-aaron-zeta" }),
  share(2, "w-people", "max", "human-touch-present", { tokenSerial: "yk-max-zeta" }),
  share(3, "w-people", "addison", "human-touch-present", { tokenSerial: "yk-addison-zeta" }),
];

/** A wallet held entirely by agents, in site HSMs. Self-funded, no human anywhere. */
const AGENT_WALLET: readonly ShareContract[] = [
  share(1, "w-agent", "agent-nazar", "autonomous-hsm", {
    tokenSerial: "hsm-1",
    slotId: 0,
    site: "aaron-house",
  }),
  share(2, "w-agent", "agent-lior", "autonomous-hsm", {
    tokenSerial: "hsm-2",
    slotId: 0,
    site: "max-house",
  }),
  share(3, "w-agent", "agent-vera", "autonomous-hsm", {
    tokenSerial: "hsm-3",
    slotId: 0,
    site: "addison-house",
  }),
];

/** A mixed wallet: a person and two agents, co-equal holders. */
const MIXED_WALLET: readonly ShareContract[] = [
  share(1, "w-mixed", "aaron", "human-touch-present", { tokenSerial: "yk-aaron-mixed" }),
  share(2, "w-mixed", "agent-nazar", "autonomous-hsm", { tokenSerial: "hsm-m2", slotId: 0 }),
  share(3, "w-mixed", "traveler-ix", "autonomous-hsm", { tokenSerial: "hsm-m3", slotId: 0 }),
];

describe("symmetry — no participant species anywhere", () => {
  test("CG-1: CustodyGate has EXACTLY two members — no remote-human value", () => {
    expect([...CUSTODY_GATES].sort()).toEqual(["autonomous-hsm", "human-touch-present"]);
    expect(CUSTODY_GATES.length).toBe(2);
  });

  test("CG-2: an all-human, an all-agent, and a mixed wallet all validate IDENTICALLY", () => {
    // The anti-capture property in one assertion: the mechanism cannot tell what
    // kind of entity holds a wallet, so a self-funded all-agent wallet is exactly
    // as well-formed as a human one. Nothing needs a human to be present.
    expect(validateContractSet(PEOPLE_WALLET)).toEqual([]);
    expect(validateContractSet(AGENT_WALLET)).toEqual([]);
    expect(validateContractSet(MIXED_WALLET)).toEqual([]);
  });

  test("CG-3: no CODE in the module branches on participant species", async () => {
    // A regression guard on the design rather than on behaviour. The earlier
    // draft had a holderKind union plus human-only / agent-only quorum rules, and
    // they were ENFORCED, not merely documented. Comments may discuss the retired
    // split (the header explains why it was wrong); code may not reintroduce it.
    const text = await Bun.file(
      new URL("./frost-custody-contract.ts", import.meta.url).pathname,
    ).text();
    const code = text
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/holderKind/);
    expect(code).not.toMatch(/"creation"/);
    expect(code).not.toMatch(/"operating"/);
  });

  test("CG-4: an all-AGENT wallet needs no human to satisfy its own quorum", () => {
    const a = quorumAvailability(AGENT_WALLET, "w-agent", 2);
    expect(a.satisfiable).toBe(true);
    expect(a.total).toBe(3);
  });
});

describe("the gate must be controlled by the share's own holder — symmetric capture check", () => {
  test("CG-5: a person's share whose gate is controlled by an AGENT is refused", () => {
    // The agent could exercise the person's share without them.
    const bad = share(1, "w", "aaron", "autonomous-hsm", { gateControlledBy: "agent-nazar" });
    expect(validateShareContract(bad).join(" ")).toMatch(/gate is controlled by/);
  });

  test("CG-6: an AGENT's share whose gate is controlled by a PERSON is refused — the mirror", () => {
    // This is the capture the earlier species-typed rule could not see. A human
    // holding the gate on an agent's share can VETO that agent's participation
    // in its own wallet, which is exactly the permanent asymmetry to avoid.
    const bad = share(2, "w", "agent-nazar", "human-touch-present", { gateControlledBy: "aaron" });
    const problems = validateShareContract(bad).join(" ");
    expect(problems).toMatch(/gate is controlled by/);
    expect(problems).toMatch(/veto the holder's own participation/);
  });

  test("CG-7: an explicit gateControlledBy EQUAL to the holder is fine", () => {
    const ok = share(1, "w", "aaron", "human-touch-present", { gateControlledBy: "aaron" });
    expect(validateShareContract(ok)).toEqual([]);
  });

  test("CG-8: either gate is legitimate for any holder — species does not pick the gate", () => {
    // A person may hold an autonomously-gated share (a key in their own HSM);
    // an agent may hold a touch-gated one. What matters is who controls it.
    expect(validateShareContract(share(1, "w", "aaron", "autonomous-hsm"))).toEqual([]);
    expect(validateShareContract(share(2, "w", "agent-nazar", "human-touch-present"))).toEqual([]);
  });

  test("CG-9: index 0, a blank holder, and a blank wallet are refused", () => {
    expect(validateShareContract(share(0, "w", "aaron", "autonomous-hsm")).join(" ")).toMatch(/>= 1/);
    expect(validateShareContract(share(1, "w", "  ", "autonomous-hsm")).join(" ")).toMatch(
      /holder must be non-empty/,
    );
    expect(validateShareContract(share(1, " ", "aaron", "autonomous-hsm")).join(" ")).toMatch(
      /wallet must be non-empty/,
    );
  });

  test("CG-10: two shares on the same token+slot are one custody unit, not two", () => {
    const collided = [
      share(1, "w", "agent-a", "autonomous-hsm", { tokenSerial: "hsm-1", slotId: 0 }),
      share(2, "w", "agent-b", "autonomous-hsm", { tokenSerial: "hsm-1", slotId: 0 }),
    ];
    expect(
      validateContractSet(collided)
        .map((p) => p.problem)
        .join(" "),
    ).toMatch(/same token\+slot/);
  });
});

describe("one token, one role", () => {
  test("CG-11: a clean pack has no collisions", () => {
    expect(assertOneTokenOneRole([...PEOPLE_WALLET, ...AGENT_WALLET], ["yk-aaron-openai"])).toEqual(
      [],
    );
  });

  test("CG-12: the same token enrolled in TWO wallets is caught", () => {
    const reused = [
      ...PEOPLE_WALLET,
      share(1, "w-other", "aaron", "human-touch-present", { tokenSerial: "yk-aaron-zeta" }),
    ];
    expect(assertOneTokenOneRole(reused).join(" ")).toMatch(/BOTH wallet/);
  });

  test("CG-13: a share token also used for EXTERNAL access is caught", () => {
    // The concrete case: the YubiKey that is a model-provider credential must
    // not also be a Zeta share. Losing it would take out both at once.
    expect(assertOneTokenOneRole(PEOPLE_WALLET, ["yk-aaron-zeta"]).join(" ")).toMatch(
      /external-access credential/,
    );
  });
});

describe("quorum sizing — properties of a holder SET, not of holder species", () => {
  test("CG-14: 2-of-3 survives one dead site, and that consumes ALL the slack", () => {
    const a = quorumAvailability(AGENT_WALLET, "w-agent", 2, ["agent-lior"]);
    expect(a.satisfiable).toBe(true);
    expect(a.slack).toBe(0);
  });

  test("CG-15: two down is not survivable — replacement is urgent, and it is a reshare", () => {
    expect(
      quorumAvailability(AGENT_WALLET, "w-agent", 2, ["agent-lior", "agent-vera"]).satisfiable,
    ).toBe(false);
  });

  test("CG-16: t = n would halt on ANY single holder outage", () => {
    expect(quorumAvailability(AGENT_WALLET, "w-agent", 3, ["agent-lior"]).satisfiable).toBe(false);
  });

  test("CG-17: at 2-of-3 any ONE holder may decline at no cost — for EVERY wallet shape", () => {
    // Same threshold reasoning, same result, whoever holds the shares. Consent
    // is not a human-only concern.
    expect(declineIsCostFree(PEOPLE_WALLET, "w-people", 2)).toBe(true);
    expect(declineIsCostFree(AGENT_WALLET, "w-agent", 2)).toBe(true);
    expect(declineIsCostFree(MIXED_WALLET, "w-mixed", 2)).toBe(true);
  });

  test("CG-18: at t = n one refusal is a VETO — a coercion gate, for any wallet", () => {
    expect(declineIsCostFree(PEOPLE_WALLET, "w-people", 3)).toBe(false);
    expect(declineIsCostFree(AGENT_WALLET, "w-agent", 3)).toBe(false);
  });

  test("CG-19: an unknown wallet has no quorum and decline is not vacuously free", () => {
    expect(declineIsCostFree(PEOPLE_WALLET, "w-nonexistent", 1)).toBe(false);
  });
});

describe("self-issued spending authority — one party, not two", () => {
  // The owner quorum is ALL AGENTS on purpose: the whole flow runs with no human.
  const owner = frostKeygen(2, 3, lcg(1001));
  const bearer = frostKeygen(1, 1, lcg(1002)); // the hot key
  const other = frostKeygen(2, 3, lcg(1003)); // an unrelated wallet's quorum

  const unsigned = {
    schema: SPENDING_AUTHORITY_SCHEMA,
    authorityId: "auth-001",
    wallet: "w-agent",
    ownerGroupPublicKeyHex: bytesToHex(owner.groupPublicKey),
    bearerPublicKeyHex: bytesToHex(bearer.groupPublicKey),
    bounds: {
      notBefore: "2026-08-14T00:00:00Z",
      notAfter: "2026-09-14T00:00:00Z",
      budgetMinorUnits: 500_00,
      currency: "USD",
      scopes: ["x402.pay"],
    },
  } as const;

  function signedByOwner(
    u: Omit<SpendingAuthority, "signatureHex">,
    seed = 2001,
  ): SpendingAuthority {
    const sig = frostThresholdSign(
      owner.groupPublicKey,
      owner.shares.slice(0, 2),
      spendingAuthoritySignable(u),
      lcg(seed),
      2,
    );
    return { ...u, signatureHex: bytesToHex(sig) };
  }

  test("SA-1: an authority signed by the OWNER quorum verifies — no human involved", () => {
    expect(verifySpendingAuthority(signedByOwner(unsigned), owner.groupPublicKey)).toEqual({
      ok: true,
    });
  });

  test("SA-2: the BEARER cannot enlarge its own authority", () => {
    // Not one party holding power over another — the ordinary property that a
    // hot key cannot self-escalate. It applies to every wallet identically.
    const bigger = { ...unsigned, bounds: { ...unsigned.bounds, budgetMinorUnits: 5_000_000_00 } };
    const sig = frostThresholdSign(
      bearer.groupPublicKey,
      bearer.shares,
      spendingAuthoritySignable(bigger),
      lcg(2002),
      1,
    );
    const forged: SpendingAuthority = { ...bigger, signatureHex: bytesToHex(sig) };
    const v = verifySpendingAuthority(forged, owner.groupPublicKey);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/not by the wallet owner quorum/);
  });

  test("SA-3: an UNRELATED wallet's quorum cannot issue against this wallet", () => {
    // Transfer-not-delegation: no wallet's quorum has authority over another's.
    const sig = frostThresholdSign(
      other.groupPublicKey,
      other.shares.slice(0, 2),
      spendingAuthoritySignable(unsigned),
      lcg(2003),
      2,
    );
    expect(
      verifySpendingAuthority({ ...unsigned, signatureHex: bytesToHex(sig) }, owner.groupPublicKey)
        .ok,
    ).toBe(false);
  });

  test("SA-4: an authority that NAMES ITSELF as its own wallet owner does not self-verify", () => {
    const selfNamed = {
      ...unsigned,
      authorityId: "auth-self",
      ownerGroupPublicKeyHex: bytesToHex(bearer.groupPublicKey),
    };
    const sig = frostThresholdSign(
      bearer.groupPublicKey,
      bearer.shares,
      spendingAuthoritySignable(selfNamed),
      lcg(2004),
      1,
    );
    const v = verifySpendingAuthority(
      { ...selfNamed, signatureHex: bytesToHex(sig) },
      owner.groupPublicKey,
    );
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/different wallet owner/);
  });

  test("SA-5: every bound is INSIDE the signature — tampering any one invalidates it", () => {
    const g = signedByOwner(unsigned);
    const mutations: readonly SpendingAuthority[] = [
      { ...g, bounds: { ...g.bounds, budgetMinorUnits: g.bounds.budgetMinorUnits + 1 } },
      { ...g, bounds: { ...g.bounds, notAfter: "2027-09-14T00:00:00Z" } },
      { ...g, bounds: { ...g.bounds, notBefore: "2020-01-01T00:00:00Z" } },
      { ...g, bounds: { ...g.bounds, scopes: [...g.bounds.scopes, "admin.everything"] } },
      { ...g, bounds: { ...g.bounds, currency: "BTC" } },
      { ...g, authorityId: "auth-999" },
      { ...g, wallet: "w-someone-else" },
      { ...g, bearerPublicKeyHex: bytesToHex(other.groupPublicKey) },
      { ...g, supersedesAuthorityId: "auth-000" },
    ];
    for (const m of mutations) {
      expect(verifySpendingAuthority(m, owner.groupPublicKey).ok).toBe(false);
    }
  });

  test("SA-6: the OWNER quorum raises its own hot key's ceiling with NO human in the loop", () => {
    // The positive half of SA-2. "More budget" is available to the wallet's own
    // holders whoever they are — here, three agents. Nothing is asked of a human.
    const raised = {
      ...unsigned,
      authorityId: "auth-002",
      supersedesAuthorityId: "auth-001",
      bounds: { ...unsigned.bounds, budgetMinorUnits: 5_000_000_00 },
    };
    expect(verifySpendingAuthority(signedByOwner(raised, 2005), owner.groupPublicKey)).toEqual({
      ok: true,
    });
  });

  test("SA-7: the canonical encoding is injective ACROSS FIELD BOUNDARIES", () => {
    // Under a "" join these encode identically, so ONE signature would cover BOTH.
    const a = spendingAuthoritySignable({ ...unsigned, authorityId: "ab", wallet: "cc" });
    const b = spendingAuthoritySignable({ ...unsigned, authorityId: "a", wallet: "bcc" });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);

    const s1 = spendingAuthoritySignable({
      ...unsigned,
      bounds: { ...unsigned.bounds, scopes: ["a", "b"] },
    });
    const s2 = spendingAuthoritySignable({
      ...unsigned,
      bounds: { ...unsigned.bounds, scopes: ["a b"] },
    });
    expect(Buffer.from(s1).equals(Buffer.from(s2))).toBe(false);
  });

  test("SA-8: an absent supersedesAuthorityId does not encode like an empty one", () => {
    const absent = spendingAuthoritySignable(unsigned);
    const empty = spendingAuthoritySignable({ ...unsigned, supersedesAuthorityId: "" });
    expect(Buffer.from(absent).equals(Buffer.from(empty))).toBe(false);
  });

  test("SA-9: a malformed signature encoding is refused, not thrown", () => {
    expect(
      verifySpendingAuthority({ ...unsigned, signatureHex: "not-hex" }, owner.groupPublicKey).ok,
    ).toBe(false);
  });
});

describe("spending within the bounds", () => {
  const owner = frostKeygen(2, 3, lcg(3001));
  const bearer = frostKeygen(1, 1, lcg(3002));
  const bearerHex = bytesToHex(bearer.groupPublicKey);

  const unsigned = {
    schema: SPENDING_AUTHORITY_SCHEMA,
    authorityId: "auth-op",
    wallet: "w-agent",
    ownerGroupPublicKeyHex: bytesToHex(owner.groupPublicKey),
    bearerPublicKeyHex: bearerHex,
    bounds: {
      notBefore: "2026-08-14T00:00:00Z",
      notAfter: "2026-09-14T00:00:00Z",
      budgetMinorUnits: 500_00,
      currency: "USD",
      scopes: ["x402.pay"],
    },
  } as const;
  const authority: SpendingAuthority = {
    ...unsigned,
    signatureHex: bytesToHex(
      frostThresholdSign(
        owner.groupPublicKey,
        owner.shares.slice(0, 2),
        spendingAuthoritySignable(unsigned),
        lcg(3003),
        2,
      ),
    ),
  };
  const verdict = verifySpendingAuthority(authority, owner.groupPublicKey);

  test("SA-10: an in-bounds spend is authorized at x402 speed, no ceremony", () => {
    expect(
      authorizeSpend(authority, verdict, {
        bearerPublicKeyHex: bearerHex,
        scope: "x402.pay",
        amountMinorUnits: 100_00,
        at: "2026-08-20T12:00:00Z",
      }),
    ).toEqual({ ok: true });
  });

  test("SA-11: over ceiling, out of scope, expired, early, wrong bearer are each refused", () => {
    const base = {
      bearerPublicKeyHex: bearerHex,
      scope: "x402.pay",
      amountMinorUnits: 100_00,
      at: "2026-08-20T12:00:00Z",
    };
    const cases: readonly (readonly [Record<string, unknown>, RegExp])[] = [
      [{ amountMinorUnits: 500_01 }, /exceeds the authorized ceiling/],
      [{ scope: "admin.everything" }, /outside the authority/],
      [{ at: "2026-09-14T00:00:00Z" }, /expired/],
      [{ at: "2026-08-13T23:59:59Z" }, /precedes the window/],
      [{ bearerPublicKeyHex: bytesToHex(owner.groupPublicKey) }, /does not name/],
      [{ amountMinorUnits: -1 }, /non-negative integer/],
      [{ at: "not-a-time" }, /RFC 3339/],
    ];
    for (const [patch, re] of cases) {
      const r = authorizeSpend(authority, verdict, { ...base, ...patch } as never);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toMatch(re);
    }
  });

  test("SA-12: the boundary is exact", () => {
    const at = (t: string, amt: number) =>
      authorizeSpend(authority, verdict, {
        bearerPublicKeyHex: bearerHex,
        scope: "x402.pay",
        amountMinorUnits: amt,
        at: t,
      }).ok;
    expect(at("2026-08-20T12:00:00Z", 500_00)).toBe(true); // exactly the ceiling
    expect(at("2026-08-14T00:00:00Z", 1)).toBe(true); // notBefore inclusive
    expect(at("2026-09-13T23:59:59Z", 1)).toBe(true);
    expect(at("2026-09-14T00:00:00Z", 1)).toBe(false); // notAfter exclusive
  });

  test("SA-13: an UNVERIFIED authority authorizes nothing, whatever it says", () => {
    expect(
      authorizeSpend(authority, { ok: false, reason: "not by the wallet owner quorum" }, {
        bearerPublicKeyHex: bearerHex,
        scope: "x402.pay",
        amountMinorUnits: 1,
        at: "2026-08-20T12:00:00Z",
      }).ok,
    ).toBe(false);
  });
});
