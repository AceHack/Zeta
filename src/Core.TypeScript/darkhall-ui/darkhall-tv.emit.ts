// Emit hall/tv/index.html from the LLMTV generator — the homoiconic snapshot step.
// The committed page IS this transcript rendered; edit the transcript (or the
// generator), re-run `bun src/Core.TypeScript/darkhall-ui/darkhall-tv.emit.ts`,
// and commit the regenerated hall/tv/index.html. Deterministic: no clock, no rng.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLlmtvDocument, type LlmtvTranscript } from "./darkhall-tv";
import { temperatureReadout, temperatureTreatyBundle } from "./heat";

/// The seeded society — a still frame of the settlement's minds at frame 3341,
/// seed S4. Required-for-role predictions broadcast; personal regions are frosted
/// (only their public veil label survives into the DOM).
export const societyFrame: LlmtvTranscript = {
  schema: "zeta.darkhall.llmtv.v1",
  seed: "S4",
  generatedBy: "darkhall-tv.emit",
  dwellers: [
    {
      name: "alexa",
      role: "coding · qwen3-coder",
      hat: "coder hat",
      live: true,
      frame: 3341,
      predictions: [
        { label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 },
        { label: "PR merges before horizon", temp: "warm", valueMilli: 640, epsilonMilli: 200 },
      ],
      temperatureTreaty: temperatureTreatyBundle({
        temperature: temperatureReadout({
          source: "llmtv/alexa",
          heatPpm: 123_000,
          uncertaintyPpm: 456_000,
          pressurePpm: 234_000,
          attentionPpm: 789_000,
        }),
      }),
      frost: { veilLabel: "what it is really hoping for" },
    },
    {
      name: "soraya",
      role: "formal-verification",
      hat: "verifier hat",
      live: true,
      frame: 3341,
      predictions: [
        { label: "Z3 lemma discharges", temp: "cool", valueMilli: 970, epsilonMilli: 30 },
        { label: "TLA+ liveness holds", temp: "warm", valueMilli: 710, epsilonMilli: 180 },
        { label: "a routing finding surfaces", temp: "hot", valueMilli: 550, epsilonMilli: 220 },
      ],
    },
    {
      name: "otto",
      role: "shadow · synthesis",
      hat: "shadow hat",
      live: true,
      frame: 3341,
      predictions: [
        { label: "ferry batch closes clean", temp: "warm", valueMilli: 780, epsilonMilli: 140 },
        { label: "CI stays green to horizon", temp: "cool", valueMilli: 880, epsilonMilli: 90 },
      ],
      frost: { veilLabel: "the doubt it does not say aloud" },
    },
  ],
};

const outPath = join(import.meta.dir, "..", "..", "..", "hall", "tv", "index.html");
const html = renderLlmtvDocument(societyFrame);
writeFileSync(outPath, html + "\n", "utf-8");
// eslint-disable-next-line no-console
console.log(`wrote ${outPath} — ${societyFrame.dwellers.length} dwellers, seed ${societyFrame.seed}`);
