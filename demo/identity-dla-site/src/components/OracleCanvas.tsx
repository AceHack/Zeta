import { useEffect, useRef } from "react";
import { DLAGrid, warmColour } from "@/hooks/useDLA";

interface Props {
  grid: DLAGrid;
  width?: number;
  height?: number;
  className?: string;
}

export default function OracleCanvas({ grid, width = 240, height = 240, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cells, W, H } = grid;
    const sw = canvas.width / W;
    const sh = canvas.height / H;
    const cx = W / 2, cy = H / 2;
    const maxD = Math.hypot(cx, cy);

    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (cells[y * W + x]) {
          ctx.fillStyle = warmColour(x, y, cx, cy, maxD);
          ctx.fillRect(x * sw, y * sh, sw + 0.5, sh + 0.5);
        }
      }
    }
  }, [grid]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={className}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}
