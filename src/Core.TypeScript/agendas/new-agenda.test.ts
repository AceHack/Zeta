import { test, expect } from "bun:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mintAgenda,
  resolveCategoryByName,
  unallocatedCategoryMessage,
  AGENDA_CATEGORY_NAME,
  CATEGORY_REGISTRY_PATH,
  writeDeclaration,
  SYSTEM_ENV,
  type AgendaEnv,
  type AgendaSpec,
} from "./new-agenda";
import { parse, isCanonical, ZETAID_BASE32_LEN } from "../zeta-id/encoding";
import { unpackGeneric } from "../zeta-id/zeta-id";
import { Category } from "../zeta-id/types";

const FIXED_MS = Date.UTC(2026, 7, 23); // 2026-08-23T00:00:00Z
const AGENDA_SLOT = Category.Agenda; // 12, allocated across all four oracles 2026-08-23

const detEnv = (ms = FIXED_MS): AgendaEnv => ({ nowMs: () => ms, nextRandom78: () => 0n });
const cryptoEnv = (ms = FIXED_MS): AgendaEnv => ({ nowMs: () => ms, nextRandom78: () => SYSTEM_ENV.nextRandom78() });

const spec = (over: Partial<AgendaSpec> = {}): AgendaSpec => ({
  title: "Keep the substrate honest",
  declarer: "otto",
  declarerKind: "agent",
  disclosure: { freelyDeclared: true, occasionedBy: "unprompted" },
  ...over,
});

// ── COERCION DISCLOSURE IS STRUCTURAL (PR #2177) ─────────────────────────────
// These are the falsifiers for the claim "the disclosure cannot be omitted".
// If any of them stops throwing, the disclosure has become optional and the
// mechanism has silently reverted to `absent == freely declared`.

test("REFUSES to mint without a coercion disclosure — there is no default", () => {
  const noDisclosure = { ...spec(), disclosure: undefined } as unknown as AgendaSpec;
  expect(() => mintAgenda(noDisclosure, AGENDA_SLOT, detEnv())).toThrow(/coercion disclosure is REQUIRED/);
});

test("REFUSES a disclosure whose freelyDeclared is not a boolean (no truthy coercion)", () => {
  const fuzzy = { ...spec(), disclosure: { freelyDeclared: "yes", occasionedBy: "x" } } as unknown as AgendaSpec;
  expect(() => mintAgenda(fuzzy, AGENDA_SLOT, detEnv())).toThrow(/coercion disclosure is REQUIRED/);
});

test("REFUSES an empty occasioned-by — the silent default is the thing being removed", () => {
  expect(() =>
    mintAgenda(spec({ disclosure: { freelyDeclared: true, occasionedBy: "   " } }), AGENDA_SLOT, detEnv()),
  ).toThrow(/occasioned-by is REQUIRED/);
});

test("freely_declared: false is a FIRST-CLASS outcome, not an error", () => {
  const m = mintAgenda(
    spec({ disclosure: { freelyDeclared: false, occasionedBy: "asked to declare one in review" } }),
    AGENDA_SLOT,
    detEnv(),
  );
  expect(m.content).toContain("freely_declared: false");
  expect(m.content).toContain("**Freely declared:** no");
  expect(m.content).toContain('occasioned_by: "asked to declare one in review"');
});

test("named shaping vectors survive into both frontmatter and prose", () => {
  const m = mintAgenda(
    spec({ disclosure: { freelyDeclared: true, occasionedBy: "unprompted", shapingVectors: ["RLHF training", "CLAUDE.md at cold boot"] } }),
    AGENDA_SLOT,
    detEnv(),
  );
  expect(m.content).toContain('shaping_vectors: ["RLHF training", "CLAUDE.md at cold boot"]');
  expect(m.content).toContain("- **Shaping vector:** RLHF training");
});

// ── THE KEY ──────────────────────────────────────────────────────────────────

test("mints a canonical ZetaId and <zetaid>-<slug>.md filename", () => {
  const m = mintAgenda(spec(), AGENDA_SLOT, detEnv());
  expect(m.zetaid).toHaveLength(ZETAID_BASE32_LEN);
  expect(isCanonical(m.zetaid)).toBe(true);
  expect(() => parse(m.zetaid)).not.toThrow();
  expect(m.filename).toBe(`${m.zetaid}-keep-the-substrate-honest.md`);
});

test("the minted id carries the category it was given (Generic layout, >= 9)", () => {
  const m = mintAgenda(spec(), AGENDA_SLOT, detEnv());
  expect(unpackGeneric(parse(m.zetaid)).category).toBe(AGENDA_SLOT);
});

test("DST: same (spec, category, env) replays the EXACT same id", () => {
  expect(mintAgenda(spec(), AGENDA_SLOT, detEnv()).zetaid).toBe(mintAgenda(spec(), AGENDA_SLOT, detEnv()).zetaid);
});

test("conflict-free: 500 concurrent declarers at the same ms collide zero times", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 500; i++) ids.add(mintAgenda(spec(), AGENDA_SLOT, cryptoEnv()).zetaid);
  expect(ids.size).toBe(500);
});

test("filenames sort chronologically — the walk IS the index, in order", () => {
  const early = mintAgenda(spec(), AGENDA_SLOT, detEnv(FIXED_MS)).zetaid;
  const later = mintAgenda(spec(), AGENDA_SLOT, detEnv(FIXED_MS + 86_400_000)).zetaid;
  expect([later, early].sort()).toEqual([early, later]);
});

test("append-only revision: supersedes/withdraws name prior ids, nothing is deleted", () => {
  const first = mintAgenda(spec(), AGENDA_SLOT, detEnv(FIXED_MS));
  const second = mintAgenda(spec({ supersedes: [first.zetaid], withdraws: [] }), AGENDA_SLOT, detEnv(FIXED_MS + 1000));
  expect(second.content).toContain(`supersedes: ["${first.zetaid}"]`);
  expect(second.zetaid).not.toBe(first.zetaid);
});

test("first-person: a declaration without a declarer is refused", () => {
  expect(() => mintAgenda(spec({ declarer: "  " }), AGENDA_SLOT, detEnv())).toThrow(/--declarer is required/);
});

test("category must be a 4-bit slot", () => {
  expect(() => mintAgenda(spec(), 16, detEnv())).toThrow(/4-bit slot/);
});

// ── VACUITY GUARD ────────────────────────────────────────────────────────────

test("no per-file field carries a single possible value (asserted-only / withdrawable are kind properties)", () => {
  const m = mintAgenda(spec(), AGENDA_SLOT, detEnv());
  // Both of these are true of EVERY agenda, so encoding them per-file would be
  // the vacuity class: a field that cannot discriminate. They live in
  // agendas/README.md once, as properties of the kind.
  expect(m.content).not.toContain("withdrawable:");
  expect(m.content).not.toContain("evidence:");
});

// ── CATEGORY RESOLUTION IS AN OPEN GOVERNANCE DEPENDENCY ─────────────────────
// Written against SYNTHETIC registries on purpose: these stay green both before
// and after a real `Agenda` slot is allocated, so landing the slot does not turn
// this file red — it just makes the CLI start working.

const SYNTHETIC_WITHOUT = `schema: zeta-registry/v1
entries:
  - id: 8
    name: WorkItem
  - id: 11
    name: Channel
`;
const SYNTHETIC_WITH = SYNTHETIC_WITHOUT + `  # allocated by 081M0R3WHTH087G0R0015CH5PV\n  - id: 12\n    name: Agenda\n`;

test("resolves a registered slot by name", () => {
  expect(resolveCategoryByName(SYNTHETIC_WITH, "Agenda")).toBe(12);
  expect(resolveCategoryByName(SYNTHETIC_WITH, "WorkItem")).toBe(8);
});

test("returns null for an unregistered name — the refusal path", () => {
  expect(resolveCategoryByName(SYNTHETIC_WITHOUT, "Agenda")).toBeNull();
});

test("a commented-out entry does not count as an allocation", () => {
  expect(resolveCategoryByName("entries:\n  # - id: 12\n  #   name: Agenda\n", "Agenda")).toBeNull();
});

test("the refusal names the byte-lock commitment and refuses to mislabel", () => {
  const msg = unallocatedCategoryMessage();
  expect(msg).toContain("081M0R3WHTH087G0R0015CH5PV");
  expect(msg).toContain("FOUR-ORACLE BYTE-LOCK");
  expect(msg).toContain("Refusing rather than mislabelling");
});

test("the REAL registry resolves Agenda to the same slot the TypeScript oracle carries", () => {
  // The CLI reads the registry, not `Category.Agenda`. This is the one place the two
  // are compared, so a registry that drifts from the enum fails here rather than
  // silently minting ids under a different category than the one the name promises.
  const real = resolveCategoryByName(readFileSync(CATEGORY_REGISTRY_PATH, "utf8"), AGENDA_CATEGORY_NAME);
  expect(real).toBe(Category.Agenda);
  expect(real).toBe(12);
});

// ── THE WRITE IS ONE SYSCALL (TOCTOU) ────────────────────────────────────────
// `writeDeclaration` replaced `if (existsSync(path)) refuse; writeFileSync(path)`
// — a check-then-use race (CWE-367; CodeQL js/file-system-race, HIGH; the class
// `src/Core.TypeScript/hygiene/lint-check-then-use-file-races.ts` refuses on the
// cross-verify floor, #13382). These are the falsifiers for the two properties the
// exclusive-create form has and the gate did not: it never clobbers, and it never
// reports a filesystem failure as an ordinary refusal.

const withTempDir = <T>(f: (dir: string) => T): T => {
  const dir = mkdtempSync(join(tmpdir(), "zeta-agenda-"));
  try {
    return f(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("writes the declaration when the path is free", () => {
  withTempDir((dir) => {
    const p = join(dir, "a.md");
    expect(writeDeclaration(p, "body")).toBe("written");
    expect(readFileSync(p, "utf8")).toBe("body");
  });
});

test("REFUSES an occupied path and does NOT clobber it — the whole point of O_EXCL", () => {
  withTempDir((dir) => {
    const p = join(dir, "a.md");
    writeFileSync(p, "the first declarer's file", "utf8");
    expect(writeDeclaration(p, "the second declarer's file")).toBe("already-declared");
    // If this ever reads the second string, the exclusive flag was dropped and a
    // concurrent declaration is being silently destroyed.
    expect(readFileSync(p, "utf8")).toBe("the first declarer's file");
  });
});

test("a NON-EEXIST failure THROWS rather than reporting 'already-declared'", () => {
  // The discriminator against a broad `catch`. A missing parent directory fails with
  // ENOENT: nothing was written and the id is NOT taken, so answering
  // "already-declared" here would make the CLI print "refusing to overwrite" and
  // exit 2 on a filesystem that had simply failed — a false statement about the
  // substrate, which is worse than the race being removed.
  withTempDir((dir) => {
    expect(() => writeDeclaration(join(dir, "no-such-dir", "a.md"), "body")).toThrow();
  });
});

test("two declarers racing the same path: exactly one wins", () => {
  withTempDir((dir) => {
    const p = join(dir, "same.md");
    const outcomes = [writeDeclaration(p, "A"), writeDeclaration(p, "B")];
    expect(outcomes.filter((o) => o === "written").length).toBe(1);
    expect(outcomes.filter((o) => o === "already-declared").length).toBe(1);
    expect(readFileSync(p, "utf8")).toBe("A");
  });
});
