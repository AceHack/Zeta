import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  HALL_INDEX_RELATIVE_PATH,
  HALL_LLMTV_STATUS_CARD_END,
  HALL_LLMTV_STATUS_CARD_START,
  hallIndexPath,
  parseHallLlmtvStatusCardArgs,
  renderHallLlmtvStatusCardBlock,
  replaceHallLlmtvStatusCardBlock,
  runHallLlmtvStatusCardCli,
  summarizeHallLlmtvStatusCard,
  updateHallLlmtvStatusCard,
  type HallLlmtvStatusCardIo,
} from "./llmtv-hall-status-card";
import {
  encodeRootSiteLlmtvStatus,
  ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH,
  rootSiteLlmtvStatus,
  rootSiteLlmtvStatusPath,
} from "./llmtv-root-site-status";
import { phaseClockForFrame } from "./llmtv-broadcast";

const rootDir = "/tmp/zeta-root-site";

const indexHtml = [
  "<!doctype html>",
  "<html>",
  "<body>",
  "    <section>",
  '      <div class="lbl">The factory — live surfaces</div>',
  HALL_LLMTV_STATUS_CARD_START,
  '<aside data-llmtv-status-card="placeholder"></aside>',
  HALL_LLMTV_STATUS_CARD_END,
  '      <div class="cards"><a href="./tv/">LLMTV</a></div>',
  "    </section>",
  "</body>",
  "</html>",
].join("\n");

function liveStatusText(): string {
  return encodeRootSiteLlmtvStatus(
    rootSiteLlmtvStatus({
      seed: "S4",
      generatedBy: "test",
      channel: "static-reader",
      writtenAtMs: 1_000,
      replayPath: join(rootDir, "data", "llmtv-live.replay.json"),
      htmlPath: join(rootDir, "hall", "tv", "index.html"),
      status: "live",
      reason: "live",
      frames: 3,
      dwellers: 2,
      stats: { accepted: 3, rejected: 0, expired: 0 },
      lastFrameAgeMs: 100,
      phaseClock: phaseClockForFrame("llmtv-root-site-reader", "S4", 3),
    }),
  );
}

function memoryIo(files: ReadonlyMap<string, string>): {
  readonly io: HallLlmtvStatusCardIo;
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

function markerCount(html: string): number {
  return html.split(HALL_LLMTV_STATUS_CARD_START).length - 1;
}

describe("llmtv-hall-status-card -- Hall index projection of the status sidecar", () => {
  it("renders a live status sidecar into a zero-script card", () => {
    const updated = updateHallLlmtvStatusCard({ kind: "present", text: liveStatusText() }, indexHtml, { rootDir });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.summary).toMatchObject({
      status: "live",
      channel: "static-reader",
      reason: "live",
      frames: 3,
      dwellers: 2,
      accepted: 3,
      lastFrameAgeMs: 100,
      phaseClock: { schema: "zeta.darkhall.phase-clock.v1", phase: 3, skewBoundTicks: 0, travelers: 1 },
    });
    expect(updated.html).toContain('data-llmtv-status-card="present"');
    expect(updated.html).toContain('data-status="live"');
    expect(updated.html).toContain('data-channel="static-reader"');
    expect(updated.html).toContain('data-last-frame-age-ms="100"');
    expect(updated.html).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(updated.html).toContain('data-phase="3"');
    expect(updated.html).toContain('data-phase-skew-bound="0"');
    expect(updated.html).toContain("<b>3</b>phase");
    expect(updated.html).toContain("<b>0</b>skew");
    expect(updated.html).toContain("<b>100</b>age-ms");
    expect(updated.html).toContain("<h2>LLMTV live</h2>");
    expect(updated.html).not.toContain("<script");
    expect(markerCount(updated.html)).toBe(1);
  });

  it("renders missing and invalid status sidecars honestly", () => {
    const missing = summarizeHallLlmtvStatusCard({ kind: "missing", error: "ENOENT" }, { rootDir });
    const invalid = summarizeHallLlmtvStatusCard({ kind: "present", text: "{ nope" }, { rootDir });

    expect(missing).toMatchObject({
      status: "cold",
      channel: "missing",
      reason: "ENOENT",
      frames: 0,
      dwellers: 0,
    });
    expect(renderHallLlmtvStatusCardBlock(missing)).toContain('data-status="cold"');
    expect(renderHallLlmtvStatusCardBlock(missing)).toContain('data-channel="missing"');
    expect(invalid).toMatchObject({
      status: "heat",
      channel: "invalid",
      reason: "invalid-status-json",
    });
    expect(renderHallLlmtvStatusCardBlock(invalid)).toContain('data-status="heat"');
    expect(renderHallLlmtvStatusCardBlock(invalid)).toContain("did not decode");
  });

  it("can insert into a Hall page that has the cards anchor but no marker block", () => {
    const unmarked = indexHtml
      .replace(`${HALL_LLMTV_STATUS_CARD_START}\n`, "")
      .replace(`${HALL_LLMTV_STATUS_CARD_END}\n`, "")
      .replace('<aside data-llmtv-status-card="placeholder"></aside>\n', "");
    const summary = summarizeHallLlmtvStatusCard({ kind: "present", text: liveStatusText() }, { rootDir });
    const block = renderHallLlmtvStatusCardBlock(summary);
    const inserted = replaceHallLlmtvStatusCardBlock(unmarked, block);

    expect(inserted).not.toBeNull();
    expect(inserted!).toContain('data-status="live"');
    expect(inserted!.indexOf(HALL_LLMTV_STATUS_CARD_START)).toBeLessThan(inserted!.indexOf('class="cards"'));
  });

  it("runs as an injected-IO CLI and reports the written status", () => {
    const indexPath = hallIndexPath(rootDir);
    const statusPath = rootSiteLlmtvStatusPath(rootDir);
    const { io, writes, stdout, stderr } = memoryIo(
      new Map([
        [indexPath, indexHtml],
        [statusPath, liveStatusText()],
      ]),
    );

    const code = runHallLlmtvStatusCardCli(["--root-site", rootDir], io);

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain(`wrote ${HALL_INDEX_RELATIVE_PATH}`);
    expect(stdout.join("")).toContain(`from=${ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH}`);
    expect(stdout.join("")).toContain("status=live");
    expect(stdout.join("")).toContain("ageMs=100");
    expect(stdout.join("")).toContain("phase=3");
    expect(stdout.join("")).toContain("skew=0");
    expect(writes.get(indexPath)).toContain('data-status="live"');
  });

  it("parses CLI options and fails if the Hall index cannot be patched", () => {
    expect(parseHallLlmtvStatusCardArgs(["--help"])).toEqual({ ok: true, request: { kind: "help" } });
    expect(parseHallLlmtvStatusCardArgs(["--root-site", rootDir])).toEqual({
      ok: true,
      request: { kind: "render", rootDir },
    });

    const { io, stderr } = memoryIo(new Map([[hallIndexPath(rootDir), "<html></html>"]]));
    const code = runHallLlmtvStatusCardCli([rootDir], io);

    expect(code).toBe(1);
    expect(stderr.join("")).toContain("missing a valid LLMTV status-card insertion point");
  });
});
