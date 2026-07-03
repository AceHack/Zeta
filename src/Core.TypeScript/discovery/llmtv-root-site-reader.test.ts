import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { publishFrame, type BroadcastSource, type SourceMind } from "./llmtv-broadcast";
import { encodeReplayArtifact, replayFrame, type ReplayArtifact, REPLAY_SCHEMA } from "./llmtv-replay";
import {
  DEFAULT_ROOT_SITE_LLMTV_STALE_AFTER_MS,
  parseRootSiteLlmtvReaderArgs,
  renderRootSiteLlmtvReadout,
  runRootSiteLlmtvReaderCli,
  type RootSiteLlmtvReaderIo,
} from "./llmtv-root-site-reader";
import { ROOT_SITE_LLMTV_HTML_RELATIVE_PATH, rootSiteLlmtvPaths } from "./llmtv-root-site-readout";

const rootDir = "/tmp/zeta-root-site";
const nowMs = 10_000;

const alexa: BroadcastSource = { zid: "zid-alexa-0001", name: "alexa" };
const soraya: BroadcastSource = { zid: "zid-soraya-0002", name: "soraya" };

const alexaMind: SourceMind = {
  role: "coding",
  hat: "coder hat",
  required: [{ label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frosted: true,
    veilLabel: "private hope",
    predictions: [{ label: "SECRET private hope", temp: "warm", valueMilli: 700, epsilonMilli: 110 }],
  },
};

const sorayaMind: SourceMind = {
  role: "formal-verification",
  hat: "verifier hat",
  required: [{ label: "Z3 lemma discharges", temp: "cool", valueMilli: 970, epsilonMilli: 30 }],
};

function artifact(receivedAtMs = 9_800): ReplayArtifact {
  return {
    schema: REPLAY_SCHEMA,
    seed: "S4",
    generatedBy: "reader-test",
    frames: [
      replayFrame(publishFrame(alexa, 1, 3341, alexaMind), receivedAtMs, "fake-bus/alexa"),
      replayFrame(publishFrame(soraya, 2, 3341, sorayaMind), receivedAtMs, "fake-bus/soraya"),
    ],
  };
}

function memoryIo(files: ReadonlyMap<string, string>): {
  readonly io: RootSiteLlmtvReaderIo;
  readonly writes: Map<string, string>;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const writes = new Map<string, string>();
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    writes,
    stdout,
    stderr,
    io: {
      readText: (path) => {
        const value = files.get(path);
        if (value === undefined) throw new Error("missing");
        return value;
      },
      writeText: (path, text) => writes.set(path, text),
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

describe("llmtv-root-site-reader -- static Pages reader over the replay ledger", () => {
  it("renders a valid fresh same-origin replay as live without script tags or frost leakage", () => {
    const rendered = renderRootSiteLlmtvReadout(
      { kind: "present", text: encodeReplayArtifact(artifact()) },
      { rootDir, nowMs },
    );

    expect(rendered.summary).toMatchObject({
      status: "live",
      reason: "live",
      frames: 2,
      dwellers: 2,
      stats: { accepted: 2, rejected: 0, expired: 0 },
      lastFrameAgeMs: 200,
    });
    expect(rendered.html).toContain('data-readout-status="live"');
    expect(rendered.html).toContain("live · same-origin replay");
    expect(rendered.html).toContain('data-dweller="alexa"');
    expect(rendered.html).toContain('data-dweller="soraya"');
    expect(rendered.html).toContain("private hope");
    expect(rendered.html).not.toContain("SECRET private hope");
    expect(rendered.html).not.toContain("<script");
  });

  it("renders missing and empty replay ledgers as cold typed states", () => {
    const missing = renderRootSiteLlmtvReadout({ kind: "missing", error: "ENOENT" }, { rootDir, nowMs });
    expect(missing.summary.status).toBe("cold");
    expect(missing.summary.reason).toBe("ENOENT");
    expect(missing.html).toContain('data-readout-status="cold"');
    expect(missing.html).toContain("offline · replay missing");

    const empty = renderRootSiteLlmtvReadout(
      { kind: "present", text: encodeReplayArtifact({ schema: REPLAY_SCHEMA, seed: "S4", frames: [] }) },
      { rootDir, nowMs },
    );
    expect(empty.summary.status).toBe("cold");
    expect(empty.summary.reason).toBe("empty");
    expect(empty.html).toContain("cold · no channels");
  });

  it("renders invalid, rejected, and expired ledger evidence as heat", () => {
    const invalid = renderRootSiteLlmtvReadout({ kind: "present", text: "{ nope" }, { rootDir, nowMs });
    expect(invalid.summary.status).toBe("heat");
    expect(invalid.summary.reason).toBe("invalid-artifact");
    expect(invalid.html).toContain("heat · invalid replay");

    const rejectedArtifact: ReplayArtifact = {
      ...artifact(),
      frames: [{ receivedAtMs: 9_900, wire: "not json" }, ...artifact().frames],
    };
    const rejected = renderRootSiteLlmtvReadout(
      { kind: "present", text: encodeReplayArtifact(rejectedArtifact) },
      { rootDir, nowMs },
    );
    expect(rejected.summary.status).toBe("heat");
    expect(rejected.summary.stats.rejected).toBe(1);
    expect(rejected.html).toContain('data-live="false"');

    const expired = renderRootSiteLlmtvReadout(
      {
        kind: "present",
        text: encodeReplayArtifact({
          ...artifact(1_000),
          expire: { nowMs: 10_000, ttlMs: 10 },
        }),
      },
      { rootDir, nowMs },
    );
    expect(expired.summary.status).toBe("heat");
    expect(expired.summary.stats.expired).toBe(2);
    expect(expired.html).toContain("heat · replay loss");
  });

  it("demotes old-but-valid rows to stale instead of pretending they are live", () => {
    const rendered = renderRootSiteLlmtvReadout(
      { kind: "present", text: encodeReplayArtifact(artifact(1_000)) },
      { rootDir, nowMs, staleAfterMs: 500 },
    );

    expect(rendered.summary.status).toBe("stale");
    expect(rendered.summary.reason).toBe("stale");
    expect(rendered.summary.lastFrameAgeMs).toBe(9_000);
    expect(rendered.html).toContain('data-readout-status="stale"');
    expect(rendered.html).toContain('data-live="false"');
  });

  it("runs as an injected-IO root-site CLI and writes hall/tv/index.html", () => {
    const paths = rootSiteLlmtvPaths(rootDir);
    const { io, writes, stdout, stderr } = memoryIo(
      new Map([[paths.replayPath, encodeReplayArtifact(artifact())]]),
    );

    const code = runRootSiteLlmtvReaderCli(["--root-site", rootDir, "--now-ms", String(nowMs)], io);

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain(`wrote ${ROOT_SITE_LLMTV_HTML_RELATIVE_PATH}`);
    expect(stdout.join("")).toContain("status=live");
    expect(writes.get(paths.htmlPath)).toContain('data-readout-status="live"');
  });

  it("parses option-style invocation and refuses invalid numeric budgets", () => {
    expect(parseRootSiteLlmtvReaderArgs(["--help"])).toEqual({ ok: true, request: { kind: "help" } });
    expect(
      parseRootSiteLlmtvReaderArgs([
        "--root-site",
        rootDir,
        "--now-ms",
        "100",
        "--stale-after-ms",
        String(DEFAULT_ROOT_SITE_LLMTV_STALE_AFTER_MS),
        "--title",
        "LLMTV",
      ]),
    ).toEqual({
      ok: true,
      request: {
        kind: "render",
        rootDir,
        nowMs: 100,
        staleAfterMs: DEFAULT_ROOT_SITE_LLMTV_STALE_AFTER_MS,
        title: "LLMTV",
      },
    });
    expect(parseRootSiteLlmtvReaderArgs(["--root-site", rootDir, "--now-ms", "NaN"])).toEqual({
      ok: false,
      error: "--now-ms must be a non-negative finite number",
    });
  });

  it("writes a cold page for a missing ledger instead of failing the site build", () => {
    const paths = rootSiteLlmtvPaths(rootDir);
    const { io, writes, stdout } = memoryIo(new Map());

    const code = runRootSiteLlmtvReaderCli([rootDir, "--now-ms", String(nowMs)], io);

    expect(code).toBe(0);
    expect(stdout.join("")).toContain("status=cold");
    expect(writes.get(paths.htmlPath)).toContain("offline · replay missing");
    expect(writes.get(join(rootDir, "hall", "tv", "index.html"))).toBe(writes.get(paths.htmlPath));
  });
});
