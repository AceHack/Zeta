import { describe, expect, it } from "bun:test";
import { publishFrame, type BroadcastSource, type SourceMind } from "./llmtv-broadcast";
import { encodeReplayArtifact, replayFrame, type ReplayArtifact, REPLAY_SCHEMA } from "./llmtv-replay";
import {
  parseReplayRenderArgs,
  renderReplayArtifactText,
  runReplayRenderCli,
  type ReplayRenderIo,
} from "./llmtv-replay-render";

import { earnThenFrostOrThrow } from "../ledger/privacy-budget";

// Frost is EARNED now, not asserted: `SourceMind.personal.frost` takes a `FrostReceipt`, and the
// only way to get one is to have a peer attest value and then spend it. A `frosted: true` literal
// no longer typechecks. See src/Core.TypeScript/ledger/privacy-budget.ts.
const frostReceiptFor = (region: string) =>
  earnThenFrostOrThrow({
    owner: `owner-of-${region}`,
    attestor: `peer-of-${region}`,
    earn: 100,
    cost: 10,
    region,
    witness: "fixture: a peer attested that the owner added value",
  });

const alexa: BroadcastSource = { zid: "zid-alexa-0001", name: "alexa" };

const alexaMind: SourceMind = {
  role: "coding",
  hat: "coder hat",
  required: [{ label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frost: frostReceiptFor("replay-render"),
    veilLabel: "private hope",
    predictions: [{ label: "SECRET private hope", temp: "warm", valueMilli: 700, epsilonMilli: 110 }],
  },
};

function artifact(): ReplayArtifact {
  return {
    schema: REPLAY_SCHEMA,
    seed: "S4",
    generatedBy: "render-test",
    frames: [
      { receivedAtMs: 999, wire: "not json", from: "bad-capture" },
      replayFrame(publishFrame(alexa, 1, 3341, alexaMind), 1000, "fake-bus/alexa"),
    ],
  };
}

function memoryIo(files: ReadonlyMap<string, string>): {
  readonly io: ReplayRenderIo;
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
      writeText: (path, text) => {
        writes.set(path, text);
      },
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

describe("llmtv-replay-render -- artifact to zero-JS page bridge", () => {
  it("renders a replay artifact into the LLMTV document and reports cold telemetry", () => {
    const input = encodeReplayArtifact(artifact());
    const rendered = renderReplayArtifactText(input, "capture.json", "out.html", { title: "Replay" });

    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.summary).toEqual({
      inputPath: "capture.json",
      outputPath: "out.html",
      dwellers: 1,
      stats: { accepted: 1, rejected: 1, expired: 0 },
    });
    expect(rendered.html).toContain("<title>Replay</title>");
    expect(rendered.html).toContain('data-schema="zeta.darkhall.llmtv.v1"');
    expect(rendered.html).toContain('data-dweller="alexa"');
    expect(rendered.html).toContain("private hope");
    expect(rendered.html).not.toContain("<script");
    expect(rendered.html).not.toContain("SECRET private hope");
  });

  it("runs as an injected-IO CLI without touching sockets or clocks", () => {
    const { io, writes, stdout, stderr } = memoryIo(new Map([["capture.json", encodeReplayArtifact(artifact())]]));

    const code = runReplayRenderCli(["capture.json", "out.html", "--title", "Replay"], io);

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("rendered out.html from=capture.json dwellers=1 accepted=1 rejected=1 expired=0");
    expect(writes.get("out.html")).toContain("<title>Replay</title>");
    expect(writes.get("out.html")).not.toContain("SECRET private hope");
  });

  it("refuses malformed artifacts before writing output", () => {
    const { io, writes, stderr } = memoryIo(new Map([["bad.json", '{"schema":"wrong"}']]));

    const code = runReplayRenderCli(["--input", "bad.json", "--out", "out.html"], io);

    expect(code).toBe(1);
    expect(writes.size).toBe(0);
    expect(stderr.join("")).toContain("invalid LLMTV replay artifact: bad.json");
  });

  it("reports missing files and argument errors as cold command failures", () => {
    const missing = memoryIo(new Map());
    expect(runReplayRenderCli(["missing.json", "out.html"], missing.io)).toBe(1);
    expect(missing.stderr.join("")).toContain("failed to read missing.json: missing");

    const noOutput = memoryIo(new Map());
    expect(runReplayRenderCli(["capture.json"], noOutput.io)).toBe(1);
    expect(noOutput.stderr.join("")).toContain("input and output paths are required");
  });

  it("parses help and option-style invocation", () => {
    expect(parseReplayRenderArgs(["--help"])).toEqual({ ok: true, request: { kind: "help" } });
    expect(parseReplayRenderArgs(["--input", "capture.json", "--out", "out.html", "--title", "Replay"])).toEqual({
      ok: true,
      request: { kind: "render", inputPath: "capture.json", outputPath: "out.html", title: "Replay" },
    });

    const { io, stdout } = memoryIo(new Map());
    expect(runReplayRenderCli(["--help"], io)).toBe(0);
    expect(stdout.join("")).toContain("zeta.llmtv.replay.v1");
  });
});
