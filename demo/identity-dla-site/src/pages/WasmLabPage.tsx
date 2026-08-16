import { useState } from "react";
import { Link } from "wouter";
import OracleWASM from "@/components/OracleWASM";

export default function WasmLabPage() {
  const [meanDf, setMeanDf] = useState<number | null>(null);
  return (
    <main style={{ minHeight: "100vh", padding: "clamp(1rem, 4vw, 3rem)", background: "var(--background)", fontFamily: "'JetBrains Mono', monospace" }}>
      <section style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: "0.72rem" }}>← interface index</Link>
        <h1 style={{ color: "var(--amber)", margin: "1.4rem 0 0.5rem" }}>Multi-Compiler WebAssembly Laboratory</h1>
        <p style={{ color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
          The experiment is intentionally manual. Starting it instantiates the repository-owned modules one at a time; stopping it prevents later modules and late results from advancing the run.
        </p>
        {meanDf !== null && <p style={{ color: "oklch(0.72 0.18 145)", fontSize: "0.8rem" }}>Completed-run mean D<sub>f</sub>: {meanDf.toFixed(3)}</p>}
        <OracleWASM seed={42} onResult={setMeanDf} />
      </section>
    </main>
  );
}
