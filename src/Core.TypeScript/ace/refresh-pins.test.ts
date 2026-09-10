// refresh-pins.test.ts — the refusals, because only the refusals matter.
//
// A pin verifier only ever run against matching input cannot tell "the check
// passed" from "the check is not wired up". Every test below drives the REAL
// decision logic through injected effects and asserts a REFUSAL; the happy paths
// are here as declared CONTROLS that must SURVIVE mutation, which is what makes
// the rest of the suite evidence rather than decoration.
//
// MUTATION LOG — each mutant was applied to refresh-pins.ts, `bun test` was run,
// and the killer named below actually went red. The controls were re-checked to
// still pass under mutants M4 and M6.
//
//   M1  parseRegistry: `remeasure` falls back to "" instead of refusing
//       KILLED BY  "a row with no remeasure= is a parse error"
//   M2  parseRegistry: drop the SHA256_REF test on `pin`
//       KILLED BY  "a short or non-hex digest is refused"
//   M3  parseRegistry: accept any `kind` string
//       KILLED BY  "an unknown kind is refused"
//   M4  digestAtPointOfUse: remove the isCommentLine skip
//       KILLED BY  "a ref named in a comment does not make a pinned file look unpinned"
//       (this mutant is the ORIGINAL BUG — the first --verify run on the real
//        tree reported windows-install-ps1-test unpinned because its header
//        comment names the base image.)
//   M5  digestAtPointOfUse: return hits[0] without the all-agree check
//       KILLED BY  "two FROM lines pinning the same ref differently is refused"
//   M6  verifyMirror: compare the file digest to itself instead of to the row
//       KILLED BY  "a registry row that disagrees with the file is a finding"
//   M7  classify: test the horizon before testing upstream === null
//       KILLED BY  "unknown beats past-horizon — a probe that did not run is not a finding about the pin"
//   M8  refreshRow: skip the restore when the re-measure fails
//       KILLED BY  "a failed re-measure restores the file and keeps the old digest"
//   M9  refreshRow: proceed when resolveUpstream returns null
//       KILLED BY  "an unresolvable upstream writes nothing"
//   M10 resolveNpmAdvisory: return `latest` regardless of the declared range
//       KILLED BY  "a latest release admitting the patched major reports FIX-AVAILABLE"
//   M11 resolveContainerDigest: fall back to the body hash on a non-200
//       KILLED BY  "a non-200 from the registry is unknown, never a digest"
//
//   CONTROLS (must SURVIVE): "a matching registry verifies clean" and
//   "a fresh row classifies as fresh". Both pass under M4 and M6 — which is
//   exactly why a green happy-path test proves nothing on its own.

import { describe, expect, test } from "bun:test";
import {
  ageInDays,
  classify,
  digestAtPointOfUse,
  isCommentLine,
  parseRegistry,
  refreshRow,
  resolveContainerDigest,
  resolveNpmAdvisory,
  rewritePin,
  splitImageRef,
  verifyMirror,
  type PinRow,
  type RefreshEffects,
} from "./refresh-pins.ts";

const D1 = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
const D2 = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

function row(over: Partial<PinRow> = {}): PinRow {
  return {
    kind: "container",
    file: "a/Dockerfile",
    ref: "example.io/img:tag",
    pin: D1,
    update: "follow-tag",
    remeasure: "true",
    horizonDays: 60,
    pinnedOn: "2026-09-01",
    ...over,
  };
}

const GOOD_ROW =
  `container  a/Dockerfile  example.io/img:tag  ${D1}  update=follow-tag  remeasure=true  horizon=60  pinned=2026-09-01`;

// ── parse refusals ───────────────────────────────────────────────────────────

describe("parseRegistry refuses what it cannot safely act on", () => {
  test("CONTROL: a well-formed row parses", () => {
    const p = parseRegistry(`# comment\n\n${GOOD_ROW}\n`);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]?.remeasure).toBe("true");
  });

  // M1. A default here would be a pin that can be bumped with nothing judging the
  // new bytes -- the exact failure the whole tool exists to prevent.
  test("a row with no remeasure= is a parse error", () => {
    const p = parseRegistry(
      `container  a/Dockerfile  example.io/img:tag  ${D1}  update=follow-tag  horizon=60  pinned=2026-09-01`,
    );
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.reason).toContain("remeasure= is mandatory");
  });

  // M2. A 8-hex "digest" verifies nothing while looking exactly like a check.
  test("a short or non-hex digest is refused", () => {
    const short = parseRegistry(
      `container  a/Dockerfile  example.io/img:tag  sha256:deadbeef  update=follow-tag  remeasure=true  horizon=60  pinned=2026-09-01`,
    );
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toContain("not sha256:<64 hex>");

    const nonHex = parseRegistry(
      `container  a/Dockerfile  example.io/img:tag  sha256:${"z".repeat(64)}  update=follow-tag  remeasure=true  horizon=60  pinned=2026-09-01`,
    );
    expect(nonHex.ok).toBe(false);
  });

  // M3. A typo'd kind that parses would be a row that silently never resolves --
  // a registry entry that looks maintained and reports nothing.
  test("an unknown kind is refused", () => {
    const p = parseRegistry(
      `contaner  a/Dockerfile  example.io/img:tag  ${D1}  update=follow-tag  remeasure=true  horizon=60  pinned=2026-09-01`,
    );
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toContain("unknown kind");
  });

  test("a bad update policy, horizon or date is refused", () => {
    const badUpdate = parseRegistry(GOOD_ROW.replace("update=follow-tag", "update=whenever"));
    expect(badUpdate.ok).toBe(false);
    const badHorizon = parseRegistry(GOOD_ROW.replace("horizon=60", "horizon=soon"));
    expect(badHorizon.ok).toBe(false);
    const zeroHorizon = parseRegistry(GOOD_ROW.replace("horizon=60", "horizon=0"));
    expect(zeroHorizon.ok).toBe(false);
    const badDate = parseRegistry(GOOD_ROW.replace("pinned=2026-09-01", "pinned=september"));
    expect(badDate.ok).toBe(false);
  });

  test("an npm-advisory pin is a version, not a digest", () => {
    const p = parseRegistry(
      `npm-advisory  package.json  npm:pkg!dep@7  0.9.250  update=follow-tag  remeasure=manual:x  horizon=90  pinned=2026-09-01`,
    );
    expect(p.ok).toBe(true);
  });
});

// ── the point-of-use read ────────────────────────────────────────────────────

describe("digestAtPointOfUse reads the FILE, not the prose about it", () => {
  test("isCommentLine covers # and //", () => {
    expect(isCommentLine("  # base image")).toBe(true);
    expect(isCommentLine("// note")).toBe(true);
    expect(isCommentLine("FROM x")).toBe(false);
  });

  // M4 — THE ORIGINAL BUG. The real windows Dockerfile names its base in a header
  // comment; before comments were stripped, --verify called a correctly pinned
  // file unpinned. A guard that matches its own documentation reads the wrong text.
  test("a ref named in a comment does not make a pinned file look unpinned", () => {
    const text = [
      "#   base   — example.io/img:tag (current; see the vendor page)",
      "# nothing here is a point of use",
      `FROM example.io/img:tag@${D1}`,
    ].join("\n");
    const got = digestAtPointOfUse(text, "example.io/img:tag");
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.digest).toBe(D1);
  });

  test("a genuinely unpinned FROM is refused", () => {
    const got = digestAtPointOfUse("FROM example.io/img:tag AS build", "example.io/img:tag");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.reason).toContain("appears unpinned");
  });

  test("a ref absent from the file is refused", () => {
    const got = digestAtPointOfUse("FROM other/img:tag@" + D1, "example.io/img:tag");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.reason).toContain("does not appear");
  });

  // M5. Picking the first would let --verify pass against whichever line it read
  // first while the other stage builds on an unreviewed base.
  test("two FROM lines pinning the same ref differently is refused", () => {
    const text = `FROM example.io/img:tag@${D1} AS a\nFROM example.io/img:tag@${D2}\n`;
    const got = digestAtPointOfUse(text, "example.io/img:tag");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.reason).toContain("different digests");
  });

  test("two FROM lines pinning the same ref identically is fine", () => {
    const text = `FROM example.io/img:tag@${D1} AS a\nFROM example.io/img:tag@${D1}\n`;
    const got = digestAtPointOfUse(text, "example.io/img:tag");
    expect(got.ok).toBe(true);
  });
});

// ── the mirror check ─────────────────────────────────────────────────────────

describe("verifyMirror keeps the registry a mirror and never a source", () => {
  test("CONTROL: a matching registry verifies clean", () => {
    const found = verifyMirror([row()], () => `FROM example.io/img:tag@${D1}`);
    expect(found).toHaveLength(0);
  });

  // M6. This is the whole clone-at-tag guarantee made mechanical: if the registry
  // ever became the source of truth, the inline pin would drift and only this fires.
  test("a registry row that disagrees with the file is a finding", () => {
    const found = verifyMirror([row()], () => `FROM example.io/img:tag@${D2}`);
    expect(found).toHaveLength(1);
    expect(found[0]?.reason).toContain("the file wins");
  });

  test("an unreadable point of use is a finding, not a skip", () => {
    const found = verifyMirror([row()], () => {
      throw new Error("ENOENT");
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.reason).toContain("unreadable");
  });

  test("npm-advisory rows carry no inline digest and are not drift-checked", () => {
    const found = verifyMirror([row({ kind: "npm-advisory", pin: "0.9.250" })], () => "");
    expect(found).toHaveLength(0);
  });
});

// ── staleness ────────────────────────────────────────────────────────────────

describe("classify — and unknown is never folded into fresh", () => {
  test("CONTROL: a fresh row classifies as fresh", () => {
    expect(classify(row(), D1, "2026-09-02").freshness).toBe("fresh");
  });

  test("a moved upstream classifies as moved", () => {
    const s = classify(row(), D2, "2026-09-02");
    expect(s.freshness).toBe("moved");
    expect(s.detail).toContain(D2);
  });

  test("a matching pin older than its horizon is past-horizon", () => {
    expect(classify(row({ horizonDays: 10 }), D1, "2026-10-01").freshness).toBe("past-horizon");
  });

  // M7. Calling an unresolvable row past-horizon would imply we know the pin is
  // behind. We do not. Unknown must not decay into a weaker claim it never earned.
  test("unknown beats past-horizon — a probe that did not run is not a finding about the pin", () => {
    const s = classify(row({ horizonDays: 1 }), null, "2026-12-01");
    expect(s.freshness).toBe("unknown");
    expect(s.detail).toContain("NOT a pass");
  });

  test("ageInDays counts whole days", () => {
    expect(ageInDays("2026-09-01", "2026-09-11")).toBe(10);
    expect(ageInDays("2026-09-01", "2026-09-01")).toBe(0);
  });
});

// ── ref parsing ──────────────────────────────────────────────────────────────

describe("splitImageRef", () => {
  test("a dotted first segment is a registry host", () => {
    expect(splitImageRef("mcr.microsoft.com/windows/servercore:ltsc2025")).toEqual({
      host: "mcr.microsoft.com",
      repo: "windows/servercore",
      tag: "ltsc2025",
    });
  });
  test("an undotted first segment is a Docker Hub namespace", () => {
    expect(splitImageRef("oven/bun:1.3.14-alpine")).toEqual({
      host: "registry-1.docker.io",
      repo: "oven/bun",
      tag: "1.3.14-alpine",
    });
  });
  test("a bare name lands under library/", () => {
    expect(splitImageRef("alpine:3.20")?.repo).toBe("library/alpine");
  });
  test("a ref with no tag is refused", () => {
    expect(splitImageRef("alpine")).toBeNull();
  });
});

// ── resolvers ────────────────────────────────────────────────────────────────

function fx(over: Partial<RefreshEffects> = {}): RefreshEffects {
  return {
    httpGet: async () => ({ status: 200, headers: {}, body: "" }),
    readFile: () => "",
    writeFile: () => {},
    run: () => ({ ok: true, output: "" }),
    today: () => "2026-09-09",
    log: () => {},
    ...over,
  };
}

describe("resolveContainerDigest", () => {
  test("reads Docker-Content-Digest", async () => {
    const got = await resolveContainerDigest(
      "example.io/img:tag",
      fx({ httpGet: async () => ({ status: 200, headers: { "docker-content-digest": D1 }, body: "{}" }) }),
    );
    expect(got).toBe(D1);
  });

  // M11. A registry answering 401/404/500 tells us nothing about the tag. Hashing
  // an error page and calling it a digest would be a fabricated measurement.
  test("a non-200 from the registry is unknown, never a digest", async () => {
    const got = await resolveContainerDigest(
      "example.io/img:tag",
      fx({ httpGet: async () => ({ status: 401, headers: {}, body: "unauthorized" }) }),
    );
    expect(got).toBeNull();
  });

  test("a transport failure is unknown, not a throw", async () => {
    const got = await resolveContainerDigest(
      "example.io/img:tag",
      fx({
        httpGet: () => {
          throw new Error("ENETDOWN");
        },
      }),
    );
    expect(got).toBeNull();
  });
});

describe("resolveNpmAdvisory — the dismissal's expiry", () => {
  const body = (range: string | null): string =>
    JSON.stringify({
      "dist-tags": { latest: "0.9.250" },
      versions: { "0.9.250": { dependencies: range === null ? {} : { mathjs: range } } },
    });

  test("a ceiling below the patched major keeps the dismissal standing", async () => {
    const got = await resolveNpmAdvisory(
      "npm:quantum-circuit!mathjs@7",
      fx({ httpGet: async () => ({ status: 200, headers: {}, body: body("^6.0.3") }) }),
    );
    expect(got).toBe("0.9.250");
  });

  // M10. If upstream ever ships a release admitting the patched major, a fix
  // EXISTS and the dismissal is stale. Reporting `latest` regardless would let it
  // age into a permanent silence — the vacuity class with a timestamp.
  test("a latest release admitting the patched major reports FIX-AVAILABLE", async () => {
    const got = await resolveNpmAdvisory(
      "npm:quantum-circuit!mathjs@7",
      fx({ httpGet: async () => ({ status: 200, headers: {}, body: body("^7.5.1") }) }),
    );
    expect(got).toBe("FIX-AVAILABLE");
  });

  test("a dependency that vanished, or a range this cannot bound, errs toward re-examining", async () => {
    const gone = await resolveNpmAdvisory(
      "npm:quantum-circuit!mathjs@7",
      fx({ httpGet: async () => ({ status: 200, headers: {}, body: body(null) }) }),
    );
    expect(gone).toBe("FIX-AVAILABLE");
    const wild = await resolveNpmAdvisory(
      "npm:quantum-circuit!mathjs@7",
      fx({ httpGet: async () => ({ status: 200, headers: {}, body: body("*") }) }),
    );
    expect(wild).toBe("FIX-AVAILABLE");
  });

  test("an unreachable registry is unknown", async () => {
    const got = await resolveNpmAdvisory(
      "npm:quantum-circuit!mathjs@7",
      fx({ httpGet: async () => ({ status: 503, headers: {}, body: "" }) }),
    );
    expect(got).toBeNull();
  });
});

// ── the refresh ──────────────────────────────────────────────────────────────

describe("rewritePin", () => {
  test("rewrites every occurrence of ref@old", () => {
    const out = rewritePin(`FROM x:t@${D1} AS a\nFROM x:t@${D1}\n`, "x:t", D1, D2);
    expect(out).toBe(`FROM x:t@${D2} AS a\nFROM x:t@${D2}\n`);
  });
  test("returns null when the old pin is not present", () => {
    expect(rewritePin("FROM x:t\n", "x:t", D1, D2)).toBeNull();
  });
});

/** A tiny in-memory tree so the refresh's writes and restores are observable. */
function tree(initial: Record<string, string>): { files: Record<string, string>; effects: (over?: Partial<RefreshEffects>) => RefreshEffects } {
  const files = { ...initial };
  return {
    files,
    effects: (over: Partial<RefreshEffects> = {}) =>
      fx({
        readFile: (p) => {
          const v = files[p];
          if (v === undefined) throw new Error(`ENOENT ${p}`);
          return v;
        },
        writeFile: (p, t) => {
          files[p] = t;
        },
        ...over,
      }),
  };
}

describe("refreshRow refuses to leave an unverified bump on disk", () => {
  const REG = "tools/setup/manifests/pinned-refs";

  function seed(): ReturnType<typeof tree> {
    return tree({
      "a/Dockerfile": `FROM example.io/img:tag@${D1}\n`,
      [REG]: `${GOOD_ROW}\n`,
      "tools/setup/manifests/pinned-refs-receipts": "# receipts\n",
    });
  }

  test("CONTROL: a resolvable move whose re-measure passes is written, with a receipt", async () => {
    const t = seed();
    const out = await refreshRow(
      row(),
      t.effects({ httpGet: async () => ({ status: 200, headers: { "docker-content-digest": D2 }, body: "{}" }) }),
    );
    expect(out.ok).toBe(true);
    expect(t.files["a/Dockerfile"]).toContain(D2);
    expect(t.files["tools/setup/manifests/pinned-refs-receipts"]).toContain(D2);
    expect(t.files["tools/setup/manifests/pinned-refs-receipts"]).toContain("result=pass");
    expect(t.files[REG]).toContain(D2);
    expect(t.files[REG]).toContain("pinned=2026-09-09");
  });

  // M8 — the load-bearing refusal. A digest no run has judged is an unverified
  // bump wearing a pin's clothes, and it lands as a one-line housekeeping diff.
  test("a failed re-measure restores the file and keeps the old digest", async () => {
    const t = seed();
    const out = await refreshRow(
      row(),
      t.effects({
        httpGet: async () => ({ status: 200, headers: { "docker-content-digest": D2 }, body: "{}" }),
        run: () => ({ ok: false, output: "build failed on the new base" }),
      }),
    );
    expect(out.ok).toBe(false);
    expect(out.message).toContain("re-measure");
    expect(out.message).toContain("build failed on the new base");
    expect(t.files["a/Dockerfile"]).toContain(D1);
    expect(t.files["a/Dockerfile"]).not.toContain(D2);
    expect(t.files["tools/setup/manifests/pinned-refs-receipts"]).not.toContain(D2);
    expect(t.files[REG]).toContain(D1);
  });

  // M9. Resolving is how we learn what to write; failing to resolve must not
  // become a write of anything.
  test("an unresolvable upstream writes nothing", async () => {
    const t = seed();
    const out = await refreshRow(row(), t.effects({ httpGet: async () => ({ status: 500, headers: {}, body: "" }) }));
    expect(out.ok).toBe(false);
    expect(out.message).toContain("could not resolve");
    expect(t.files["a/Dockerfile"]).toBe(`FROM example.io/img:tag@${D1}\n`);
  });

  test("an unchanged upstream is a no-op, not a rewrite", async () => {
    const t = seed();
    const out = await refreshRow(
      row(),
      t.effects({ httpGet: async () => ({ status: 200, headers: { "docker-content-digest": D1 }, body: "{}" }) }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.changed).toBe(false);
    expect(t.files["tools/setup/manifests/pinned-refs-receipts"]).toBe("# receipts\n");
  });

  test("update=frozen refuses", async () => {
    const t = seed();
    const out = await refreshRow(row({ update: "frozen" }), t.effects());
    expect(out.ok).toBe(false);
    expect(out.message).toContain("frozen");
  });

  test("an npm-advisory row refuses — reversing a dismissal is a judgement", async () => {
    const t = seed();
    const out = await refreshRow(row({ kind: "npm-advisory", pin: "0.9.250" }), t.effects());
    expect(out.ok).toBe(false);
    expect(out.message).toContain("advisory disposition");
  });

  test("a stale row whose old pin is gone from the file refuses rather than guessing", async () => {
    const t = tree({
      "a/Dockerfile": "FROM example.io/img:tag\n",
      [REG]: `${GOOD_ROW}\n`,
    });
    const out = await refreshRow(
      row(),
      t.effects({ httpGet: async () => ({ status: 200, headers: { "docker-content-digest": D2 }, body: "{}" }) }),
    );
    expect(out.ok).toBe(false);
    expect(out.message).toContain("run --verify first");
  });
});

// ── the committed registry itself ────────────────────────────────────────────

describe("the committed pinned-refs registry", () => {
  test("parses, and every row's pin is the pin written at its point of use", () => {
    const text = require("node:fs").readFileSync("tools/setup/manifests/pinned-refs", "utf-8") as string;
    const parsed = parseRegistry(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.length).toBeGreaterThan(0);
    const findings = verifyMirror(parsed.rows, (p) => require("node:fs").readFileSync(p, "utf-8") as string);
    expect(findings).toEqual([]);
  });

  test("no row's point of use is this registry — a mirror never points at itself", () => {
    const text = require("node:fs").readFileSync("tools/setup/manifests/pinned-refs", "utf-8") as string;
    const parsed = parseRegistry(text);
    if (!parsed.ok) throw new Error(parsed.reason);
    for (const r of parsed.rows) expect(r.file).not.toContain("pinned-refs");
  });
});
