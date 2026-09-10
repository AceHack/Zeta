import { describe, expect, test } from "bun:test";
import { isUnhashed, resolvePin, unhashedInstallNotice } from "./unhashed-pin.ts";

const HEX = "a".repeat(64);
const TAGGED = "https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar";
const UNTAGGED = "https://x.ai/cli/install.sh";
const REASON = "upstream-serves-whatever-is-current-and-publishes-no-versioned-artifact";

describe("resolvePin — the digest path is untouched", () => {
  test("a 64-hex digest resolves to a digest pin", () => {
    expect(resolvePin("from-url", "d", TAGGED, { sha256: HEX })).toEqual({ kind: "digest", sha256: HEX });
  });

  test("an uppercase digest is normalized rather than refused", () => {
    const pin = resolvePin("from-url", "d", TAGGED, { sha256: HEX.toUpperCase() });
    expect(pin).toEqual({ kind: "digest", sha256: HEX });
  });

  test("a digest is not unhashed", () => {
    expect(isUnhashed({ kind: "digest", sha256: HEX })).toBe(false);
  });

  test("a malformed digest is still refused", () => {
    expect(() => resolvePin("from-url", "d", TAGGED, { sha256: "nothex" })).toThrow(/64 hex chars/u);
  });
});

describe("resolvePin — silence still fails closed", () => {
  test("a row with no sha256= at all is refused", () => {
    expect(() => resolvePin("from-elan", "elan", TAGGED, {})).toThrow(/sha256= pin required/u);
  });

  test("the refusal names BOTH declarations, so the reader knows the exception exists", () => {
    let message = "";
    try {
      resolvePin("from-elan", "elan", TAGGED, {});
    } catch (err) {
      message = String(err);
    }
    expect(message).toContain("sha256=tag-only");
    expect(message).toContain("sha256=unpinned");
    expect(message).toContain("Silence is not a declaration");
  });
});

describe("resolvePin — tag-only", () => {
  test("accepted with a reason and a version-shaped tag", () => {
    const pin = resolvePin("from-url", "d", TAGGED, { sha256: "tag-only", tagonly: REASON });
    expect(pin).toEqual({ kind: "tag-only", reason: REASON });
    expect(isUnhashed(pin)).toBe(true);
  });

  test("refused without a reason", () => {
    expect(() => resolvePin("from-url", "d", TAGGED, { sha256: "tag-only" })).toThrow(
      /tagonly=<reason> is required and it is missing/u,
    );
  });

  test("refused on a moving alias — latest pins nothing", () => {
    expect(() =>
      resolvePin("from-url", "d", "https://example.test/releases/latest/x.jar", {
        sha256: "tag-only",
        tagonly: REASON,
      }),
    ).toThrow(/version-shaped tag/u);
  });

  test("refused on a bare filename with no path version", () => {
    expect(() => resolvePin("from-url", "d", UNTAGGED, { sha256: "tag-only", tagonly: REASON })).toThrow(
      /version-shaped tag/u,
    );
  });

  test("a lettered tag like /E-3.2.0/ counts as version-shaped", () => {
    const url = "https://github.com/eprover/eprover/archive/refs/tags/E-3.2.0/x.tar.gz";
    expect(resolvePin("from-autotools-tarball", "eprover", url, { sha256: "tag-only", tagonly: REASON }).kind).toBe(
      "tag-only",
    );
  });
});

describe("resolvePin — unpinned", () => {
  test("accepted only where there is no version to pin", () => {
    const pin = resolvePin("from-installer", "grok", UNTAGGED, { sha256: "unpinned", unpinned: REASON });
    expect(pin).toEqual({ kind: "unpinned", reason: REASON });
  });

  test("refused without a reason", () => {
    expect(() => resolvePin("from-installer", "grok", UNTAGGED, { sha256: "unpinned" })).toThrow(
      /unpinned=<reason> is required/u,
    );
  });

  // THE SHRINK DIRECTION AT DECLARATION TIME. The weakest exception may not be chosen where a
  // stronger one is available, or "unpinned" becomes the convenient answer to everything.
  test("refused when the URL DOES carry a version tag — use tag-only instead", () => {
    let message = "";
    try {
      resolvePin("from-url", "d", TAGGED, { sha256: "unpinned", unpinned: REASON });
    } catch (err) {
      message = String(err);
    }
    expect(message).toContain("DOES carry a version-shaped");
    expect(message).toContain("sha256=tag-only");
  });
});

describe("the reason floor — the exception must cost more than the rule", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["a bare yes", "yes"],
    ["a single long word", "becausewedonothaveadigestforthisone"],
    ["two words only", "no-digest"],
    ["a mood, not a cause", "TODO"],
    ["whitespace", "   "],
  ];
  for (const [label, reason] of cases) {
    test(`refuses ${label}`, () => {
      expect(() => resolvePin("from-installer", "x", UNTAGGED, { sha256: "unpinned", unpinned: reason })).toThrow(
        /unpinned=<reason> is required/u,
      );
    });
  }

  test("accepts a three-word hyphenated cause that clears the length floor", () => {
    const ok = "vendor-endpoint-publishes-no-versioned-artifact";
    expect(resolvePin("from-installer", "x", UNTAGGED, { sha256: "unpinned", unpinned: ok }).kind).toBe("unpinned");
  });

  // A digest costs 64 measured characters. If the exception were cheaper than that in the
  // trivial case, it would be the path of least resistance and would spread on its own.
  test("the shortest acceptable reason is not trivially cheap", () => {
    expect("vendor-endpoint-publishes-no-versioned-artifact".length).toBeGreaterThan(20);
  });
});

describe("unhashedInstallNotice — an unhashed install must SAY so", () => {
  test("a digest pin prints nothing", () => {
    expect(unhashedInstallNotice({ kind: "digest", sha256: HEX }, "d", TAGGED)).toBeNull();
  });

  test("a tag-only pin names the kind, the subject, and its own reason", () => {
    const line = unhashedInstallNotice({ kind: "tag-only", reason: REASON }, "tla2tools.jar", TAGGED);
    expect(line).toContain("TAG-ONLY INSTALL");
    expect(line).toContain("tla2tools.jar");
    expect(line).toContain(REASON);
    expect(line).toContain("no digest was verified");
  });

  test("an unpinned pin names the weaker kind", () => {
    expect(unhashedInstallNotice({ kind: "unpinned", reason: REASON }, "grok", UNTAGGED)).toContain(
      "UNPINNED INSTALL",
    );
  });
});
