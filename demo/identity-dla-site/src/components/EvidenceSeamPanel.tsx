/**
 * EvidenceSeamPanel — Dark Matter Observatory evidence room.
 *
 * Design: hard-edged near-black instrument panel, mono data readouts, amber for retained facts,
 * teal for unresolved state, and red only for witnessed conflicts. No rounded decorative chrome.
 * Evidence values mirror merged Zeta PRs #15638, #15660, #15669, and #15680.
 */
import { useMemo, useState } from "react";

type EvidenceSign = "assertion +1" | "retraction −1";
type Alteration = "none" | "uncertainty" | "spectrum" | "signature";
type CausalScenario = "settled" | "missing predecessor" | "visible fork";
type GenesisScenario = "witnessed" | "unknown witness" | "visible conflict";

const GENERATOR_MASKS = [225, 210, 180, 120] as const;

function popcount(value: number): number {
  let count = 0;
  for (let word = value; word !== 0; word >>>= 1) count += word & 1;
  return count;
}

function enumerateCode(): number[] {
  return Array.from({ length: 16 }, (_, message) =>
    GENERATOR_MASKS.reduce(
      (word, generator, row) => (message & (1 << row) ? word ^ generator : word),
      0,
    ),
  );
}

const WEIGHT_FOUR_SUPPORTS = new Set(
  enumerateCode().filter((word) => word !== 0 && popcount(word) === 4),
);

const DEFAULT_AMBIGUOUS_MASK = Array.from(WEIGHT_FOUR_SUPPORTS)[0] ?? 225;

const SPECTRUM = [
  {
    lane: "uncoded cube",
    carrier: "256",
    operators: "256",
    defect: "1",
    verdict: "rank-one regular",
    tone: "var(--amber)",
  },
  {
    lane: "coded [8,4,4] quotient",
    carrier: "16",
    operators: "256",
    defect: "16",
    verdict: "faithful, non-regular",
    tone: "var(--amber)",
  },
  {
    lane: "four-colour residue",
    carrier: "16",
    operators: "16",
    defect: "1",
    verdict: "56 / 70 subsets",
    tone: "oklch(0.72 0.14 190)",
  },
  {
    lane: "bivector + half-spinor",
    carrier: "undeclared",
    operators: "undeclared",
    defect: "unknown",
    verdict: "unmeasured — no action map",
    tone: "var(--muted-foreground)",
  },
] as const;

const controlStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 0,
  background: "oklch(0.085 0.012 265)",
  color: "var(--foreground)",
  font: "inherit",
  fontSize: "0.66rem",
  padding: "0.55rem 0.65rem",
} as const;

function Register({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div style={{ borderTop: `2px solid ${tone}`, padding: "0.72rem 0.6rem", background: "oklch(0.075 0.01 265)" }}>
      <div style={{ color: "var(--muted-foreground)", fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: tone, fontSize: "clamp(0.9rem, 1.7vw, 1.12rem)", fontWeight: 800, margin: "0.35rem 0 0.2rem", letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ color: "var(--muted-foreground)", fontSize: "0.54rem", lineHeight: 1.45 }}>{note}</div>
    </div>
  );
}

function ByteMask({ mask }: { mask: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(24px, 1fr))", gap: 4 }} aria-label="Eight transport coordinates">
      {Array.from({ length: 8 }, (_, index) => {
        const erased = (mask & (1 << index)) !== 0;
        return (
          <div
            key={index}
            title={`coordinate ${index}: ${erased ? "erased" : "received"}`}
            style={{
              minHeight: 42,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${erased ? "var(--fail-red)" : "oklch(0.55 0.12 190)"}`,
              background: erased ? "oklch(0.19 0.07 25)" : "oklch(0.12 0.035 190)",
              color: erased ? "oklch(0.82 0.15 30)" : "oklch(0.78 0.12 190)",
              fontSize: "0.62rem",
              fontWeight: 800,
            }}
          >
            {erased ? "×" : index}
          </div>
        );
      })}
    </div>
  );
}

function BoundaryTrace({ tone }: { tone: string }) {
  return (
    <div style={{ position: "relative", marginTop: "0.85rem", minHeight: 112, borderTop: "1px solid var(--border)", overflow: "hidden" }} aria-hidden="true">
      <svg viewBox="0 0 760 112" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M0 78 L54 78 L78 48 L108 48 L126 70 L166 70 L186 30 L218 30 L236 57 L270 57 L292 17 L322 17 L346 49 L382 49 L404 82 L438 82 L462 42 L494 42 L518 64 L552 64 L576 25 L610 25 L632 55 L672 55 L696 36 L760 36" fill="none" stroke={tone} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <path d="M76 48 L76 93 M186 30 L186 92 M292 17 L292 92 M462 42 L462 93 M576 25 L576 93 M696 36 L696 93" fill="none" stroke="oklch(0.55 0.1 190 / 0.45)" strokeWidth="1" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        {[76, 186, 292, 462, 576, 696].map((x) => <circle key={x} cx={x} cy={93} r="3" fill="oklch(0.72 0.14 190)" />)}
      </svg>
      <div style={{ position: "absolute", right: 8, bottom: 7, color: "var(--muted-foreground)", fontSize: "0.48rem", letterSpacing: "0.11em" }}>
        RETAINED BOUNDARY / UNRESOLVED SAMPLES
      </div>
    </div>
  );
}

export default function EvidenceSeamPanel() {
  const [erasedCount, setErasedCount] = useState(1);
  const [ambiguousFour, setAmbiguousFour] = useState(false);
  const [sign, setSign] = useState<EvidenceSign>("assertion +1");
  const [alteration, setAlteration] = useState<Alteration>("none");
  const [causal, setCausal] = useState<CausalScenario>("settled");
  const [genesis, setGenesis] = useState<GenesisScenario>("witnessed");

  const mask = useMemo(() => {
    if (erasedCount === 4 && ambiguousFour) return DEFAULT_AMBIGUOUS_MASK;
    return erasedCount === 8 ? 255 : (1 << erasedCount) - 1;
  }, [erasedCount, ambiguousFour]);

  const containsCodewordSupport = Array.from(WEIGHT_FOUR_SUPPORTS).some(
    (support) => support !== 0 && (support & mask) === support,
  );
  const recoverable = erasedCount <= 4 && !containsCodewordSupport;
  const semanticReceipt = recoverable;
  const exactRoot = semanticReceipt && alteration === "none";

  const continuity =
    causal === "settled" ? "settled" : causal === "missing predecessor" ? "unresolved" : "disputed";
  const authority =
    genesis === "witnessed" ? "witnessed" : genesis === "unknown witness" ? "unresolved" : "disputed";
  const integrity = !semanticReceipt
    ? "not assessed"
    : alteration === "none"
      ? "intact"
      : "distinct content";

  const transportTone = !semanticReceipt
    ? "var(--fail-red)"
    : exactRoot
      ? "var(--amber)"
      : "var(--amber)";

  return (
    <section
      aria-labelledby="evidence-seam-title"
      style={{
        border: "1px solid var(--border)",
        borderRadius: 0,
        background: "oklch(0.065 0.012 265)",
        color: "var(--foreground)",
        fontFamily: "'JetBrains Mono', monospace",
        overflow: "hidden",
        minHeight: "calc(100vh - 5rem)",
      }}
    >
      <header style={{ padding: "1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "var(--amber)", fontSize: "0.56rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            room evidence instrument · merged artifacts
          </div>
          <h2 id="evidence-seam-title" style={{ margin: "0.38rem 0 0", fontSize: "clamp(1.25rem, 3vw, 2.05rem)", letterSpacing: "-0.045em" }}>
            Adinkra recovery → durable truth → local witness
          </h2>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.55rem", color: "var(--muted-foreground)", lineHeight: 1.55 }}>
          PR #15638 seam · #15660 mutation gate
          <br />#15669 authority · #15680 defect spectrum
        </div>
      </header>

      <div className="evidence-seam-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)", gap: 0 }}>
        <div style={{ padding: "1rem", borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.65rem", marginBottom: "0.9rem" }}>
            <label style={{ fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
              erased coordinates: <strong style={{ color: "var(--foreground)" }}>{erasedCount}</strong>
              <input
                aria-label="Erased transport coordinates"
                type="range"
                min={0}
                max={8}
                value={erasedCount}
                onChange={(event) => setErasedCount(Number(event.target.value))}
                style={{ width: "100%", marginTop: "0.55rem", accentColor: "var(--amber)" }}
              />
            </label>
            <label style={{ fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
              evidence sign
              <select value={sign} onChange={(event) => setSign(event.target.value as EvidenceSign)} style={{ ...controlStyle, marginTop: "0.35rem" }}>
                <option>assertion +1</option>
                <option>retraction −1</option>
              </select>
            </label>
            <label style={{ fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
              CRC-valid semantic change
              <select value={alteration} onChange={(event) => setAlteration(event.target.value as Alteration)} style={{ ...controlStyle, marginTop: "0.35rem" }}>
                <option value="none">none</option>
                <option value="uncertainty">uncertainty changed</option>
                <option value="spectrum">spectrum key changed</option>
                <option value="signature">signature split changed</option>
              </select>
            </label>
          </div>

          {erasedCount === 4 && (
            <button
              type="button"
              onClick={() => setAmbiguousFour((current) => !current)}
              style={{
                ...controlStyle,
                width: "auto",
                marginBottom: "0.75rem",
                borderColor: ambiguousFour ? "var(--fail-red)" : "oklch(0.55 0.12 190)",
              }}
            >
              {ambiguousFour ? "using codeword-support erasure — ambiguous" : "using information-set erasure — identifiable"}
            </button>
          )}

          <ByteMask mask={mask} />

          <div style={{ marginTop: "0.85rem", borderLeft: `3px solid ${transportTone}`, padding: "0.65rem 0.75rem", background: "oklch(0.08 0.012 265)" }}>
            <div style={{ color: transportTone, fontWeight: 800, fontSize: "clamp(0.9rem, 1.8vw, 1.12rem)", letterSpacing: "-0.025em" }}>
              {!semanticReceipt
                ? "UNDECODABLE — no semantic receipt enters the ledger"
                : exactRoot
                  ? "RECOVERED — durable receipt root R′ = R"
                  : "VALID DIFFERENT FACT — durable root R′ ≠ R"}
            </div>
            <div style={{ color: "var(--muted-foreground)", fontSize: "0.55rem", lineHeight: 1.55, marginTop: "0.3rem" }}>
              All 0–3 erasures and 56 of 70 four-erasure masks are identifiable. The fourteen weight-four codeword supports are ambiguous. Absence at transport does not manufacture an “unresolved” evidence atom.
            </div>
          </div>
          <BoundaryTrace tone={transportTone} />
        </div>

        <div style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.7rem" }}>
            audit scenarios
          </div>
          <label style={{ display: "block", fontSize: "0.55rem", color: "var(--muted-foreground)", marginBottom: "0.65rem" }}>
            causal continuity
            <select value={causal} onChange={(event) => setCausal(event.target.value as CausalScenario)} style={{ ...controlStyle, marginTop: "0.35rem" }}>
              <option>settled</option>
              <option>missing predecessor</option>
              <option>visible fork</option>
            </select>
          </label>
          <label style={{ display: "block", fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
            local genesis witness
            <select value={genesis} onChange={(event) => setGenesis(event.target.value as GenesisScenario)} style={{ ...controlStyle, marginTop: "0.35rem" }}>
              <option>witnessed</option>
              <option>unknown witness</option>
              <option>visible conflict</option>
            </select>
          </label>

          <div className="evidence-register-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.55rem", marginTop: "0.9rem" }}>
            <Register label="evidence sign" value={semanticReceipt ? sign : "no receipt"} note="+1 and −1 both retain uncertainty." tone="var(--amber)" />
            <Register label="content integrity" value={integrity} note="Different content gets a different root; it is not silently normalized." tone="var(--amber)" />
            <Register label="causal continuity" value={semanticReceipt ? continuity : "not observed"} note="A missing predecessor remains unknown; a visible fork fails closed." tone={continuity === "settled" ? "var(--amber)" : continuity === "unresolved" ? "oklch(0.72 0.14 190)" : "var(--fail-red)"} />
            <Register label="genesis authority" value={semanticReceipt ? authority : "not observed"} note="The roster is local. A partition cannot reveal an unseen competing genesis." tone={authority === "witnessed" ? "var(--amber)" : authority === "unresolved" ? "oklch(0.72 0.14 190)" : "var(--fail-red)"} />
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ color: "var(--amber)", fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              representation-defect spectrum
            </div>
            <div style={{ fontSize: "0.58rem", color: "var(--muted-foreground)", marginTop: "0.3rem" }}>
              Same recovery lane. Different representation questions. Unknown stays unknown.
            </div>
          </div>
          <div style={{ fontSize: "0.53rem", color: "var(--muted-foreground)", textAlign: "right" }}>
            mutation gate: ambiguity · CRC · duplicate · length<br />4 / 4 deliberate weakenings killed
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.55rem" }}>
          {SPECTRUM.map((row) => (
            <div key={row.lane} style={{ border: "1px solid var(--border)", borderTop: `3px solid ${row.tone}`, padding: "0.7rem", background: "oklch(0.075 0.01 265)" }}>
              <div style={{ color: row.tone, fontSize: "0.65rem", fontWeight: 800, minHeight: "2.2em" }}>{row.lane}</div>
              <div style={{ color: row.tone, fontSize: "clamp(1.25rem, 2.5vw, 1.85rem)", fontWeight: 900, letterSpacing: "-0.06em", margin: "0.25rem 0 0.55rem" }}>δ {row.defect}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.3rem", fontSize: "0.52rem", color: "var(--muted-foreground)", marginTop: "0.55rem" }}>
                <span>carrier M</span><strong style={{ color: "var(--foreground)" }}>{row.carrier}</strong>
                <span>operators A</span><strong style={{ color: "var(--foreground)" }}>{row.operators}</strong>
              </div>
              <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--border)", paddingTop: "0.45rem", fontSize: "0.52rem", color: row.tone }}>
                {row.verdict}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
