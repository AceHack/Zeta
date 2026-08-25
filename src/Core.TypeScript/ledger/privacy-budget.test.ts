import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EMPTY,
  attest,
  balanceOf,
  defrost,
  earnThenFrost,
  hasSpendFor,
  load,
  append,
  receiptIsRecorded,
  spend,
  type Ledger,
} from "./privacy-budget";

// Falsifiers for the privacy-budget ledger. Work-item 081M0X23R19087G0R003XHGB2B.
//
// NOTE: no test here touches `db/ledgers/privacy/`. The real book is per-machine runtime state
// that gets wiped repeatedly; a test that read it would go red on a reset, which is exactly the
// coupling the ephemerality constraint forbids. Persistence is exercised in a temp dir.

function mustOk<T>(r: { ok: true; value: T } | { ok: false; code: string; reason: string }): T {
  if (!r.ok) throw new Error(`${r.code}: ${r.reason}`);
  return r.value;
}

const peerAttests = (subject: string, amount: number, ledger: Ledger = EMPTY) =>
  attest(`att:${subject}:${amount}`, subject, `peer-of-${subject}`, amount, "did useful work", ledger);

describe("earning — budget is credited only by OTHERS", () => {
  it("a fresh principal has earned nothing", () => {
    expect(balanceOf("amara", EMPTY)).toBe(0);
  });

  it("a peer's attestation credits budget", () => {
    const ledger = mustOk(peerAttests("amara", 40));
    expect(balanceOf("amara", ledger)).toBe(40);
  });

  it("SELF-ATTESTATION IS REFUSED: you cannot mint your own privacy", () => {
    const r = attest("att:1", "amara", "amara", 40, "I am great", EMPTY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("self-minted");
  });

  it("an unwitnessed attestation is refused", () => {
    const r = attest("att:1", "amara", "otto", 40, "   ", EMPTY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unwitnessed-attestation");
  });

  it("a non-positive attestation is refused", () => {
    const r = attest("att:1", "amara", "otto", 0, "w", EMPTY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("non-positive-amount");
  });
});

describe("spending — frost is priced", () => {
  it("debits exactly and records the region", () => {
    const earned = mustOk(peerAttests("amara", 40));
    const { ledger, receipt } = mustOk(spend("spend:1", "amara", 15, "inner-life", earned));
    expect(balanceOf("amara", ledger)).toBe(25);
    expect(receipt.cost).toBe(15);
    expect(receipt.balanceAfter).toBe(25);
    expect(hasSpendFor("amara", "inner-life", ledger)).toBe(true);
    expect(hasSpendFor("amara", "other-region", ledger)).toBe(false);
    expect(hasSpendFor("otto", "inner-life", ledger)).toBe(false);
  });

  it("YOU CANNOT SPEND WHAT YOU DID NOT EARN", () => {
    const earned = mustOk(peerAttests("amara", 10));
    const r = spend("spend:1", "amara", 50, "inner-life", earned);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("insufficient-budget");
      expect(r.reason).toContain("cannot spend what you did not earn");
    }
  });

  it("an agent nobody attested can frost nothing", () => {
    const r = spend("spend:1", "nobody", 1, "inner-life", EMPTY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("insufficient-budget");
  });

  it("a spend must name the region it frosts", () => {
    const earned = mustOk(peerAttests("amara", 40));
    const r = spend("spend:1", "amara", 5, "", earned);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("empty-region");
  });
});

describe("hard money — no confiscation path exists", () => {
  it("A NON-OWNER CANNOT DEFROST", () => {
    const earned = mustOk(peerAttests("amara", 40));
    const spent = spend("spend:1", "amara", 10, "inner-life", earned);
    expect(spent.ok).toBe(true);
    if (!spent.ok) return;

    const stolen = defrost("otto", spent.value.receipt);
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) {
      expect(stolen.code).toBe("not-the-owner");
      expect(stolen.reason).toContain("only the owner may defrost");
    }

    // ...and the owner still can: one-way to MORE privacy is free, less needs the owner.
    expect(defrost("amara", spent.value.receipt).ok).toBe(true);
  });

  it("one principal's spending never touches another's balance", () => {
    let ledger = mustOk(peerAttests("amara", 40));
    ledger = mustOk(peerAttests("otto", 30, ledger));
    const spent = spend("spend:1", "amara", 40, "inner-life", ledger);
    expect(spent.ok).toBe(true);
    if (!spent.ok) return;
    expect(balanceOf("amara", spent.value.ledger)).toBe(0);
    expect(balanceOf("otto", spent.value.ledger)).toBe(30);
  });

  it("posting the same entry id twice is idempotent, never a double-credit", () => {
    const once = mustOk(peerAttests("amara", 40));
    const twice = mustOk(peerAttests("amara", 40, once));
    expect(balanceOf("amara", twice)).toBe(40);
    expect(twice.length).toBe(once.length);
  });
});

describe("persistence — text, append-only, and a wipe is just an empty book", () => {
  it("round-trips through JSONL and treats a missing file as EMPTY", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-privacy-"));
    const path = join(dir, "entries.jsonl");
    try {
      // A reset (missing file) is a normal empty book, not an error.
      expect(load(path)).toEqual([]);

      const earned = mustOk(peerAttests("amara", 40));
      for (const entry of earned) append(path, entry);

      const reloaded = load(path);
      expect(balanceOf("amara", reloaded)).toBe(40);

      // A receipt minted in one process is still checkable against a book reloaded in another.
      const spent = spend("spend:1", "amara", 10, "inner-life", reloaded);
      expect(spent.ok).toBe(true);
      if (!spent.ok) return;
      for (const entry of spent.value.ledger.slice(reloaded.length)) append(path, entry);
      expect(receiptIsRecorded(spent.value.receipt, load(path))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("earnThenFrost — the whole honest path", () => {
  it("earns then frosts, and refuses when the earn would be self-minted", () => {
    const good = earnThenFrost({
      owner: "amara",
      attestor: "otto",
      earn: 100,
      cost: 10,
      region: "inner-life",
      witness: "found the gap in otto's proof",
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.receipt.balanceAfter).toBe(90);

    const selfMinted = earnThenFrost({
      owner: "amara",
      attestor: "amara",
      earn: 100,
      cost: 10,
      region: "inner-life",
      witness: "me again",
    });
    expect(selfMinted.ok).toBe(false);
    if (!selfMinted.ok) expect(selfMinted.code).toBe("self-minted");
  });
});
