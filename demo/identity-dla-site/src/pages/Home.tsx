import { Link } from "wouter";

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: "1rem",
  color: "inherit",
  textDecoration: "none",
  background: "var(--card)",
  border: "1px solid var(--border)",
  minHeight: "9rem",
};

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", padding: "clamp(1rem, 4vw, 3rem)", background: "var(--background)", fontFamily: "'JetBrains Mono', monospace" }}>
      <section style={{ maxWidth: 960, margin: "0 auto" }}>
        <p style={{ color: "var(--amber-dim)", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>Zeta · Identity Space</p>
        <h1 style={{ color: "var(--amber)", fontSize: "clamp(1.5rem, 5vw, 3rem)", margin: "0.4rem 0" }}>Multi-Oracle DLA</h1>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 720, lineHeight: 1.7 }}>
          Choose one bounded interface. Authorization stays responsive; visual and compiler experiments load only when you open them.
        </p>
        <nav aria-label="Identity Space interfaces" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem", marginTop: "2rem" }}>
          <Link href="/authorize" style={cardStyle}>
            <strong style={{ color: "oklch(0.72 0.18 145)", display: "block", marginBottom: "0.7rem" }}>Authorize this device</strong>
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem", lineHeight: 1.6 }}>One passkey ceremony. No DLA, WebGPU, or WASM workload is initialized on this route.</span>
          </Link>
          <Link href="/observatory" style={cardStyle}>
            <strong style={{ color: "var(--amber)", display: "block", marginBottom: "0.7rem" }}>Observatory</strong>
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem", lineHeight: 1.6 }}>Canvas, SVG, quantum, biological, society, and research visualizations.</span>
          </Link>
          <Link href="/wasm-lab" style={cardStyle}>
            <strong style={{ color: "oklch(0.72 0.18 195)", display: "block", marginBottom: "0.7rem" }}>Compiler laboratory</strong>
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem", lineHeight: 1.6 }}>Six repository-owned compiler modules. They run only after an explicit start request.</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
