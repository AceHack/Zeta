import { useEffect, useRef } from "react";
import { DLAGrid, warmColour } from "@/hooks/useDLA";

interface Props {
  grid: DLAGrid;
  size?: number;
}

export default function OracleCSS({ grid, size = 240 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !grid) return;
    const { cells, W, H } = grid;
    const scale = size / W;
    const cx = W / 2, cy = H / 2;
    const maxD = Math.hypot(cx, cy);
    const shadows: string[] = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (cells[y * W + x]) {
          const col = warmColour(x, y, cx, cy, maxD);
          shadows.push(`${x * scale}px ${y * scale}px 0 ${Math.max(scale - 1, 1)}px ${col}`);
        }
      }
    }
    el.style.boxShadow = shadows.join(",");
  }, [grid, size]);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        overflow: "hidden",
        background: "#080810",
      }}
    >
      {/* The single 1×1 pixel that carries the entire cluster via box-shadow */}
      <div
        ref={ref}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          background: "transparent",
        }}
      />
    </div>
  );
}
