// src/Core.TypeScript/zflash/iso-integrity.test.ts
//
// Falsifiers for the pre-write ISO integrity gate.
//
// The property under test is FAIL CLOSED. Every one of these tests names a
// world in which the gate must refuse, and each would go green if the gate
// were deleted or softened to a warning — which is what makes them a guard
// rather than a description.
//
// No filesystem, no ISO, no device: the three effects arrive through the
// injected IsoIntegrityIo, so the two I/O failure branches (unreadable
// manifest, unreadable ISO) are reachable here. They would otherwise be code
// nobody has ever seen run.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  establishIsoIntegrity,
  isoManifestCandidates,
  realIsoIntegrityIo,
  type IsoIntegrityIo,
} from "./iso-integrity.ts";

const ISO_DIR = join("/tmp", "zflash-fixture");
const ISO_BASE = "zeta-installer-2026-08-21.iso";
const ISO = join(ISO_DIR, ISO_BASE);
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

/** An IO whose whole world is one in-memory map of path -> file text. */
function io(files: Record<string, string>, digest: string = DIGEST_A): IsoIntegrityIo {
  return {
    exists: (p) => Object.hasOwn(files, p),
    readText: (p) => {
      const t = files[p];
      if (t === undefined) throw new Error("ENOENT " + p);
      return t;
    },
    sha256File: () => Promise.resolve(digest),
  };
}

describe("isoManifestCandidates", () => {
  test("looks beside the ISO, in this order, with no duplicates printed to the operator", () => {
    expect(isoManifestCandidates(ISO)).toEqual([
      ISO + ".sha256",
      join(ISO_DIR, "SHA256SUMS"),
    ]);
  });

  test("every candidate lives in the ISO's own directory — the gate never widens its search", () => {
    for (const c of isoManifestCandidates(ISO)) {
      expect(c.startsWith(ISO_DIR)).toBe(true);
    }
  });
});

describe("establishIsoIntegrity — fail closed", () => {
  test("NO MANIFEST IS A REFUSAL, never a pass", async () => {
    const r = await establishIsoIntegrity(ISO, io({}));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("manifest-missing");
  });

  test("the refusal names the files it wants and the directory to put them in", async () => {
    const r = await establishIsoIntegrity(ISO, io({}));
    if (r.ok) throw new Error("expected a refusal");
    expect(r.message).toContain(ISO + ".sha256");
    expect(r.message).toContain(join(ISO_DIR, "SHA256SUMS"));
    expect(r.message).toContain(ISO_DIR);
    expect(r.message).toContain("No device has been touched.");
    // The computed digest is shown so the operator can compare it by eye
    // against a checksum they hold somewhere the gate cannot read.
    expect(r.message).toContain(DIGEST_A);
  });

  test("A DIGEST MISMATCH IS A REFUSAL — the corrupt/substituted-ISO case", async () => {
    const r = await establishIsoIntegrity(
      ISO,
      io({ [join(ISO_DIR, "SHA256SUMS")]: DIGEST_B + "  " + ISO_BASE + "\n" }, DIGEST_A),
    );
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("digest-mismatch");
    expect(r.message).toContain(DIGEST_B);
    expect(r.message).toContain(DIGEST_A);
  });

  test("AN UNREADABLE MANIFEST IS A REFUSAL, and is NOT reported as a missing one", async () => {
    const path = join(ISO_DIR, "SHA256SUMS");
    const r = await establishIsoIntegrity(ISO, {
      exists: (p) => p === path,
      readText: () => {
        throw new Error("EACCES: permission denied");
      },
      sha256File: () => Promise.resolve(DIGEST_A),
    });
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("manifest-unreadable");
    expect(r.message).toContain("EACCES");
    // Telling an operator who HAS the manifest to go and fetch one is how a
    // permission error becomes an hour of confusion.
    expect(r.message).not.toContain("no SHA256SUMS manifest beside");
  });

  test("AN UNREADABLE ISO IS A REFUSAL — an unhashable file is never verified", async () => {
    const path = join(ISO_DIR, "SHA256SUMS");
    const r = await establishIsoIntegrity(ISO, {
      exists: (p) => p === path,
      readText: () => DIGEST_A + "  " + ISO_BASE + "\n",
      sha256File: () => Promise.reject(new Error("EIO: read error")),
    });
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("iso-unreadable");
    expect(r.message).toContain("EIO");
  });

  test("AN UNPARSEABLE MANIFEST IS A REFUSAL — an HTML error page is not a checksum", async () => {
    const r = await establishIsoIntegrity(
      ISO,
      io({ [join(ISO_DIR, "SHA256SUMS")]: "<html>404 Not Found</html>\n" }),
    );
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("manifest-unparseable");
  });

  test("A MANIFEST THAT DOES NOT MENTION THIS ISO IS A REFUSAL", async () => {
    const r = await establishIsoIntegrity(
      ISO,
      io({ [join(ISO_DIR, "SHA256SUMS")]: DIGEST_A + "  some-other.iso\n" }),
    );
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("iso-not-in-manifest");
    expect(r.message).toContain("some-other.iso");
  });

  test("a manifest listing a DIFFERENT file at the right digest does not launder the ISO", async () => {
    // The lookup is by exact basename. Resolving "the newest matching entry"
    // would attest a filename other than the one about to be written.
    const r = await establishIsoIntegrity(
      ISO,
      io({
        [join(ISO_DIR, "SHA256SUMS")]:
          DIGEST_A + "  zeta-installer-2026-01-01.iso\n" + DIGEST_B + "  " + ISO_BASE + "\n",
      }),
    );
    if (r.ok) throw new Error("expected a refusal");
    expect(r.reason).toBe("digest-mismatch");
  });
});

describe("establishIsoIntegrity — the one way through", () => {
  test("a matching entry in SHA256SUMS verifies, and says what it verified against", async () => {
    const manifestPath = join(ISO_DIR, "SHA256SUMS");
    const r = await establishIsoIntegrity(
      ISO,
      io({ [manifestPath]: DIGEST_A + "  " + ISO_BASE + "\n" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.manifestPath).toBe(manifestPath);
    expect(r.sha256).toBe(DIGEST_A);
    expect(r.report).toContain(manifestPath);
    expect(r.report).toContain(DIGEST_A);
  });

  test("a <iso>.sha256 sidecar works too, and wins over SHA256SUMS when both exist", async () => {
    const sidecar = ISO + ".sha256";
    const r = await establishIsoIntegrity(
      ISO,
      io({
        [sidecar]: DIGEST_A + "  " + ISO_BASE + "\n",
        [join(ISO_DIR, "SHA256SUMS")]: DIGEST_B + "  " + ISO_BASE + "\n",
      }),
    );
    if (!r.ok) throw new Error("expected the sidecar to verify");
    expect(r.manifestPath).toBe(sidecar);
  });

  test("the BSD `*filename` form and upper-case hex both verify (GNU sha256sum output)", async () => {
    const r = await establishIsoIntegrity(
      ISO,
      io({ [join(ISO_DIR, "SHA256SUMS")]: DIGEST_A.toUpperCase() + " *" + ISO_BASE + "\n" }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("realIsoIntegrityIo", () => {
  test("reports a path that does not exist as absent rather than throwing", () => {
    expect(realIsoIntegrityIo().exists(join(ISO_DIR, "definitely-not-here"))).toBe(false);
  });
});
