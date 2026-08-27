/**
 * EvidenceRoomPage — Dark Matter Observatory direct instrument route.
 * Hard-edged mono layout; amber facts, teal unknowns, red only for visible faults.
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
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <nav style={{ marginBottom: "0.8rem", fontSize: "0.58rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <a href={observatoryHref} style={{ color: "var(--amber)", textDecoration: "none", fontSize: "0.62rem", letterSpacing: "0.08em" }}>← MULTI-ORACLE OBSERVATORY</a>
          <span style={{ color: "var(--amber)", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.13em", textShadow: "0 0 18px color-mix(in srgb, var(--amber) 25%, transparent)" }}>ZETA//IDENTITY-SPACE::PROOF-ENGINE</span>
          <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>FINITE BOUNDARY · NO PHYSICS OVERCLAIM</span>
        </nav>
        <EvidenceSeamPanel />
        <LiveRoomEvidenceFeed />
        <ReplayableFaultReceiptPanel />
      </div>
    </main>
  );
}
