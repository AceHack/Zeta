// reconcile-surfaces.test.ts — unit + MUTATION tests for the hardware-inventory
// cross-surface reconciliation drift check (081M00R59KS087G0R001W3837V).
//
// A drift check that cannot go red is not a check (toy-is-free-metered-must-be-earned:
// a test that survives mutation is not a falsifier). So every HWR-* invariant below
// is exercised by INTRODUCING the divergence into a fixture repo and asserting the
// check reports it — and the real repo is asserted clean-modulo-ledger so a genuinely
// new divergence on main shows up here too.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collect,
  countSnapshot,
  loadOpen,
  parseProbeNode,
  parseSurfaceHeader,
  reconcile,
  snapshotDigest,
  triage,
  type CheckId,
  type Finding,
} from "./reconcile-surfaces";
import { ITEMS_JSON_REL, renderItemsJson } from "./generate-items-json";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: a miniature repo carrying one of each provenance class, all reconciled.
// Mutators below take the fixture and break exactly one thing.
// ─────────────────────────────────────────────────────────────────────────────

interface Fixture {
  root: string;
  cleanup: () => void;
}

/** Parser exercise only — never written to the fixture. Carries the awkward cases:
 *  a `× N` suffix, a bare line, an inline `4×` inside notes, and a Provenance
 *  section that must not be counted. */
const SNAPSHOT_BODY = `<!-- hardware-surface: class=snapshot; units=5; lines=3 -->

# Audit

## GPUs

- Widget GPU × 3
- Doodad GPU

## Boxes

- Box (with 4× 20TB drives)

## Provenance

- not an asset line
`;

/** The fixture's on-disk snapshot: ONE audited unit, matched by one real register
 *  row, so a fully-reconciled fixture reports nothing at all — including HWR-5.
 *  No Provenance section, because the HWR-4 mutant appends to this file and an
 *  appended line has to land in an asset section to be counted. */
const FIXTURE_SNAPSHOT_BODY = `

# Audit

## GPUs

- Doodad GPU
`;

/** Header + body, with the digest computed rather than hardcoded — the digest of a
 *  literal in a test file is the kind of constant that goes stale silently. */
const FIXTURE_SNAPSHOT = `<!-- hardware-surface: class=snapshot; units=1; lines=1; body-sha256=${snapshotDigest(
  FIXTURE_SNAPSHOT_BODY,
)} -->${FIXTURE_SNAPSHOT_BODY}`;

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "hwrecon-"));
  const w = (rel: string, body: string): void => {
    const full = join(root, rel);
    mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
    writeFileSync(full, body, "utf8");
  };

  w(
    "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
    `---
id: 0EFJ9RW179ZFT9WBMXZZNYM92A
name: Thing
qty: 1
status: active
assigned_machine: host-a.local
---
`,
  );
  w("machines/host-a.local.pub", "ssh-ed25519 AAAA fixture\n");
  w("docs/inventory/hardware-2026-01-01-draft.md", FIXTURE_SNAPSHOT);
  w("docs/inventory/fleet-fixture.md", "<!-- hardware-surface: class=declaration; probe-nodes=1 -->\n\n# Fleet\n");
  w("docs/HARDWARE-CAPABILITY-MATRIX.md", "<!-- hardware-surface: class=capability -->\n\n# Matrix\n");
  w(
    "maintainers/alice/cluster-nodes/node-1/node.yaml",
    `spec:
  hostname: node-1
  hardware:
    network:
      mac: "aa:bb:cc:dd:ee:01"
`,
  );
  w("inventory/reconciliation-open.json", JSON.stringify({ open: [] }) + "\n");

  // The DERIVED surface, written by the same derivation the check compares against.
  // Deliberately not a hand-written literal: a fixture that hardcoded the expected
  // JSON would pass by agreeing with a copy rather than with the generator — the
  // failure mode under test, wearing a test's clothes.
  w(ITEMS_JSON_REL, renderItemsJson(root).json);

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Run the check over a fixture and return the finding ids it reports. */
function checksFired(root: string): CheckId[] {
  return [...new Set(reconcile(collect(root)).map((f) => f.check))].sort();
}

function findingsFor(root: string, id: CheckId): Finding[] {
  return reconcile(collect(root)).filter((f) => f.check === id);
}

function write(root: string, rel: string, body: string): void {
  const full = join(root, rel);
  mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
  writeFileSync(full, body, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure parsers
// ─────────────────────────────────────────────────────────────────────────────

describe("parsers", () => {
  test("countSnapshot counts a `× N` SUFFIX as N and an inline `4×` as one unit", () => {
    // The pinned lesson: `Box (with 4× 20TB drives)` is ONE box whose notes mention
    // drives. An unanchored /×\s*(\d+)/ reads it as 20 and inflates the audit — that
    // exact slip is the 206-vs-225 discrepancy found while measuring the real snapshot.
    expect(countSnapshot(SNAPSHOT_BODY)).toEqual({ lines: 3, units: 5 });
  });

  test("countSnapshot excludes the Provenance section", () => {
    expect(countSnapshot("## Provenance\n\n- source: someone\n")).toEqual({ lines: 0, units: 0 });
  });

  test("parseSurfaceHeader reads the semicolon-separated key=value form", () => {
    const h = parseSurfaceHeader("<!-- hardware-surface: class=snapshot; units=206; lines=188 -->");
    expect(h?.get("class")).toBe("snapshot");
    expect(h?.get("units")).toBe("206");
  });

  test("parseSurfaceHeader returns undefined when the doc declares nothing", () => {
    expect(parseSurfaceHeader("# just a doc\n")).toBeUndefined();
  });

  test("parseProbeNode reads hostname + mac and does not run past the line", () => {
    // Regression: `\s*$` with the /m flag spans the newline, so an EMPTY field
    // silently absorbs the next line's value. Caught live on the first run of this
    // check — an empty `assigned_machine:` parsed as the following `sample: true`
    // and produced a phantom HWR-1. Any /^key:\s*(.*)$/m in this file is that bug.
    const n = parseProbeNode(
      "f",
      'spec:\n  hostname: node-9\n  hardware:\n    network:\n      mac: ""\n      ip: "10.0.0.1"\n',
    );
    expect(n.hostname).toBe("node-9");
    expect(n.mac).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The fixture reconciles
// ─────────────────────────────────────────────────────────────────────────────

describe("a fully-declared fixture reconciles clean", () => {
  test("no findings", () => {
    const f = makeFixture();
    try {
      expect(checksFired(f.root)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTANTS — one per invariant. Each must turn the check red.
// ─────────────────────────────────────────────────────────────────────────────

describe("mutants", () => {
  test("HWR-1: a register row assigned to a machine no surface knows", () => {
    const f = makeFixture();
    try {
      write(
        f.root,
        "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
        "---\nid: 0EFJ9RW179ZFT9WBMXZZNYM92A\nname: Thing\nassigned_machine: ghost-box.local\nsample: true\n---\n",
      );
      const hits = findingsFor(f.root, "HWR-1");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("ghost-box.local");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-1 accepts a machine known only from the probe surface", () => {
    // Two machine-identity surfaces exist (machines/ host keys, and self-registered
    // hostnames). Resolving against only one would make the check a liar.
    const f = makeFixture();
    try {
      write(
        f.root,
        "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
        "---\nid: 0EFJ9RW179ZFT9WBMXZZNYM92A\nname: Thing\nassigned_machine: node-1\nsample: true\n---\n",
      );
      expect(findingsFor(f.root, "HWR-1")).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  test("HWR-2: two node registrations reporting one MAC", () => {
    const f = makeFixture();
    try {
      write(
        f.root,
        "maintainers/alice/cluster-nodes/node-2/node.yaml",
        'spec:\n  hostname: node-2\n  hardware:\n    network:\n      mac: "aa:bb:cc:dd:ee:01"\n',
      );
      write(
        f.root,
        "docs/inventory/fleet-fixture.md",
        "<!-- hardware-surface: class=declaration; probe-nodes=2 -->\n\n# Fleet\n",
      );
      const hits = findingsFor(f.root, "HWR-2");
      expect(hits.length).toBe(1);
      expect(hits[0]!.key).toBe("aa:bb:cc:dd:ee:01");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-3: a fourth hardware list appears with no provenance class", () => {
    // This is the anti-re-fork guard: the way we got here is that someone added a
    // list and nothing asked what it was.
    const f = makeFixture();
    try {
      write(f.root, "docs/inventory/hardware-yet-another-list.md", "# More hardware\n\n- Thing\n");
      const hits = findingsFor(f.root, "HWR-3");
      expect(hits.length).toBe(1);
      expect(hits[0]!.key).toBe("docs/inventory/hardware-yet-another-list.md");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-4: the snapshot body changes and its declared counts do not", () => {
    const f = makeFixture();
    try {
      write(f.root, "docs/inventory/hardware-2026-01-01-draft.md", FIXTURE_SNAPSHOT + "- Sneaky extra GPU × 7\n");
      const hits = findingsFor(f.root, "HWR-4");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("units=8"); // header still says 1
    } finally {
      f.cleanup();
    }
  });

  test("HWR-4: a body edit the COUNTS cannot see is caught by the digest", () => {
    // Found by mutating the real snapshot, not by design: `## Provenance` is that
    // file's last section, so a bullet appended at end-of-file lands inside the
    // excluded section and moves neither count. Counts alone are a check with a
    // blind spot; the byte-pin removes it.
    const f = makeFixture();
    try {
      write(
        f.root,
        "docs/inventory/hardware-2026-01-01-draft.md",
        FIXTURE_SNAPSHOT.replace("# Audit", "# Audit (quietly re-titled)"),
      );
      const hits = findingsFor(f.root, "HWR-4");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("body changed without a count change");
    } finally {
      f.cleanup();
    }
  });

  test("snapshotDigest ignores the header it lives in", () => {
    // Otherwise re-pinning would never converge: writing the digest into the header
    // would change the digest.
    const body = "\n\n# A\n\n## GPUs\n\n- One\n";
    expect(snapshotDigest(`<!-- hardware-surface: class=snapshot; units=1 -->${body}`)).toBe(
      snapshotDigest(`<!-- hardware-surface: class=snapshot; units=1; body-sha256=deadbeef -->${body}`),
    );
  });

  test("HWR-5: a placeholder row is not asset coverage", () => {
    // The sharpest number this check produces. `sample: true` rows exist to prove
    // the file shape; counting them is how "we have an audited asset register"
    // comes to mean zero without anyone lying.
    const f = makeFixture();
    try {
      expect(findingsFor(f.root, "HWR-5")).toEqual([]);
      write(
        f.root,
        "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
        "---\nid: 0EFJ9RW179ZFT9WBMXZZNYM92A\nname: Thing\nassigned_machine: host-a.local\nsample: true\n---\n",
      );
      const hits = findingsFor(f.root, "HWR-5");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("0 non-sample rows");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-6: a node registers and the declaration is not updated", () => {
    const f = makeFixture();
    try {
      write(
        f.root,
        "maintainers/bob/cluster-nodes/node-7/node.yaml",
        'spec:\n  hostname: node-7\n  hardware:\n    network:\n      mac: "aa:bb:cc:dd:ee:07"\n',
      );
      const hits = findingsFor(f.root, "HWR-6");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("probe-nodes=1");
      expect(hits[0]!.detail).toContain("2 node registrations");
    } finally {
      f.cleanup();
    }
  });

  // ── HWR-7 ──────────────────────────────────────────────────────────────────
  // The divergence this whole check was added for, in the exact shape it took on
  // main: edit the register, leave the published projection alone. Before HWR-7
  // this left `reconcile` green AND all 23 inventory unit tests passing, because
  // the reconciler read the register from the .md files and no workflow ran the
  // generator's own `--check`.
  test("HWR-7: the register is edited and the published read-model is not regenerated", () => {
    const f = makeFixture();
    try {
      write(
        f.root,
        "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
        `---
id: 0EFJ9RW179ZFT9WBMXZZNYM92A
name: Thing
qty: 1
status: active
value_usd: 999999
assigned_machine: host-a.local
---
`,
      );
      const hits = findingsFor(f.root, "HWR-7");
      expect(hits.length).toBe(1);
      expect(hits[0]!.key).toBe(ITEMS_JSON_REL);
      expect(hits[0]!.detail).toContain("not what the register derives");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-7: the read-model is hand-edited while the register stays put", () => {
    // The other direction, and the one a checked-in generated file invites: someone
    // fixes a price in the published JSON because that is the file they were looking
    // at. A check that only caught register-side edits would miss it.
    const f = makeFixture();
    try {
      write(f.root, ITEMS_JSON_REL, renderItemsJson(f.root).json.replace('"name": "Thing"', '"name": "Thingg"'));
      const hits = findingsFor(f.root, "HWR-7");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("not what the register derives");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-7: an absent read-model is stale, not vacuously fine", () => {
    // The vacuity trap for any compare-to-a-file check: a missing expectation must
    // never read as agreement.
    const f = makeFixture();
    try {
      rmSync(join(f.root, ITEMS_JSON_REL));
      const hits = findingsFor(f.root, "HWR-7");
      expect(hits.length).toBe(1);
      expect(hits[0]!.detail).toContain("absent");
    } finally {
      f.cleanup();
    }
  });

  test("HWR-7: a register row the generator rejects is reported, not silently dropped", () => {
    // `generate` returns errors instead of items for a malformed row. Without this
    // branch the derived side would be the empty string, the committed side would
    // still hold real rows, and the finding would read as ordinary staleness —
    // pointing the reader at "re-run the generator", which would also fail.
    const f = makeFixture();
    try {
      write(
        f.root,
        "inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-thing.md",
        `---
id: 0EFJ9RW179ZFT9WBMXZZNYM92A
name: Thing
qty: 1
status: on-fire
---
`,
      );
      const hits = findingsFor(f.root, "HWR-7");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.map((h) => h.detail).join(" ")).toContain("rejected by the generator");
    } finally {
      f.cleanup();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The ledger must not be able to rot
// ─────────────────────────────────────────────────────────────────────────────

describe("open-findings ledger", () => {
  test("a ledgered finding is accounted, not unaccounted", () => {
    const findings: Finding[] = [{ check: "HWR-2", key: "aa:bb", detail: "d" }];
    const t = triage(findings, [{ check: "HWR-2", key: "aa:bb", workitem: "W", why: "y" }]);
    expect(t.unaccounted).toEqual([]);
    expect(t.accounted.length).toBe(1);
    expect(t.stale).toEqual([]);
  });

  test("a suppression whose finding no longer reproduces is itself a failure", () => {
    // Anti-rot. Without this, an accepted divergence becomes a permanent silent
    // exception the moment someone quietly fixes the underlying data.
    const t = triage([], [{ check: "HWR-2", key: "aa:bb", workitem: "W", why: "y" }]);
    expect(t.stale.length).toBe(1);
    expect(t.unaccounted).toEqual([]);
  });

  test("a divergence with no ledger entry is unaccounted", () => {
    const t = triage([{ check: "HWR-1", key: "x", detail: "d" }], []);
    expect(t.unaccounted.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The real repo
// ─────────────────────────────────────────────────────────────────────────────

describe("this repository", () => {
  test("every divergence is either fixed or ledgered with a work-item", () => {
    const t = triage(reconcile(collect()), loadOpen());
    expect(t.unaccounted.map((f) => `${f.check} ${f.detail}`)).toEqual([]);
    expect(t.stale.map((o) => `${o.check} ${o.key}`)).toEqual([]);
  });

  test("every ledger entry names the work-item that owns it", () => {
    for (const o of loadOpen()) {
      expect(o.workitem).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(o.why.length).toBeGreaterThan(40);
    }
  });
});
