/**
 * The staging side of "the status is derived": whether the Go oracle ships is decided by
 * looking at the tree, and the evidence file says which way it went.
 *
 * The controlling case is the MUTATION test — the same code path with the Go module
 * removed — because a staging step hardcoded to "published" passes the positive test and
 * only that one can fail it.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyPagesArtifact } from "./identity-dla-pages-artifact";
import { GO_PAGES_ASSET, GO_PAGES_BRIDGE, PAGES_WASM_ASSETS, stagePagesWasmAssets } from "./identity-dla-pages-wasm-assets";

const realRepoRoot = join(import.meta.dir, "..", "..", "..");

/**
 * A 57-byte stand-in for the Go module, hex-in-source so the fixture stays readable and
 * diffable (`.claude/rules/no-binary-in-proof-lineage.md`).
 *
 * WHY A STAND-IN: the real `dla-canonical-go.wasm` is ~1.9 MB and is BUILT, so on a
 * runner where the Pages Go build has not happened it does not exist — and a positive
 * test gated on "skip unless it was built" is a check that never runs looking like one
 * that passed. This module carries exactly the ABI the staging step demands
 * (`run` / `resume` / `mem`), so the PUBLISHED path is exercised on every machine.
 */
const GO_SHAPED_MODULE_HEX = [
  "00 61 73 6d 01 00 00 00", // magic + version
  "01 04 01 60 00 00", // type section: one () -> () signature
  "03 03 02 00 00", // function section: two functions of that type
  "05 03 01 00 01", // memory section: one memory, min 1 page
  "07 16 03 03 72 75 6e 00 00 06 72 65 73 75 6d 65 00 01 03 6d 65 6d 02 00", // exports: run, resume, mem
  "0a 07 02 02 00 0b 02 00 0b", // code section: two empty bodies
].join(" ");

const goShapedModule = Uint8Array.from(GO_SHAPED_MODULE_HEX.split(/\s+/).map((byte) => parseInt(byte, 16)));

/**
 * A repo-shaped fixture: the six committed modules copied in, plus whichever half of the
 * Go pair the case under test wants. Copying rather than pointing at the real tree is
 * what lets a case DELETE the Go module without touching the developer's checkout.
 */
function fixtureRepo(options: { readonly goModule: boolean; readonly goBridge: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-pages-go-"));
  for (const asset of PAGES_WASM_ASSETS) {
    const target = join(root, asset.source);
    mkdirSync(join(target, ".."), { recursive: true });
    cpSync(join(realRepoRoot, asset.source), target);
  }
  if (options.goModule) {
    const target = join(root, GO_PAGES_ASSET.source);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, goShapedModule);
  }
  if (options.goBridge) {
    const target = join(root, GO_PAGES_BRIDGE.source);
    mkdirSync(join(target, ".."), { recursive: true });
    // Contents are irrelevant to staging; only the pairing is.
    writeFileSync(target, "globalThis.Go = class Go {};\n", "utf8");
  }
  return root;
}

/** The parts of a built site the evidence writer insists on, minus the WASM. */
function fixtureArtifact(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-pages-artifact-"));
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), `<script src="/assets/index-abc123.js"></script>`, "utf8");
  writeFileSync(join(root, "assets", "index-abc123.js"), `console.log("authorize this device evidence-seam");`, "utf8");
  writeFileSync(join(root, "assets", "EvidenceRoomPage-abc123.js"), `fetch("docs/room-evidence/index.json");`, "utf8");
  return root;
}

const goModuleIsBuilt = existsSync(join(realRepoRoot, GO_PAGES_ASSET.source));

describe("Go oracle staging is derived from the tree", () => {
  test("both halves present — the pair is staged and the evidence says published", () => {
    const repo = fixtureRepo({ goModule: true, goBridge: true });
    const artifact = fixtureArtifact();
    try {
      const staging = stagePagesWasmAssets(repo, artifact);
      expect(staging.absent).toEqual([]);
      expect(staging.staged).toContain("wasm/dla-go.wasm");
      expect(staging.staged).toContain("wasm/wasm_exec.js");
      expect(staging.staged.length).toBe(PAGES_WASM_ASSETS.length + 2);
      const evidence = verifyPagesArtifact(artifact);
      expect(evidence.goOracle).toBe("published");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(artifact, { recursive: true, force: true });
    }
  });

  test("MUTATION: the Pages Go build did not run — six assets, and the artifact says absent", () => {
    const repo = fixtureRepo({ goModule: false, goBridge: false });
    const artifact = fixtureArtifact();
    try {
      const staging = stagePagesWasmAssets(repo, artifact);
      expect(staging.staged.length).toBe(PAGES_WASM_ASSETS.length);
      expect(staging.staged).not.toContain("wasm/dla-go.wasm");
      expect(staging.absent.length).toBe(1);
      expect(staging.absent[0]).toContain("the Pages Go build did not run");
      expect(existsSync(join(artifact, "wasm", "dla-go.wasm"))).toBeFalse();
      const evidence = verifyPagesArtifact(artifact);
      expect(evidence.goOracle).toBe("absent");
      expect(evidence.wasmAssets.length).toBe(PAGES_WASM_ASSETS.length);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(artifact, { recursive: true, force: true });
    }
  });

  test("MUTATION: module without its bridge is ABSENT, not published", () => {
    const repo = fixtureRepo({ goModule: true, goBridge: false });
    const artifact = fixtureArtifact();
    try {
      const staging = stagePagesWasmAssets(repo, artifact);
      expect(staging.staged.length).toBe(PAGES_WASM_ASSETS.length);
      expect(staging.absent[0]).toContain("Go runtime bridge");
      expect(verifyPagesArtifact(artifact).goOracle).toBe("absent");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(artifact, { recursive: true, force: true });
    }
  });

  test("MUTATION: a bridge published beside a MISSING module is still absent", () => {
    const repo = fixtureRepo({ goModule: false, goBridge: true });
    const artifact = fixtureArtifact();
    try {
      const staging = stagePagesWasmAssets(repo, artifact);
      expect(staging.absent[0]).toContain("the Pages Go build did not run");
      expect(verifyPagesArtifact(artifact).goOracle).toBe("absent");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(artifact, { recursive: true, force: true });
    }
  });

  test("the declared ABI is the Go runtime's, and a module lacking it is refused", () => {
    // Not the DLA functions: a Go module exposes those through `globalThis` at run time,
    // so `run`/`resume`/`mem` are what distinguish a Go module from 1.9 MB of anything.
    const exports = new Set(
      WebAssembly.Module.exports(new WebAssembly.Module(goShapedModule)).map((entry) => entry.name),
    );
    for (const name of GO_PAGES_ASSET.requiredExports) expect(exports.has(name)).toBeTrue();

    // NEGATIVE CONTROL: a WebAssembly module with the right magic and the wrong ABI must
    // not be staged as the Go oracle — magic alone is not identification.
    const repo = fixtureRepo({ goModule: false, goBridge: true });
    const artifact = fixtureArtifact();
    try {
      const impostor = join(repo, GO_PAGES_ASSET.source);
      mkdirSync(join(impostor, ".."), { recursive: true });
      cpSync(join(realRepoRoot, PAGES_WASM_ASSETS[0]!.source), impostor);
      expect(() => stagePagesWasmAssets(repo, artifact)).toThrow(/lacks required exports/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(artifact, { recursive: true, force: true });
    }
  });

  test("when the real module has been built, it is a Go module of the expected scale", () => {
    if (!goModuleIsBuilt) {
      // Not a skip: an explicit, visible statement that the 1.9 MB artefact is absent on
      // this machine. The four cases above already cover both staging outcomes.
      expect(goModuleIsBuilt).toBeFalse();
      return;
    }
    const bytes = readFileSync(join(realRepoRoot, GO_PAGES_ASSET.source));
    expect(bytes.length).toBeGreaterThan(1_000_000);
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
    const exports = new Set(
      WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map((entry) => entry.name),
    );
    for (const name of GO_PAGES_ASSET.requiredExports) expect(exports.has(name)).toBeTrue();
  });
});
