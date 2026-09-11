import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { attributionOf, canonicalize, groupByModel, NO_MODEL, type IdentityRoster } from "./agent-identity.ts";

const roster = JSON.parse(readFileSync("registry/agent-identity-roster.json", "utf8")) as IdentityRoster;

describe("the measured historical fragmentation collapses", () => {
  test("all four spellings of the same model reach ONE canonical name", () => {
    // 1538 commits, one model, four labels. If this regresses, every grouping splits again.
    const seen = ["claude-opus-5", "Claude Opus 5", "claude-opus-5[1m]", "Claude"]
      .map((r) => canonicalize(r, roster.models));
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe("claude-opus-5");
  });

  test("all four spellings of the same harness reach ONE canonical name", () => {
    const seen = ["claude-code", "Claude Code", "claude-code/cli", "Claude Code (remote container)"]
      .map((r) => canonicalize(r, roster.harnesses));
    expect(new Set(seen).size).toBe(1);
  });

  test("the toolchain string is NOT a model — it normalises to the absence value", () => {
    // 1324 commits wrote a toolchain into the model field. Left alone it is a phantom
    // sixth model family in every correlation.
    expect(canonicalize("bun + git + gh CLI", roster.models)).toBe(NO_MODEL);
  });
});

describe("an unknown value is VISIBLE, never silently passed through", () => {
  test("an unrecognised model is null, not the raw string", () => {
    // Falling back to the raw string is how the fragmentation happened: every new spelling
    // silently became its own category.
    expect(canonicalize("some-model-nobody-registered", roster.models)).toBeNull();
  });
  test("empty is null", () => {
    expect(canonicalize("   ", roster.models)).toBeNull();
  });
  test("grouping reports unknowns under null rather than dropping the rows", () => {
    const rows = [
      attributionOf("Claude Opus 5", "Claude Code", roster),
      attributionOf("mystery-model", "Cursor", roster),
    ];
    const g = groupByModel(rows);
    expect(g.get("claude-opus-5")).toBe(1);
    expect(g.get(null)).toBe(1);
  });
});

describe("the roster is a set of IDENTITIES, never agendas", () => {
  test("no entry carries an agenda field", () => {
    // Aaron 2026-09-10: "in our system only self claimed agendas are implied." An agenda
    // written here would be an OBSERVER's inference stored as if authoritative — the exact
    // move `engagement-profiles` forbids. Identity is checkable; purpose is asked about.
    const raw = readFileSync("registry/agent-identity-roster.json", "utf8");
    const parsed = JSON.parse(raw) as { models: Record<string, unknown>[]; harnesses: Record<string, unknown>[] };
    for (const e of [...parsed.models, ...parsed.harnesses]) {
      expect(Object.keys(e)).not.toContain("agenda");
      expect(Object.keys(e)).not.toContain("intent");
    }
  });

  test("every entry carries a vendor, so the rho vendor layer is groupable", () => {
    for (const e of [...roster.models, ...roster.harnesses]) {
      expect((e as unknown as { vendor?: string }).vendor ?? "").not.toBe("");
    }
  });
});

describe("normalisation is READ-side — the raw assertion survives", () => {
  test("attributionOf keeps the raw strings alongside the canonical ones", () => {
    // The Z-set property, testable: a correction is +1 then -1, never a delete. If the raw
    // value were dropped here, this module would be normalising on WRITE in disguise and the
    // repo would lose the ability to ask what an author actually asserted.
    const row = attributionOf("bun + git + gh CLI", "GitHub Actions", roster);
    expect(row.model).toBe(NO_MODEL);
    expect(row.rawModel).toBe("bun + git + gh CLI");
    expect(row.harness).toBe("github-actions");
    expect(row.rawHarness).toBe("GitHub Actions");
  });

  test("a re-reading of the past needs only an alias edit, never a history rewrite", () => {
    // The payoff of read-side normalisation: move an alias, and every past grouping re-reads
    // correctly. A write-side scheme could not — the distinguishing bytes would be gone.
    const before = canonicalize("Claude", roster.models);
    const rerostered = {
      ...roster,
      models: roster.models.map((m) =>
        m.canonical === "claude-opus-5" ? { ...m, aliases: m.aliases.filter((a) => a !== "Claude") } : m,
      ),
    };
    expect(before).toBe("claude-opus-5");
    expect(canonicalize("Claude", rerostered.models)).toBeNull();
  });
});
