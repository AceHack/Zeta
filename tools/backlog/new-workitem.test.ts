import { test, expect } from "bun:test";
import { mintWorkItem, slugify } from "./new-workitem";
import { parse, isCanonical, ZETAID_BASE32_LEN } from "../../src/Core.TypeScript/zeta-id/encoding";
import { DETERMINISTIC_ENV, DEFAULT_ENV } from "../../src/Core.TypeScript/zeta-id/zeta-id";

const FIXED_MS = Date.UTC(2026, 5, 6); // 2026-06-06T00:00:00Z — fixed for deterministic ids

test("mints a canonical ZetaId and <zetaid>-<slug>.md filename", () => {
  const m = mintWorkItem({
    title: "Migrate backlog to ZetaId",
    type: "task",
    nowMs: FIXED_MS,
    env: DETERMINISTIC_ENV,
  });
  expect(m.zetaid).toHaveLength(ZETAID_BASE32_LEN);
  expect(isCanonical(m.zetaid)).toBe(true);
  expect(() => parse(m.zetaid)).not.toThrow();
  expect(m.filename).toBe(`${m.zetaid}-migrate-backlog-to-zetaid.md`);
});

test("frontmatter carries id/type/state/priority/slug/title/created/cross-refs", () => {
  const m = mintWorkItem({
    title: "Fix the login bug",
    type: "bug",
    priority: "P1",
    dependsOn: ["B-0956", "B-0682"],
    nowMs: FIXED_MS,
    env: DETERMINISTIC_ENV,
  });
  expect(m.content).toContain(`id: ${m.zetaid}`);
  expect(m.content).toContain("type: bug");
  expect(m.content).toContain("state: backlog");
  expect(m.content).toContain("priority: P1");
  expect(m.content).toContain("slug: fix-the-login-bug");
  expect(m.content).toContain('title: "Fix the login bug"');
  expect(m.content).toContain("created: 2026-06-06T"); // ISO from FIXED_MS (2026-06-06Z)
  expect(m.content).toContain('depends_on: ["B-0956", "B-0682"]');
  expect(m.content).toContain("composes_with: []");
});

test("type=task default state is backlog (the open state)", () => {
  const m = mintWorkItem({ title: "x", type: "task", nowMs: FIXED_MS, env: DETERMINISTIC_ENV });
  expect(m.content).toContain("state: backlog");
});

test("later timestamp sorts after earlier (workitems/ ls = chronological)", () => {
  const earlier = mintWorkItem({ title: "a", type: "task", nowMs: FIXED_MS, env: DEFAULT_ENV });
  const later = mintWorkItem({ title: "b", type: "task", nowMs: FIXED_MS + 1000, env: DEFAULT_ENV });
  // filename sort == zetaid sort == time order, regardless of random low bits / slug
  expect(earlier.filename < later.filename).toBe(true);
});

test("conflict-free: same inputs + crypto env mint DIFFERENT ids (no collision)", () => {
  const a = mintWorkItem({ title: "same title", type: "task", nowMs: FIXED_MS, env: DEFAULT_ENV });
  const b = mintWorkItem({ title: "same title", type: "task", nowMs: FIXED_MS, env: DEFAULT_ENV });
  expect(a.zetaid).not.toBe(b.zetaid); // randomness bits differ → distinct files
  expect(a.filename).not.toBe(b.filename);
});

test("validates inputs", () => {
  expect(() => mintWorkItem({ title: "", type: "task", env: DETERMINISTIC_ENV })).toThrow();
  // @ts-expect-error — bad type
  expect(() => mintWorkItem({ title: "x", type: "story", env: DETERMINISTIC_ENV })).toThrow();
});

test("slugify is filename-safe, lowercase, hyphenated, bounded", () => {
  expect(slugify("Hello, World!")).toBe("hello-world");
  expect(slugify("  Trim --- runs  ")).toBe("trim-runs");
  expect(slugify("")).toBe("untitled");
  expect(slugify("!!!")).toBe("untitled");
  expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  expect(/^[a-z0-9-]+$/.test(slugify("Ünïcödé and spaces 123"))).toBe(true);
});
