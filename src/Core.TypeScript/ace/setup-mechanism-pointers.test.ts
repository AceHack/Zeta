import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePin } from "./setup-realizers/unhashed-pin.ts";
import { parseMechanismManifest } from "./setup-manifest.ts";
import { listSetupRealizerIds } from "./setup-realizers/index.ts";
import {
  buildSetupMechanismPointers,
  bunMechanismRealizer,
  serializeSetupMechanismPointers,
} from "./setup-mechanism-pointers.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const pointersJsonPath = join(repoRoot, "tools", "setup", "ace-mechanism-pointers.json");

describe("setup mechanism pointers (Ace time-crystal deps)", () => {
  // The two jar rows were deleted (081M001E114087G0R001AZF4KD): nothing read
  // what they wrote, and their URL was a re-uploadable tag. The invariant they
  // failed stayed behind, vacuous for as long as the manifest held no rows --
  // and stopped being vacuous on 081M23AST90087G0R00150MK76, which added the
  // Alloy jar row to a path the runners really do load under a digest that
  // really does pin it. This assertion now has a subject.
  // A DIGEST *OR* A DECLARED REASON FOR NOT HAVING ONE. Aaron 2026-09-10: "we need to
  // support non hashed dependencies they are just not the preferred and need to be handled
  // separately." This assertion was the THIRD surface encoding the mandatory-digest
  // assumption -- after the realizer and `lint-verifier-jar-provenance` -- and it is the one
  // that caught the gap, which is the assertion doing its job rather than being wrong.
  //
  // It does not weaken into "anything goes": every row must still resolve under the SHARED
  // vocabulary, so a row that is neither a valid digest nor a properly-declared tag-only /
  // unpinned row still fails here, with `resolvePin`'s own message.
  test("every from-url row carries an https URL and a resolvable pin", () => {
    const text = readFileSync(join(repoRoot, "tools/setup/manifests/from-url"), "utf8");
    const rows = parseMechanismManifest(text);
    // Without a subject this test is vacuous; it went vacuous once before (see above).
    expect(rows.length).toBeGreaterThan(0);
    for (const entry of rows) {
      const url = entry.tokens[1] ?? "";
      expect(url).toMatch(/^https:\/\//);
      // Throws on an undeclared or malformed pin, which is the refusal we want kept.
      const pin = resolvePin("from-url", entry.tokens[0] ?? "row", url, entry.attrs as never);
      expect(["digest", "tag-only", "unpinned"]).toContain(pin.kind);
      if (pin.kind === "digest") expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("at least one from-url row still carries a real digest", () => {
    // The counterweight to the relaxation above: if every row drifted to tag-only, the
    // assertion would still pass while the repo had stopped pinning anything at all.
    const text = readFileSync(join(repoRoot, "tools/setup/manifests/from-url"), "utf8");
    const digests = parseMechanismManifest(text).filter((e) => /^[0-9a-f]{64}$/u.test(e.attrs.sha256 ?? ""));
    expect(digests.length).toBeGreaterThan(0);
  });

  test("from-shim includes jammy cvc5 alias", () => {
    const text = readFileSync(join(repoRoot, "tools/setup/manifests/from-shim"), "utf8");
    const entries = parseMechanismManifest(text);
    expect(entries.some((e) => e.tokens.join(" ") === "cvc5 cvc4" && e.attrs.when === "ubuntu-22.04")).toBe(
      true,
    );
  });

  test("buildSetupMechanismPointers covers all Bun setup realizers", () => {
    const pointers = buildSetupMechanismPointers();
    expect(pointers.length).toBeGreaterThanOrEqual(13);
    expect(pointers.every((p) => p.realizer.startsWith("src/Core.TypeScript/ace/setup-realizers/"))).toBe(
      true,
    );
    for (const p of pointers) {
      expect(p.schema).toBe("zeta.ace.package-manager-pointers.v1");
      // from-url left this set on 081M23AST90087G0R00150MK76: it now carries the
      // digest-pinned Alloy jar row, so it is held to the same has-dependencies
      // bar as every other mechanism rather than to the empty-manifest exemption.
      if (
        p.manifest === "tools/setup/manifests/from-dotnet-workload"
        || p.manifest === "tools/setup/manifests/from-deb"
      ) {
        expect(p.dependencies.length).toBe(0);
      } else {
        expect(p.dependencies.length).toBeGreaterThan(0);
      }
      for (const dep of p.dependencies) {
        expect(dep.update).toBeDefined();
      }
    }
  });

  test("every registered Bun realizer has an Ace pointer", () => {
    const pointers = buildSetupMechanismPointers();
    const realizers = new Set(pointers.map((p) => p.realizer));
    for (const id of listSetupRealizerIds()) {
      expect(realizers.has(bunMechanismRealizer(id))).toBe(true);
    }
  });

  test("ace-mechanism-pointers.json matches generated pointers", () => {
    const expected = serializeSetupMechanismPointers();
    const onDisk = readFileSync(pointersJsonPath, "utf8").trim();
    expect(onDisk).toBe(expected.trim());
  });
});
