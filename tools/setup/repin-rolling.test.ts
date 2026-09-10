// repin-rolling.test.ts — the pure halves of the rolling re-pin.
//
// The network fetch and the re-measure spawn are not exercised here: one needs
// GitHub and the other needs a JVM and twenty minutes. What IS exercised is
// every place the tool REWRITES the tree, because a re-pin that silently edits
// the wrong bytes is worse than one that refuses.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertHttpsUrl,
  deriveIdentity,
  fetchToBuffer,
  identityPatternSource,
  identitySubstitutionPairs,
  receiptRow,
  recoverIdentityFromSurfaces,
  rewriteManifestRow,
  sha256Of,
  stageVerifiedWrite,
  substituteAll,
} from "./repin-rolling.ts";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const DEST = "src/Core.TLA/tla2tools.jar";

describe("substituteAll", () => {
  test("replaces every occurrence and counts them", () => {
    const result = substituteAll(`${OLD} and ${OLD}`, [[OLD, NEW]]);
    expect(result.text).toBe(`${NEW} and ${NEW}`);
    expect(result.replacements).toBe(2);
  });

  // A pin surface that matched NOTHING is the finding the tool refuses on: it
  // means the row's pinsurfaces= list has drifted from where the digest lives,
  // and a re-pin that "succeeded" against it would leave a half re-pin behind.
  test("reports zero when nothing matched", () => {
    expect(substituteAll("no digests here", [[OLD, NEW]]).replacements).toBe(0);
  });

  test("an empty or identity pair is a no-op rather than a corruption", () => {
    expect(substituteAll("text", [["", NEW]]).text).toBe("text");
    expect(substituteAll("text", [[OLD, OLD]]).replacements).toBe(0);
  });
});

describe("rewriteManifestRow", () => {
  const manifest =
    `# ${DEST} was pinned at sha256=${OLD} on some earlier date\n` +
    `other/dest  https://example.invalid/x  sha256=${OLD}\n` +
    `${DEST}  https://example.invalid/y  sha256=${OLD}  rolling=t\n`;

  test("moves the digest on the named row only", () => {
    const out = rewriteManifestRow(manifest, DEST, OLD, NEW);
    expect(out).toContain(`${DEST}  https://example.invalid/y  sha256=${NEW}`);
    expect(out).toContain(`other/dest  https://example.invalid/x  sha256=${OLD}`);
  });

  // Comments carry the MEASUREMENT history -- rewriting a digest inside one
  // would silently falsify the record of what was measured when. It holds
  // because a comment's first token is never the bare dest, which is also why
  // rewriteManifestRow carries no SEPARATE comment guard: one was written, and
  // it survived mutation, i.e. it could not change any outcome.
  test("leaves comments alone", () => {
    expect(rewriteManifestRow(manifest, DEST, OLD, NEW)).toContain(
      `# ${DEST} was pinned at sha256=${OLD} on some earlier date`,
    );
  });

  test("refuses when there is no row for the dest", () => {
    expect(() => rewriteManifestRow(manifest, "nope/x.jar", OLD, NEW)).toThrow("has no row for");
  });
});

describe("receiptRow", () => {
  test("emits every field the lint demands, in the ledger's format", () => {
    const row = receiptRow(DEST, NEW, "2026-09-09", "a/b.ts:--all", "docs/cross-verify/x.md");
    expect(row).toBe(
      `${DEST}  sha256=${NEW}  measured=2026-09-09  result=pass  remeasure=a/b.ts:--all  evidence=docs/cross-verify/x.md`,
    );
  });

  // `result=pass` is not a parameter, and that is deliberate: the tool only ever
  // reaches this line after the re-measure exited 0, so there is no code path
  // that can write a receipt for a run that failed.
  test("result is always pass, because a failed run never gets this far", () => {
    expect(receiptRow(DEST, NEW, "2026-09-09", "x:y", "z")).toContain("result=pass");
  });
});

describe("deriveIdentity", () => {
  test("a row with no identity= asks for nothing and gets null", () => {
    expect(deriveIdentity(undefined, "/nonexistent/does-not-matter.jar")).toBeNull();
    expect(deriveIdentity("", "/nonexistent/does-not-matter.jar")).toBeNull();
  });

  // Against a REAL jar, so the refusal is the identity check firing rather than
  // the file read failing -- otherwise the assertion passes for the wrong reason
  // and a tool that silently guessed an identity would still look tested.
  test("an unknown identity kind is refused rather than guessed", () => {
    const jar = join(process.cwd(), "src/Core.TLA/tla2tools.jar");
    if (!existsSync(jar)) return; // fetched jar; a probe that cannot run is unknown
    expect(deriveIdentity("jar-tlc", jar)).toContain("(rev:");
    expect(() => deriveIdentity("jar-something-else", jar)).toThrow("unknown identity=");
  });
});

describe("recoverIdentityFromSurfaces", () => {
  const OLD_ID = "2026.09.09.162536 (rev: 4ad12e8)";
  const NEW_ID = "2026.09.09.201538 (rev: 94db4a6)";

  test("a row with no identity= asks for nothing and gets null", () => {
    expect(recoverIdentityFromSurfaces(undefined, [`TLC2 Version ${OLD_ID}`])).toBeNull();
    expect(recoverIdentityFromSurfaces("", [`TLC2 Version ${OLD_ID}`])).toBeNull();
  });

  test("an unknown identity kind is refused rather than guessed", () => {
    expect(() => recoverIdentityFromSurfaces("jar-something-else", ["x"])).toThrow(
      "unknown identity=",
    );
    expect(() => identityPatternSource("jar-something-else")).toThrow("unknown identity=");
  });

  // The gitignored jar is absent on a fresh clone. Pin surfaces still name the
  // previous identity as the suffix of `TLC2 Version …`, which is the same
  // substring deriveIdentity would return from the old bytes.
  test("extracts the jar-tlc identity from a TLC2 Version banner", () => {
    expect(
      recoverIdentityFromSurfaces("jar-tlc", [`TLC2 Version ${OLD_ID}`]),
    ).toBe(OLD_ID);
  });

  test("the same identity restated in every pin surface is still one identity", () => {
    const texts = [
      `  "versionBanner": "TLC2 Version ${OLD_ID}",`,
      `| **TLA+ / TLC** | \`TLC2 Version ${OLD_ID}\` |`,
      `| TLA+ (\`tla2tools.jar\`, \`TLC2 Version ${OLD_ID}\`) |`,
    ];
    expect(recoverIdentityFromSurfaces("jar-tlc", texts)).toBe(OLD_ID);
  });

  test("two distinct identities in pin surfaces is a refusal, not a pick", () => {
    expect(() =>
      recoverIdentityFromSurfaces("jar-tlc", [
        `TLC2 Version ${OLD_ID}`,
        `TLC2 Version ${NEW_ID}`,
      ]),
    ).toThrow("ambiguous prior identity");
  });

  test("surfaces that name no identity return null rather than inventing one", () => {
    expect(recoverIdentityFromSurfaces("jar-tlc", ["sha256=" + OLD, "no banner"])).toBeNull();
  });

  test("extracts a jar-alloy identity in the same shape deriveIdentity would return", () => {
    expect(
      recoverIdentityFromSurfaces("jar-alloy", ["6.2.0.202501090817 (rev: 794226d)"]),
    ).toBe("6.2.0.202501090817 (rev: 794226d)");
  });

  test("the recovered identity is the substring substituteAll needs to rewrite a banner", () => {
    const surface = `"versionBanner": "TLC2 Version ${OLD_ID}"`;
    const recovered = recoverIdentityFromSurfaces("jar-tlc", [surface]);
    expect(recovered).toBe(OLD_ID);
    const { text, replacements } = substituteAll(surface, [[recovered ?? "", NEW_ID]]);
    expect(replacements).toBe(1);
    expect(text).toBe(`"versionBanner": "TLC2 Version ${NEW_ID}"`);
  });

  // Against the committed pin surfaces, so a row whose pinsurfaces= list has
  // drifted to historical banners (research notes, old evidence) fails here
  // rather than at the next rolling rebuild. Shape, not a frozen timestamp:
  // the live identity moves when the rolling pin moves.
  test("committed tla2tools pin surfaces name exactly one jar-tlc identity", () => {
    const texts = [
      readFileSync(join(process.cwd(), "registry/tlc-models.json"), "utf8"),
      readFileSync(join(process.cwd(), "docs/INSTALLED.md"), "utf8"),
      readFileSync(join(process.cwd(), "docs/dependency-status.md"), "utf8"),
    ];
    const recovered = recoverIdentityFromSurfaces("jar-tlc", texts);
    expect(recovered).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{6} \(rev: [0-9a-f]+\)$/);
  });
});

describe("identitySubstitutionPairs", () => {
  const OLD_ID = "2026.09.09.162536 (rev: 4ad12e8)";
  const NEW_ID = "2026.09.09.201538 (rev: 94db4a6)";

  test("a row with no identity= contributes no pair", () => {
    expect(identitySubstitutionPairs(undefined, OLD_ID, NEW_ID)).toEqual([]);
    expect(identitySubstitutionPairs("", OLD_ID, NEW_ID)).toEqual([]);
  });

  test("both identities present become one substitution pair", () => {
    expect(identitySubstitutionPairs("jar-tlc", OLD_ID, NEW_ID)).toEqual([[OLD_ID, NEW_ID]]);
  });

  // The failure this PR exists to close: identity= set, old jar absent,
  // recovery returned null, and the previous tool skipped the pair. Digest
  // moved, banner did not, re-measure then looked like a verifier finding.
  test("identity= with no recovered prior identity is a refusal, not a skip", () => {
    expect(() => identitySubstitutionPairs("jar-tlc", null, NEW_ID)).toThrow(
      "previous identity cannot be recovered",
    );
  });

  test("identity= with no identity from the new bytes is a refusal", () => {
    expect(() => identitySubstitutionPairs("jar-tlc", OLD_ID, null)).toThrow(
      "new bytes yielded no identity",
    );
  });
});

describe("stageVerifiedWrite", () => {
  // The write is staged and re-read before it is renamed into place: a short
  // write, a full disk, or a truncated body must never leave partial bytes at
  // the path a runner loads from. It verifies WHAT WE INTENDED TO WRITE landed,
  // and claims nothing about whether upstream sent the right bytes -- only the
  // re-measure says that.
  test("writes through a .part and leaves none behind", () => {
    const dir = mkdtempSync(join(tmpdir(), "repin-stage-"));
    const dest = join(dir, "thing.jar");
    const body = new TextEncoder().encode("payload");
    stageVerifiedWrite(dest, body, sha256Of(body));
    expect(readFileSync(dest, "utf8")).toBe("payload");
    expect(existsSync(dest + ".part")).toBe(false);
  });

  test("a digest that disagrees with the bytes refuses and leaves nothing at dest", () => {
    const dir = mkdtempSync(join(tmpdir(), "repin-stage-"));
    const dest = join(dir, "thing.jar");
    const body = new TextEncoder().encode("payload");
    expect(() => stageVerifiedWrite(dest, body, "0".repeat(64))).toThrow();
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(dest + ".part")).toBe(false);
  });
});

describe("fetchToBuffer", () => {
  // A row's URL is file data, and "committed and reviewed" is a PROCESS claim --
  // this is the mechanical one. `realizeFromUrl` already refuses a non-HTTPS row;
  // this tool reads the same rows and had no such guard until CodeQL pointed at
  // the flow. The check runs BEFORE any request, so this test needs no network.
  test("a non-HTTPS row is refused before any request is made", async () => {
    await expect(fetchToBuffer("http://example.invalid/x.jar")).rejects.toThrow("HTTPS required");
    await expect(fetchToBuffer("file:///etc/passwd")).rejects.toThrow("HTTPS required");
  });

  test("the scheme is PARSED, not prefix-matched", () => {
    expect(assertHttpsUrl("HTTPS://Example.test/x.jar").protocol).toBe("https:");
    expect(() => assertHttpsUrl("httpsx://example.test/x.jar")).toThrow("HTTPS required");
    expect(() => assertHttpsUrl("not a url")).toThrow("not a URL");
  });
});

describe("sha256Of", () => {
  test("hashes bytes, not a path", () => {
    expect(sha256Of(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
