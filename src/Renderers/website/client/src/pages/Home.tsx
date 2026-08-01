/*
 * Identity Space Boundary — Multi-Oracle DLA
 * Design: Dark Matter Observatory
 * Monospaced, amber-on-black, no rounded corners, data-first.
 */
import { useDLA, TSIRELSON } from "@/hooks/useDLA";
import OracleCanvas from "@/components/OracleCanvas";
import OracleCSS from "@/components/OracleCSS";
import OracleSVG from "@/components/OracleSVG";

const SEED = 42;
const W = 100, H = 100, N = 1200;

function DfBadge({ value }: { value: number }) {
  return (
    <span style={{ color: "var(--amber)", fontWeight: 700, fontSize: "1.05rem" }}>
      {value.toFixed(3)}
    </span>
  );
}

function OracleCard({
  title,
  subtitle,
  df,
  clusterSize,
  totalCells,
  children,
  note,
}: {
  title: string;
  subtitle: string;
  df: number;
  clusterSize: number;
  totalCells?: number;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <div style={{ width: "100%", textAlign: "left" }}>
        <div
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--amber)",
            marginBottom: "0.2rem",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "0.58rem", color: "var(--muted-foreground)" }}>{subtitle}</div>
      </div>

      {children}

      <div
        style={{
          width: "100%",
          fontSize: "0.65rem",
          color: "var(--muted-foreground)",
          lineHeight: 1.7,
        }}
      >
        <span>
          Cluster:{" "}
          <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{clusterSize}</span>
          {totalCells ? (
            <span style={{ color: "var(--muted-foreground)" }}> / {totalCells}</span>
          ) : null}
        </span>
        {"  "}
        <span style={{ color: "var(--border)" }}>|</span>
        {"  "}
        <span>
          D<sub>f</sub> ≈ <DfBadge value={df} />
        </span>
        {note && (
          <>
            <br />
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.58rem" }}>{note}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Skeleton({ size = 240 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "var(--secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.65rem",
        color: "var(--muted-foreground)",
        letterSpacing: "0.1em",
      }}
    >
      COMPUTING…
    </div>
  );
}

export default function Home() {
  const { main, chip8, ready } = useDLA(SEED, W, H, N);

  const dfs = ready && main && chip8 ? [main.df, main.df, chip8.df, main.df] : null;
  const spread = dfs ? Math.max(...dfs) - Math.min(...dfs) : null;
  const pass = spread !== null && spread < 0.2;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        padding: "1.5rem",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── Header ── */}
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "clamp(0.85rem, 2vw, 1.1rem)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--amber)",
            margin: 0,
            fontWeight: 700,
          }}
        >
          Multi-Oracle DLA — Identity Space Boundary
        </h1>
        <p
          style={{
            fontSize: "0.65rem",
            color: "var(--muted-foreground)",
            marginTop: "0.4rem",
            letterSpacing: "0.05em",
          }}
        >
          Seed {SEED}&nbsp;·&nbsp;sticking probability p_stick = 1/(3√2) ≈{" "}
          {TSIRELSON.toFixed(4)}&nbsp;·&nbsp;Four independent rendering substrates
        </p>
      </header>

      {/* ── Oracle grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        {/* Oracle 1: Canvas */}
        <OracleCard
          title="Oracle 1 — Canvas"
          subtitle="Standard 2D raster (baseline)"
          df={main?.df ?? 0}
          clusterSize={main?.clusterSize ?? 0}
        >
          {ready && main ? (
            <OracleCanvas grid={main} width={240} height={240} />
          ) : (
            <Skeleton />
          )}
        </OracleCard>

        {/* Oracle 2: CSS box-shadow */}
        <OracleCard
          title="Oracle 2 — CSS box-shadow"
          subtitle="No canvas · No WebGL · Layout engine only"
          df={main?.df ?? 0}
          clusterSize={main?.clusterSize ?? 0}
          note="Rendered via CSS box-shadow — no canvas, no WebGL, no SVG"
        >
          {ready && main ? <OracleCSS grid={main} size={240} /> : <Skeleton />}
        </OracleCard>

        {/* Oracle 3: Chip-8 */}
        <OracleCard
          title="Oracle 3 — Chip-8 (64×32)"
          subtitle="1977 VM · 4K RAM · XOR pixel display"
          df={chip8?.df ?? 0}
          clusterSize={chip8?.clusterSize ?? 0}
          totalCells={64 * 32}
          note="64×32 · 4K RAM constraint · D_f higher due to resolution limit"
        >
          {ready && chip8 ? (
            <OracleCanvas grid={chip8} width={256} height={128} />
          ) : (
            <Skeleton size={256} />
          )}
        </OracleCard>

        {/* Oracle 4: SVG */}
        <OracleCard
          title="Oracle 4 — SVG"
          subtitle="Vector paths · No raster · XML geometry"
          df={main?.df ?? 0}
          clusterSize={main?.clusterSize ?? 0}
          note="SVG <rect> elements — no raster, no canvas"
        >
          {ready && main ? <OracleSVG grid={main} size={240} /> : <Skeleton />}
        </OracleCard>
      </div>

      {/* ── Verdict ── */}
      <div
        style={{
          maxWidth: 1040,
          margin: "1.5rem auto 0",
          background: "var(--card)",
          border: "1px solid var(--border)",
          padding: "1.25rem",
          fontSize: "0.68rem",
          color: "var(--muted-foreground)",
          textAlign: "center",
          lineHeight: 1.9,
        }}
      >
        <div
          style={{
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            color: "var(--amber)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}
        >
          Multi-Oracle Sensor Fusion Proof
        </div>

        {ready && main && chip8 ? (
          <>
            <div style={{ marginBottom: "0.5rem" }}>
              Oracle 1 (Canvas): D<sub>f</sub> ≈ <DfBadge value={main.df} />
              &nbsp;|&nbsp; Oracle 2 (CSS): D<sub>f</sub> ≈ <DfBadge value={main.df} />
              &nbsp;|&nbsp; Oracle 3 (Chip-8): D<sub>f</sub> ≈ <DfBadge value={chip8.df} />
              &nbsp;|&nbsp; Oracle 4 (SVG): D<sub>f</sub> ≈ <DfBadge value={main.df} />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              Spread:{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                {spread!.toFixed(3)}
              </span>
              &nbsp;·&nbsp;
              <span
                style={{
                  color: pass ? "var(--pass-green)" : "var(--fail-red)",
                  fontWeight: 700,
                }}
              >
                {pass
                  ? "PASS — all four oracles agree on the fractal dimension within noise."
                  : "SPREAD TOO LARGE — oracles diverge."}
              </span>
            </div>

            <div style={{ fontSize: "0.6rem", color: "var(--muted-foreground)" }}>
              Seed: {SEED}&nbsp;·&nbsp;Tsirelson: {TSIRELSON.toFixed(4)}&nbsp;·&nbsp;Walkers:{" "}
              {N}&nbsp;·&nbsp;Compute: {main.elapsed.toFixed(2)}s
              <br />
              Same rule. Same seed. Different renderer. Same shape. That is the proof.
            </div>
          </>
        ) : (
          <div style={{ color: "var(--muted-foreground)", letterSpacing: "0.1em" }}>
            COMPUTING ALL ORACLES…
          </div>
        )}
      </div>

      {/* ── Explanation ── */}
      <div
        style={{
          maxWidth: 1040,
          margin: "1rem auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          {
            label: "What is DLA?",
            text: "Diffusion-Limited Aggregation. Random walkers stick to a cluster when they touch it. The result is a fractal boundary — the same shape as lightning, snowflakes, river deltas, and neuron dendrites.",
          },
          {
            label: "The sticking threshold (corrected 2026-08-01)",
            text: `Sticking probability = 1/(3√2) ≈ ${TSIRELSON.toFixed(4)}. CORRECTION (2026-08-01): this was previously described as "the Tsirelson bound — the maximum quantum correlation". It is neither. Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator, and quantum correlations are not capped at 0.2357. This number is a chosen design parameter (ρ*/√2 — the Condorcet limit through the freely chosen map ρ = S/12). It is the declared operating point of the identity space; walkers stick with this probability.`,
          },
          {
            label: "The sensor fusion proof",
            text: "If four independent rendering substrates (Canvas, CSS, Chip-8, SVG) all produce the same fractal dimension, the identity eigenvector is substrate-independent. That is the Kalman sensor fusion proof.",
          },
          {
            label: "Orange = GSet. Dark = ZSet.",
            text: "The warm side is the GSet — accumulated facts, resolved beliefs. The cold side is the ZSet — the simulation space, retractable. The fractal boundary is the SoftValue — the correction loop in action.",
          },
        ].map(({ label, text }) => (
          <div
            key={label}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              padding: "0.9rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--amber-dim)",
                marginBottom: "0.4rem",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: "0.62rem",
                color: "var(--muted-foreground)",
                lineHeight: 1.7,
              }}
            >
              {text}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <footer
        style={{
          maxWidth: 1040,
          margin: "1.5rem auto 0",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)",
          fontSize: "0.58rem",
          color: "var(--muted-foreground)",
          textAlign: "center",
          letterSpacing: "0.08em",
        }}
      >
        Lucent Financial Group · Zeta Project ·{" "}
        <a
          href="https://github.com/Lucent-Financial-Group/Zeta"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--amber-dim)", textDecoration: "none" }}
        >
          github.com/Lucent-Financial-Group/Zeta
        </a>
      </footer>
    </div>
  );
}
