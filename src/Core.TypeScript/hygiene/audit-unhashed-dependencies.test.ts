import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMechanismManifest } from "../ace/setup-manifest.ts";
import { resolvePin } from "../ace/setup-realizers/unhashed-pin.ts";
import { diffInventory, entryKey } from "./audit-unhashed-dependencies.ts";
import {
  MECHANISMS,
  deriveInventory,
  renderInventory,
  unknownManifests,
  type Inventory,
  type InventoryEntry,
} from "./unhashed-inventory.ts";

const ROOT = resolve(import.meta.dir, "../../..");

function entry(over: Partial<InventoryEntry>): InventoryEntry {
  return {
    mechanism: "from-installer",
    subject: "grok",
    source: "tools/setup/manifests/from-installer:27",
    coverage: "unpinned",
    reason: "vendor-publishes-no-versioned-artifact",
    count: 1,
    blocker: "",
    ...over,
  };
}

function inventoryOf(entries: readonly InventoryEntry[]): Inventory {
  return {
    declared: entries.filter((e) => e.coverage === "tag-only" || e.coverage === "unpinned"),
    undeclared: entries.filter((e) => e.coverage === "undeclared"),
    digestCovered: entries.filter((e) => e.coverage === "digest"),
  };
}

describe("the audit fails BOTH ways — the roster shrinks but never grows", () => {
  test("clean: the committed page and the derivation agree", () => {
    const inv = inventoryOf([entry({})]);
    const d = diffInventory(renderInventory(inv), inv);
    expect(d.entered).toEqual([]);
    expect(d.stale).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  // DIRECTION 1. Reproduced live 2026-09-10 by appending an undeclared vendor row to
  // tools/setup/manifests/from-installer: rc=1, "ENTERED WITHOUT LANDING IN THE INVENTORY".
  test("DIRECTION 1: an unhashed dependency that is not on the committed page fails", () => {
    const committed = renderInventory(inventoryOf([entry({})]));
    const derived = inventoryOf([entry({}), entry({ subject: "newtool", source: "tools/setup/manifests/from-installer:33" })]);
    const d = diffInventory(committed, derived);
    expect(d.entered.map((e) => e.subject)).toEqual(["newtool"]);
    expect(d.stale).toEqual([]);
  });

  // DIRECTION 2. Reproduced live 2026-09-10 by replacing `forge`'s sha256=unpinned with a
  // 64-hex digest: rc=1, "NO LONGER UNHASHED, STILL ON THE ROSTER".
  test("DIRECTION 2: an entry the tree no longer produces fails, so the roster must shrink", () => {
    const committed = renderInventory(inventoryOf([entry({}), entry({ subject: "forge" })]));
    const derived = inventoryOf([entry({})]);
    const d = diffInventory(committed, derived);
    expect(d.entered).toEqual([]);
    expect(d.stale.some((k) => k.includes("forge"))).toBe(true);
  });

  test("a declared reason that drifted from the row is reported", () => {
    const committed = renderInventory(inventoryOf([entry({})]));
    const derived = inventoryOf([entry({ reason: "a-completely-different-stated-cause" })]);
    expect(diffInventory(committed, derived).changed.length).toBe(1);
  });

  // Without this the digest-covered table — ~1900 entries — parses as roster rows that the
  // derivation never produces, and EVERY run reports them all as stale. A check that fails
  // always is as useless as one that cannot fail. Caught exactly this way on first run.
  test("the digest-covered denominator table is not compared as roster", () => {
    const inv = inventoryOf([entry({}), entry({ mechanism: "docker", subject: "ubuntu@sha256:aa", coverage: "digest", reason: "" })]);
    const d = diffInventory(renderInventory(inv), inv);
    expect(d.stale).toEqual([]);
  });

  test("entryKey is stable across the two table shapes", () => {
    const e = entry({});
    expect(entryKey(e)).toBe(JSON.stringify([e.mechanism, e.source, e.subject]));
    expect(entryKey(e)).not.toBe(entryKey(entry({ subject: "forge" })));
  });
});

describe("the mechanism table is the reviewed artifact", () => {
  // DIRECTION 3. Reproduced live by creating tools/setup/manifests/from-newthing: rc=1.
  test("every manifest on disk is described", () => {
    expect(unknownManifests(ROOT)).toEqual([]);
  });

  test("a mechanism with no digest slot must name the specific obstacle", () => {
    for (const m of MECHANISMS) {
      if (m.hasDigestSlot || m.acquiresNothing !== undefined || m.commitPinned === true) continue;
      expect(m.blocker ?? "").not.toBe("");
      // "not yet declarable" is only honest if the obstacle is nameable. A one-word blocker is
      // an excuse; the point of the column is that the removal work can be scoped from it.
      expect((m.blocker ?? "").length).toBeGreaterThan(40);
    }
  });
});

describe("the real tree", () => {
  test("the derivation sees dependencies of every coverage class", () => {
    const inv = deriveInventory(ROOT);
    expect(inv.declared.length).toBeGreaterThan(0);
    expect(inv.undeclared.length).toBeGreaterThan(0);
    expect(inv.digestCovered.length).toBeGreaterThan(0);
  });

  // THE FALSIFIER THAT MATTERS MOST, and the one whose absence let a sibling implementation
  // ship a gate that refused every production row while its unit tests passed: that gate read
  // the URL out of `attrs`, where a manifest URL never is. Unit tests supplied `url` as an attr
  // and went green; the real rows would have thrown. So this test runs resolvePin over the
  // COMMITTED manifest text, exactly as the realizer does.
  test("every row of every wired manifest resolves, as the realizer calls it", () => {
    for (const manifest of ["from-url", "from-elan", "from-autotools-tarball", "from-installer", "from-deb"]) {
      const path = resolve(ROOT, "tools/setup/manifests", manifest);
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      for (const row of parseMechanismManifest(text)) {
        const subject = row.tokens[0];
        const url = row.tokens[1];
        if (subject === undefined || url === undefined) continue;
        expect(() => resolvePin(manifest, subject, url, row.attrs)).not.toThrow();
      }
    }
  });

  // THE PRE-FIX STATE. Until 2026-09-10 tools/setup/manifests/from-installer had no pin column
  // at all: `grok  https://x.ai/cli/install.sh` was the whole row, and the realizer fetched and
  // EXECUTED it with HTTPS as the only trust anchor. That row is refused now.
  test("the pre-fix from-installer row — no pin of any kind — is refused", () => {
    const preFix = "grok          https://x.ai/cli/install.sh\n";
    const row = parseMechanismManifest(preFix)[0]!;
    expect(() => resolvePin("from-installer", row.tokens[0]!, row.tokens[1]!, row.attrs)).toThrow(
      /sha256= pin required/u,
    );
  });

  test("the pre-fix from-elan refusal is preserved for a row that declares nothing", () => {
    const row = parseMechanismManifest("elan  https://example.test/elan-init.sh\n")[0]!;
    expect(() => resolvePin("from-elan", row.tokens[0]!, row.tokens[1]!, row.attrs)).toThrow(/sha256= pin required/u);
  });

  test("rendering is deterministic — the same tree renders byte-identically twice", () => {
    expect(renderInventory(deriveInventory(ROOT))).toBe(renderInventory(deriveInventory(ROOT)));
  });
});
