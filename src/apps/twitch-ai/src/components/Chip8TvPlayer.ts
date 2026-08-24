import type {
  ArenaReadout,
  ArenaTrackReadout,
} from "../../../../Core.TypeScript/observe/observe";
import {
  WHY_TERMINAL,
  whyAnswer,
  type WhyContext,
} from "../../../../Core.TypeScript/bayesian/why-chain";
import {
  placeboAttention,
  type StudyCondition,
} from "../../../../Core.TypeScript/chip8/study-protocol";
import type { AttentionFramePayload, FramePayload } from "../protocol";

/** Dominant-axis arrow for an intent vector; null when there is no intent. */
function intentArrow(dx: number, dy: number): string | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "→" : "←";
  return dy >= 0 ? "↓" : "↑";
}

export class Chip8TvPlayer {
  private element: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private llmtvOverlay: HTMLElement;
  private screenContainer: HTMLElement;
  private perceptionOverlay: HTMLElement;
  private attentionOverlay: HTMLElement;
  private readonly tileDivs: HTMLDivElement[] = [];
  private fixationRing: HTMLDivElement;
  private lastFixation: number | null = null;
  /** D5: the WHY strip below the screen; −1 = closed, else the chain depth. */
  private whyStrip: HTMLDivElement;
  private whyDepth = -1;
  /** The deciding state of the LATEST frame — what open answers re-render from. */
  private lastWhy: WhyContext | null = null;
  /** Cycle of the latest frame; a backwards jump means the cart was switched. */
  private lastCycle = -1;
  /**
   * D6: what the overlay may show this trial. "full" is the shipped page;
   * the other three exist only under ?study=1 — the study gates what the
   * viewer SEES, never what the payload carries (scoring reads the payload).
   */
  private overlayCondition: StudyCondition = "full";
  public agentId: string;

  constructor(containerId: string, agentId: string) {
    this.agentId = agentId;
    this.element = document.createElement("div");
    this.element.className = "stream-panel";

    // Screen setup
    this.screenContainer = document.createElement("div");
    this.screenContainer.className = "screen-container";
    this.screenContainer.style.position = "relative";

    this.canvas = document.createElement("canvas");
    this.canvas.width = 64;
    this.canvas.height = 32;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;

    // Clear to black initially
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, 64, 32);

    const headerContainer = document.createElement("div");
    headerContainer.className = "screen-header";
    headerContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%;">
        <span><span class="concept-label">🧠 Mode:</span> <span class="concept-value" id="concept-${agentId}">[INITIALIZING]</span></span>
        <span class="attention-header">👁 <span class="attention-value" id="attention-${agentId}">[--]</span></span>
        <span class="objective-header">🎯 <span class="objective-value" id="objective-${agentId}">[WAITING]</span></span>
        <span class="why-btn" id="why-${agentId}" title="Ask the agent why (click again for the next reason down)">WHY?</span>
      </div>
    `;
    headerContainer.querySelector(`#why-${agentId}`)?.addEventListener("click", () => {
      this.descendWhy();
    });

    this.screenContainer.appendChild(headerContainer);
    // The canvas and the perception overlay share one positioned wrapper so
    // bounding boxes (in % of the 64×32 grid) land exactly on the pixels.
    // The wrapper MUST fill the 16:9 screen box: the canvas is sized
    // 100%×100% of its parent, and an unsized wrapper collapses the whole
    // screen to the canvas's intrinsic 64×32 (shipped briefly; caught live).
    const canvasWrap = document.createElement("div");
    canvasWrap.style.position = "relative";
    canvasWrap.style.width = "100%";
    canvasWrap.style.height = "100%";
    this.canvas.style.display = "block";
    canvasWrap.appendChild(this.canvas);
    // D3/D4 (#14503): the frost layer (uncertainty) and the fixation ring
    // (saccade sweep / fixation settle) sit UNDER the perception boxes.
    this.attentionOverlay = document.createElement("div");
    this.attentionOverlay.style.position = "absolute";
    this.attentionOverlay.style.inset = "0";
    this.attentionOverlay.style.pointerEvents = "none";
    for (let t = 0; t < 32; t++) {
      const tile = document.createElement("div");
      tile.className = "attention-tile";
      tile.style.left = `${String((t % 8) * 12.5)}%`;
      tile.style.top = `${String(Math.floor(t / 8) * 25)}%`;
      this.tileDivs.push(tile);
      this.attentionOverlay.appendChild(tile);
    }
    this.fixationRing = document.createElement("div");
    this.fixationRing.className = "fixation-ring";
    this.fixationRing.style.display = "none";
    this.attentionOverlay.appendChild(this.fixationRing);
    canvasWrap.appendChild(this.attentionOverlay);
    this.perceptionOverlay = document.createElement("div");
    this.perceptionOverlay.style.position = "absolute";
    this.perceptionOverlay.style.inset = "0";
    this.perceptionOverlay.style.pointerEvents = "none";
    canvasWrap.appendChild(this.perceptionOverlay);
    // D5: clicking the agent's screen is the literal "click the agent" of the
    // spec — same handler as the WHY? chip (the overlays are pointer-inert).
    canvasWrap.style.cursor = "pointer";
    canvasWrap.title = "Click the agent to ask why";
    canvasWrap.addEventListener("click", () => {
      this.descendWhy();
    });
    this.screenContainer.appendChild(canvasWrap);
    // The WHY strip lives BELOW the screen, not inside it: the screen box is
    // a fixed 16:9 flex container with overflow:hidden, and an in-flow child
    // there fights the canvas for space instead of speaking under it.
    this.whyStrip = document.createElement("div");
    this.whyStrip.className = "why-strip";
    this.whyStrip.style.display = "none";
    this.whyStrip.addEventListener("click", () => {
      this.descendWhy();
    });

    // Xbox Controller Setup
    this.llmtvOverlay = document.createElement("div");
    this.llmtvOverlay.className = "controller-overlay xbox-layout";
    this.llmtvOverlay.innerHTML = `
      <div class="xbox-controller">
        <div class="triggers">
          <div class="trigger-btn" id="btn-lt-${agentId}">LT</div>
          <div class="trigger-btn" id="btn-lb-${agentId}">LB</div>
          <div class="agent-label mono">${agentId}</div>
          <div class="trigger-btn" id="btn-rb-${agentId}">RB</div>
          <div class="trigger-btn" id="btn-rt-${agentId}">RT</div>
        </div>
        <div class="gamepad-main">
          <div class="system-buttons" style="display:flex; justify-content:center; gap:10px; margin-bottom:5px;">
            <div class="face-btn" style="transform:scale(0.6);" id="btn-select-${agentId}">SEL</div>
            <div class="face-btn" style="transform:scale(0.6);" id="btn-start-${agentId}">STA</div>
          </div>
          <!-- D-Pad -->
          <div class="dpad" style="position:relative;">
            <div class="face-btn" style="position:absolute; top:-10px; left:-10px; transform:scale(0.5);" id="btn-l3-${agentId}">L3</div>
            <div class="dpad-row">
              <div class="dpad-btn empty"></div>
              <div class="dpad-btn dir-btn" id="btn-up-${agentId}">▲</div>
              <div class="dpad-btn empty"></div>
            </div>
            <div class="dpad-row">
              <div class="dpad-btn dir-btn" id="btn-left-${agentId}">◀</div>
              <div class="dpad-btn center-deco"></div>
              <div class="dpad-btn dir-btn" id="btn-right-${agentId}">▶</div>
            </div>
            <div class="dpad-row">
              <div class="dpad-btn empty"></div>
              <div class="dpad-btn dir-btn" id="btn-down-${agentId}">▼</div>
              <div class="dpad-btn empty"></div>
            </div>
          </div>

          <!-- Face Buttons -->
          <div class="face-buttons" style="position:relative;">
            <div class="face-btn" style="position:absolute; top:-10px; right:-10px; transform:scale(0.5);" id="btn-r3-${agentId}">R3</div>
            <div class="face-row center-row">
              <div class="face-btn" id="btn-y-${agentId}">Y</div>
            </div>
            <div class="face-row split-row">
              <div class="face-btn" id="btn-x-${agentId}">X</div>
              <div class="face-btn" id="btn-b-${agentId}">B</div>
            </div>
            <div class="face-row center-row">
              <div class="face-btn action-btn" id="btn-a-${agentId}">A</div>
            </div>
          </div>
      </div>
    `;

    this.element.appendChild(this.screenContainer);
    this.element.appendChild(this.whyStrip);
    this.element.appendChild(this.llmtvOverlay);
    document.getElementById(containerId)?.appendChild(this.element);
  }

  public updateFrame(displayArray: readonly number[]): void {
    if (displayArray.length !== 64 * 32) return;

    const imgData = this.ctx.createImageData(64, 32);
    for (let i = 0; i < displayArray.length; i++) {
      const idx = i * 4;
      const colorVal = displayArray[i] ?? 0;
      let r = 0,
        g = 0,
        b = 0;
      const a = 255;

      if (colorVal === 1) {
        // Plane 1: Cyan/Green
        r = 74;
        g = 222;
        b = 128;
      } else if (colorVal === 2) {
        // Plane 2: Orange
        r = 251;
        g = 146;
        b = 60;
      } else if (colorVal === 3) {
        // Plane 1+2: White
        r = 255;
        g = 255;
        b = 255;
      } else if (colorVal > 0) {
        // Other planes: Magenta
        r = 236;
        g = 72;
        b = 153;
      }
      // colorVal 0 stays black.

      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = a;
    }
    this.ctx.putImageData(imgData, 0, 0);
  }

  /** The mode header: "HUNT · self#1 · adv#4" — or "HUNT →" in arrow-only. */
  private renderModeHeader(arena: ArenaReadout): void {
    const concept = document.getElementById(`concept-${this.agentId}`);
    if (!concept) return;
    const selfTrack = arena.tracks.find((t) => t.role === "self");
    const adv = arena.tracks.find((t) => t.role === "adversary");
    const parts = [arena.mode.toUpperCase()];
    if (selfTrack) parts.push(`self#${String(selfTrack.id)}`);
    if (adv) parts.push(`adv#${String(adv.id)}`);
    // D6 arrow-only: with the tracks stripped, the intent vector renders as
    // a bare arrow — mode + intent is ALL this condition may show.
    if (arena.tracks.length === 0 && arena.desired) {
      const glyph = intentArrow(arena.desired.dx, arena.desired.dy);
      if (glyph) parts.push(glyph);
    }
    concept.textContent = parts.join(" · ");
  }

  /** The OCR'd scoreboard: "OCR 2:1 (first to 5)". */
  private renderOcrReadout(arena: ArenaReadout): void {
    const objective = document.getElementById(`objective-${this.agentId}`);
    if (!objective) return;
    // The cart draws the player score in color 2 (left) and the AI score in
    // color 1 (right); the OCR grid carries both with their colors.
    const mine = arena.ocr.find((n) => n.color === 2);
    const theirs = arena.ocr.find((n) => n.color === 1);
    if (!mine && !theirs) {
      objective.textContent = "[NO GLYPHS]";
      return;
    }
    const mineText = mine ? String(mine.value) : "–";
    const theirsText = theirs ? String(theirs.value) : "–";
    // WIN_SCORE lives in the cart (mutual-sim.ts: "5 = player WINS"); saying
    // "first to 5" without the running total left viewers asking what the
    // target even was.
    objective.textContent = `agent ${mineText} — ${theirsText} rival · first to 5 wins`;
    objective.title =
      "The two digits are drawn INSIDE the playfield and are solid: a sprite " +
      "that touches them is blocked, exactly like a wall. The agent reads its " +
      "own score off those pixels — that is its only reward channel.";
  }

  /** One bounding box, positioned in % of the 64×32 grid. */
  private trackBoxHtml(t: ArenaTrackReadout): string {
    const boxColor: Record<ArenaTrackReadout["role"], string> = {
      self: "#22d3ee",
      adversary: "#f87171",
      scenery: "#64748b",
      object: "#eab308",
    };
    const left = ((t.minX / 64) * 100).toFixed(2);
    const top = ((t.minY / 32) * 100).toFixed(2);
    const w = (((t.maxX - t.minX + 1) / 64) * 100).toFixed(2);
    const h = (((t.maxY - t.minY + 1) / 32) * 100).toFixed(2);
    const color = boxColor[t.role];
    const dash = t.role === "scenery" ? "dashed" : "solid";
    return `<div style="position:absolute; left:${left}%; top:${top}%; width:${w}%; height:${h}%; border:1px ${dash} ${color}; box-sizing:border-box;" title="#${String(t.id)} ${t.role}${t.isStatic ? " static" : ""}"></div>`;
  }

  /**
   * Render the forced-perception readout: bounding boxes over the screen
   * (self = cyan, adversary = red, scenery = grey, other = amber), the mode
   * in the header, and the OCR'd scoreboard. This is the "show what it sees"
   * half of the demo — the glow shows what it thinks.
   */
  private renderArena(arena: ArenaReadout | null): void {
    if (!arena) {
      const concept = document.getElementById(`concept-${this.agentId}`);
      if (concept) concept.textContent = "[OBSERVING]";
      const objective = document.getElementById(`objective-${this.agentId}`);
      if (objective) objective.textContent = "[--]";
      // Clear, don't linger: stale boxes over a null arena were invisible
      // before the study's "none" condition made the path reachable.
      this.perceptionOverlay.innerHTML = "";
      return;
    }
    this.renderModeHeader(arena);
    this.renderOcrReadout(arena);
    this.perceptionOverlay.innerHTML = arena.tracks.map((t) => this.trackBoxHtml(t)).join("");
  }

  /** The 16 controller-button element ids, by CHIP-8 key. */
  private buttonIds(): Record<number, string> {
    return {
      0: `btn-start-${this.agentId}`,
      1: `btn-lt-${this.agentId}`,
      2: `btn-up-${this.agentId}`,
      3: `btn-rt-${this.agentId}`,
      4: `btn-left-${this.agentId}`,
      5: `btn-a-${this.agentId}`,
      6: `btn-right-${this.agentId}`,
      7: `btn-x-${this.agentId}`,
      8: `btn-down-${this.agentId}`,
      9: `btn-b-${this.agentId}`,
      10: `btn-lb-${this.agentId}`, // A
      11: `btn-rb-${this.agentId}`, // B
      12: `btn-y-${this.agentId}`, // C
      13: `btn-l3-${this.agentId}`, // D
      14: `btn-r3-${this.agentId}`, // E
      15: `btn-select-${this.agentId}`, // F
    };
  }

  /** Reset all buttons to the dim base style. */
  private resetButtons(keyMap: Record<number, string>): void {
    for (const id of Object.values(keyMap)) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = "0.2";
        btn.style.boxShadow = "none";
        btn.style.transform = "scale(1)";
        btn.style.background = ""; // reset background
      }
    }
  }

  /** RGB probability glow: opacity + red halo scaled by P(key). */
  private applyPredictionGlow(
    keyMap: Record<number, string>,
    predictions: Readonly<Record<number, number>>,
  ): void {
    for (const [keyStr, prob] of Object.entries(predictions)) {
      const key = parseInt(keyStr, 10);
      const id = keyMap[key];
      if (!id || prob <= 0.05) continue;
      const btn = document.getElementById(id);
      if (!btn) continue;
      // Opacity maps from 0.2 to 1.0 based on prob
      btn.style.opacity = (0.2 + prob * 0.8).toFixed(2);
      if (prob > 0.4) {
        // RGB visualization for prediction (Red)
        btn.style.boxShadow = `0 0 ${(10 + prob * 20).toFixed(1)}px rgba(255, 0, 0, ${prob.toFixed(3)})`;
        btn.style.transform = `scale(${(1 + prob * 0.15).toFixed(3)})`;
      }
    }
  }

  /** CMYK override for the keys actually committed/pressed this tick. */
  private applyCommittedGlow(keyMap: Record<number, string>, committedKeys: readonly boolean[]): void {
    for (let k = 0; k < 16; k++) {
      if (!committedKeys[k]) continue;
      const id = keyMap[k];
      if (!id) continue;
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.style.opacity = "1.0";
      btn.style.transform = "scale(1.2)";
      // CMYK visualization for committed (Cyan)
      btn.style.boxShadow = "0 0 20px rgba(0, 255, 255, 1)";
      btn.style.background = "rgba(0, 255, 255, 0.2)";
    }
  }

  /**
   * D3: frost is the uncertainty channel — clear = known, frosted = not
   * known yet, bright = attended right now. D4: the fixation ring MOVES
   * with a fast CSS sweep (the saccade) and settles bright (the fixation);
   * the split is DebouncedOracle's, rendered.
   */
  private renderAttention(att: AttentionFramePayload | null): void {
    const meter = document.getElementById(`attention-${this.agentId}`);
    if (!att) {
      if (meter) meter.textContent = "[--]";
      for (const tile of this.tileDivs) tile.style.opacity = "0";
      this.fixationRing.style.display = "none";
      return;
    }
    this.renderFrostTiles(att);
    this.renderFixation(att);
    if (meter) meter.textContent = this.meterText(att);
  }

  /** Frost thickens with uncertainty; an attended tile reads as clearing. */
  private renderFrostTiles(att: AttentionFramePayload): void {
    let maxV = 0;
    for (const v of att.variance) if (v > maxV) maxV = v;
    const attended = new Set(att.attended);
    for (let t = 0; t < this.tileDivs.length && t < att.variance.length; t++) {
      const tile = this.tileDivs[t];
      if (!tile) continue;
      const variance = att.variance[t] ?? 0;
      const norm = maxV > 0 ? variance / maxV : 0;
      const isAttended = attended.has(t);
      const strength = isAttended ? 0.25 : 0.55;
      const alpha = norm < 0.08 ? 0 : norm * strength;
      tile.style.opacity = alpha.toFixed(3);
      tile.classList.toggle("attended", isAttended);
    }
  }

  /** The ring's left/top transition IS the saccade; the pulse is the settle. */
  private renderFixation(att: AttentionFramePayload): void {
    if (att.fixation === null) {
      this.fixationRing.style.display = "none";
      return;
    }
    this.fixationRing.style.display = "block";
    this.fixationRing.style.left = `${String((att.fixation % att.cols) * 12.5)}%`;
    this.fixationRing.style.top = `${String(Math.floor(att.fixation / att.cols) * 25)}%`;
    if (att.fixation !== this.lastFixation) {
      // Restart the settle pulse (forced reflow between class toggles).
      this.fixationRing.classList.remove("settling");
      this.fixationRing.getBoundingClientRect();
      this.fixationRing.classList.add("settling");
      this.lastFixation = att.fixation;
    }
  }

  private meterText(att: AttentionFramePayload): string {
    let useful: string;
    if (att.usefulWork === "ambiguous") useful = "ambiguous";
    else useful = `${(att.usefulWork * 100).toFixed(0)}%`;
    return `K=${String(att.topK)} useful ${useful} ρ̄ ${att.rho.mean.toFixed(2)}`;
  }

  /**
   * D5 (#14503): one click, one sentence; the next click, the next reason
   * down; the chain saturates at "I don't know." and the click after the
   * terminal closes the strip. Answers are regenerated EVERY FRAME from
   * that frame's own `why` payload — the state that drove the decision —
   * so the sentence on screen tracks the live decision, never a cache.
   */
  /**
   * D6: apply a study condition. Leaving "full" hides the WHY chip and
   * closes an open chain — the overlay family is what the study meters,
   * so a non-full trial must not leak any of it.
   */
  public setOverlayCondition(c: StudyCondition): void {
    this.overlayCondition = c;
    const chip = document.getElementById(`why-${this.agentId}`);
    if (chip) chip.style.display = c === "full" ? "" : "none";
    if (c !== "full" && this.whyDepth !== -1) {
      this.whyDepth = -1;
      this.renderWhy();
    }
  }

  /**
   * The placebo payload: the real frame's SCALAR readouts (meter, ρ — they
   * carry no direction) under fake SPATIAL content (frost, attended set,
   * fixation) that is a pure function of the cycle. Visually a live field;
   * informationally decoupled from the screen.
   */
  private placeboPayload(real: AttentionFramePayload, cycle: number): AttentionFramePayload {
    const fake = placeboAttention(cycle, this.tileDivs.length, real.topK);
    return {
      cols: real.cols,
      rows: real.rows,
      variance: Float32Array.from(fake.variance),
      mean: real.mean,
      attended: fake.attended,
      fixation: fake.fixation,
      usefulWork: real.usefulWork,
      rho: real.rho,
      topK: real.topK,
    };
  }

  private descendWhy(): void {
    if (this.overlayCondition !== "full") return;
    if (this.whyDepth === -1) {
      this.whyDepth = 0;
    } else if (this.lastWhy === null || whyAnswer(this.lastWhy, this.whyDepth) === WHY_TERMINAL) {
      this.whyDepth = -1;
    } else {
      this.whyDepth += 1;
    }
    this.renderWhy();
  }

  private renderWhy(): void {
    if (this.whyDepth === -1) {
      this.whyStrip.style.display = "none";
      return;
    }
    this.whyStrip.style.display = "block";
    if (this.lastWhy === null) {
      this.whyStrip.classList.add("terminal");
      this.whyStrip.textContent = "— no decision on this frame yet —";
      return;
    }
    const answer = whyAnswer(this.lastWhy, this.whyDepth);
    this.whyStrip.classList.toggle("terminal", answer === WHY_TERMINAL);
    // Say WHO is speaking — an unlabelled sentence under a game screen reads
    // as a glitch, not as the agent answering the question it was asked.
    this.whyStrip.textContent = `🧠 ${this.agentId} · why${"?".repeat(this.whyDepth + 1)} ${answer}`;
    this.whyStrip.title =
      answer === WHY_TERMINAL ? "That is the bottom — click to close" : "Click for the next reason down";
  }

  public updatePredictions(frame: FramePayload): void {
    // A backwards cycle jump = the cart was switched and the worker rebooted;
    // the open WHY chain belonged to the old cart's decision, so it closes.
    if (frame.cycle < this.lastCycle) {
      this.whyDepth = -1;
    }
    this.lastCycle = frame.cycle;
    this.lastWhy = this.overlayCondition === "full" ? frame.why : null;
    this.renderWhy();

    // D6: gate what each study condition may SHOW (the payload itself is
    // untouched — the study's scoring reads it regardless of rendering).
    let arena = frame.arena;
    let attention = frame.attention;
    if (this.overlayCondition === "none") {
      arena = null;
      attention = null;
    } else if (this.overlayCondition === "arrow-only") {
      arena = frame.arena
        ? { mode: frame.arena.mode, tracks: [], ocr: [], desired: frame.arena.desired }
        : null;
      attention = null;
    } else if (this.overlayCondition === "placebo") {
      attention = frame.attention ? this.placeboPayload(frame.attention, frame.cycle) : null;
    }

    this.renderArena(arena);
    this.renderAttention(attention);

    // Process BNN predictions (RGB probabilities) and committed keys (CMYK)
    const keyMap = this.buttonIds();
    this.resetButtons(keyMap);
    this.applyPredictionGlow(keyMap, frame.keyPredictions);
    this.applyCommittedGlow(keyMap, frame.keys);
  }
}
