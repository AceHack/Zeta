/**
 * EvidenceRoomPage — Dark Matter Observatory direct instrument route.
 * Hard-edged mono layout; amber facts, teal unknowns, red only for visible faults.
 */
import EvidenceSeamPanel from "@/components/EvidenceSeamPanel";
import LiveRoomEvidenceFeed from "@/components/LiveRoomEvidenceFeed";

export default function EvidenceRoomPage() {
  const observatoryHref = typeof window !== "undefined" && window.location.hash ? "#/observatory" : "/";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        color: "var(--foreground)",
        padding: "clamp(0.55rem, 1.5vw, 1.25rem)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <nav style={{ marginBottom: "0.8rem", fontSize: "0.58rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <a href={observatoryHref} style={{ color: "var(--amber)", textDecoration: "none" }}>← multi-oracle observatory</a>
          <span style={{ color: "var(--muted-foreground)" }}>ZETA IDENTITY SPACE · PROOF ENGINE · finite boundary, no physics overclaim</span>
        </nav>
        <EvidenceSeamPanel />
        <LiveRoomEvidenceFeed />
      </div>
    </main>
  );
}
