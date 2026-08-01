import { DLAGrid, warmColour } from "@/hooks/useDLA";

interface Props {
  grid: DLAGrid;
  size?: number;
}

export default function OracleSVG({ grid, size = 240 }: Props) {
  const { cells, W, H } = grid;
  const sw = size / W;
  const sh = size / H;
  const cx = W / 2, cy = H / 2;
  const maxD = Math.hypot(cx, cy);

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (cells[y * W + x]) {
        rects.push(
          <rect
            key={y * W + x}
            x={x * sw}
            y={y * sh}
            width={sw + 0.5}
            height={sh + 0.5}
            fill={warmColour(x, y, cx, cy, maxD)}
          />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      style={{ display: "block", background: "#080810", shapeRendering: "crispEdges" }}
    >
      {rects}
    </svg>
  );
}
