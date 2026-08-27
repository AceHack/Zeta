import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GO_PAGES_ASSET, GO_PAGES_BRIDGE, PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;
const CURRENT_PROPOSAL_MARKER = "authorize this device";
const RETIRED_PROPOSAL_MARKER = "GitHub's own issue form authenticates";

export type PagesArtifactEvidence = Readonly<{
  readonly entryAsset: string;
  readonly authorizationAsset: string;
  readonly evidenceRouteAsset: string;
  readonly evidenceReaderAsset: string;
  readonly proposalMarker: typeof CURRENT_PROPOSAL_MARKER;
  readonly wasmAssets: readonly string[];
  /**
   * DERIVED BY LOOKING, never declared. The Go substrate is built during the Pages
   * build rather than committed, so whether it shipped is a property of THIS artifact.
   * Writing `"published"` unconditionally would reproduce, in the evidence file, the
   * exact defect this field exists to close in the UI.
   */
  readonly goOracle: "published" | "absent";
}>;

function assertWasmMagic(file: string): void {
  const bytes = readFileSync(file);
  if (bytes.length < WASM_MAGIC.length || !WASM_MAGIC.every((value, index) => bytes[index] === value)) {
    throw new Error(`teaching error: published Pages asset is not a WebAssembly binary: ${file}`);
  }
}

/**
 * Proves the exact artifact uploaded to Pages contains the current verifier UI and
 * repository-owned WASM bytes. It intentionally checks built output, not source,
 * so a stale copy path cannot self-certify from current TypeScript source.
 */
export function verifyPagesArtifact(artifactRoot: string): PagesArtifactEvidence {
  const indexPath = join(artifactRoot, "index.html");
  const index = readFileSync(indexPath, "utf8");
  const entryMatch = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(index);
  if (!entryMatch?.[1]) throw new Error("teaching error: Pages index does not reference a hashed JavaScript entry asset");
  const entryAsset = entryMatch[1];
  const assetsDirectory = join(artifactRoot, "assets");
  const scriptAssets = readdirSync(assetsDirectory).filter(asset => asset.endsWith(".js"));
  const scripts = scriptAssets.map(asset => ({ asset, body: readFileSync(join(assetsDirectory, asset), "utf8") }));
  const authorizationAsset = scripts.find(script => script.body.includes(CURRENT_PROPOSAL_MARKER))?.asset;
  if (!authorizationAsset) {
    throw new Error("teaching error: Pages artifact omits the current one-time device authorization control");
  }
  const evidenceRouteAsset = scripts.find(script => script.body.includes("evidence-seam"))?.asset;
  if (!evidenceRouteAsset) {
    throw new Error("teaching error: Pages artifact omits the evidence-room route");
  }
  const evidenceReaderAsset = scripts.find(script => script.body.includes("room-evidence"))?.asset;
  if (!evidenceReaderAsset) {
    throw new Error("teaching error: Pages artifact omits the durable room-evidence reader");
  }
  if (scripts.some(script => script.body.includes(RETIRED_PROPOSAL_MARKER))) {
    throw new Error("teaching error: Pages artifact still contains the retired GitHub issue-form proposal transport");
  }
  for (const asset of PAGES_WASM_ASSETS) assertWasmMagic(join(artifactRoot, asset.published));

  // The Go pair: present ⇒ verified and listed; absent ⇒ said out loud. A module
  // published without its runtime bridge counts as ABSENT, because it cannot run —
  // "the file is there" is not the property the page depends on.
  const goModule = join(artifactRoot, GO_PAGES_ASSET.published);
  const goBridge = join(artifactRoot, GO_PAGES_BRIDGE.published);
  const goPublished = existsSync(goModule) && existsSync(goBridge);
  if (goPublished) assertWasmMagic(goModule);

  return {
    entryAsset,
    authorizationAsset,
    evidenceRouteAsset,
    evidenceReaderAsset,
    proposalMarker: CURRENT_PROPOSAL_MARKER,
    wasmAssets: [
      ...PAGES_WASM_ASSETS.map(asset => asset.published),
      ...(goPublished ? [GO_PAGES_ASSET.published, GO_PAGES_BRIDGE.published] : []),
    ],
    goOracle: goPublished ? "published" : "absent",
  };
}

export function writePagesArtifactEvidence(artifactRoot: string, revision: string): PagesArtifactEvidence {
  const evidence = verifyPagesArtifact(artifactRoot);
  writeFileSync(
    join(artifactRoot, "identity-dla-build-evidence.json"),
    `${JSON.stringify({ schema: "zeta.identity-dla-pages-artifact.v1", revision, ...evidence }, null, 2)}\n`,
    "utf8",
  );
  return evidence;
}
