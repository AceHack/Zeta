/**
 * LiveRoomEvidenceFeed — Dark Matter Observatory discovery console.
 * Amber indicates a retrieved immutable envelope, teal indicates no data or unavailable state;
 * this browser never infers a durable fact, Merkle verification, or genesis verdict from absence.
 */
import { useCallback, useEffect, useState } from "react";

const RAW_ROOT = "https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/main/docs/room-evidence";
const INDEX_URL = `${RAW_ROOT}/index.json`;

type EnvelopeView = {
  eventId: string;
  auditContentKey: string;
  receiptContentKey: string;
  weight: number;
  emitterId: string;
  emitterSeq: number;
  witnessMaterial: boolean;
};

type FeedState =
  | { kind: "loading" }
  | { kind: "empty"; source: string }
  | { kind: "ready"; source: string; total: number; entries: EnvelopeView[] }
  | { kind: "unavailable"; reason: string }
  | { kind: "malformed"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
}

async function readFeed(signal: AbortSignal): Promise<FeedState> {
  let response: Response;
  try {
    response = await fetch(INDEX_URL, { cache: "no-store", signal });
  } catch (error) {
    return { kind: "unavailable", reason: error instanceof Error ? error.message : "feed request failed" };
  }
  if (!response.ok) return { kind: "unavailable", reason: `index request returned HTTP ${response.status}` };

  let manifest: unknown;
  try {
    manifest = await response.json();
  } catch {
    return { kind: "malformed", reason: "index is not valid JSON" };
  }
  if (!isRecord(manifest) || manifest.schema !== "zeta.room-evidence-live-feed-index.v1" || !Array.isArray(manifest.entries)) {
    return { kind: "malformed", reason: "index does not match zeta.room-evidence-live-feed-index.v1" };
  }
  if (manifest.entries.length === 0) return { kind: "empty", source: INDEX_URL };

  try {
    const ids = new Set<string>();
    const entries = await Promise.all(
      manifest.entries.slice(0, 8).map(async (entry, index): Promise<EnvelopeView> => {
        if (!isRecord(entry)) throw new Error(`index entry ${index} is not an object`);
        const eventId = requireString(entry.eventId, `index entry ${index} eventId`);
        const file = requireString(entry.file, `index entry ${index} file`);
        if (!/^room-evidence\/[A-Za-z0-9._:-]+\.json$/.test(file)) throw new Error(`index entry ${index} file is outside room-evidence`);
        if (ids.has(eventId)) throw new Error(`index repeats eventId ${eventId}`);
        ids.add(eventId);
        const eventResponse = await fetch(`${RAW_ROOT}/${encodeURIComponent(file).replace(/%2F/g, "/")}`, { cache: "no-store", signal });
        if (!eventResponse.ok) throw new Error(`envelope ${file} returned HTTP ${eventResponse.status}`);
        const envelope: unknown = await eventResponse.json();
        if (!isRecord(envelope) || !isRecord(envelope.delta) || !isRecord(envelope.receipt)) {
          throw new Error(`envelope ${file} lacks a receipt or delta`);
        }
        if (requireString(envelope.delta.eventId, `${file} delta.eventId`) !== eventId) {
          throw new Error(`index eventId ${eventId} does not bind envelope ${file}`);
        }
        return {
          eventId,
          auditContentKey: requireString(entry.auditContentKey, `${file} audit content key`),
          receiptContentKey: requireString(entry.receiptContentKey, `${file} receipt content key`),
          weight: requireInteger(envelope.receipt.weight, `${file} receipt.weight`),
          emitterId: requireString(envelope.delta.emitterId, `${file} emitter`),
          emitterSeq: requireInteger(envelope.delta.emitterSeq, `${file} logical sequence`),
          witnessMaterial: envelope.genesisWitness !== undefined,
        };
      }),
    );
    return { kind: "ready", source: INDEX_URL, total: manifest.entries.length, entries };
  } catch (error) {
    return { kind: "malformed", reason: error instanceof Error ? error.message : "feed envelope parse failed" };
  }
}

const labelStyle = { color: "var(--muted-foreground)", fontSize: "0.54rem", letterSpacing: "0.13em", textTransform: "uppercase" as const };

export default function LiveRoomEvidenceFeed() {
  const [state, setState] = useState<FeedState>({ kind: "loading" });
  const refresh = useCallback(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void readFeed(controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => refresh(), [refresh]);

  const tone = state.kind === "ready" ? "var(--amber)" : state.kind === "malformed" ? "var(--fail-red)" : "var(--teal)";
  const title = state.kind === "ready" ? "PERSISTED RECEIPT DISCOVERY" : state.kind === "empty" ? "NO RECEIPT EMITTED" : state.kind === "loading" ? "READING RECEIPT MANIFEST" : state.kind === "unavailable" ? "FEED UNAVAILABLE" : "FEED TEACHING ERROR";

  return (
    <section style={{ borderTop: "1px solid color-mix(in srgb, var(--amber) 48%, transparent)", marginTop: "1.4rem", paddingTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>Durable room evidence · repository mirror</div>
          <h2 style={{ margin: "0.25rem 0 0", color: tone, fontSize: "clamp(1.35rem, 3.2vw, 2.35rem)", lineHeight: 0.96, letterSpacing: "-0.075em" }}>{title}</h2>
        </div>
        <button onClick={() => refresh()} style={{ background: "transparent", border: `1px solid ${tone}`, color: tone, padding: "0.44rem 0.65rem", fontFamily: "inherit", fontSize: "0.6rem", letterSpacing: "0.1em", cursor: "pointer" }}>
          REFRESH MANIFEST
        </button>
      </div>

      <p style={{ margin: "0.75rem 0", color: "var(--muted-foreground)", fontSize: "0.7rem", lineHeight: 1.6, maxWidth: 960 }}>
        Discovery only. The browser validates the manifest/envelope shape and event-ID binding; it does not perform the durable ledger’s content-address verification or infer a signer verdict from absent data.
      </p>

      {state.kind === "loading" && <div style={{ color: "var(--teal)", fontSize: "0.72rem" }}>→ requesting immutable manifest…</div>}
      {state.kind === "empty" && <div style={{ color: "var(--teal)", fontSize: "0.78rem", borderLeft: "3px solid var(--teal)", paddingLeft: "0.7rem" }}>The schema is published, but this feed currently contains zero persisted room receipts. This is not a retraction or a negative observation.</div>}
      {state.kind === "unavailable" && <div style={{ color: "var(--teal)", fontSize: "0.78rem", borderLeft: "3px solid var(--teal)", paddingLeft: "0.7rem" }}>No receipt state was synthesized. {state.reason}</div>}
      {state.kind === "malformed" && <div style={{ color: "var(--fail-red)", fontSize: "0.78rem", borderLeft: "3px solid var(--fail-red)", paddingLeft: "0.7rem" }}>Rejected discovery record: {state.reason}</div>}
      {state.kind === "ready" && (
        <>
          <div style={{ color: "var(--amber)", fontSize: "0.64rem", marginBottom: "0.55rem" }}>SHOWING {state.entries.length} OF {state.total} DISCOVERED ENVELOPE{state.total === 1 ? "" : "S"}</div>
          <div className="evidence-feed-grid">
            {state.entries.map((entry) => (
              <article key={entry.eventId} style={{ border: "1px solid color-mix(in srgb, var(--amber) 34%, transparent)", padding: "0.75rem", background: "color-mix(in srgb, var(--background) 88%, var(--amber))" }}>
                <div style={{ ...labelStyle, color: "var(--amber)" }}>{entry.weight > 0 ? "+1 assertion" : "−1 retraction"} · sequence {entry.emitterSeq}</div>
                <div style={{ margin: "0.4rem 0", color: "var(--foreground)", fontSize: "0.73rem", overflowWrap: "anywhere" }}>{entry.eventId}</div>
                <div style={{ color: "var(--muted-foreground)", fontSize: "0.59rem", lineHeight: 1.55 }}>emitter: {entry.emitterId}<br />witness material: {entry.witnessMaterial ? "present; authority is assessed by a local verifier" : "absent; do not guess"}<br />audit key: {entry.auditContentKey.slice(0, 22)}…</div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
