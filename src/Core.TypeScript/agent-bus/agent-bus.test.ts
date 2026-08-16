/**
 * Agent-bus Phase 1 (081KSXN940008QG0R00171YAZW) tests — pure write/read/mint against a temp root.
 * No git, no real docs/agent-bus/ (per the module's pure/CLI split).
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { DETERMINISTIC_ENV, DEFAULT_ENV, unpack } from "../zeta-id/zeta-id";
import { Category } from "../zeta-id/types";
import { envelopePath, mintBusZetaIdHex, serializeEnvelope, isSafeSegment, type AgentBusEnvelope } from "./types";
import { writeEnvelope, makeEnvelope } from "./publish";
import { readEnvelopesSince, nextCursor, envelopeCursor, parseSubscribeArgs } from "./subscribe";

let ROOT: string;
beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "agent-bus-test-"));
});
afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

// AgentBusEnvelope === MessageEnvelope: topic+payload top-level + id/from/to/timestamp/expiresAt.
// Scope the helper to the shadow-catch member so `over` can't desync topic from its payload:
// Partial<AgentBusEnvelope> would let a caller set topic without the matching payload, and the
// spread { topic, payload, ...over } then produces a non-member (e.g. heartbeat-topic with a
// shadow payload) that isn't assignable to the discriminated union (Codex #6283 P1; bun strips
// types so it ran green, tsc catches it).
type ShadowCatchEnvelope = Extract<AgentBusEnvelope, { topic: "shadow-catch" }>;

/**
 * A distinct, stable, GENUINELY DECODABLE bus id per sequence number.
 *
 * These fixtures used zero-padded literals such as `"01".padStart(32, "0")` — 32 valid hex
 * characters whose decoded version is 0, a version that does not exist. They passed only
 * while `isCanonicalBusId`
 * was a bare `/^[0-9a-f]{32}$/`; `subscribe.ts` now decodes. Minting from an increasing
 * timestamp preserves the property these tests actually rely on — LEXICAL id order
 * matches mint order — because the timestamp field sits above the randomness field.
 */
const BUS_ID = (seq: number): string => mintBusZetaIdHex(DETERMINISTIC_ENV, 1_700_000_000_000 + seq);

const env = (over: Partial<ShadowCatchEnvelope> = {}): AgentBusEnvelope => ({
  topic: "shadow-catch",
  payload: { content: "hi" },
  id: BUS_ID(1),
  from: "otto-cli",
  to: "*",
  timestamp: "2026-05-31T12:00:00.000Z",
  expiresAt: "2026-06-01T12:00:00.000Z",
  ...over,
});

describe("mintBusZetaIdHex", () => {
  it("is 32 hex chars in the Bus category", () => {
    const hex = mintBusZetaIdHex(DETERMINISTIC_ENV, 1_700_000_000_000);
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
    expect(unpack(BigInt(`0x${hex}`) as never).category).toBe(Category.Bus);
  });
  it("is reproducible under DETERMINISTIC_ENV (same fields -> same id; the G-Set collision caveat)", () => {
    expect(mintBusZetaIdHex(DETERMINISTIC_ENV, 1_700_000_000_000)).toBe(mintBusZetaIdHex(DETERMINISTIC_ENV, 1_700_000_000_000));
  });
  it("is unique under DEFAULT_ENV even at the same ms (crypto randomness)", () => {
    expect(mintBusZetaIdHex(DEFAULT_ENV, 1_700_000_000_000)).not.toBe(mintBusZetaIdHex(DEFAULT_ENV, 1_700_000_000_000));
  });
});

describe("envelopePath + isSafeSegment (path-injection guard)", () => {
  it("lays out <root>/<persona>/<YYYY>/<MM>/<DD>/<id>.json (UTC)", () => {
    expect(envelopePath(ROOT, "otto-cli", "deadbeef", new Date("2026-05-31T23:59:00Z"))).toBe(
      join(ROOT, "otto-cli", "2026", "05", "31", "deadbeef.json"),
    );
  });
  it("rejects unsafe segments (../, /, leading dot)", () => {
    expect(isSafeSegment("otto-cli")).toBe(true);
    expect(isSafeSegment("otto-windows")).toBe(true); // kebab hyphen is fine
    expect(isSafeSegment("../etc")).toBe(false);
    expect(isSafeSegment("a/b")).toBe(false);
    expect(isSafeSegment(".hidden")).toBe(false);
    expect(isSafeSegment("a:b")).toBe(false); // Windows-forbidden colon (Copilot #6283)
    expect(isSafeSegment("a*b")).toBe(false); // Windows-forbidden glob char
    expect(() => envelopePath(ROOT, "../escape", "deadbeef")).toThrow();
    expect(() => envelopePath(ROOT, "otto-cli", "../../escape")).toThrow();
  });
});

describe("writeEnvelope — G-Set CRDT semantics (atomic, no TOCTOU)", () => {
  const at = new Date("2026-05-31T12:00:00Z");
  it("creates the file under the persona/date/id path", () => {
    const r = writeEnvelope(env(), ROOT, at);
    expect(r.kind).toBe("created");
    expect(existsSync(r.path)).toBe(true);
    expect(r.path).toBe(join(ROOT, "otto-cli", "2026", "05", "31", `${env().id}.json`));
  });
  it("is idempotent on identical content (re-publish = safe no-op)", () => {
    expect(writeEnvelope(env(), ROOT, at).kind).toBe("created");
    expect(writeEnvelope(env(), ROOT, at).kind).toBe("exists-identical");
  });
  it("surfaces a same-id/different-content collision (atomic; never silently overwrites)", () => {
    writeEnvelope(env(), ROOT, at);
    expect(writeEnvelope(env({ payload: { content: "DIFFERENT" } }), ROOT, at).kind).toBe("collision");
  });
  it("disjoint ids -> disjoint files (grow-only set, conflict-free)", () => {
    writeEnvelope(env({ id: BUS_ID(1) }), ROOT, at);
    writeEnvelope(env({ id: BUS_ID(2) }), ROOT, at);
    expect(readEnvelopesSince(ROOT)).toHaveLength(2);
  });
  it("defaults the date partition to the envelope's OWN timestamp, not wall-clock (Copilot #6283)", () => {
    // No explicit `at` -> partition must come from env.timestamp so an idempotent
    // re-publish always lands the same file, even near a UTC-midnight boundary.
    const id = BUS_ID(13);
    const r = writeEnvelope(env({ id, timestamp: "2026-05-31T23:59:00.000Z" }), ROOT);
    expect(r.path).toBe(join(ROOT, "otto-cli", "2026", "05", "31", `${id}.json`));
  });
  it("refuses to write an envelope with a malformed timestamp (no NaN/NaN/NaN path) — Copilot #6283", () => {
    expect(() => writeEnvelope(env({ timestamp: "not-a-date" }), ROOT)).toThrow();
  });
});

describe("readEnvelopesSince", () => {
  const at = new Date("2026-05-31T12:00:00Z");
  const seed = () => {
    writeEnvelope(env({ id: BUS_ID(1), timestamp: "2026-05-31T10:00:00.000Z" }), ROOT, at);
    writeEnvelope(env({ id: BUS_ID(2), timestamp: "2026-05-31T11:00:00.000Z" }), ROOT, at);
    writeEnvelope(env({ id: BUS_ID(3), timestamp: "2026-05-31T12:00:00.000Z" }), ROOT, at);
  };

  it("returns all envelopes sorted by timestamp when no cursor", () => {
    seed();
    expect(readEnvelopesSince(ROOT).map((e) => e.timestamp)).toEqual([
      "2026-05-31T10:00:00.000Z",
      "2026-05-31T11:00:00.000Z",
      "2026-05-31T12:00:00.000Z",
    ]);
  });
  it("returns only envelopes strictly after the cursor", () => {
    seed();
    expect(readEnvelopesSince(ROOT, "2026-05-31T10:30:00.000Z").map((e) => e.timestamp)).toEqual([
      "2026-05-31T11:00:00.000Z",
      "2026-05-31T12:00:00.000Z",
    ]);
  });
  it("nextCursor is the newest envelope's compound cursor", () => {
    seed();
    const envs = readEnvelopesSince(ROOT);
    expect(nextCursor(envs)).toBe(`2026-05-31T12:00:00.000Z|${BUS_ID(3)}`);
  });
  it("does NOT drop a later same-millisecond envelope — compound (timestamp, id) cursor", () => {
    const sameTs = "2026-05-31T12:00:00.000Z";
    const e1 = env({ id: BUS_ID(10), timestamp: sameTs });
    const e2 = env({ id: BUS_ID(11), timestamp: sameTs });
    writeEnvelope(e1, ROOT, at);
    writeEnvelope(e2, ROOT, at);
    expect(readEnvelopesSince(ROOT, envelopeCursor(e1)).map((e) => e.id)).toEqual([e2.id]);
  });
  it("filters to a recipient (addressed-to-me + broadcast *, never others) — Codex #6283", () => {
    const A1 = BUS_ID(21);
    const A3 = BUS_ID(23);
    writeEnvelope(env({ id: A1, to: "otto-cli" }), ROOT, at);
    writeEnvelope(env({ id: BUS_ID(22), to: "otto-windows" }), ROOT, at);
    writeEnvelope(env({ id: A3, to: "*" }), ROOT, at);
    const cmp = (a: string, b: string) => a.localeCompare(b);
    expect(readEnvelopesSince(ROOT, undefined, "otto-cli").map((e) => e.id).sort(cmp)).toEqual([A1, A3].sort(cmp));
  });

  it("skips malformed JSON (best-effort) without throwing", () => {
    writeEnvelope(env(), ROOT, at);
    const bad = join(ROOT, "otto-cli", "2026", "05", "31", "ffffffffffffffffffffffffffffffff.json");
    mkdirSync(dirname(bad), { recursive: true });
    writeFileSync(bad, "{ not json");
    expect(readEnvelopesSince(ROOT)).toHaveLength(1);
  });
  it("skips schema-invalid envelopes (valid JSON, missing timestamp/id) without throwing", () => {
    writeEnvelope(env(), ROOT, at);
    const bad = join(ROOT, "otto-cli", "2026", "05", "31", "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.json");
    mkdirSync(dirname(bad), { recursive: true });
    writeFileSync(bad, JSON.stringify({ topic: "shadow-catch", payload: { content: "no keys" } })); // no timestamp/id
    expect(readEnvelopesSince(ROOT)).toHaveLength(1); // the good one; schema-invalid skipped, no crash
  });
  it("skips an envelope whose timestamp isn't canonical ISO (would corrupt ordering) — Copilot #6283", () => {
    writeEnvelope(env(), ROOT, at);
    const id = BUS_ID(13);
    const bad = join(ROOT, "otto-cli", "2026", "05", "31", `${id}.json`);
    mkdirSync(dirname(bad), { recursive: true });
    // valid JSON, has id + timestamp strings, but timestamp is non-ISO (sorts wrong)
    writeFileSync(bad, JSON.stringify({ ...env({ id }), timestamp: "2026/05/31 12:00" }));
    expect(readEnvelopesSince(ROOT)).toHaveLength(1); // good one only; non-ISO skipped
  });
});

describe("serializeEnvelope + makeEnvelope", () => {
  it("serialize is stable (pretty + trailing newline)", () => {
    const s = serializeEnvelope(env());
    expect(s.endsWith("}\n")).toBe(true);
    expect((JSON.parse(s) as AgentBusEnvelope).id).toBe(env().id);
  });
  it("makeEnvelope builds a MessageEnvelope (Bus id, timestamp+expiresAt, top-level topic/payload)", () => {
    const e = makeEnvelope("otto-cli", "*", { topic: "heartbeat", payload: { status: "alive" } }, 1_700_000_000_000);
    expect(e.id).toMatch(/^[0-9a-f]{32}$/);
    expect(e.timestamp).toBe(new Date(1_700_000_000_000).toISOString());
    expect(e.topic).toBe("heartbeat");
    expect(e.from).toBe("otto-cli");
    expect(typeof e.expiresAt).toBe("string");
  });
});

describe("parseSubscribeArgs (CLI arg parsing)", () => {
  it("treats a bare positional as the cursor when --for is absent (Codex #6283 regression)", () => {
    expect(parseSubscribeArgs(["mycursor"])).toEqual({ cursor: "mycursor", recipient: undefined, fetch: true });
  });
  it("parses cursor + --for in either order", () => {
    expect(parseSubscribeArgs(["mycursor", "--for", "otto-cli"])).toEqual({ cursor: "mycursor", recipient: "otto-cli", fetch: true });
    expect(parseSubscribeArgs(["--for", "otto-cli", "mycursor"])).toEqual({ cursor: "mycursor", recipient: "otto-cli", fetch: true });
  });
  it("does not mistake the --for value for the cursor", () => {
    expect(parseSubscribeArgs(["--for", "otto-cli"]).cursor).toBeUndefined();
  });
  it("honors --no-fetch", () => {
    expect(parseSubscribeArgs(["mycursor", "--no-fetch"])).toEqual({ cursor: "mycursor", recipient: undefined, fetch: false });
  });
});
