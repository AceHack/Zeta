import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SHARE_DIR,
  directoryShareFetcher,
  httpUnsealClient,
  parseSidecarArgs,
} from "./openbao-unseal-sidecar.ts";
import { classifyHealth, decideUnsealerTick } from "./vault-unsealer.ts";

describe("the share cache is read fresh, and a missing one is not a crash", () => {
  test("an absent mount yields NO shares rather than throwing", () => {
    // A sidecar that crash-loops beside a HEALTHY store because nobody has run
    // the ceremony yet is worse than one that waits: the restart count would
    // read as a store problem. `validateShares` in the payload is what refuses
    // an insufficient set; this adapter only reports what is there.
    const fetcher = directoryShareFetcher("/nonexistent-zeta-share-mount");
    expect(fetcher.fetchSharesThisTick()).resolves.toEqual([]);
  });

  test("shares are re-read on EVERY call, so a rotated cache takes effect next tick", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-shares-"));
    try {
      writeFileSync(join(dir, "share-1"), "alpha\n");
      const fetcher = directoryShareFetcher(dir);
      expect(await fetcher.fetchSharesThisTick()).toEqual(["alpha"]);

      // The port's contract is "called every sealed tick -- never cached across
      // ticks". If this adapter cached, a rotated Secret would not take effect
      // until the container restarted.
      writeFileSync(join(dir, "share-2"), "beta\n");
      expect(await fetcher.fetchSharesThisTick()).toEqual(["alpha", "beta"]);

      rmSync(join(dir, "share-1"));
      expect(await fetcher.fetchSharesThisTick()).toEqual(["beta"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("blank files and dotfiles are skipped, not offered as shares", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-shares-"));
    try {
      // Kubernetes projects Secrets with a `..data` symlink and dot-prefixed
      // internals; offering those as shares would spend unseal attempts on
      // guaranteed-invalid keys.
      mkdirSync(join(dir, "..2026_09_08"), { recursive: true });
      writeFileSync(join(dir, ".hidden"), "nope\n");
      writeFileSync(join(dir, "empty"), "   \n");
      writeFileSync(join(dir, "real"), "gamma\n");
      expect(await directoryShareFetcher(dir).fetchSharesThisTick()).toEqual(["gamma"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the HTTP adapter cannot init, and unreachable is never a seal", () => {
  test("the client exposes health and putUnseal and NOTHING else", () => {
    // The payload's type is the gate: "a client that can init is a client this
    // module must not be handed". This asserts the adapter honours it in fact,
    // not just in type -- a runtime key nobody declared would still be callable.
    expect(Object.keys(httpUnsealClient()).sort()).toEqual(["health", "putUnseal"]);
  });

  test("an unreachable listener classifies as MISS, never as sealed", async () => {
    // The expensive confusion: reading a connection refusal as `sealed` would
    // make the loop fetch shares and spend unseal attempts at a store that is
    // not listening -- share material on the wire for no reason.
    const health = await httpUnsealClient("http://127.0.0.1:1").health();
    expect(health.status).toBe(0);
    expect(classifyHealth(health)).toBe("unreachable");
    expect(decideUnsealerTick(health).kind).toBe("miss");
  });

  test("a not-initialized store yields REFUSE-INIT — the sidecar never inits", () => {
    const decision = decideUnsealerTick({ status: 501, initialized: false });
    expect(decision.kind).toBe("refuse-init");
  });
});

describe("argument parsing refuses the coercive threshold", () => {
  test("defaults point at the documented mount", () => {
    const opts = parseSidecarArgs([]);
    expect(opts.shareDir).toBe(DEFAULT_SHARE_DIR);
    expect(opts.once).toBe(false);
    expect(opts.threshold).toBeGreaterThanOrEqual(2);
  });

  test("threshold 1 is parsed but must be rejected by the caller — MENO calls it coercion", () => {
    // Parsing is not permission. The entrypoint refuses <2; this pins that the
    // value survives parsing so the refusal is a decision, not an accident of
    // the parser silently clamping it.
    expect(parseSidecarArgs(["--threshold", "1"]).threshold).toBe(1);
  });

  test("flags are read positionally and fall back cleanly", () => {
    const opts = parseSidecarArgs(["--share-dir", "/tmp/x", "--tick-ms", "900", "--once"]);
    expect(opts.shareDir).toBe("/tmp/x");
    expect(opts.tickMs).toBe(900);
    expect(opts.once).toBe(true);
  });
});
