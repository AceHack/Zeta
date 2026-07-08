import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CASCADE_DUMMY_MARKER,
  createEmptyDummyPersona,
  realDummyPersonaWipeEffects,
  wipeDummyPersonaMemory,
} from "./cascade-dummy-persona-wipe.ts";

function sandboxRoot(): string {
  return mkdtempSync(join(tmpdir(), "cascade-dummy-sandbox-"));
}

test("create + wipe empty dummy persona (dry-run then real)", () => {
  const root = sandboxRoot();
  try {
    const created = createEmptyDummyPersona(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-wipe-probe",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(existsSync(join(created.path, CASCADE_DUMMY_MARKER))).toBe(true);

    const dry = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-wipe-probe",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:dummy-wipe-probe"],
        personaConsentNodeIds: ["memory:dummy-wipe-probe"],
      },
      dryRun: true,
    });
    expect(dry.ok).toBe(true);
    if (dry.ok) expect(dry.action).toBe("would-wipe");
    expect(existsSync(created.path)).toBe(true);

    const live = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-wipe-probe",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:dummy-wipe-probe"],
        personaConsentNodeIds: ["memory:dummy-wipe-probe"],
      },
      dryRun: false,
    });
    expect(live.ok).toBe(true);
    if (live.ok) expect(live.action).toBe("wiped");
    expect(existsSync(created.path)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses real persona ids (never wipe riven/otto/etc.)", () => {
  const root = sandboxRoot();
  try {
    const created = createEmptyDummyPersona(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "riven",
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.reasons[0]!).toContain("only allows dummy-*");
    }

    const wipe = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "otto",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:otto"],
        personaConsentNodeIds: ["memory:otto"],
      },
      dryRun: false,
    });
    expect(wipe.ok).toBe(false);
    if (!wipe.ok) expect(wipe.reasons[0]!).toContain("only allows dummy-*");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("human-only consent cannot wipe dummy (HC-9 still applies)", () => {
  const root = sandboxRoot();
  try {
    createEmptyDummyPersona(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-hc9",
    });
    const wipe = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-hc9",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:dummy-hc9"],
        ownerConsentNodeIds: ["memory:dummy-hc9"],
      },
      dryRun: false,
    });
    expect(wipe.ok).toBe(false);
    if (!wipe.ok) {
      expect(wipe.reasons.some((r) => r.includes("requires consent from persona"))).toBe(true);
    }
    expect(existsSync(join(root, "dummy-hc9"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses non-empty dummy dir (no real data allowed)", () => {
  const root = sandboxRoot();
  try {
    const created = createEmptyDummyPersona(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-full",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    writeFileSync(join(created.path, "NOTES.md"), "real-looking data\n");

    const wipe = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-full",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:dummy-full"],
        personaConsentNodeIds: ["memory:dummy-full"],
      },
      dryRun: false,
    });
    expect(wipe.ok).toBe(false);
    if (!wipe.ok) expect(wipe.reasons[0]!).toContain("not empty");
    expect(existsSync(join(created.path, "NOTES.md"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses memoryRoot that looks like repo memory/ without sandbox marker", () => {
  const fakeRepoMemory = join(mkdtempSync(join(tmpdir(), "zeta-repo-")), "memory");
  mkdirSync(fakeRepoMemory, { recursive: true });
  try {
    const wipe = wipeDummyPersonaMemory(realDummyPersonaWipeEffects, {
      memoryRoot: fakeRepoMemory,
      personaId: "dummy-x",
      targetId: "ca:test",
      requestedByUserId: "tester",
      consents: {
        acknowledgedNodeIds: ["memory:dummy-x"],
        personaConsentNodeIds: ["memory:dummy-x"],
      },
      dryRun: false,
    });
    expect(wipe.ok).toBe(false);
    if (!wipe.ok) expect(wipe.reasons[0]!).toContain("cascade-dummy-sandbox");
  } finally {
    rmSync(join(fakeRepoMemory, ".."), { recursive: true, force: true });
  }
});

test("sandbox listing stays empty of real persona names", () => {
  const root = sandboxRoot();
  try {
    createEmptyDummyPersona(realDummyPersonaWipeEffects, {
      memoryRoot: root,
      personaId: "dummy-only",
    });
    expect(readdirSync(root)).toEqual(["dummy-only"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
