import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { publishFrame, type BroadcastSource, type SourceMind } from "./llmtv-broadcast";
import { encodeReplayArtifact, replayFrame, REPLAY_SCHEMA, type ReplayArtifact } from "./llmtv-replay";
import { HALL_LLMTV_STATUS_CARD_END, HALL_LLMTV_STATUS_CARD_START } from "./llmtv-hall-status-card";
import {
  buildPagesStaticArtifact,
  parsePagesStaticExportArgs,
  runPagesStaticExportCli,
  type PagesStaticExportIo,
} from "./llmtv-pages-static-export";
import { ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH } from "./llmtv-root-site-readout";
import { decodeRootSiteLlmtvStatus, ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH } from "./llmtv-root-site-status";

const tempRoots: string[] = [];

const source: BroadcastSource = { zid: "zid-vera-0001", name: "vera" };
const mind: SourceMind = {
  role: "root-site reader",
  hat: "static export hat",
  required: [{ label: "Pages artifact tells the truth", temp: "cool", valueMilli: 920, epsilonMilli: 40 }],
};

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-llmtv-pages-export-"));
  tempRoots.push(root);
  return root;
}

function write(root: string, relativePath: string, text: string): void {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function read(root: string, relativePath: string): string {
  return readFileSync(join(root, ...relativePath.split("/")), "utf8");
}

function seedStaticSource(root: string): void {
  write(root, "index.html", "<!doctype html><title>Zeta</title>");
  write(root, "robots.txt", "User-agent: *\nAllow: /\n");
  write(root, "sitemap.xml", "<urlset></urlset>");
  write(root, "demo/index.html", "<!doctype html><title>demo</title>");
  write(
    root,
    "hall/index.html",
    [
      "<!doctype html><title>hall</title>",
      "<section>",
      '  <div class="lbl">The factory — live surfaces</div>',
      HALL_LLMTV_STATUS_CARD_START,
      '  <aside data-llmtv-status-card="placeholder"></aside>',
      HALL_LLMTV_STATUS_CARD_END,
      '  <div class="cards">cards</div>',
      "</section>",
    ].join("\n"),
  );
  write(root, "hall/tv/index.html", "<!doctype html><title>old tv</title>old standing view");
  write(root, "docs/README.md", "# Docs\n");
}

function replayArtifact(): ReplayArtifact {
  return {
    schema: REPLAY_SCHEMA,
    seed: "S4",
    generatedBy: "pages-export-test",
    frames: [
      replayFrame(
        publishFrame(source, 1, 700, mind, {
          phaseClockSeed: "S4",
          phaseClockSource: "llmtv-pages-export-test",
        }),
        900,
        "test-bus/vera",
      ),
    ],
  };
}

function captureIo(): {
  readonly io: PagesStaticExportIo;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("llmtv-pages-static-export -- static Pages artifact with LLMTV readout", () => {
  it("copies served static roots and writes a cold LLMTV page when the replay ledger is absent", () => {
    const sourceDir = tempDir();
    const outDir = join(tempDir(), "dist");
    seedStaticSource(sourceDir);
    const { io, stdout, stderr } = captureIo();

    const code = runPagesStaticExportCli(["--source-dir", sourceDir, "--out-dir", outDir, "--now-ms", "1000"], io);

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("llmtv=wrote hall/tv/index.html");
    expect(stdout.join("")).toContain("statusCard=wrote hall/index.html");
    expect(stdout.join("")).toContain("status=cold");
    expect(read(outDir, "index.html")).toContain("Zeta");
    expect(read(outDir, "demo/index.html")).toContain("demo");
    expect(read(outDir, "docs/README.md")).toContain("# Docs");
    expect(existsSync(join(outDir, ".nojekyll"))).toBe(true);
    expect(read(outDir, "hall/tv/index.html")).toContain('data-readout-status="cold"');
    expect(read(outDir, "hall/index.html")).toContain('data-llmtv-status-card="present"');
    expect(read(outDir, "hall/index.html")).toContain('data-status="cold"');
    expect(read(outDir, "hall/index.html")).toContain('data-channel="static-reader"');
    expect(decodeRootSiteLlmtvStatus(read(outDir, ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH))).toMatchObject({
      channel: "static-reader",
      status: "cold",
      reason: expect.stringContaining("ENOENT") as unknown as string,
    });
    expect(read(outDir, "hall/tv/index.html")).not.toContain("old standing view");
  });

  it("renders a copied same-origin replay ledger as a live LLMTV page", () => {
    const sourceDir = tempDir();
    const outDir = join(tempDir(), "dist");
    seedStaticSource(sourceDir);
    write(sourceDir, ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH, encodeReplayArtifact(replayArtifact()));

    const summary = buildPagesStaticArtifact({ sourceDir, outDir, nowMs: 1_000 });

    expect(summary.llmtvReaderExitCode).toBe(0);
    expect(summary.llmtvStatusCardExitCode).toBe(0);
    expect(summary.copiedRoots).toContain("data");
    expect(summary.llmtvReaderStdout.join("")).toContain("status=live");
    expect(summary.llmtvStatusCardStdout.join("")).toContain("status=live");
    expect(summary.llmtvStatusCardStdout.join("")).toContain("ageMs=100");
    expect(summary.llmtvStatusCardStdout.join("")).toContain("phase=700");
    expect(read(outDir, ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH)).toContain("zeta.llmtv.replay.v1");
    expect(decodeRootSiteLlmtvStatus(read(outDir, ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH))).toMatchObject({
      channel: "static-reader",
      status: "live",
      frames: 1,
      dwellers: 1,
      lastFrameAgeMs: 100,
      phaseClock: { schema: "zeta.darkhall.phase-clock.v1", phase: 700, skewBoundTicks: 0, travelers: 1 },
    });
    expect(read(outDir, "hall/tv/index.html")).toContain('data-readout-status="live"');
    expect(read(outDir, "hall/tv/index.html")).toContain('data-dweller="vera"');
    expect(read(outDir, "hall/index.html")).toContain('data-status="live"');
    expect(read(outDir, "hall/index.html")).toContain('data-frames="1"');
    expect(read(outDir, "hall/index.html")).toContain('data-last-frame-age-ms="100"');
    expect(read(outDir, "hall/index.html")).toContain('data-phase="700"');
    expect(read(outDir, "hall/index.html")).not.toContain("<script");
  });

  it("parses CLI options and refuses to overwrite the source root", () => {
    const sourceDir = tempDir();
    const { io, stderr } = captureIo();

    expect(parsePagesStaticExportArgs(["--help"])).toEqual({ ok: true, request: { kind: "help" } });
    expect(parsePagesStaticExportArgs(["--now-ms", "NaN"])).toEqual({
      ok: false,
      error: "--now-ms must be a non-negative finite number",
    });

    const code = runPagesStaticExportCli(["--source-dir", sourceDir, "--out-dir", sourceDir], io);

    expect(code).toBe(1);
    expect(stderr.join("")).toContain("out-dir must be different from source-dir");
  });
});
