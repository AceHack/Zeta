export interface Chip8TvState {
  readonly display: boolean[]; // 64x32
  readonly cycle: number;
  readonly causalSignature: string;
  readonly hat: string;
  readonly keyPredictions?: Record<number, number>;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export const CHIP8_TV_CSS = `
  :root {
    --bg: #0b0f19;
    --panel: #12131a;
    --scan: rgba(255, 255, 255, 0.015);
    --txt: #e8ecf6;
    --txt-dim: #565f7d;
    --phosphor-on: #5ec8c2;
    --phosphor-off: #1c2638;
    --c-hot: #9a8ce6;
    --mono: 'Space Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --disp: 'Space Grotesk', system-ui, sans-serif;
  }
  
  body {
    margin: 0;
    padding: 2rem;
    background-color: var(--bg);
    color: var(--txt);
    font-family: var(--mono);
    display: flex;
    flex-direction: column;
    align-items: center;
    background-image: repeating-linear-gradient(0deg, var(--scan) 0 1px, transparent 1px 3px);
  }

  .tv-container {
    border: 1px solid #2f3850;
    border-radius: 12px;
    background: var(--panel);
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    max-width: 800px;
    width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #2f3850;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }

  .title {
    font-family: var(--disp);
    font-size: 1.4rem;
    font-weight: 600;
  }

  .title small {
    color: var(--txt-dim);
    font-size: 0.8rem;
    font-family: var(--mono);
    letter-spacing: 0.1em;
  }

  .status-pill {
    background: rgba(94, 200, 194, 0.1);
    color: var(--phosphor-on);
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border: 1px solid var(--phosphor-on);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .meta-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2f3850;
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.8rem;
  }

  .meta-label {
    color: var(--txt-dim);
    text-transform: uppercase;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    margin-bottom: 0.3rem;
  }

  .meta-value {
    color: var(--c-hot);
    font-weight: bold;
    word-break: break-all;
  }

  .screen-bezel {
    background: #05070a;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: inset 0 0 20px rgba(0,0,0,1);
    border: 2px solid #1a2030;
    position: relative;
    overflow: hidden;
  }

  .screen-bezel::after {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size: 100% 2px, 3px 100%;
    pointer-events: none;
    z-index: 10;
  }

  .chip8-display {
    display: grid;
    grid-template-columns: repeat(64, 1fr);
    gap: 1px;
    aspect-ratio: 2/1;
    width: 100%;
    background: #000;
  }

  .pixel {
    background: var(--phosphor-off);
    border-radius: 1px;
  }

  .pixel.on {
    background: var(--phosphor-on);
    box-shadow: 0 0 8px var(--phosphor-on), 0 0 2px #fff;
    /* Blur effect for retro feel */
    filter: blur(0.4px);
  }

  .keypad-container {
    margin-top: 1.5rem;
    display: flex;
    justify-content: center;
  }
  
  .hex-keypad {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    width: 250px;
  }
  
  .keypad-btn {
    background: #1a2030;
    border: 2px solid #2f3850;
    border-radius: 4px;
    color: var(--txt-dim);
    font-family: var(--mono);
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0.5rem;
    text-align: center;
    transition: all 0.1s ease-in-out;
    position: relative;
  }
  
  .keypad-btn::after {
    content: attr(data-prob);
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 0.5rem;
    color: var(--txt-dim);
    opacity: 0.7;
  }
`;

export function renderChip8TvDocument(state: Chip8TvState): string {
  // Build the display
  let pixelsHtml = "";
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = x + y * 64;
      const isOn = state.display[idx];
      pixelsHtml += `<div class="pixel ${isOn ? 'on' : ''}"></div>`;
    }
  }

  // Build the keypad
  let keypadHtml = "";
  const hexKeys = [
    1, 2, 3, 0xC,
    4, 5, 6, 0xD,
    7, 8, 9, 0xE,
    0xA, 0, 0xB, 0xF
  ];
  
  if (state.keyPredictions) {
    for (const key of hexKeys) {
      const prob = state.keyPredictions[key] || 0;
      const intensity = Math.min(1.0, prob * 3); // scale up for visual effect
      const glow = `box-shadow: 0 0 ${intensity * 15}px rgba(94, 200, 194, ${intensity}); border-color: rgba(94, 200, 194, ${intensity + 0.2}); color: rgba(255, 255, 255, ${intensity + 0.5})`;
      const bg = `background: rgba(94, 200, 194, ${intensity * 0.3})`;
      
      keypadHtml += `<div class="keypad-btn" style="${glow}; ${bg}" data-prob="${(prob*100).toFixed(0)}%">${key.toString(16).toUpperCase()}</div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CHIP-8 LLMTV Live Feed</title>
  <style>${CHIP8_TV_CSS}</style>
</head>
<body>
  <div class="tv-container">
    <div class="header">
      <div class="title">
        LLMTV <small>CHIP-8 FEED</small>
      </div>
      <div class="status-pill">LIVE</div>
    </div>
    
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Active Pilot Hat</div>
        <div class="meta-value">${escapeHtml(state.hat)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Causal Orbit Signature</div>
        <div class="meta-value" style="color: var(--phosphor-on);">${escapeHtml(state.causalSignature)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Environment Cycle</div>
        <div class="meta-value" style="color: var(--txt);">${state.cycle}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Signal Source</div>
        <div class="meta-value" style="color: var(--txt-dim);">C. elegans Kuramoto Connectome</div>
      </div>
    </div>

    <div class="screen-bezel">
      <div class="chip8-display">
        ${pixelsHtml}
      </div>
    </div>
    
    ${state.keyPredictions ? `
    <div class="keypad-container">
      <div class="hex-keypad">
        ${keypadHtml}
      </div>
    </div>
    ` : ''}
  </div>

  <script>
    // Auto-reload the feed periodically to act like a live broadcast
    setTimeout(() => {
      window.location.reload();
    }, 100); // refresh 10 times a second
  </script>
</body>
</html>`;
}
