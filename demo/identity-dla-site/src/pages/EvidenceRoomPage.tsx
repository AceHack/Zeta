/**
 * EvidenceRoomPage — Dark Matter Observatory direct instrument route.
 * Structural retained-branch geometry, hard-edged mono layout; amber facts, teal unknowns, red only for visible faults.
 */
import EvidenceSeamPanel from "@/components/EvidenceSeamPanel";
import LiveRoomEvidenceFeed from "@/components/LiveRoomEvidenceFeed";
import ReplayableFaultReceiptPanel from "@/components/ReplayableFaultReceiptPanel";

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
      <div className="evidence-room-shell" style={{ maxWidth: 1500, margin: "0 auto" }}>
        <nav style={{ borderBottom: "1px solid var(--border)", marginBottom: "1.2rem", paddingBottom: "0.6rem", fontSize: "0.58rem", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: "1rem", alignItems: "center" }}>
          <a href={observatoryHref} style={{ color: "var(--amber-dim)", textDecoration: "none", fontSize: "0.56rem", letterSpacing: "0.08em" }}>← MULTI-ORACLE OBSERVATORY</a>
          <span className="evidence-room-wordmark">ZETA//IDENTITY-SPACE::PROOF-ENGINE</span>
          <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.06em", justifySelf: "end", fontSize: "0.52rem" }}>FINITE BOUNDARY · NO PHYSICS OVERCLAIM</span>
        </nav>
        <EvidenceSeamPanel />
        <LiveRoomEvidenceFeed />
        <ReplayableFaultReceiptPanel />
      </div>
    </main>
  );
}
