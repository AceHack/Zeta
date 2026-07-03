import { test, expect } from "bun:test";
import { mintWorkItem, publishCreatedEvent, slugify, workItemEventsRoot, type WorkItemEnv } from "./new-workitem";
import { parse, isCanonical, ZETAID_BASE32_LEN } from "../zeta-id/encoding";
import { DEFAULT_ENV } from "../zeta-id/zeta-id";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXED_MS = Date.UTC(2026, 5, 6); // 2026-06-06T00:00:00Z — fixed for deterministic ids

// DST: inject the environment (clock + randomness). Deterministic env = fixed clock
// + zero randomness → fully replayable ids. Crypto env = fixed clock + real randomness
// → exercises the conflict-free property.
const detEnv = (ms = FIXED_MS): WorkItemEnv => ({ nowMs: () => ms, nextInt64: () => 0n });
const cryptoEnv = (ms = FIXED_MS): WorkItemEnv => ({ nowMs: () => ms, nextInt64: () => DEFAULT_ENV.nextInt64() });

test("mints a canonical ZetaId and <zetaid>-<slug>.md filename", () => {
  const m = mintWorkItem({ title: "Migrate backlog to ZetaId", type: "task" }, detEnv());
  expect(m.zetaid).toHaveLength(ZETAID_BASE32_LEN);
  expect(isCanonical(m.zetaid)).toBe(true);
  expect(() => parse(m.zetaid)).not.toThrow();
  expect(m.filename).toBe(`${m.zetaid}-migrate-backlog-to-zetaid.md`);
});

test("DST: same (spec, env) replays the EXACT same id (deterministic)", () => {
  const a = mintWorkItem({ title: "Replayable", type: "task" }, detEnv());
  const b = mintWorkItem({ title: "Replayable", type: "task" }, detEnv());
  expect(a.zetaid).toBe(b.zetaid);
  expect(a.filename).toBe(b.filename);
});

test("frontmatter carries id/type/state/priority/slug/title/created/cross-refs", () => {
  const m = mintWorkItem(
    { title: "Fix the login bug", type: "bug", priority: "P1", dependsOn: ["081KSXN940008QG0R002FWR9B2", "081KS3X9Y0008QG0R000W00V73"] },
    detEnv(),
  );
  expect(m.content).toContain(`id: ${m.zetaid}`);
  expect(m.content).toContain("type: bug");
  expect(m.content).toContain("state: backlog");
  expect(m.content).toContain("priority: P1");
  expect(m.content).toContain("slug: fix-the-login-bug");
  expect(m.content).toContain('title: "Fix the login bug"');
  expect(m.content).toContain("created: 2026-06-06T"); // ISO from FIXED_MS (2026-06-06Z)
  expect(m.content).toContain('depends_on: ["081KSXN940008QG0R002FWR9B2", "081KS3X9Y0008QG0R000W00V73"]');
  expect(m.content).toContain("composes_with: []");
});

test("type=task default state is backlog (the open state)", () => {
  const m = mintWorkItem({ title: "x", type: "task" }, detEnv());
  expect(m.content).toContain("state: backlog");
});

test("later timestamp sorts after earlier (workitems/ ls = chronological)", () => {
  const earlier = mintWorkItem({ title: "a", type: "task" }, cryptoEnv(FIXED_MS));
  const later = mintWorkItem({ title: "b", type: "task" }, cryptoEnv(FIXED_MS + 1000));
  // filename sort == zetaid sort == time order, regardless of random low bits / slug
  expect(earlier.filename < later.filename).toBe(true);
});

test("conflict-free: same inputs + crypto env mint DIFFERENT ids (no collision)", () => {
  const env = cryptoEnv(FIXED_MS);
  const a = mintWorkItem({ title: "same title", type: "task" }, env);
  const b = mintWorkItem({ title: "same title", type: "task" }, env);
  expect(a.zetaid).not.toBe(b.zetaid); // randomness bits differ → distinct files
  expect(a.filename).not.toBe(b.filename);
});

test("validates inputs", () => {
  expect(() => mintWorkItem({ title: "", type: "task" }, detEnv())).toThrow();
  // @ts-expect-error — bad type
  expect(() => mintWorkItem({ title: "x", type: "story" }, detEnv())).toThrow();
});

test("slugify is filename-safe, lowercase, hyphenated, bounded", () => {
  expect(slugify("Hello, World!")).toBe("hello-world");
  expect(slugify("  Trim --- runs  ")).toBe("trim-runs");
  expect(slugify("")).toBe("untitled");
  expect(slugify("!!!")).toBe("untitled");
  expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  expect(/^[a-z0-9-]+$/.test(slugify("Ünïcödé and spaces 123"))).toBe(true);
});

test("publishCreatedEvent writes a WorkItemCreated G-Set file", () => {
  const workItemsDir = mkdtempSync(join(tmpdir(), "wi-smoke-"));
  const eventsRoot = workItemEventsRoot(workItemsDir);
  try {
    const env: WorkItemEnv = detEnv();
    const spec = { title: "Event slice", type: "task" as const };
    const minted = mintWorkItem(spec, env);
    const result = publishCreatedEvent(minted, spec, env, "test-agent", eventsRoot);
    expect(result.kind).toBe("created");
    expect(result.path.startsWith(eventsRoot)).toBe(true);
    const body = JSON.parse(readFileSync(result.path, "utf-8"));
    expect(body.kind).toBe("created");
    expect(body.by).toBe("test-agent");
    expect(body.payload.workItemId).toBe(minted.zetaid);
    expect(body.payload.type).toBe("task");
  } finally {
    rmSync(workItemsDir, { recursive: true, force: true });
  }
});

test("publishCreatedEvent is deterministic given the same WorkItemEnv", () => {
  const eventsRoot = mkdtempSync(join(tmpdir(), "wi-events-"));
  try {
    const env: WorkItemEnv = detEnv();
    const spec = { title: "Replay", type: "task" as const };
    const minted = mintWorkItem(spec, env);
    const a = publishCreatedEvent(minted, spec, env, "test-agent", eventsRoot);
    const b = publishCreatedEvent(minted, spec, env, "test-agent", eventsRoot);
    expect(a.path).toBe(b.path);
    expect(a.kind).toBe("created");
    expect(b.kind).toBe("exists-identical");
  } finally {
    rmSync(eventsRoot, { recursive: true, force: true });
  }
});
