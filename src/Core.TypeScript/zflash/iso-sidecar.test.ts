/**
 * iso-sidecar.test.ts
 *
 * The falsifier for the half of the integrity gate that had nothing to check.
 *
 * iso-integrity.test.ts already pins the REFUSALS: no manifest, wrong digest,
 * ISO not listed. All correct, and all of them fired on zflash's own happy
 * path, because the auto-pull that both metal runbooks recommend copied the
 * `.iso` out of the CI download and deleted the sidecar with the temp dir.
 *
 * MEASURED ON main BEFORE THIS FILE EXISTED (e15299e0), against the real
 * artifacts of run 32461224707:
 *
 *   as shipped ......................... manifest-missing
 *   sidecar copied verbatim ............ iso-not-in-manifest
 *   sidecar filename field rewritten ... verified
 *
 * The middle line is why the rewrite is load-bearing. CI publishes
 * `nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso`; the auto-pull renames
 * it to `zeta-installer-25.11-ci<run>-<date>-<arch>.iso`; and the gate looks the
 * file up by EXACT basename. Copying the publisher's line unchanged attests a
 * filename that is not on disk.
 *
 * The fixtures below use the REAL artifact names and the REAL digests from run
 * 32461224707 rather than invented ones, so a change to the CI publishing shape
 * shows up here as a test failure rather than as a surprise on metal.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  selectManifestForIso,
  rewriteManifestForLocalName,
  materializeIsoSidecar,
  establishIsoIntegrity,
  realIsoIntegrityIo,
  realSidecarIo,
  type SidecarIo,
} from "./iso-integrity.ts";
import { stampedCiIsoFileName } from "./lib.ts";

// ── real names and digests from build-ai-cluster-iso run 32461224707 ────────
const UP_X86 = "nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso";
const UP_ARM = "nixos-minimal-25.11.20260522.b77b3de-aarch64-linux.iso";
const SHA_X86 = "74c14c791b8ccdca1c21ba9928c63c241b4350c1758df791795cc273cf706c4e";
const SHA_ARM = "3ca526648c8e7057bc5d4b3c8dcd685aa7e7f32bf0ff92a6ded66f02d3dbd75b";

/**
 * The layout `gh run download <id> --dir D` actually produces for that run.
 *
 * Each artifact becomes a directory NAMED after the artifact, so the ISO and
 * its sidecar are SIBLINGS, never neighbours. Note the aarch64 artifact
 * directory is named `zeta-installer-aarch64-iso` while the file inside is
 * `nixos-minimal-…-aarch64-linux.iso`: the directory name does not describe its
 * contents, which is why nothing here may match on it.
 */
const CI_DOWNLOAD_TREE: readonly string[] = [
  `/dl/${UP_X86}/${UP_X86}`,
  `/dl/${UP_X86}.sha256/${UP_X86}.sha256`,
  `/dl/${UP_X86}.cosign/${UP_X86}.cosign`,
  `/dl/zeta-installer-aarch64-iso/${UP_ARM}`,
  `/dl/zeta-installer-aarch64-iso.sha256/${UP_ARM}.sha256`,
  "/dl/qemu-full-install-serial-log/serial.log",
];

describe("selectManifestForIso finds the sidecar in the tree gh actually produces", () => {
  test("the x86_64 sidecar is found, in a SIBLING directory of the ISO", () => {
    const r = selectManifestForIso(CI_DOWNLOAD_TREE, `/dl/${UP_X86}/${UP_X86}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(`/dl/${UP_X86}.sha256/${UP_X86}.sha256`);
  });

  test("the aarch64 sidecar is found even though its artifact directory is named something else", () => {
    const r = selectManifestForIso(CI_DOWNLOAD_TREE, `/dl/zeta-installer-aarch64-iso/${UP_ARM}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(`/dl/zeta-installer-aarch64-iso.sha256/${UP_ARM}.sha256`);
  });

  test("the two arches do not get each other's manifest", () => {
    const x = selectManifestForIso(CI_DOWNLOAD_TREE, `/dl/${UP_X86}/${UP_X86}`);
    const a = selectManifestForIso(CI_DOWNLOAD_TREE, `/dl/zeta-installer-aarch64-iso/${UP_ARM}`);
    expect(x.ok && a.ok && x.path === a.path).toBe(false);
  });

  test("a `.cosign` file is not mistaken for a manifest", () => {
    const r = selectManifestForIso([`/dl/x/${UP_X86}.cosign`], `/dl/x/${UP_X86}`);
    expect(r.ok).toBe(false);
  });

  test("a bare SHA256SUMS is accepted as a fallback", () => {
    const r = selectManifestForIso(["/dl/a/SHA256SUMS"], `/dl/a/${UP_X86}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/dl/a/SHA256SUMS");
  });

  test("the exact sidecar WINS over a SHA256SUMS that may cover several images", () => {
    const r = selectManifestForIso(
      ["/dl/a/SHA256SUMS", `/dl/b/${UP_X86}.sha256`],
      `/dl/a/${UP_X86}`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(`/dl/b/${UP_X86}.sha256`);
  });

  test("no manifest at all is a refusal that names what it looked for", () => {
    const r = selectManifestForIso([`/dl/a/${UP_X86}`], `/dl/a/${UP_X86}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.searched).toContain(`${UP_X86}.sha256`);
  });
});

describe("rewriteManifestForLocalName transcribes the digest and edits only the name", () => {
  const local = stampedCiIsoFileName("25.11", 32461224707, "2026-08-20T00:00:00Z", "x86_64");

  test("the local name is the one the gate will look up", () => {
    const r = rewriteManifestForLocalName(`${SHA_X86}  ${UP_X86}\n`, UP_X86, local);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe(`${SHA_X86}  ${local}\n`);
      expect(r.sha256).toBe(SHA_X86);
    }
  });

  test("THE DIGEST IS COPIED, NEVER RECOMPUTED", () => {
    // If this function ever hashed the local bytes instead of transcribing the
    // publisher's digest, the gate downstream would pass unconditionally — a
    // check that cannot fail. Feeding it a manifest whose digest is knowably
    // wrong must therefore produce that wrong digest, unchanged.
    const bogus = "0".repeat(64);
    const r = rewriteManifestForLocalName(`${bogus}  ${UP_X86}\n`, UP_X86, local);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sha256).toBe(bogus);
  });

  test("a multi-entry SHA256SUMS yields only the entry for THIS iso", () => {
    const text = `${SHA_X86}  ${UP_X86}\n${SHA_ARM}  ${UP_ARM}\n`;
    const r = rewriteManifestForLocalName(text, UP_ARM, "local-arm.iso");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe(`${SHA_ARM}  local-arm.iso\n`);
  });

  test("an entry we did not download is a refusal, not an invented line", () => {
    const r = rewriteManifestForLocalName(`${SHA_ARM}  ${UP_ARM}\n`, UP_X86, local);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("iso-not-in-manifest");
  });

  test("an unparseable manifest is a refusal", () => {
    const r = rewriteManifestForLocalName("this is not a checksum file\n", UP_X86, local);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("manifest-unparseable");
  });

  test("`*`-prefixed binary-mode entries are handled (GNU coreutils shape)", () => {
    const r = rewriteManifestForLocalName(`${SHA_X86} *${UP_X86}\n`, UP_X86, local);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sha256).toBe(SHA_X86);
  });
});

/** An in-memory SidecarIo so both failure branches are reachable without a filesystem. */
function fakeIo(files: Record<string, string>, opts: { unreadable?: string; unwritable?: boolean } = {}): {
  io: SidecarIo;
  written: Record<string, string>;
} {
  const written: Record<string, string> = {};
  return {
    written,
    io: {
      exists: (p) => p in files || p in written,
      readText: (p) => {
        if (opts.unreadable === p) throw new Error("EACCES: permission denied");
        if (p in written) return written[p]!;
        const v = files[p];
        if (v === undefined) throw new Error("ENOENT: " + p);
        return v;
      },
      writeText: (p, t) => {
        if (opts.unwritable === true) throw new Error("EROFS: read-only file system");
        written[p] = t;
      },
    },
  };
}

describe("materializeIsoSidecar", () => {
  const isoSrc = `/dl/${UP_X86}/${UP_X86}`;
  const isoDest = "/home/op/Downloads/zeta-installer-25.11-ci32461224707-2026-08-20-x86_64.iso";
  const manifestPath = `/dl/${UP_X86}.sha256/${UP_X86}.sha256`;

  test("writes the sidecar beside the LOCAL copy, named for the local copy", () => {
    const { io, written } = fakeIo({ [manifestPath]: `${SHA_X86}  ${UP_X86}\n` });
    const r = materializeIsoSidecar(io, { downloadedFiles: CI_DOWNLOAD_TREE, isoSrcPath: isoSrc, isoDestPath: isoDest });
    expect(r.ok).toBe(true);
    expect(written[isoDest + ".sha256"]).toBe(`${SHA_X86}  zeta-installer-25.11-ci32461224707-2026-08-20-x86_64.iso\n`);
  });

  test("says out loud that the digest came from CI rather than from local bytes", () => {
    const { io } = fakeIo({ [manifestPath]: `${SHA_X86}  ${UP_X86}\n` });
    const r = materializeIsoSidecar(io, { downloadedFiles: CI_DOWNLOAD_TREE, isoSrcPath: isoSrc, isoDestPath: isoDest });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.report).toContain("not recomputed locally");
  });

  test("idempotent: an identical existing sidecar is not rewritten", () => {
    const sidecar = isoDest + ".sha256";
    const { io, written } = fakeIo({
      [manifestPath]: `${SHA_X86}  ${UP_X86}\n`,
      [sidecar]: `${SHA_X86}  zeta-installer-25.11-ci32461224707-2026-08-20-x86_64.iso\n`,
    });
    const r = materializeIsoSidecar(io, { downloadedFiles: CI_DOWNLOAD_TREE, isoSrcPath: isoSrc, isoDestPath: isoDest });
    expect(r.ok).toBe(true);
    expect(Object.keys(written)).toEqual([]);
  });

  test("a download with no manifest REFUSES — it does not hash the ISO itself", () => {
    const { io, written } = fakeIo({});
    const r = materializeIsoSidecar(io, {
      downloadedFiles: [isoSrc],
      isoSrcPath: isoSrc,
      isoDestPath: isoDest,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-manifest-in-download");
    expect(Object.keys(written)).toEqual([]);
  });

  test("an unreadable manifest is distinguished from a missing one", () => {
    const { io } = fakeIo({ [manifestPath]: "x" }, { unreadable: manifestPath });
    const r = materializeIsoSidecar(io, { downloadedFiles: CI_DOWNLOAD_TREE, isoSrcPath: isoSrc, isoDestPath: isoDest });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("manifest-unreadable");
  });

  test("an unwritable Downloads folder is reported, not swallowed", () => {
    const { io } = fakeIo({ [manifestPath]: `${SHA_X86}  ${UP_X86}\n` }, { unwritable: true });
    const r = materializeIsoSidecar(io, { downloadedFiles: CI_DOWNLOAD_TREE, isoSrcPath: isoSrc, isoDestPath: isoDest });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("sidecar-unwritable");
  });
});

describe("END TO END: the auto-pull's output satisfies the gate it has to pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "zflash-sidecar-e2e-"));

  test("pull, rename, materialise, verify — the whole bare-zflash path", async () => {
    // Stand up the download tree gh produces, with a small stand-in "ISO" whose
    // real digest goes in the manifest so the gate has something true to check.
    const bytes = "pretend-iso-bytes-for-the-e2e";
    const digest = createHash("sha256").update(bytes).digest("hex");
    const srcDir = join(dir, "dl", UP_X86);
    const manDir = join(dir, "dl", `${UP_X86}.sha256`);
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(manDir, { recursive: true });
    const isoSrc = join(srcDir, UP_X86);
    const manifest = join(manDir, `${UP_X86}.sha256`);
    writeFileSync(isoSrc, bytes);
    writeFileSync(manifest, `${digest}  ${UP_X86}\n`);

    // What the auto-pull does: copy under a run-stamped local name.
    const downloads = join(dir, "Downloads");
    mkdirSync(downloads, { recursive: true });
    const isoDest = join(downloads, stampedCiIsoFileName("25.11", 32461224707, "2026-08-20T00:00:00Z", "x86_64"));
    writeFileSync(isoDest, bytes);

    // WITHOUT the sidecar the gate refuses. Establishing that first is what
    // makes the pass below evidence rather than decoration.
    const before = await establishIsoIntegrity(isoDest, realIsoIntegrityIo());
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.reason).toBe("manifest-missing");

    const r = materializeIsoSidecar(realSidecarIo(), {
      downloadedFiles: [isoSrc, manifest],
      isoSrcPath: isoSrc,
      isoDestPath: isoDest,
    });
    expect(r.ok).toBe(true);

    const after = await establishIsoIntegrity(isoDest, realIsoIntegrityIo());
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.sha256).toBe(digest);
  });

  test("a VERBATIM sidecar copy would still refuse — the rename is why the rewrite exists", async () => {
    const bytes = "pretend-iso-bytes-verbatim";
    const digest = createHash("sha256").update(bytes).digest("hex");
    const downloads = join(dir, "Downloads2");
    mkdirSync(downloads, { recursive: true });
    const isoDest = join(downloads, stampedCiIsoFileName("25.11", 1, "2026-08-20T00:00:00Z", "x86_64"));
    writeFileSync(isoDest, bytes);
    // The publisher's line, unedited.
    writeFileSync(isoDest + ".sha256", `${digest}  ${UP_X86}\n`);
    const v = await establishIsoIntegrity(isoDest, realIsoIntegrityIo());
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("iso-not-in-manifest");
  });

  test("a TAMPERED iso still fails after the sidecar is materialised", async () => {
    // The gate must stay a gate. If materialisation ever hashed local bytes,
    // this is the test that would go green and should not.
    const downloads = join(dir, "Downloads3");
    mkdirSync(downloads, { recursive: true });
    const isoSrc = join(downloads, UP_X86);
    const manifest = isoSrc + ".sha256";
    writeFileSync(isoSrc, "the bytes CI built");
    writeFileSync(manifest, `${createHash("sha256").update("the bytes CI built").digest("hex")}  ${UP_X86}\n`);

    const isoDest = join(downloads, "zeta-installer-25.11-ci9-2026-08-20-x86_64.iso");
    writeFileSync(isoDest, "the bytes someone else substituted");

    const r = materializeIsoSidecar(realSidecarIo(), {
      downloadedFiles: [isoSrc, manifest],
      isoSrcPath: isoSrc,
      isoDestPath: isoDest,
    });
    expect(r.ok).toBe(true); // the sidecar is written from CI's digest

    const v = await establishIsoIntegrity(isoDest, realIsoIntegrityIo());
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("digest-mismatch");
  });

  process.on("exit", () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });
});

describe("the sidecar step is WIRED into the auto-pull, and the pull is REACHABLE", () => {
  const CLI = new URL("./cli.ts", import.meta.url).pathname;
  const src = readFileSync(CLI, "utf8");

  test("the auto-pull materialises a sidecar", () => {
    expect(src).toContain("materializeIsoSidecar(realSidecarIo()");
  });

  test("the sidecar step runs AFTER the ISO is copied to its local name", () => {
    const copyIdx = src.indexOf("copyFileSync(ciIsoSrc, dlDest)");
    const sidecarIdx = src.indexOf("materializeIsoSidecar(realSidecarIo()");
    expect(copyIdx).toBeGreaterThan(0);
    expect(sidecarIdx).toBeGreaterThan(copyIdx);
  });

  test("the list handed to the sidecar step is UNFILTERED — the sidecar is not a .iso", () => {
    // Asserted as the WHOLE line, not a substring. `toContain` on the prefix
    // survives appending `.filter(p => p.endsWith(".iso"))`, which is exactly
    // the defect: filtering here loses the sidecar before it is looked for.
    const line = src.split("\n").find((l) => l.includes("collectFilesUnder(dlDir)"));
    expect(line?.trim()).toBe("const downloadedFiles = collectFilesUnder(dlDir);");
    // The .iso filter belongs on `found`, downstream of the full list.
    expect(src).toContain('const found = downloadedFiles.filter((p) => p.endsWith(".iso"));');
  });

  test("the pull is given whatever discovery returned, including nothing", () => {
    expect(src).toContain("const pulled = autoDownloadFreshIsoIfNeeded(local, isoArch)");
    const discoverIdx = src.indexOf("const found = discoverLocalIso(isoArch)");
    const pullIdx = src.indexOf("const pulled = autoDownloadFreshIsoIfNeeded(local, isoArch)");
    expect(discoverIdx).toBeGreaterThan(0);
    expect(pullIdx).toBeGreaterThan(discoverIdx);
  });

  test("the refusal survives when the pull cannot produce an ISO either", () => {
    // Reachable-but-silent would be worse than the bail it replaced.
    expect(src).toContain("if (pulled === null)");
  });
});
