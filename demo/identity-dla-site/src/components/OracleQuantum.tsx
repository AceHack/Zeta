/**
 * OracleQuantum — Oracle 5: Q# quantum walk DLA
 *
 * Renders two layers on a single canvas:
 *   1. Background: |ψ|² probability density as a cold-blue heatmap (the ZSet field)
 *   2. Foreground: collapsed cluster cells in warm amber (the GSet — measurement outcome)
 *
 * The interference fringes in the density field are visible as the cold
 * blue/teal pattern beneath the orange cluster. These are the quantum
 * interference terms — the thing that has no classical analogue.
 */
import { useEffect, useRef } from "react";
import { QuantumGrid } from "@/hooks/useQuantumWalk";

interface Props {
  grid: QuantumGrid;
  width?: number;
  height?: number;
}

export default function OracleQuantum({ grid, width = 240, height = 240 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cells, density, W, H } = grid;
    const sw = canvas.width / W;
    const sh = canvas.height / H;

    // Find max density for normalisation
    let maxD = 0;
    for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];

    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const p = maxD > 0 ? density[idx] / maxD : 0;

        if (cells[idx]) {
          // Collapsed / stuck: warm amber-orange (GSet)
          const cx = W / 2, cy = H / 2;
          const t = Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy);
          const r = Math.round(255 - t * 51);
          const g = Math.round(170 - t * 170);
          ctx.fillStyle = `rgb(${r},${g},0)`;
        } else if (p > 0.02) {
          // Probability density: cold blue-teal interference field (ZSet)
          const intensity = Math.pow(p, 0.4); // gamma compress for visibility
          const r = Math.round(10 + intensity * 20);
          const g = Math.round(30 + intensity * 80);
          const b = Math.round(60 + intensity * 140);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          continue; // skip background pixels
        }

        ctx.fillRect(x * sw, y * sh, sw + 0.5, sh + 0.5);
      }
    }
  }, [grid]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}
