import { describe, expect, test } from "bun:test";
import {
  designThresholdRetained,
  evaluatePreregisteredRhoSweep,
  PREREGISTERED_RHO_THRESHOLDS,
  RHO_T_DESIGN,
  type RhoSweepEpisode,
} from "./rho-threshold-sweep";

function balancedEpisodes(winningThreshold: number): RhoSweepEpisode[] {
  return PREREGISTERED_RHO_THRESHOLDS.flatMap((threshold) =>
    ["seed-a", "seed-b"].map((seed) => ({
      threshold,
      seed,
      taskId: "arc-translation-01",
      episode: 0,
      solved: threshold === winningThreshold,
      actions: 10,
      sourceArtifact: `sha256:${seed}:${threshold}`,
    })),
  );
}

describe("rho-threshold-sweep", () => {
  test("RTS-1: no observations yields no verdict rather than a fabricated winner", () => {
    const verdict = evaluatePreregisteredRhoSweep([]);
    expect(verdict).toEqual({
      kind: "no-verdict",
      reason: "no recorded CHIP-8/ARC episode outcomes were supplied",
    });
  });

  test("RTS-2: the design threshold retains only when actual balanced outcomes make it the unique winner", () => {
    const verdict = evaluatePreregisteredRhoSweep(balancedEpisodes(RHO_T_DESIGN));
    expect(verdict.kind).toBe("winner");
    expect(designThresholdRetained(verdict)).toBe(true);
  });

  test("RTS-3: fault injection — a better competing threshold falsifies retention of 1/(3√2)", () => {
    const competingThreshold = 1 / 3;
    const verdict = evaluatePreregisteredRhoSweep(balancedEpisodes(competingThreshold));
    expect(verdict.kind).toBe("winner");
    expect(designThresholdRetained(verdict)).toBe(false);
    if (verdict.kind === "winner") expect(verdict.winner).toBeCloseTo(competingThreshold, 12);
  });

  test("RTS-4: missing a threshold in one seed/task/episode cell gives no verdict", () => {
    const episodes = balancedEpisodes(RHO_T_DESIGN).filter((episode) => episode.threshold !== 0.45 || episode.seed !== "seed-a");
    const verdict = evaluatePreregisteredRhoSweep(episodes);
    expect(verdict.kind).toBe("no-verdict");
    if (verdict.kind === "no-verdict") expect(verdict.reason).toContain("unbalanced cell");
  });

  test("RTS-5: 2√2 is a CHSH-scale number, not a valid rho threshold", () => {
    const episodes = balancedEpisodes(RHO_T_DESIGN);
    const first = episodes[0]!;
    const verdict = evaluatePreregisteredRhoSweep([
      ...episodes.slice(1),
      { ...first, threshold: 2 * Math.SQRT2 },
    ]);
    expect(verdict.kind).toBe("no-verdict");
    if (verdict.kind === "no-verdict") expect(verdict.reason).toContain("outside the rho domain [0,1]");
  });

  test("RTS-6: equal acquisition efficiencies are reported as a tie, not selected by threshold order", () => {
    const episodes = balancedEpisodes(-1).map((episode) => ({ ...episode, solved: false }));
    const verdict = evaluatePreregisteredRhoSweep(episodes);
    expect(verdict.kind).toBe("tie");
    if (verdict.kind === "tie") expect(verdict.tiedThresholds).toHaveLength(PREREGISTERED_RHO_THRESHOLDS.length);
  });
});
