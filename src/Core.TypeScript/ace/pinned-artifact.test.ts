// pinned-artifact.test.ts — falsifiers for the pinned-install verifier.
//
// THE ONLY HALF THAT MATTERS IS THE REFUSAL. A verifier exercised solely on matching input
// cannot distinguish "the check passed" from "the check is not wired up" — which is the exact
// defect class the pin was written to remove. So the tests below are written so that DELETING
// the digest comparison in pinned-artifact.ts turns them red, not green.

import { describe, expect, test } from "bun:test";
import {
  digestMatches,
  installPinnedArtifact,
  parsePin,
  sha256Hex,
  type InstallEffects,
} from "./pinned-artifact.ts";

const PAYLOAD = new TextEncoder().encode("pretend this is a 1.4GB tarball");
const PAYLOAD_SHA = sha256Hex(PAYLOAD);

const goodPin = () => ({
  entry: {
    name: "ollama",
    version: "0.32.13",
    contentAddress: `sha256:${PAYLOAD_SHA}`,
    weight: 1,
    packageManager: "ace",
    lastUpdated: "2026-08-16T00:00:00Z",
  },
  artifact: {
    tag: "v0.32.13",
    asset: "ollama-linux-amd64.tar.zst",
    url: "https://example.invalid/ollama-linux-amd64.tar.zst",
    platform: "linux/x86_64",
    sizeBytes: PAYLOAD.length,
    installsInto: "/usr/local",
    verify: { binary: "ollama", versionArgs: ["--version"] },
  },
});

interface Trace {
  readonly extracted: string[];
  readonly fetched: string[];
}

function effects(
  opts: {
    serve?: Uint8Array;
    fetchThrows?: string;
    host?: string;
    extractOk?: boolean;
    onPath?: boolean;
    versionOutput?: string;
  } = {},
): { fx: InstallEffects; trace: Trace } {
  const trace: Trace = { extracted: [], fetched: [] };
  const fx: InstallEffects = {
    hostPlatform: () => opts.host ?? "linux/x86_64",
    fetchBytes: async (url) => {
      trace.fetched.push(url);
      if (opts.fetchThrows !== undefined) throw new Error(opts.fetchThrows);
      return opts.serve ?? PAYLOAD;
    },
    writeTemp: async (name) => `/tmp/${name}`,
    extract: async (archive, dest) => {
      trace.extracted.push(`${archive} -> ${dest}`);
      return opts.extractOk === false
        ? { ok: false, message: "tar refused" }
        : { ok: true, message: "" };
    },
    which: async (b) => (opts.onPath === false ? null : `/usr/local/bin/${b}`),
    run: async () => ({
      ok: true,
      // The real `ollama --version` with no server running prints a warning FIRST and the
      // version on the second line — reproduced here because a `head -1` style match would
      // have rejected a perfectly good install.
      output: opts.versionOutput ?? "Warning: could not connect to a running Ollama instance\nWarning: client version is 0.32.13\n",
    }),
    log: () => {},
  };
  return { fx, trace };
}

describe("digestMatches", () => {
  test("accepts the pinned bytes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, PAYLOAD)).toBe(true);
  });

  test("REJECTS a single flipped byte", () => {
    const tampered = new Uint8Array(PAYLOAD);
    tampered[0] = (tampered[0] ?? 0) ^ 0x01;
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, tampered)).toBe(false);
  });

  test("REJECTS truncated bytes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, PAYLOAD.slice(0, PAYLOAD.length - 1))).toBe(false);
  });

  test("REJECTS empty bytes — the shape a silently-failed download takes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, new Uint8Array(0))).toBe(false);
  });
});

describe("parsePin refuses malformed pins rather than fetching on undefined", () => {
  test("a non-sha256 contentAddress", () => {
    const p = goodPin();
    const r = parsePin({ ...p, entry: { ...p.entry, contentAddress: "blake3:abc" } });
    expect(r.ok).toBe(false);
  });

  test("a SHORT hex digest — the shape that would 'verify' nothing", () => {
    const p = goodPin();
    const r = parsePin({ ...p, entry: { ...p.entry, contentAddress: "sha256:abc123" } });
    expect(r.ok).toBe(false);
  });

  test("a non-https url", () => {
    const p = goodPin();
    const r = parsePin({ ...p, artifact: { ...p.artifact, url: "http://example.invalid/x" } });
    expect(r.ok).toBe(false);
  });

  test("a missing verify block", () => {
    const p = goodPin() as Record<string, unknown>;
    const artifact = { ...(p["artifact"] as Record<string, unknown>) };
    delete artifact["verify"];
    expect(parsePin({ ...p, artifact }).ok).toBe(false);
  });

  test("the committed pin file itself parses", async () => {
    const raw = await Bun.file(new URL("../../../.github/ollama-pin.json", import.meta.url)).json();
    const r = parsePin(raw);
    expect(r.ok).toBe(true);
  });
});

describe("installPinnedArtifact", () => {
  test("happy path installs and reports the pinned version", async () => {
    const { fx, trace } = effects();
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(true);
    expect(trace.extracted.length).toBe(1);
  });

  test("WRONG BYTES ⇒ digest-mismatch AND NOTHING IS EXTRACTED", async () => {
    // The load-bearing assertion is the second one. A verifier that reports a mismatch after
    // having already unpacked the payload has detected nothing useful.
    const { fx, trace } = effects({ serve: new TextEncoder().encode("malicious replacement") });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("digest-mismatch");
    expect(trace.extracted).toEqual([]);
  });

  test("an EMPTY response is refused, not treated as success", async () => {
    const { fx, trace } = effects({ serve: new Uint8Array(0) });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    expect(trace.extracted).toEqual([]);
  });

  test("a wrong-platform host REFUSES instead of installing something that fits", async () => {
    const { fx, trace } = effects({ host: "darwin/arm64" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("platform-mismatch");
    expect(trace.fetched).toEqual([]); // refused before touching the network
  });

  test("a download failure is an outcome, not a throw", async () => {
    const { fx } = effects({ fetchThrows: "ECONNRESET" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("download-failed");
  });

  test("extraction failure surfaces as extract-failed", async () => {
    const { fx } = effects({ extractOk: false });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("extract-failed");
  });

  test("binary absent from PATH after extraction is a failure", async () => {
    const { fx } = effects({ onPath: false });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("not-on-path");
  });

  test("A SHADOWING OLDER BINARY is caught — correct archive, wrong thing on PATH", async () => {
    const { fx } = effects({ versionOutput: "ollama version is 0.19.0" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("version-mismatch");
  });

  test("the real two-line --version output (warning first) is ACCEPTED", async () => {
    const { fx } = effects({
      versionOutput: "Warning: could not connect to a running Ollama instance\nWarning: client version is 0.32.13\n",
    });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(true);
  });
});
