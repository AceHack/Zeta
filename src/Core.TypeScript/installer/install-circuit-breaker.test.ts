/**
 * install-circuit-breaker.test.ts -- falsifiers for R9 and R4.
 *
 * The load-bearing assertions are the REFUSALS: a corrupt ledger must not read
 * as zero attempts, and a recognised prior install whose identity will not
 * validate must STOP the wipe rather than re-pave into a duplicate
 * registration (HWR-2).
 *
 * DESIGNED-BUT-UNRUN against hardware. Nothing here has met a disk.
 */

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS,
  decideBreaker,
  planRepair,
  validateAttemptLedger,
  validateRememberedIdentity,
} from "./install-circuit-breaker.ts";

describe("R9: a corrupt counter must not read as zero", () => {
  test("an empty ledger is trusted and means first attempt", () => {
    const v = validateAttemptLedger("");
    expect(v.trusted).toBe(true);
    expect(v.records).toHaveLength(0);
  });

  test("garbage is UNTRUSTED, and untrusted OPENS the breaker", () => {
    const v = validateAttemptLedger("this is not a ledger");
    expect(v.trusted).toBe(false);
    const b = decideBreaker({ validation: v, ledgerWritable: true });
    expect(b.state).toBe("open");
    expect(b.reason).toContain("corrupt counter");
  });

  test("attempt numbers that skip are untrusted: a truncated ledger is not a fresh one", () => {
    expect(validateAttemptLedger("2|t|failed|wipe").trusted).toBe(false);
    expect(validateAttemptLedger("1|t|failed|wipe\n3|t|failed|wipe").trusted).toBe(false);
  });

  test("consecutive failures reach the bound and OPEN the breaker", () => {
    const rows: string[] = [];
    for (let i = 1; i <= DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS; i++) {
      rows.push(String(i) + "|2026-08-21T00:00:00Z|failed|wipe");
    }
    const v = validateAttemptLedger(rows.join("\n"));
    expect(v.trusted).toBe(true);
    const b = decideBreaker({ validation: v, ledgerWritable: true });
    expect(b.state).toBe("open");
    expect(b.consecutiveFailures).toBe(DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS);
  });

  test("a completed install resets the run of failures", () => {
    const v = validateAttemptLedger("1|t|failed|wipe\n2|t|failed|wipe\n3|t|ok|wipe\n4|t|failed|wipe");
    const b = decideBreaker({ validation: v, ledgerWritable: true });
    expect(b.consecutiveFailures).toBe(1);
    expect(b.state).toBe("closed");
  });

  test("an unwritable ledger is BLIND, never closed", () => {
    const b = decideBreaker({ validation: validateAttemptLedger(""), ledgerWritable: false });
    expect(b.state).toBe("blind");
  });

  test("an unwritable ledger does NOT rescue an already-open breaker", () => {
    const b = decideBreaker({ validation: validateAttemptLedger("nonsense"), ledgerWritable: false });
    expect(b.state).toBe("open");
  });
});

const GOOD = {
  "cluster-node-id": "control-plane",
  "cluster-segment-mac": "aa:bb:cc:dd:ee:ff",
  "cluster-segment-address": "10.0.0.5/24",
  "cluster-control-plane-address": "10.0.0.1",
  "usb-uuid": "1234-ABCD",
};

describe("R4: validate remembered identity BEFORE trusting it", () => {
  test("a complete identity validates", () => {
    const v = validateRememberedIdentity(GOOD);
    expect(v.trusted).toBe(true);
    expect(v.identity?.hostname).toBe("control-plane");
  });

  test("a missing node id is untrusted", () => {
    const v = validateRememberedIdentity({ ...GOOD, "cluster-node-id": "" });
    expect(v.trusted).toBe(false);
    expect(v.reasons.join(" ")).toContain("absent");
  });

  test("a partial segment trio is untrusted: all three or none", () => {
    const v = validateRememberedIdentity({ ...GOOD, "cluster-segment-address": "" });
    expect(v.trusted).toBe(false);
    expect(v.reasons.join(" ")).toContain("partial");
  });

  test("no segment trio at all is fine: absent is not broken", () => {
    const v = validateRememberedIdentity({
      "cluster-node-id": "worker-gpu",
      "cluster-segment-mac": "",
      "cluster-segment-address": "",
      "cluster-control-plane-address": "",
    });
    expect(v.trusted).toBe(true);
  });

  test("a malformed MAC is untrusted", () => {
    expect(validateRememberedIdentity({ ...GOOD, "cluster-segment-mac": "aa-bb-cc-dd-ee-ff" }).trusted).toBe(false);
  });

  test("a hostname with a shell metacharacter is untrusted", () => {
    expect(validateRememberedIdentity({ ...GOOD, "cluster-node-id": "node;rm" }).trusted).toBe(false);
  });
});

describe("R4 + HWR-2: a recognised node with an unreadable identity STOPS the wipe", () => {
  test("nothing recognised means an ordinary fresh install", () => {
    const p = planRepair({ priorInstallRecognised: false, identityValidation: validateRememberedIdentity({}) });
    expect(p.action).toBe("fresh-install");
  });

  test("recognised plus valid identity means rejoin as SELF", () => {
    const p = planRepair({ priorInstallRecognised: true, identityValidation: validateRememberedIdentity(GOOD) });
    expect(p.action).toBe("repair-reuse-identity");
    expect(p.reuseHostname).toBe("control-plane");
    expect(p.reuseSegmentMac).toBe("aa:bb:cc:dd:ee:ff");
  });

  test("recognised plus BROKEN identity REFUSES the wipe and names HWR-2", () => {
    const p = planRepair({
      priorInstallRecognised: true,
      identityValidation: validateRememberedIdentity({ ...GOOD, "cluster-node-id": "" }),
    });
    expect(p.action).toBe("refuse-wipe");
    expect(p.reason).toContain("HWR-2");
    expect(p.reuseHostname).toBeNull();
  });

  test("the refusal is what makes this different from ignoring broken state", () => {
    const broken = planRepair({
      priorInstallRecognised: true,
      identityValidation: validateRememberedIdentity({ "cluster-node-id": "NOT A HOSTNAME" }),
    });
    expect(broken.action).not.toBe("fresh-install");
    expect(broken.action).not.toBe("repair-reuse-identity");
  });
});
