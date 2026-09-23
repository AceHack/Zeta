import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";
import { scriptDeclaresEvidenceRoute, verifyPagesArtifact } from "./identity-dla-pages-artifact";

const roots: string[] = [];

function fixture(
  options: {
    readonly currentMarker?: boolean;
    readonly evidenceRoom?: boolean;
    readonly receiptDetail?: boolean;
    readonly retiredMarker?: boolean;
    readonly sourceManifest?: boolean;
    readonly validWasm?: boolean;
  } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-pages-artifact-"));
  roots.push(root);
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), '<script type="module" src="/assets/index-fixture.js"></script>');
  writeFileSync(
    join(root, "assets", "index-fixture.js"),
    `import('./PasskeyProposalPanel-fixture.js') evidence-seam ${options.receiptDetail === false ? "" : "evidence-seam/receipt/"} ${options.sourceManifest === false ? "" : "evidence-seam/sources"}`,
  );
  writeFileSync(
    join(root, "assets", "PasskeyProposalPanel-fixture.js"),
    `${options.currentMarker === false ? "" : "authorize this device"}${options.retiredMarker ? " GitHub's own issue form authenticates" : ""}`,
  );
  writeFileSync(
    join(root, "assets", "EvidenceRoomPage-fixture.js"),
    options.evidenceRoom === false ? "missing reader" : "evidence-seam docs/room-evidence/index.json",
  );
  writeFileSync(
    join(root, "assets", "EvidenceReceiptDetailPage-fixture.js"),
    options.receiptDetail === false ? "missing receipt page" : "COPY RECEIPT ID",
  );
  writeFileSync(
    join(root, "assets", "EvidenceSourceManifestPage-fixture.js"),
    options.sourceManifest === false ? "missing source manifest" : "SOURCE MANIFEST",
  );
  for (const asset of PAGES_WASM_ASSETS) {
    const target = join(root, asset.published);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(
      target,
      options.validWasm === false
        ? "<html>stale</html>"
        : Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    );
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("scriptDeclaresEvidenceRoute — readdir order is not a contract (081M35PQN5Y087G0R000YCPATJ)", () => {
  const routeBody =
    "import('./PasskeyProposalPanel-fixture.js') evidence-seam evidence-seam/receipt/ evidence-seam/sources";
  const readerBody = "evidence-seam docs/room-evidence/index.json";

  test("the index route chunk qualifies; the reader chunk does not", () => {
    expect(scriptDeclaresEvidenceRoute(routeBody)).toBe(true);
    expect(scriptDeclaresEvidenceRoute(readerBody)).toBe(false);
  });

  test("reader-first order still selects the route chunk — the live CI fail on b17179b081", () => {
    const scripts = [
      { asset: "EvidenceRoomPage-fixture.js", body: readerBody },
      { asset: "index-fixture.js", body: routeBody },
    ];
    expect(scripts.find((script) => scriptDeclaresEvidenceRoute(script.body))?.asset).toBe("index-fixture.js");
  });
});

describe("identity-dla Pages artifact verification", () => {
  test("accepts a current lazy authorization chunk and repository-owned WASM bytes", () => {
    const evidence = verifyPagesArtifact(fixture());
    expect(evidence.proposalMarker).toBe("authorize this device");
    expect(evidence.authorizationAsset).toBe("PasskeyProposalPanel-fixture.js");
    expect(evidence.evidenceRouteAsset).toBe("index-fixture.js");
    expect(evidence.evidenceReaderAsset).toBe("EvidenceRoomPage-fixture.js");
    expect(evidence.receiptDetailAsset).toBe("EvidenceReceiptDetailPage-fixture.js");
    expect(evidence.sourceManifestAsset).toBe("EvidenceSourceManifestPage-fixture.js");
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

  test("FAULT INJECTION: rejects a bundle that omitted the receipt-detail lazy page", () => {
    expect(() => verifyPagesArtifact(fixture({ receiptDetail: false }))).toThrow("receipt-detail");
  });

  test("FAULT INJECTION: rejects a bundle that omitted the source-manifest lazy page", () => {
    expect(() => verifyPagesArtifact(fixture({ sourceManifest: false }))).toThrow("source-manifest");
  });
});
