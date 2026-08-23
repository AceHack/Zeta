export class Chip8TvPlayer {
  private element: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private llmtvOverlay: HTMLElement;
  private screenContainer: HTMLElement;
  private perceptionOverlay: HTMLElement;
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
    this.ctx = this.canvas.getContext("2d")!;

    // Clear to black initially
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, 64, 32);

    const headerContainer = document.createElement("div");
    headerContainer.className = "screen-header";
    headerContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%;">
        <span><span class="concept-label">🧠 Mode:</span> <span class="concept-value" id="concept-${agentId}">[INITIALIZING]</span></span>
        <span class="objective-header">🎯 <span class="objective-value" id="objective-${agentId}">[WAITING]</span></span>
      </div>
    `;

    this.screenContainer.appendChild(headerContainer);
    // The canvas and the perception overlay share one positioned wrapper so
    // bounding boxes (in % of the 64×32 grid) land exactly on the pixels.
    const canvasWrap = document.createElement("div");
    canvasWrap.style.position = "relative";
    this.canvas.style.display = "block";
    canvasWrap.appendChild(this.canvas);
    this.perceptionOverlay = document.createElement("div");
    this.perceptionOverlay.style.position = "absolute";
    this.perceptionOverlay.style.inset = "0";
    this.perceptionOverlay.style.pointerEvents = "none";
    canvasWrap.appendChild(this.perceptionOverlay);
    this.screenContainer.appendChild(canvasWrap);
    
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
    this.element.appendChild(this.llmtvOverlay);
    document.getElementById(containerId)?.appendChild(this.element);
  }

  public updateFrame(displayArray: number[]) {
    if (!displayArray || displayArray.length !== 64 * 32) return;
    
    const imgData = this.ctx.createImageData(64, 32);
    for (let i = 0; i < displayArray.length; i++) {
      const idx = i * 4;
      const colorVal = displayArray[i] ?? 0;
      let r = 0, g = 0, b = 0, a = 255;
      
      if (colorVal === 1) { // Plane 1: Cyan/Green
        r = 74; g = 222; b = 128;
      } else if (colorVal === 2) { // Plane 2: Orange
        r = 251; g = 146; b = 60;
      } else if (colorVal === 3) { // Plane 1+2: White
        r = 255; g = 255; b = 255;
      } else if (colorVal > 0) { // Other planes: Magenta
        r = 236; g = 72; b = 153;
      } else {
        a = 255; // Black
      }

      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = a;
    }
    this.ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Render the forced-perception readout: bounding boxes over the screen
   * (self = cyan, adversary = red, scenery = grey, other = amber), the mode
   * in the header, and the OCR'd scoreboard. This is the "show what it sees"
   * half of the demo — the glow shows what it thinks.
   */
  private renderArena(arena: any) {
    const concept = document.getElementById(`concept-${this.agentId}`);
    const objective = document.getElementById(`objective-${this.agentId}`);
    if (!arena) {
      if (concept) concept.textContent = "[OBSERVING]";
      return;
    }

    if (concept) {
      const self = (arena.tracks || []).find((t: any) => t.role === "self");
      const adv = (arena.tracks || []).find((t: any) => t.role === "adversary");
      const parts = [String(arena.mode || "?").toUpperCase()];
      if (self) parts.push(`self#${self.id}`);
      if (adv) parts.push(`adv#${adv.id}`);
      concept.textContent = parts.join(" · ");
    }
    if (objective) {
      // The cart draws the player score in color 2 (left) and the AI score in
      // color 1 (right); the OCR grid carries both with their colors.
      const ocr = arena.ocr || [];
      const mine = ocr.find((n: any) => n.color === 2);
      const theirs = ocr.find((n: any) => n.color === 1);
      objective.textContent =
        mine || theirs
          ? `OCR ${mine ? mine.value : "–"}:${theirs ? theirs.value : "–"} (first to 5)`
          : "[NO GLYPHS]";
    }

    const boxColor: Record<string, string> = {
      self: "#22d3ee",
      adversary: "#f87171",
      scenery: "#64748b",
      object: "#eab308",
    };
    let html = "";
    for (const t of arena.tracks || []) {
      const left = (t.minX / 64) * 100;
      const top = (t.minY / 32) * 100;
      const w = ((t.maxX - t.minX + 1) / 64) * 100;
      const h = ((t.maxY - t.minY + 1) / 32) * 100;
      const color = boxColor[t.role as string] ?? boxColor["object"];
      const dash = t.role === "scenery" ? "dashed" : "solid";
      html += `<div style="position:absolute; left:${left}%; top:${top}%; width:${w}%; height:${h}%; border:1px ${dash} ${color}; box-sizing:border-box;" title="#${t.id} ${t.role}${t.isStatic ? " static" : ""}"></div>`;
    }
    this.perceptionOverlay.innerHTML = html;
  }

  public updatePredictions(frame: any) {
    if (!frame) return;

    this.renderArena(frame.arena);

    // Process BNN predictions (RGB probabilities) and committed keys (CMYK)
    const predictions = frame.keyPredictions || {};
    const committedKeys = frame.keys || [];
    
    const keyMap: Record<number, string> = {
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
      12: `btn-y-${this.agentId}`,  // C
      13: `btn-l3-${this.agentId}`, // D
      14: `btn-r3-${this.agentId}`, // E
      15: `btn-select-${this.agentId}` // F
    };

    // Reset all buttons to base style
    Object.values(keyMap).forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = '0.2';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'scale(1)';
        btn.style.background = ''; // reset background
      }
    });

    // Apply RGB probability bars (using box-shadow/opacity for visual "bar-like" intensity)
    for (const [keyStr, probRaw] of Object.entries(predictions)) {
      const key = parseInt(keyStr, 10);
      const prob = probRaw as number;
      const id = keyMap[key];
      if (id && prob > 0.05) {
        const btn = document.getElementById(id);
        if (btn) {
          // Opacity maps from 0.2 to 1.0 based on prob
          btn.style.opacity = (0.2 + (prob * 0.8)).toFixed(2);
          
          if (prob > 0.4) {
            // RGB visualization for prediction (Red)
            btn.style.boxShadow = `0 0 ${10 + (prob * 20)}px rgba(255, 0, 0, ${prob})`;
            btn.style.transform = `scale(${1 + (prob * 0.15)})`;
          }
        }
      }
    }

    // Override with CMYK for actually committed/pressed keys
    for (let k = 0; k < 16; k++) {
      if (committedKeys[k]) {
        const id = keyMap[k];
        if (id) {
          const btn = document.getElementById(id);
          if (btn) {
            btn.style.opacity = '1.0';
            btn.style.transform = 'scale(1.2)';
            // CMYK visualization for committed (Cyan)
            btn.style.boxShadow = `0 0 20px rgba(0, 255, 255, 1)`;
            btn.style.background = 'rgba(0, 255, 255, 0.2)';
          }
        }
      }
    }
  }
}
