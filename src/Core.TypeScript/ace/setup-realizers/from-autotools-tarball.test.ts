import { describe, expect, test } from "bun:test";
import { tarballCacheKey, tarballDisposition } from "./from-autotools-tarball.ts";

/**
 * The cache decision, offline.
 *
 * `~/.cache/zeta/from-autotools-tarball/*.tgz` became a CI-restored
 * `actions/cache` path on 2026-08-17, which turns "a tarball is present" from a
 * fact this process established into a claim another run made. These tests pin
 * the consequence: presence alone never authorises use.
 */
describe("setup-realizers/from-autotools-tarball", () => {
  test("absent tarball is fetched", () => {
    expect(tarballDisposition(false, false)).toBe("fetch");
  });

  test("present AND matching is the only path that skips the network", () => {
    expect(tarballDisposition(true, true)).toBe("use-cached");
  });

  test("present but mismatching is discarded — never used, never fatal", () => {
    // The forcing case. Before the pin was checked on restore, this returned
    // the same answer as `use-cached`: unverified bytes into `./configure &&
    // make install` for the prover that discharges our FOL obligations.
    // It is deliberately NOT fatal — a derived cache may legitimately be
    // corrupt, so it self-heals by refetching, and only a mismatch on the
    // FRESHLY fetched bytes throws (that is upstream disagreeing with the pin).
    expect(tarballDisposition(true, false)).toBe("discard-and-fetch");
  });

  test("no disposition trusts an unverified present file", () => {
    const trusting = [true, false].filter((matches) => tarballDisposition(true, matches) === "use-cached");
    expect(trusting).toEqual([true]);
  });

  test("cache key is a pure function of the URL, so a version bump re-keys", () => {
    const v320 = tarballCacheKey("https://github.com/eprover/eprover/archive/refs/tags/E-3.2.0.tar.gz");
    const v321 = tarballCacheKey("https://github.com/eprover/eprover/archive/refs/tags/E-3.2.1.tar.gz");
    expect(v320).toBe(tarballCacheKey("https://github.com/eprover/eprover/archive/refs/tags/E-3.2.0.tar.gz"));
    expect(v320).not.toBe(v321);
    expect(v320).toMatch(/^[0-9a-f]{64}$/);
  });
});
