/**
 * ReplayableFaultReceiptPanel — Dark Matter Observatory fault-vector console.
 *
 * Hard-edged mono instrument: amber retains resolved facts, teal marks unknown authority,
 * and red is reserved for visible conflict or undecodable transport. This panel replays
 * pre-registered finite vectors; it never claims a production receipt has been emitted.
 */
import { useMemo, useState } from "react";

type FaultScenario =
  | "correctable-recovery"
  | "undecodable-transport"
  | "altered-content"
  | "unresolved-witness"
  | "visible-witness-conflict";

type FaultVector = {
  label: string;
  code: string;
  state: string;
  tone: string;
  outcome: string;
  registers: readonly [string, string][];
  lesson: string;
  next: string;
};

const VECTORS: Record<FaultScenario, FaultVector> = {
  "correctable-recovery": {
    label: "correctable recovery",
    code: "ADE-R1",
    state: "recovered",
    tone: "var(--amber)",
    outcome: "IDENTIFIABLE 3 / 8 ERASURE · R′ = R",
    registers: [["sign", "+1 or −1"], ["integrity", "intact"], ["continuity", "settled"], ["authority", "witnessed"]],
    lesson: "Recovered bytes enter the ordinary durable fold. The replay retains the transport diagnostic and does not create a parallel truth path.",
    next: "append recovered signed atom",
  },
  "undecodable-transport": {
    label: "undecodable transport",
    code: "ADE-R2",
    state: "no semantic receipt",
    tone: "var(--fail-red)",
    outcome: "UNDERDETERMINED 8 / 8 ERASURE · NO ATOM",
    registers: [["sign", "not observed"], ["integrity", "not assessed"], ["continuity", "not observed"], ["authority", "not observed"]],
    lesson: "Missing transport bytes do not become an unresolved evidence atom. The retained object is a diagnostic vector only.",
    next: "request a new transmission · append no atom",
  },
  "altered-content": {
    label: "altered content",
    code: "ADE-R3",
    state: "distinct fact",
    tone: "var(--amber)",
    outcome: "CRC-VALID CHANGE · R′ ≠ R",
    registers: [["sign", "+1 or −1"], ["integrity", "distinct content"], ["continuity", "settled"], ["authority", "witnessed"]],
    lesson: "A changed uncertainty, spectrum, or signature-split field has a different durable root. It cannot overwrite the earlier fact.",
    next: "append separately; correction = explicit −1 + new generator",
  },
  "unresolved-witness": {
    label: "unresolved witness",
    code: "ADE-R4",
    state: "authority unresolved",
    tone: "oklch(0.72 0.14 190)",
    outcome: "LOCAL WITNESS ABSENT · RETAIN UNKNOWN",
    registers: [["sign", "+1 or −1"], ["integrity", "intact"], ["continuity", "settled"], ["authority", "unresolved"]],
    lesson: "An absent local witness is not invalid and is not globally false. It remains visible without authorizing authority-dependent action.",
    next: "request locally verifiable witness binding",
  },
  "visible-witness-conflict": {
    label: "visible witness conflict",
    code: "ADE-R5",
    state: "authority disputed",
    tone: "var(--fail-red)",
    outcome: "CONFLICTING WITNESS ATOMS · FAIL CLOSED",
    registers: [["sign", "+1 or −1"], ["integrity", "intact"], ["continuity", "settled"], ["authority", "disputed"]],
    lesson: "The system preserves both visible witness atoms. Selecting one silently would erase the dispute from the audit trail.",
    next: "block authority action; await separately signed local adjudication",
  },
};

const SCENARIOS = Object.keys(VECTORS) as FaultScenario[];

export default function ReplayableFaultReceiptPanel() {
  const [scenario, setScenario] = useState<FaultScenario>("correctable-recovery");
  const [run, setRun] = useState(0);
  const vector = useMemo(() => VECTORS[scenario], [scenario]);

  return (
    <section
      aria-labelledby="fault-replay-title"
      style={{ border: "1px solid var(--border)", borderRadius: 0, background: "oklch(0.065 0.012 265)", marginTop: "0.9rem", overflow: "hidden" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "0.9rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ color: "var(--amber)", fontSize: "0.53rem", letterSpacing: "0.15em", textTransform: "uppercase" }}>replayable fault receipts · pre-registered vectors</div>
          <h2 id="fault-replay-title" style={{ margin: "0.35rem 0 0", fontSize: "clamp(1.15rem, 2.7vw, 1.72rem)", letterSpacing: "-0.055em" }}>teach the fault; do not erase the observation</h2>
        </div>
        <div style={{ color: "var(--muted-foreground)", fontSize: "0.53rem", lineHeight: 1.55, textAlign: "right" }}>content-addressed on persistence<br />no production receipt implied</div>
      </header>

      <div style={{ height: 48, borderBottom: "1px solid var(--border)", overflow: "hidden", position: "relative" }} aria-hidden="true">
        <svg viewBox="0 0 920 48" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
          <path d="M0 36 L68 36 L90 17 L124 17 L144 34 L200 34 L224 7 L260 7 L281 27 L338 27 L358 12 L394 12 L418 39 L470 39 L496 21 L530 21 L552 2 L587 2 L614 29 L678 29 L702 15 L738 15 L762 35 L818 35 L846 20 L920 20" fill="none" stroke="var(--amber)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M90 17 L108 2 L129 2 M224 7 L244 31 L264 31 M552 2 L571 22 L591 22 M702 15 L720 2 L741 2" fill="none" stroke="var(--amber)" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M144 34 L144 46 M418 39 L418 46 M762 35 L762 46" fill="none" stroke="var(--teal)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="fault-receipt-layout" style={{ display: "grid", gridTemplateColumns: "minmax(210px, 0.72fr) minmax(0, 1.28fr)" }}>
        <div style={{ padding: "0.9rem", borderRight: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted-foreground)", fontSize: "0.5rem", letterSpacing: "0.13em", textTransform: "uppercase", marginBottom: "0.6rem" }}>fault vector selector</div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {SCENARIOS.map((item) => {
              const active = scenario === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setScenario(item); setRun(0); }}
                  style={{ textAlign: "left", font: "inherit", fontSize: "0.57rem", padding: "0.55rem 0.6rem", borderRadius: 0, border: `1px solid ${active ? VECTORS[item].tone : "var(--border)"}`, background: active ? "oklch(0.14 0.04 85)" : "transparent", color: active ? VECTORS[item].tone : "var(--muted-foreground)", cursor: "pointer" }}
                >
                  {VECTORS[item].code} · {VECTORS[item].label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ color: vector.tone, fontWeight: 900, fontSize: "clamp(1.3rem, 3.15vw, 2rem)", letterSpacing: "-0.065em" }}>{vector.outcome}</div>
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.5rem" }}>{vector.code} / VECTOR-{String(run).padStart(2, "0")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1px", margin: "0.85rem 0", background: "var(--border)" }}>
            {vector.registers.map(([label, value]) => <div key={label} style={{ background: "oklch(0.075 0.01 265)", padding: "0.5rem" }}><div style={{ color: "var(--muted-foreground)", fontSize: "0.44rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div><div style={{ color: vector.tone, fontSize: "0.57rem", fontWeight: 700, marginTop: "0.25rem" }}>{value}</div></div>)}
          </div>
          <p style={{ color: "var(--foreground)", fontSize: "0.62rem", lineHeight: 1.65, margin: "0.5rem 0" }}>{vector.lesson}</p>
          <div style={{ borderLeft: `3px solid ${vector.tone}`, padding: "0.5rem 0.65rem", background: "oklch(0.08 0.012 265)", color: "var(--muted-foreground)", fontSize: "0.55rem", lineHeight: 1.5 }}><strong style={{ color: vector.tone }}>NEXT GENERATOR</strong> · {vector.next}</div>
          <button type="button" onClick={() => setRun((value) => value + 1)} style={{ marginTop: "0.8rem", font: "inherit", fontSize: "0.58rem", fontWeight: 800, borderRadius: 0, border: `1px solid ${vector.tone}`, background: "transparent", color: vector.tone, padding: "0.55rem 0.75rem", cursor: "pointer" }}>REPLAY VECTOR →</button>
        </div>
      </div>
    </section>
  );
}
