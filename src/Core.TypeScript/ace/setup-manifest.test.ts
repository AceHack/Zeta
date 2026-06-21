import { describe, expect, test } from "bun:test";
import { parseSetupManifest, parseMechanismManifest, pointerFromSetupManifest, pointerFromMechanismManifest } from "./setup-manifest.ts";

describe("setup manifest parser", () => {
  test("parses specs and key-value attrs while preserving q# values", () => {
    const entries = parseSetupManifest(`
# header comment
qdk[azure]==1.29.1     role=reference-oracle lang=q#
qsharp==1.29.1         role=reference-oracle lang=q# # trailing comment
azure-quantum==3.10.0  role=reference-oracle lang=q#
`);

    expect(entries.map((entry) => entry.spec)).toEqual([
      "qdk[azure]==1.29.1",
      "qsharp==1.29.1",
      "azure-quantum==3.10.0",
    ]);
    expect(entries.map((entry) => entry.attrs.lang)).toEqual(["q#", "q#", "q#"]);
    expect(entries.map((entry) => entry.attrs.role)).toEqual([
      "reference-oracle",
      "reference-oracle",
      "reference-oracle",
    ]);
  });

  test("parseMechanismManifest splits tokens and attrs", () => {
    const entries = parseMechanismManifest(
      "tools/tla/x.jar https://example.com/x.jar requires=java role=formal-verifier\n",
    );
    expect(entries[0]!.tokens).toEqual(["tools/tla/x.jar", "https://example.com/x.jar"]);
    expect(entries[0]!.attrs.requires).toBe("java");
    expect(entries[0]!.attrs.role).toBe("formal-verifier");
  });

  test("pointerFromMechanismManifest sets ecosystem to mechanism and update policy", () => {
    const pointer = pointerFromMechanismManifest({
      mechanism: "from-url",
      text: "dest path https://x/y requires=java\n",
      purpose: "test",
      realizer: "tools/setup/mechanisms/from-url.sh",
      manifest: "tools/setup/manifests/from-url",
    });
    expect(pointer.dependencies[0]).toEqual({
      ecosystem: "from-url",
      spec: "dest path https://x/y",
      update: "pinned-url",
    });
  });

  test("builds package-manager pointer dependencies from a setup manifest", () => {
    const pointer = pointerFromSetupManifest({
      text: "qsharp==1.29.1 role=reference-oracle lang=q#\n",
      ecosystem: "pypi",
      purpose: "Q# oracle",
      realizer: "tools/setup/common/quantum.sh",
      manifest: "tools/setup/manifests/quantum",
      optIn: ["ZETA_INSTALL_QUANTUM=1"],
    });

    expect(pointer).toEqual({
      schema: "zeta.ace.package-manager-pointers.v1",
      purpose: "Q# oracle",
      realizer: "tools/setup/common/quantum.sh",
      manifest: "tools/setup/manifests/quantum",
      opt_in: ["ZETA_INSTALL_QUANTUM=1"],
      dependencies: [
        {
          ecosystem: "pypi",
          spec: "qsharp==1.29.1",
          role: "reference-oracle",
          lang: "q#",
          update: "pinned",
        },
      ],
    });
  });
});
