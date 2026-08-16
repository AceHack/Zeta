import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;
const CURRENT_PROPOSAL_MARKER = "authorize this device";
const RETIRED_PROPOSAL_MARKER = "GitHub's own issue form authenticates";

export type PagesArtifactEvidence = Readonly<{
  readonly entryAsset: string;
  readonly proposalMarker: typeof CURRENT_PROPOSAL_MARKER;
  readonly wasmAssets: readonly string[];
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
  const entry = readFileSync(join(artifactRoot, "assets", entryAsset), "utf8");
  if (!entry.includes(CURRENT_PROPOSAL_MARKER)) {
    throw new Error("teaching error: Pages entry omits the current one-time device authorization control");
  }
  if (entry.includes(RETIRED_PROPOSAL_MARKER)) {
    throw new Error("teaching error: Pages entry still contains the retired GitHub issue-form proposal transport");
  }
  for (const asset of PAGES_WASM_ASSETS) assertWasmMagic(join(artifactRoot, asset.published));
  return {
    entryAsset,
    proposalMarker: CURRENT_PROPOSAL_MARKER,
    wasmAssets: PAGES_WASM_ASSETS.map(asset => asset.published),
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
