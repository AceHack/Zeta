import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tarballCacheKey, tarballDisposition } from "./from-autotools-tarball.ts";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { tierAllows, tierFromAttrs, resolveHostTier } from "./host-tier.ts";

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

/**
 * The host-tier gate on the SOURCE BUILD (081M0K36K69087G0R003BYSCF8).
 *
 * These read the real manifest and call the real tier predicates — the same two the
 * realizer calls — so the assertion cannot drift from the behaviour by being a second
 * copy of the rule.
 */
describe("setup-realizers/from-autotools-tarball — host tier", () => {
  const MANIFEST = join(import.meta.dir, "../../../../tools/setup/manifests/from-autotools-tarball");
  const entries = (): ReturnType<typeof parseMechanismManifest> =>
    parseMechanismManifest(readFileSync(MANIFEST, "utf8"));

  test("a slim host builds nothing from source", () => {
    // 76s of `configure && make install` on the 1-vCPU runner, for a first-order
    // theorem prover that a `dotnet build` lane never invokes.
    const slim = resolveHostTier({ ZETA_HOST_TIER: "slim" });
    const built = entries()
      .filter((e) => tierAllows(tierFromAttrs(e.attrs), slim))
      .map((e) => e.tokens[0]);
    expect(built).toEqual([]);
  });

  test("a full host still builds eprover — the gate subtracts, it never adds", () => {
    const full = resolveHostTier({ ZETA_HOST_TIER: "full" });
    const built = entries()
      .filter((e) => tierAllows(tierFromAttrs(e.attrs), full))
      .map((e) => e.tokens[0]);
    expect(built).toContain("eprover");
    expect(built.length).toBe(entries().length);
  });

  test("every row carries an explicit tier — untagged would mean built everywhere", () => {
    // The failure this pins: adding a row and forgetting `tier=` silently puts another
    // source build back on the slim runner, which is the bug this gate closed.
    const untagged = entries()
      .filter((e) => e.attrs.tier === undefined)
      .map((e) => e.tokens[0]);
    expect(untagged).toEqual([]);
  });
});
