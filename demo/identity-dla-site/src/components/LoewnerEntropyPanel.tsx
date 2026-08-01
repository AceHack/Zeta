/**
 * LoewnerEntropyPanel — Real-time Loewner entropy display
 *
 * Design philosophy: Obsidian Ledger — monochrome amber-on-black, mathematical precision
 *
 * Displays S_Loew(t) = -ln(t/κ) as the DLA cluster grows.
 * Marks the t* where S_Loew = ln(3√2) ≈ 1.447 nats — NOTE: this is the tautology -ln(1/x)=ln(x) at the chosen sticking constant, not a physics crossing (Z-3 retracted 2026-08-01).
 *
 * Conjecture Z-3: S_Loew at the sticking constant = ln(3√2) ≈ 1.447 nats [tautology; Z-3 retracted]
 *
 * The Loewner entropy is the information-theoretic content of the SLE_κ driver.
 * At t = t*, the system is at the quantum correlation ceiling — the same threshold
 * that drives the DLA sticking probability.
 */

import { useEffect, useRef, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const STICKING_THRESHOLD = 1 / (3 * Math.SQRT2);
const LOEWNER_TARGET = Math.log(3 * Math.SQRT2); // ≈ 1.447 nats
const KAPPA_OBS = 2.67;
const KAPPA_DLA = 5.7;

// ── Props ─────────────────────────────────────────────────────────────────────
interface LoewnerEntropyPanelProps {
  /** Current walker count (proxy for time t) */
  walkerCount: number;
  /** Total walkers (normalizes t to [0, T]) */
  totalWalkers: number;
  /** Current D_f from Oracle 1 (Canvas) */
  currentDf?: number;
  width?: number;
  height?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loewnerEntropy(t: number, kappa: number): number {
  if (t <= 0) return Infinity;
  return Math.max(0, -Math.log(t / kappa));
}

// t* where S_Loew = ln(3√2): t* = κ · STICKING_THRESHOLD
function tStar(kappa: number): number {
  return kappa * STICKING_THRESHOLD;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoewnerEntropyPanel({
  walkerCount,
  totalWalkers,
  currentDf,
  width = 1040,
  height = 120,
}: LoewnerEntropyPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Normalize walker count to time t ∈ [0.01, T_max]
  // We scale so that t* (sticking-threshold crossing) occurs at ~30% of total walkers
  const T_MAX = 5.0;
  const t = useMemo(() => {
    if (totalWalkers === 0) return 0.01;
    return Math.max(0.01, (walkerCount / totalWalkers) * T_MAX);
  }, [walkerCount, totalWalkers]);

  const tStarObs = tStar(KAPPA_OBS);   // ≈ 0.630
  const tStarDLA = tStar(KAPPA_DLA);   // ≈ 1.343
  const sLoewObs = loewnerEntropy(t, KAPPA_OBS);
  const sLoewDLA = loewnerEntropy(t, KAPPA_DLA);
  const crossedObs = t >= tStarObs;
  const crossedDLA = t >= tStarDLA;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, width, height);

    const padL = 60, padR = 20, padT = 16, padB = 28;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // S_Loew range: [0, 4]
    const S_MAX = 4.0;

    // Map t → x, S → y
    const tx = (tv: number) => padL + (tv / T_MAX) * plotW;
    const sy = (sv: number) => padT + plotH - (Math.min(sv, S_MAX) / S_MAX) * plotH;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let s = 0; s <= S_MAX; s += 1) {
      ctx.beginPath(); ctx.moveTo(padL, sy(s)); ctx.lineTo(padL + plotW, sy(s)); ctx.stroke();
    }
    for (let tv = 0; tv <= T_MAX; tv += 1) {
      ctx.beginPath(); ctx.moveTo(tx(tv), padT); ctx.lineTo(tx(tv), padT + plotH); ctx.stroke();
    }

    // Target line: S_Loew = ln(3√2) ≈ 1.447
    ctx.strokeStyle = "rgba(245,158,11,0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, sy(LOEWNER_TARGET));
    ctx.lineTo(padL + plotW, sy(LOEWNER_TARGET));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw S_Loew curves
    const curves = [
      { kappa: KAPPA_OBS, color: "#2dd4bf", label: `κ=${KAPPA_OBS} (obs)` },
      { kappa: KAPPA_DLA, color: "#a78bfa", label: `κ=${KAPPA_DLA} (DLA)` },
    ];

    for (const { kappa, color } of curves) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 200; i++) {
        const tv = 0.01 + (i / 200) * T_MAX;
        const sv = loewnerEntropy(tv, kappa);
        if (sv > S_MAX + 0.5) continue;
        const px = tx(tv), py = sy(sv);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Current time marker
    const curX = tx(t);
    ctx.strokeStyle = "rgba(245,158,11,0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // t* markers
    for (const { kappa, color } of curves) {
      const ts = tStar(kappa);
      const px = tx(ts);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      // Dot at crossing
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, sy(LOEWNER_TARGET), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(107,114,128,0.7)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText("S_Loew", 2, padT + plotH / 2);
    ctx.fillText("t", padL + plotW - 6, padT + plotH + 14);
    // Y ticks
    for (let s = 0; s <= S_MAX; s += 1) {
      ctx.fillText(s.toString(), padL - 18, sy(s) + 3);
    }
    // Target label
    ctx.fillStyle = "rgba(245,158,11,0.6)";
    ctx.fillText(`ln(3√2)≈${LOEWNER_TARGET.toFixed(3)}`, padL + 4, sy(LOEWNER_TARGET) - 3);

    // Current S_Loew dots
    for (const { kappa, color } of curves) {
      const sv = loewnerEntropy(t, kappa);
      if (sv <= S_MAX) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(curX, sy(sv), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [t, width, height]);

  return (
    <div style={{
      background: "rgba(7,7,15,0.95)",
      border: "1px solid rgba(255,255,255,0.07)",
      padding: "0.75rem 1rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ fontSize: "0.65rem", color: "rgba(245,158,11,0.9)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Loewner Entropy — S_Loew(t) = −ln(t/κ)
        </div>
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.58rem", flexWrap: "wrap" }}>
          <span style={{ color: "#2dd4bf" }}>
            κ={KAPPA_OBS} · S={sLoewObs.toFixed(3)}{" "}
            {crossedObs ? <span style={{ color: "rgba(245,158,11,0.9)" }}>✓ t* crossed</span> : `(t*=${tStarObs.toFixed(3)})`}
          </span>
          <span style={{ color: "#a78bfa" }}>
            κ={KAPPA_DLA} · S={sLoewDLA.toFixed(3)}{" "}
            {crossedDLA ? <span style={{ color: "rgba(245,158,11,0.9)" }}>✓ t* crossed</span> : `(t*=${tStarDLA.toFixed(3)})`}
          </span>
          {currentDf !== undefined && (
            <span style={{ color: "rgba(245,158,11,0.7)" }}>
              D_f={currentDf.toFixed(3)} · t={t.toFixed(3)}
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width: "100%", height: "auto" }}
      />

      {/* Conjecture Z-3 note */}
      <div style={{ fontSize: "0.55rem", color: "rgba(107,114,128,0.6)", lineHeight: 1.7 }}>
        <span style={{ color: "rgba(245,158,11,0.5)" }}>Conjecture Z-3:</span>{" "}
        S_Loew at the sticking constant → ln(3√2) ≈ {LOEWNER_TARGET.toFixed(4)} nats.
        The amber dashed line marks this target. Vertical dashed lines mark t* for each κ.
        The orange dot is the current time t (proportional to walker count).
        {" "}<span style={{ color: "#2dd4bf" }}>Teal = κ={KAPPA_OBS} (observed D_f ≈ 1.322)</span>.{" "}
        <span style={{ color: "#a78bfa" }}>Purple = κ={KAPPA_DLA} (theoretical DLA D_f ≈ 1.71)</span>.
        When the orange marker crosses a t* line, the cluster has reached the sticking-constant entropy value.
      </div>
    </div>
  );
}

export { LOEWNER_TARGET, tStar, loewnerEntropy };
