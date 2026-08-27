import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";
import { verifyPagesArtifact } from "./identity-dla-pages-artifact";

const roots: string[] = [];

function fixture(
  options: {
    readonly currentMarker?: boolean;
    readonly evidenceRoom?: boolean;
    readonly retiredMarker?: boolean;
    readonly validWasm?: boolean;
  } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-pages-artifact-"));
  roots.push(root);
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), '<script type="module" src="/assets/index-fixture.js"></script>');
  writeFileSync(join(root, "assets", "index-fixture.js"), "import('./PasskeyProposalPanel-fixture.js') evidence-seam");
  writeFileSync(
    join(root, "assets", "PasskeyProposalPanel-fixture.js"),
    `${options.currentMarker === false ? "" : "authorize this device"}${options.retiredMarker ? " GitHub's own issue form authenticates" : ""}`,
  );
  writeFileSync(
    join(root, "assets", "EvidenceRoomPage-fixture.js"),
    options.evidenceRoom === false ? "missing reader" : "evidence-seam docs/room-evidence/index.json",
  );
  for (const asset of PAGES_WASM_ASSETS) {
    const target = join(root, asset.published);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, options.validWasm === false ? "<html>stale</html>" : Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("identity-dla Pages artifact verification", () => {
  test("accepts a current lazy authorization chunk and repository-owned WASM bytes", () => {
    const evidence = verifyPagesArtifact(fixture());
    expect(evidence.proposalMarker).toBe("authorize this device");
    expect(evidence.authorizationAsset).toBe("PasskeyProposalPanel-fixture.js");
    expect(evidence.evidenceRouteAsset).toBe("index-fixture.js");
    expect(evidence.evidenceReaderAsset).toBe("EvidenceRoomPage-fixture.js");
    expect(evidence.wasmAssets).toHaveLength(6);
  });

  test("FAULT INJECTION: rejects a bundle that lost the current device authorization UI", () => {
    expect(() => verifyPagesArtifact(fixture({ currentMarker: false }))).toThrow("one-time device authorization");
  });

  test("FAULT INJECTION: rejects the retired issue-form bundle", () => {
    expect(() => verifyPagesArtifact(fixture({ retiredMarker: true }))).toThrow("retired GitHub issue-form");
  });

  test("FAULT INJECTION: rejects HTML or other stale bytes in a published WASM path", () => {
    expect(() => verifyPagesArtifact(fixture({ validWasm: false }))).toThrow("not a WebAssembly binary");
  });

  test("FAULT INJECTION: rejects a bundle that omitted the durable room-evidence reader", () => {
    expect(() => verifyPagesArtifact(fixture({ evidenceRoom: false }))).toThrow("durable room-evidence reader");
  });
});
