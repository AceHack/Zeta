/**
 * study.ts — D6's ?study=1 mode: the prediction falsifier (spec #14503).
 *
 * The claim under test: watching the overlay lets a viewer predict the
 * agent's next move better than watching bare pixels. If it does not, the
 * overlay is decoration and the honest move is to cut it.
 *
 * Protocol, one trial at a time:
 *  1. WATCH — the viewer watches under this trial's condition (Latin-square
 *     counterbalanced: full / none / placebo / arrow-only).
 *  2. PROBE — the sim PAUSES (a real freeze, worker-side) and the viewer is
 *     asked: where does the AI go next?
 *  3. MEASURE — the sim resumes; after the horizon the agent's net
 *     displacement grades the guess (dominant axis; a still agent discards
 *     the trial — reported, never silently dropped).
 *
 * Scoring reads the FRAME PAYLOAD (which always carries the arena readout);
 * the condition gates only what the viewer SEES. All schedule/scoring logic
 * is the pure, bun-tested module in Core.TypeScript/chip8/study-protocol.ts;
 * this file is the DOM and the message wire around it.
 */
import {
  STUDY_CHANCE,
  actualDirection,
  conditionFor,
  summarizeTally,
  tallyTrials,
  type StudyCondition,
  type StudyDirection,
  type StudyTrial,
} from "../../../Core.TypeScript/chip8/study-protocol";
import type { Chip8TvPlayer } from "./components/Chip8TvPlayer";
import type { FramePayload, MainToWorkerMessage } from "./protocol";

/** Ticks the viewer watches under a condition before the probe (~5 s). */
const WATCH_TICKS = 150;
/** Ticks after resume that grade the guess (~1.5 s). */
const HORIZON_TICKS = 45;
/**
 * Net displacement under this many pixels = "held still" → discard. Sprites
 * are 2 px and a fleeing agent parked against a wall genuinely holds, so
 * one full pixel of dominant motion is the honest floor — the first smoke
 * discarded its trial at 2 px over 30 ticks.
 */
const MIN_PX = 1;
/** No probe before the explore phase ends — an explore agent walks a fixed pattern. */
const FIRST_PROBE_AFTER = 260;

type Phase = "watching" | "awaiting-answer" | "measuring";

interface SelfPos {
  readonly x: number;
  readonly y: number;
}

function selfCentroid(frame: FramePayload): SelfPos | null {
  const track = frame.arena?.tracks.find((t) => t.role === "self");
  if (!track) return null;
  return { x: (track.minX + track.maxX) / 2, y: (track.minY + track.maxY) / 2 };
}

export class StudyRunner {
  private readonly post: (message: MainToWorkerMessage) => void;
  private readonly player: Chip8TvPlayer;
  private readonly trials: StudyTrial[] = [];
  private trialIx = 0;
  private phase: Phase = "watching";
  private probeAtCycle = FIRST_PROBE_AFTER + WATCH_TICKS;
  private horizonEndCycle = 0;
  private pendingGuess: StudyDirection | null = null;
  private pausedSelf: SelfPos | null = null;
  private lastCycle = -1;

  private readonly panel: HTMLDivElement;
  private readonly statusEl: HTMLSpanElement;
  private readonly promptEl: HTMLDivElement;
  private readonly resultsEl: HTMLDivElement;

  constructor(post: (message: MainToWorkerMessage) => void, player: Chip8TvPlayer) {
    this.post = post;
    this.player = player;

    this.panel = document.createElement("div");
    this.panel.className = "study-panel";
    this.statusEl = document.createElement("span");
    this.statusEl.className = "study-status";
    this.promptEl = document.createElement("div");
    this.promptEl.className = "study-prompt";
    this.promptEl.style.display = "none";
    const promptLabel = document.createElement("span");
    promptLabel.textContent = "Where does the AI go next?";
    this.promptEl.appendChild(promptLabel);
    const dirs: readonly { d: StudyDirection; glyph: string }[] = [
      { d: "up", glyph: "▲" },
      { d: "left", glyph: "◀" },
      { d: "right", glyph: "▶" },
      { d: "down", glyph: "▼" },
    ];
    for (const { d, glyph } of dirs) {
      const b = document.createElement("button");
      b.className = "study-arrow";
      b.textContent = glyph;
      b.title = d;
      b.addEventListener("click", () => {
        this.answer(d);
      });
      this.promptEl.appendChild(b);
    }
    const skip = document.createElement("button");
    skip.className = "study-skip";
    skip.textContent = "can't tell";
    skip.title = "Skip this probe (no trial is recorded; the condition retries)";
    skip.addEventListener("click", () => {
      this.skipProbe();
    });
    this.promptEl.appendChild(skip);

    this.resultsEl = document.createElement("div");
    this.resultsEl.className = "study-results";
    const copy = document.createElement("button");
    copy.className = "study-skip";
    copy.textContent = "copy data";
    copy.title = "Copy the raw trials as JSON";
    copy.addEventListener("click", () => {
      const json = JSON.stringify(this.trials);
      navigator.clipboard.writeText(json).catch(() => {
        console.log("[Study] trials:", json);
      });
    });

    this.panel.appendChild(this.statusEl);
    this.panel.appendChild(this.promptEl);
    this.panel.appendChild(this.resultsEl);
    this.panel.appendChild(copy);
    document.body.appendChild(this.panel);

    this.applyCondition();
  }

  private get condition(): StudyCondition {
    return conditionFor(this.trialIx);
  }

  private applyCondition(): void {
    this.player.setOverlayCondition(this.condition);
    this.renderStatus();
  }

  private renderStatus(): void {
    const phaseText: Record<Phase, string> = {
      watching: "watch",
      "awaiting-answer": "PREDICT",
      measuring: "grading",
    };
    this.statusEl.textContent = `trial ${String(this.trialIx + 1)} · ${this.condition} · ${phaseText[this.phase]}`;
  }

  private renderResults(): void {
    const t = tallyTrials(this.trials);
    this.resultsEl.textContent = `${summarizeTally(t)} · chance ${String(STUDY_CHANCE * 100)}%`;
  }

  private answer(guess: StudyDirection): void {
    if (this.phase !== "awaiting-answer") return;
    this.pendingGuess = guess;
    this.promptEl.style.display = "none";
    this.phase = "measuring";
    this.horizonEndCycle = this.lastCycle + HORIZON_TICKS;
    this.renderStatus();
    this.post({ type: "RESUME", payload: {} });
  }

  private skipProbe(): void {
    if (this.phase !== "awaiting-answer") return;
    // No trial recorded; the same condition watches again and re-probes.
    this.promptEl.style.display = "none";
    this.phase = "watching";
    this.probeAtCycle = this.lastCycle + WATCH_TICKS;
    this.renderStatus();
    this.post({ type: "RESUME", payload: {} });
  }

  private finishTrial(actual: StudyDirection | null): void {
    if (this.pendingGuess !== null) {
      this.trials.push({ condition: this.condition, guess: this.pendingGuess, actual });
    }
    this.pendingGuess = null;
    this.pausedSelf = null;
    this.trialIx += 1;
    this.phase = "watching";
    this.probeAtCycle = this.lastCycle + WATCH_TICKS;
    this.applyCondition();
    this.renderResults();
  }

  /** Feed every frame here (after the player has rendered it). */
  onFrame(frame: FramePayload): void {
    // Cart switch mid-trial: the answer key is gone. A graded-phase trial is
    // recorded as discarded (never silently dropped); a watching trial just
    // restarts its clock on the new cart.
    if (frame.cycle < this.lastCycle) {
      if (this.phase === "measuring") {
        this.finishTrial(null);
      } else {
        this.probeAtCycle = frame.cycle + WATCH_TICKS;
      }
    }
    this.lastCycle = frame.cycle;

    if (this.phase === "watching" && frame.cycle >= this.probeAtCycle) {
      const self = selfCentroid(frame);
      if (!self) {
        // Nobody to predict yet (self not identified) — extend the watch.
        this.probeAtCycle = frame.cycle + WATCH_TICKS;
        return;
      }
      this.pausedSelf = self;
      this.phase = "awaiting-answer";
      this.promptEl.style.display = "flex";
      this.renderStatus();
      this.post({ type: "PAUSE", payload: {} });
      return;
    }

    if (this.phase === "measuring" && frame.cycle >= this.horizonEndCycle) {
      const self = selfCentroid(frame);
      const from = this.pausedSelf;
      // Self lost over the horizon (respawn, occlusion) = no answer key.
      const actual =
        self && from ? actualDirection(self.x - from.x, self.y - from.y, MIN_PX) : null;
      this.finishTrial(actual);
    }
  }
}
