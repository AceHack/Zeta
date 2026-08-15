import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  commitMeasure,
  findExistingEntry,
  renderEntry,
  repoWorkItemResolver,
  slugify,
  validateMeasure,
  type MeasureSpec,
  type WorkItemResolver,
} from "./measure";

const KEY = "081KZZZH24H087G0R002TXQA15";
const known: WorkItemResolver = (id) => (id === KEY ? `${KEY}-a-real-work-item.md` : null);

const spec = (over: Partial<MeasureSpec> = {}): MeasureSpec => ({
  workItem: KEY,
  title: "derive block address from seq",
  measure: "blockSeq/blockPos were trusted from an unauthenticated header; both are now derived",
  sign: "reduced",
  because: "a lying peer could write any slot of any block; the address is no longer attacker-supplied",
  witness: "ULT-36 fails without the fix",
  ...over,
});

function tmpLedger(): string {
  return mkdtempSync(join(tmpdir(), "shadow-du-ledger-"));
}

// ── it RECORDS ────────────────────────────────────────────────────────────────────────────────

test("records a substantiated measurement as one text entry keyed by the work-item", () => {
  const dir = tmpLedger();
  try {
    const r = commitMeasure(dir, spec(), known);
    expect(r.kind).toBe("created");
    const files = readdirSync(dir);
    expect(files).toEqual([`${KEY}-derive-block-address-from-seq.md`]);
    const body = readFileSync(join(dir, files[0]!), "utf8");
    expect(body).toContain(`# ΔU: ${KEY} —`);
    expect(body).toContain("**ΔU > 0 because:**");
    expect(body).toContain("**witnessed by:** ULT-36 fails without the fix");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the sign is ordinal and rendered as its glyph — no cardinal price is ever invented", () => {
  expect(renderEntry(spec({ sign: "reduced" }))).toContain("ΔU > 0 because:");
  expect(renderEntry(spec({ sign: "increased" }))).toContain("ΔU < 0 because:");
  expect(renderEntry(spec({ sign: "unchanged" }))).toContain("ΔU ≈ 0 because:");
  // No digit-bearing "price" field exists to fabricate.
  expect(renderEntry(spec())).not.toMatch(/\*\*(price|value|worth):\*\*/);
});

// ── it REFUSES ────────────────────────────────────────────────────────────────────────────────

test("REFUSES an unsubstantiated work-item key (the invented-entry guard)", () => {
  const dir = tmpLedger();
  try {
    const r = commitMeasure(dir, spec({ workItem: "081ZZZZZZZZ087G0R002TXQA15" }), known);
    expect(r.kind).toBe("refused");
    expect(r.kind === "refused" && r.code).toBe("unknown-work-item");
    expect(readdirSync(dir)).toEqual([]); // refusal writes NOTHING
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("REFUSES an unwitnessed ΔU (unmetered asserted as metered)", () => {
  const r = validateMeasure(spec({ witness: "   " }), known);
  expect(r.ok).toBe(false);
  expect(r.ok === false && r.code).toBe("unwitnessed");
});

test("REFUSES a ΔU sign with no rationale", () => {
  const r = validateMeasure(spec({ because: "" }), known);
  expect(r.ok === false && r.code).toBe("unreasoned");
});

test("REFUSES a `measure` with nothing measured", () => {
  const r = validateMeasure(spec({ measure: "" }), known);
  expect(r.ok === false && r.code).toBe("unmeasured");
});

test("REFUSES a non-canonical ZetaId (I/L/O/U are not Crockford base32)", () => {
  for (const bad of ["", "B-0357", "081KZZZH24H087G0R002TXQA1", "081KZZZH24H087G0R002TXQAIL"]) {
    const r = validateMeasure(spec({ workItem: bad }), known);
    expect(r.ok === false && r.code).toBe("malformed-key");
  }
});

test("a fully substantiated measurement passes — the refusals discriminate, they do not block everything", () => {
  expect(validateMeasure(spec(), known)).toEqual({ ok: true });
});

// ── IDEMPOTENCY (dv2 §6): measure twice ⇒ one entry, one price ─────────────────────────────────

test("measuring the SAME fix twice yields one entry and one price (upsert, not double-pay)", () => {
  const dir = tmpLedger();
  try {
    const first = commitMeasure(dir, spec(), known);
    const before = readFileSync(join(dir, readdirSync(dir)[0]!), "utf8");

    const second = commitMeasure(dir, spec(), known);

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("unchanged"); // apply-N-times == apply-once EFFECT
    const files = readdirSync(dir);
    expect(files).toHaveLength(1); // ONE entry
    const after = readFileSync(join(dir, files[0]!), "utf8");
    expect(after).toBe(before); // ONE price, byte-identical
    expect(after.match(/because:/g)).toHaveLength(1); // not appended twice
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a CORRECTED re-measure upserts in place — still one entry, the new price", () => {
  const dir = tmpLedger();
  try {
    commitMeasure(dir, spec(), known);
    const r = commitMeasure(dir, spec({ witness: "ULT-36 and ULT-24 fail without the fix" }), known);
    expect(r.kind).toBe("upserted");
    expect(readdirSync(dir)).toHaveLength(1);
    expect(readFileSync(join(dir, readdirSync(dir)[0]!), "utf8")).toContain("ULT-36 and ULT-24");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a retitled re-measure does NOT fork a second entry — identity is the ZetaId, not the slug", () => {
  const dir = tmpLedger();
  try {
    commitMeasure(dir, spec(), known);
    const r = commitMeasure(dir, spec({ title: "a completely different wording" }), known);
    expect(r.kind).toBe("upserted");
    expect(readdirSync(dir)).toHaveLength(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dedups against a LEGACY short-form entry instead of gaining a twin", () => {
  const dir = tmpLedger();
  try {
    // The ledger's pre-existing entry is keyed by an 11-char prefix of the full ZetaId.
    writeFileSync(join(dir, "081KWG9JQ9H-iring-isemiring-split.md"), "# legacy\n", "utf8");
    const full = "081KWG9JQ9H08QG0R0024EMETG";
    expect(findExistingEntry(dir, full)).toBe("081KWG9JQ9H-iring-isemiring-split.md");
    const r = commitMeasure(dir, spec({ workItem: full }), () => "found");
    expect(r.kind).toBe("upserted");
    expect(readdirSync(dir)).toHaveLength(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("README.md is never treated as a ledger entry", () => {
  const dir = tmpLedger();
  try {
    writeFileSync(join(dir, "README.md"), "# readme\n", "utf8");
    expect(findExistingEntry(dir, KEY)).toBeNull();
    expect(commitMeasure(dir, spec(), known).kind).toBe("created");
    expect(readdirSync(dir).sort()).toEqual(["081KZZZH24H087G0R002TXQA15-derive-block-address-from-seq.md", "README.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── the real resolver ─────────────────────────────────────────────────────────────────────────

test("repoWorkItemResolver finds ids under workitems/ and docs/backlog/, and only those", () => {
  const root = mkdtempSync(join(tmpdir(), "shadow-du-repo-"));
  try {
    mkdirSync(join(root, "workitems", "done", "2026", "07"), { recursive: true });
    mkdirSync(join(root, "docs", "backlog", "P1"), { recursive: true });
    writeFileSync(join(root, "workitems", `${KEY}-open.md`), "x", "utf8");
    writeFileSync(join(root, "workitems", "done", "2026", "07", "081KWG9JQ9H08QG0R0024EMETG-done.md"), "x", "utf8");
    writeFileSync(join(root, "docs", "backlog", "P1", "081KSXN940008QG0R002FWR9B2-row.md"), "x", "utf8");

    const resolve = repoWorkItemResolver(root);
    expect(resolve(KEY)).toBe(`${KEY}-open.md`);
    expect(resolve("081KWG9JQ9H08QG0R0024EMETG")).toBe("081KWG9JQ9H08QG0R0024EMETG-done.md");
    expect(resolve("081KSXN940008QG0R002FWR9B2")).toBe("081KSXN940008QG0R002FWR9B2-row.md");
    expect(resolve("081ZZZZZZZZ087G0R002TXQA15")).toBeNull();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("slugify is ordinal, hyphenated and bounded", () => {
  expect(slugify("Derive Block Address From Seq!")).toBe("derive-block-address-from-seq");
  expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  expect(slugify("---")).toBe("");
});
