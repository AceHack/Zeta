/**
 * KappaPhaseDiagram -- SLE_kappa phase diagram
 *
 * Design: Dark Matter Observatory -- monochrome amber-on-black
 *
 * Shows D_f = 1 + kappa/8 vs kappa with:
 *   - Three regime markers: simple curve (kappa < 4), space-filling (kappa = 4), self-intersecting (kappa > 4)
 *   - DLA observed value: kappa ~ 2.67 (D_f ~ 1.334)
 *   - DLA theoretical conjecture: kappa ~ 5.7 (D_f ~ 1.71) -- Conjecture Z-4
 *   - sticking-threshold line: D_f = 1 + STICKING_THRESHOLD = 1.2357
 *   - Known SLE universality classes: SAW (kappa=2), LERW (kappa=2), Ising (kappa=3), percolation (kappa=6), UST (kappa=8)
 */
import { useEffect, useRef } from "react";

const STICKING_THRESHOLD = 1 / (3 * Math.SQRT2); // ~ 0.2357

// D_f = 1 + kappa/8 for kappa <= 8, else 2
function df(kappa: number): number {
  return kappa <= 8 ? 1 + kappa / 8 : 2;
}

const UNIVERSALITY_CLASSES = [
  { kappa: 2.0,  label: "SAW / LERW",        color: "#34d399", df: df(2.0)  },
  { kappa: 3.0,  label: "Ising cluster",      color: "#60a5fa", df: df(3.0)  },
  { kappa: 4.0,  label: "GFF level line",     color: "#f59e0b", df: df(4.0)  },
  { kappa: 6.0,  label: "Percolation",        color: "#f87171", df: df(6.0)  },
  { kappa: 8.0,  label: "UST Peano curve",    color: "#e879f9", df: df(8.0)  },
];

const DLA_OBSERVED  = { kappa: 2.67, label: "DLA observed",     color: "#2dd4bf", df: df(2.67) };
const DLA_THEORY    = { kappa: 5.7,  label: "DLA theoretical (Z-4)", color: "#a78bfa", df: df(5.7)  };

export default function KappaPhaseDiagram({ width = 900, height = 260 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD_L = 52, PAD_R = 20, PAD_T = 28, PAD_B = 44;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const kappaMax = 10;
    const dfMin = 1.0, dfMax = 2.1;

    const toX = (k: number) => PAD_L + (k / kappaMax) * plotW;
    const toY = (d: number) => PAD_T + plotH - ((d - dfMin) / (dfMax - dfMin)) * plotH;

    // Background
    ctx.fillStyle = "oklch(0.10 0.01 265)";
    ctx.fillRect(0, 0, W, H);

    // Regime shading
    // kappa < 4: simple curve (teal tint)
    ctx.fillStyle = "rgba(45,212,191,0.04)";
    ctx.fillRect(PAD_L, PAD_T, toX(4) - PAD_L, plotH);
    // kappa > 4: self-intersecting (red tint)
    ctx.fillStyle = "rgba(248,113,113,0.04)";
    ctx.fillRect(toX(4), PAD_T, toX(kappaMax) - toX(4), plotH);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let k = 0; k <= kappaMax; k += 2) {
      ctx.beginPath(); ctx.moveTo(toX(k), PAD_T); ctx.lineTo(toX(k), PAD_T + plotH); ctx.stroke();
    }
    for (let d = 1.0; d <= 2.1; d += 0.25) {
      ctx.beginPath(); ctx.moveTo(PAD_L, toY(d)); ctx.lineTo(PAD_L + plotW, toY(d)); ctx.stroke();
    }

    // Regime boundary at kappa=4
    ctx.strokeStyle = "rgba(245,158,11,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toX(4), PAD_T); ctx.lineTo(toX(4), PAD_T + plotH); ctx.stroke();
    ctx.setLineDash([]);

    // sticking D_f line: D_f = 1 + STICKING_THRESHOLD ~ 1.2357
    const tsirelsonDf = 1 + STICKING_THRESHOLD;
    ctx.strokeStyle = "rgba(245,158,11,0.5)";
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD_L, toY(tsirelsonDf)); ctx.lineTo(PAD_L + plotW, toY(tsirelsonDf)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(245,158,11,0.6)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`D_f = 1+rho ~ ${tsirelsonDf.toFixed(4)}`, PAD_L + 4, toY(tsirelsonDf) - 3);

    // D_f = 2 ceiling
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([2, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, toY(2.0)); ctx.lineTo(PAD_L + plotW, toY(2.0)); ctx.stroke();
    ctx.setLineDash([]);

    // Main D_f = 1 + kappa/8 curve
    ctx.strokeStyle = "rgba(245,158,11,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 8; k += 0.05) {
      const x = toX(k);
      const y = toY(df(k));
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Flat at D_f=2 for kappa > 8
    ctx.strokeStyle = "rgba(245,158,11,0.4)";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(toX(8), toY(2.0));
    ctx.lineTo(toX(kappaMax), toY(2.0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Universality class dots
    UNIVERSALITY_CLASSES.forEach(({ kappa, label, color, df: d }) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(kappa), toY(d), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(label, toX(kappa) + 7, toY(d) + 3);
    });

    // DLA observed (teal, larger)
    ctx.fillStyle = DLA_OBSERVED.color;
    ctx.beginPath();
    ctx.arc(toX(DLA_OBSERVED.kappa), toY(DLA_OBSERVED.df), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DLA_OBSERVED.color;
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillText(DLA_OBSERVED.label, toX(DLA_OBSERVED.kappa) + 9, toY(DLA_OBSERVED.df) + 3);

    // DLA theoretical (purple, larger, dashed circle)
    ctx.strokeStyle = DLA_THEORY.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(toX(DLA_THEORY.kappa), toY(DLA_THEORY.df), 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = DLA_THEORY.color;
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillText(DLA_THEORY.label, toX(DLA_THEORY.kappa) + 9, toY(DLA_THEORY.df) + 3);

    // Axis labels
    ctx.fillStyle = "rgba(107,114,128,0.7)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    // X axis ticks
    for (let k = 0; k <= kappaMax; k += 2) {
      ctx.fillText(k.toString(), toX(k) - 4, PAD_T + plotH + 14);
    }
    ctx.fillText("kappa", PAD_L + plotW / 2 - 16, H - 6);
    // Y axis ticks
    for (let d = 1.0; d <= 2.0; d += 0.25) {
      ctx.fillText(d.toFixed(2), 2, toY(d) + 4);
    }
    ctx.save();
    ctx.translate(12, PAD_T + plotH / 2 + 16);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("D_f", 0, 0);
    ctx.restore();

    // Regime labels
    ctx.fillStyle = "rgba(45,212,191,0.5)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText("simple curve (kappa < 4)", PAD_L + 4, PAD_T + 12);
    ctx.fillStyle = "rgba(248,113,113,0.5)";
    ctx.fillText("self-intersecting (kappa > 4)", toX(4.1), PAD_T + 12);

  }, [width, height]);

  return (
    <div style={{
      background: "oklch(0.10 0.01 265)",
      border: "1px solid oklch(0.25 0.05 265 / 0.6)",
      padding: "0.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "oklch(0.72 0.18 290)", marginBottom: "0.2rem",
          }}>
            SLE_kappa Phase Diagram -- D_f = 1 + kappa/8
          </div>
          <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)" }}>
            Teal dot = DLA observed (kappa ~ 2.67) -- Purple circle = DLA theoretical Z-4 (kappa ~ 5.7) -- Amber line = sticking-constant D_f line
          </div>
        </div>
        <div style={{
          fontSize: "0.52rem", color: "oklch(0.72 0.18 290)",
          padding: "0.2rem 0.5rem",
          border: "1px solid oklch(0.45 0.18 290 / 0.4)",
          background: "oklch(0.12 0.04 290 / 0.2)",
          letterSpacing: "0.06em",
        }}>
          Conjecture Z-4
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.4rem",
        fontSize: "0.5rem",
        color: "var(--muted-foreground)",
      }}>
        <div style={{ padding: "0.3rem 0.5rem", border: "1px solid rgba(45,212,191,0.2)", background: "rgba(45,212,191,0.05)" }}>
          <span style={{ color: "#2dd4bf", fontWeight: 700 }}>DLA observed:</span>{" "}
          kappa ~ 2.67, D_f ~ {df(2.67).toFixed(3)} -- close to measured 1.322
        </div>
        <div style={{ padding: "0.3rem 0.5rem", border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.05)" }}>
          <span style={{ color: "#a78bfa", fontWeight: 700 }}>DLA theoretical (Z-4):</span>{" "}
          kappa ~ 5.7, D_f ~ {df(5.7).toFixed(3)} -- SLE_kappa harmonic measure conjecture
        </div>
        <div style={{ padding: "0.3rem 0.5rem", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)" }}>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Gap:</span>{" "}
          D_f(theory) - D_f(observed) = {(df(5.7) - df(2.67)).toFixed(3)} -- the open question in DLA universality
        </div>
      </div>
    </div>
  );
}
