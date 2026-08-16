import { Link } from "wouter";
import PasskeyProposalPanel from "@/components/PasskeyProposalPanel";

export default function AuthorizePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "clamp(1rem, 4vw, 3rem)", background: "var(--background)", fontFamily: "'JetBrains Mono', monospace" }}>
      <section style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: "0.72rem" }}>← interface index</Link>
        <h1 style={{ color: "var(--amber)", margin: "1.4rem 0 0.5rem" }}>Authorize this device</h1>
        <p style={{ color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
          This lightweight route loads no visual oracle or compiler. A passkey creates a short-lived device capability; the scoped GitHub App and Action remain the only repository writers.
        </p>
        <PasskeyProposalPanel />
      </section>
    </main>
  );
}
