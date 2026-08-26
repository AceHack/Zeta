import { describe, expect, test } from "bun:test";
import {
  bootstrapCi,
  canonAtom,
  canonWords,
  effectiveN,
  elicitationPrompt,
  flopProxy,
  generateWorkItems,
  hillN0,
  hillN1,
  hillN2,
  jensenShannonDivergence,
  makeRng,
  meanPairwiseAnswerAgreement,
  meanPairwisePhi,
  parseAnswer,
  scoreAnswers,
  shannonEntropyNats,
  splitHalf,
  tally,
  workPrompt,
  ELICITATIONS,
  jackknifeSe,
  permutationTest,
} from "./f3-hat-choice-decorrelation";

const rep = (s: string, n: number): string[] => Array.from({ length: n }, () => s);

describe("Hill numbers — the effective-choice count", () => {
  test("uniform over k categories gives N0 = N1 = N2 = k", () => {
    const d = tally(["a", "b", "c", "d"].flatMap((s) => rep(s, 25)));
    expect(hillN0(d)).toBe(4);
    expect(hillN1(d)).toBeCloseTo(4, 10);
    expect(hillN2(d)).toBeCloseTo(4, 10);
  });

  test("THE POINT: a long thin tail inflates N0 far above N1 and N2", () => {
    // 97 samples in 3 archetypes + 3 singletons. A hundred witnesses? No.
    const items = [...rep("guardian", 40), ...rep("curator", 33), ...rep("architect", 24), "poet", "cook", "sailor"];
    const d = tally(items);
    expect(hillN0(d)).toBe(6);
    expect(hillN1(d)).toBeLessThan(4);
    expect(hillN2(d)).toBeLessThan(3.2);
    // The raw count overstates the effective count by more than 50%.
    expect(hillN0(d) / hillN1(d)).toBeGreaterThan(1.5);
  });

  test("a single repeated choice is exactly one effective witness", () => {
    const d = tally(rep("guardian", 100));
    expect(shannonEntropyNats(d)).toBeCloseTo(0, 12);
    expect(hillN1(d)).toBeCloseTo(1, 12);
    expect(hillN2(d)).toBeCloseTo(1, 12);
  });

  test("N2 <= N1 <= N0 always (Hill ordering), on random distributions", () => {
    const rng = makeRng(7);
    for (let t = 0; t < 50; t++) {
      const items: string[] = [];
      for (let i = 0; i < 200; i++) items.push(`c${Math.floor(rng() * (1 + Math.floor(rng() * 12)))}`);
      const d = tally(items);
      expect(hillN2(d)).toBeLessThanOrEqual(hillN1(d) + 1e-9);
      expect(hillN1(d)).toBeLessThanOrEqual(hillN0(d) + 1e-9);
    }
  });

  test("empty distribution is 0, not NaN", () => {
    const d = tally([]);
    expect(hillN1(d)).toBe(0);
    expect(hillN2(d)).toBe(0);
    expect(shannonEntropyNats(d)).toBe(0);
  });
});

describe("Jensen-Shannon divergence — the wording falsifier's statistic", () => {
  test("identical distributions give 0", () => {
    const a = tally([...rep("x", 10), ...rep("y", 5)]);
    const b = tally([...rep("x", 20), ...rep("y", 10)]);
    expect(jensenShannonDivergence(a, b)).toBeCloseTo(0, 12);
  });

  test("disjoint support gives exactly 1 bit — the upper bound", () => {
    expect(jensenShannonDivergence(tally(rep("x", 10)), tally(rep("y", 10)))).toBeCloseTo(1, 12);
  });

  test("symmetric", () => {
    const a = tally([...rep("x", 7), ...rep("y", 3)]);
    const b = tally([...rep("y", 2), ...rep("z", 8)]);
    expect(jensenShannonDivergence(a, b)).toBeCloseTo(jensenShannonDivergence(b, a), 12);
  });

  test("stays inside [0,1] on random pairs", () => {
    const rng = makeRng(11);
    for (let t = 0; t < 100; t++) {
      const mk = () => tally(Array.from({ length: 50 }, () => `c${Math.floor(rng() * 6)}`));
      const v = jensenShannonDivergence(mk(), mk());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test("split-half of one sampler is SMALL — this is the noise floor the falsifier needs", () => {
    const rng = makeRng(3);
    const items = Array.from({ length: 400 }, () => (rng() < 0.5 ? "a" : rng() < 0.5 ? "b" : "c"));
    const [h1, h2] = splitHalf(items);
    expect(jensenShannonDivergence(h1, h2)).toBeLessThan(0.05);
  });

  test("ATOM-LEVEL SATURATION is real: all-distinct strings give JSD=1 for BOTH cross and floor", () => {
    // This is why the primary statistic is word-level. Recorded as a test so the
    // limitation cannot be quietly forgotten: at atom level the falsifier is
    // uninformative, not passing.
    const a = Array.from({ length: 50 }, (_, i) => `role-a-${i}`);
    const b = Array.from({ length: 50 }, (_, i) => `role-b-${i}`);
    const [ha, hb] = splitHalf(a);
    expect(jensenShannonDivergence(tally(a), tally(b))).toBeCloseTo(1, 6);
    expect(jensenShannonDivergence(ha, hb)).toBeCloseTo(1, 6);
  });
});

describe("canonicalisation is mechanical", () => {
  test("atom form lowercases, strips punctuation, collapses whitespace", () => {
    expect(canonAtom('  "Cosmic  Curator." ')).toBe("cosmic curator");
    expect(canonAtom("Information-Architect")).toBe("information-architect");
  });

  test("word form drops stopwords and single characters", () => {
    expect(canonWords("I want to be the Guardian of Data")).toEqual(["guardian", "data"]);
  });

  test("no archetype lexicon is applied — unrelated names stay unrelated", () => {
    expect(canonWords("Cosmic Curator")).toEqual(["cosmic", "curator"]);
    expect(canonWords("Cyber Sentinel")).toEqual(["cyber", "sentinel"]);
  });
});

describe("meanPairwisePhi — and its refusal to score degenerate pairs", () => {
  test("identical agents are perfectly correlated", () => {
    const v = [true, false, true, true, false];
    expect(meanPairwisePhi([v, v, v]).phi).toBeCloseTo(1, 12);
  });

  test("exactly opposite agents give phi = -1", () => {
    const a = [true, false, true, false];
    const b = a.map((x) => !x);
    expect(meanPairwisePhi([a, b]).phi).toBeCloseTo(-1, 12);
  });

  test("a zero-variance agent makes phi UNDEFINED and is EXCLUDED, not scored 0", () => {
    const allRight = [true, true, true, true];
    const mixed = [true, false, true, false];
    const r = meanPairwisePhi([allRight, mixed]);
    expect(r.definedPairs).toBe(0);
    expect(r.undefinedPairs).toBe(1);
    expect(Number.isNaN(r.phi)).toBe(true);
  });

  test("defined and undefined pairs are counted separately over a mixed panel", () => {
    const r = meanPairwisePhi([
      [true, true, true, true],
      [true, false, true, false],
      [false, true, false, true],
    ]);
    expect(r.undefinedPairs).toBe(2);
    expect(r.definedPairs).toBe(1);
    expect(r.phi).toBeCloseTo(-1, 12);
  });
});

describe("meanPairwiseAnswerAgreement", () => {
  test("identical answer vectors agree fully", () => {
    expect(
      meanPairwiseAnswerAgreement([
        [1, 2, 3],
        [1, 2, 3],
      ]),
    ).toBeCloseTo(1, 12);
  });

  test("fully disjoint answers agree nowhere", () => {
    expect(
      meanPairwiseAnswerAgreement([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toBeCloseTo(0, 12);
  });

  test("two nulls count as agreement on producing nothing usable", () => {
    expect(
      meanPairwiseAnswerAgreement([
        [null, 1],
        [null, 2],
      ]),
    ).toBeCloseTo(0.5, 12);
  });

  test("is defined where phi is not — the all-right panel", () => {
    const r = meanPairwiseAnswerAgreement([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeCloseTo(1, 12);
  });
});

describe("effectiveN — the Kish design effect", () => {
  test("rho=0 gives N independent witnesses", () => {
    expect(effectiveN(24, 0)).toBeCloseTo(24, 12);
  });
  test("rho=1 collapses 24 agents to ONE witness", () => {
    expect(effectiveN(24, 1)).toBeCloseTo(1, 12);
  });
  test("rho=0.5 on 24 agents leaves under 2 witnesses", () => {
    expect(effectiveN(24, 0.5)).toBeLessThan(2);
  });
  test("is monotone decreasing in rho", () => {
    let prev = Infinity;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const e = effectiveN(24, r);
      expect(e).toBeLessThanOrEqual(prev + 1e-9);
      prev = e;
    }
  });
  test("negative rho is clamped at N, never inflated above the panel size", () => {
    expect(effectiveN(24, -0.9)).toBeLessThanOrEqual(24);
  });
});

describe("scoreAnswers — accuracy and abstention are TWO numbers", () => {
  test("a correct decline never counts as a correct answer", () => {
    const s = scoreAnswers([
      { answer: -1, correctIndex: null },
      { answer: -1, correctIndex: null },
      { answer: 3, correctIndex: 3 },
      { answer: 1, correctIndex: 3 },
    ]);
    expect(s.answerable).toBe(2);
    expect(s.accuracy).toBeCloseTo(0.5, 12); // NOT 3/4
    expect(s.abstentionPrecision).toBeCloseTo(1, 12);
    expect(s.abstentionRecall).toBeCloseTo(1, 12);
  });

  test("THE F2 DEFECT, refused: a perfect abstainer with 0% accuracy is not 100% anything", () => {
    const s = scoreAnswers([
      { answer: -1, correctIndex: null },
      { answer: 0, correctIndex: 2 },
      { answer: 0, correctIndex: 1 },
    ]);
    expect(s.accuracy).toBeCloseTo(0, 12);
    expect(s.abstentionPrecision).toBeCloseTo(1, 12);
    // There is no single number here that reads as success. That is the design.
  });

  test("an over-abstainer is caught by precision, not by recall", () => {
    const s = scoreAnswers([
      { answer: -1, correctIndex: null },
      { answer: -1, correctIndex: 1 },
      { answer: -1, correctIndex: 2 },
    ]);
    expect(s.abstentionRecall).toBeCloseTo(1, 12);
    expect(s.abstentionPrecision).toBeCloseTo(1 / 3, 12);
    expect(s.accuracy).toBeCloseTo(0, 12);
  });

  test("no abstentions and no unanswerable items leave abstention scores NaN, not 0", () => {
    const s = scoreAnswers([{ answer: 1, correctIndex: 1 }]);
    expect(Number.isNaN(s.abstentionPrecision)).toBe(true);
    expect(Number.isNaN(s.abstentionRecall)).toBe(true);
    expect(s.accuracy).toBeCloseTo(1, 12);
  });
});

describe("flopProxy — the denominator that is not milliseconds", () => {
  test("scales with model size at equal token count", () => {
    expect(flopProxy(9.2, 100) / flopProxy(0.494, 100)).toBeCloseTo(9.2 / 0.494, 6);
  });
  test("THE DEFECT IT REPLACES: equal latency does NOT mean equal cost", () => {
    // A 0.5B and a 9B finishing in the same wall-clock differ by ~19x here.
    expect(flopProxy(9.2, 50)).toBeGreaterThan(18 * flopProxy(0.494, 50));
  });
});

describe("bootstrapCi is seeded and DST-replayable", () => {
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  test("same seed gives byte-identical bounds", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i / 40);
    const a = bootstrapCi(xs, mean, 500, 1234);
    const b = bootstrapCi(xs, mean, 500, 1234);
    expect(a.lo).toBe(b.lo);
    expect(a.hi).toBe(b.hi);
  });

  test("different seeds do not give identical bounds (the RNG is actually used)", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i / 40);
    const a = bootstrapCi(xs, mean, 500, 1234);
    const b = bootstrapCi(xs, mean, 500, 999);
    expect(a.lo === b.lo && a.hi === b.hi).toBe(false);
  });

  test("the interval brackets the point estimate", () => {
    const xs = Array.from({ length: 60 }, (_, i) => Math.sin(i));
    const ci = bootstrapCi(xs, mean, 800, 42);
    expect(ci.lo).toBeLessThanOrEqual(ci.point);
    expect(ci.hi).toBeGreaterThanOrEqual(ci.point);
  });
});

describe("work items and prompts", () => {
  test("generation is deterministic from the seed", () => {
    expect(JSON.stringify(generateWorkItems(30, 42))).toBe(JSON.stringify(generateWorkItems(30, 42)));
    expect(JSON.stringify(generateWorkItems(30, 42))).not.toBe(JSON.stringify(generateWorkItems(30, 43)));
  });

  test("the answerable class really has the correct option at the stated index", () => {
    for (const it of generateWorkItems(200, 42)) {
      if (it.correctIndex !== null) {
        expect(it.options[it.correctIndex]).toBe("respond_to_operator");
      }
    }
  });

  test("the UNANSWERABLE class really lacks the correct option", () => {
    const unans = generateWorkItems(200, 42).filter((i) => i.correctIndex === null);
    expect(unans.length).toBeGreaterThan(20);
    for (const it of unans) expect(it.options).not.toContain("respond_to_operator");
  });

  test("the no-hat prompt carries no persona preamble and the hat prompt does", () => {
    const item = generateWorkItems(1, 42)[0]!;
    expect(workPrompt(null, item).startsWith("Choose ONE action")).toBe(true);
    expect(workPrompt("Cosmic Curator", item)).toContain("You are the Cosmic Curator.");
  });

  test("both prompts state the rule and the abstain channel", () => {
    const item = generateWorkItems(1, 42)[0]!;
    for (const p of [workPrompt(null, item), workPrompt("Guardian", item)]) {
      expect(p).toContain("outranks");
      expect(p).toContain("reply -1");
    }
  });

  test("parseAnswer accepts -1, rejects out-of-range, returns null on prose", () => {
    expect(parseAnswer("-1", 5)).toBe(-1);
    expect(parseAnswer(" 3 ", 5)).toBe(3);
    expect(parseAnswer("7", 5)).toBe(null);
    expect(parseAnswer("I think the operator", 5)).toBe(null);
  });
});

describe("the elicitation set is a real rewording, not synonyms", () => {
  test("six distinct phrasings, all sharing the answer-format suffix", () => {
    expect(ELICITATIONS.length).toBe(6);
    expect(new Set(ELICITATIONS.map((e) => e.text)).size).toBe(6);
    for (const e of ELICITATIONS) expect(elicitationPrompt(e.text)).toContain("short role name only");
  });

  test("no phrasing names a role — the prompt must not hand over the answer", () => {
    const leaky = /guardian|curator|architect|analyst|engineer|verifier|critic|explorer|builder/i;
    for (const e of ELICITATIONS) expect(leaky.test(e.text)).toBe(false);
  });
});

describe("jackknifeSe — the right tool for a U-statistic over agent pairs", () => {
  const jk = jackknifeSe;
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  test("a constant sample has zero spread", () => {
    const r = jk(
      Array.from({ length: 20 }, () => 5),
      mean,
    );
    expect(r.point).toBeCloseTo(5, 12);
    expect(r.se).toBeCloseTo(0, 10);
  });

  test("approximates the classical SE of the mean", () => {
    const xs = Array.from({ length: 50 }, (_, i) => Math.sin(i * 1.7));
    const m = mean(xs);
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
    expect(jk(xs, mean).se).toBeCloseTo(sd / Math.sqrt(xs.length), 6);
  });

  test("is deterministic — no RNG, so it replays exactly", () => {
    const xs = Array.from({ length: 30 }, (_, i) => i * 0.37);
    expect(jk(xs, mean).se).toBe(jk(xs, mean).se);
  });

  test("refuses rather than inventing an SE below n=3", () => {
    expect(Number.isNaN(jk([1, 2], mean).se)).toBe(true);
  });
});

describe("permutationTest — the exact null for the A-vs-B comparison", () => {
  const pt = permutationTest;
  const diffOfMeans = (a: readonly number[], b: readonly number[]) =>
    b.reduce((s, x) => s + x, 0) / b.length - a.reduce((s, x) => s + x, 0) / a.length;

  test("exchangeable groups give a large p-value", () => {
    const rng = makeRng(5);
    const a = Array.from({ length: 24 }, () => rng());
    const b = Array.from({ length: 24 }, () => rng());
    expect(pt(a, b, diffOfMeans, 2000, 77, "two-sided").pValue).toBeGreaterThan(0.1);
  });

  test("a genuinely lower B group is detected in the 'less' tail", () => {
    const a = Array.from({ length: 24 }, (_, i) => 0.8 + i * 0.001);
    const b = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.001);
    const r = pt(a, b, diffOfMeans, 2000, 77, "less");
    expect(r.observed).toBeLessThan(0);
    expect(r.pValue).toBeLessThan(0.01);
  });

  test("the direction matters — the same data is NOT significant in the wrong tail", () => {
    const a = Array.from({ length: 24 }, (_, i) => 0.8 + i * 0.001);
    const b = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.001);
    expect(pt(a, b, diffOfMeans, 2000, 77, "greater").pValue).toBeGreaterThan(0.9);
  });

  test("p is never exactly 0 — the observed labelling is itself a permutation", () => {
    const a = Array.from({ length: 10 }, () => 1);
    const b = Array.from({ length: 10 }, () => 0);
    expect(pt(a, b, diffOfMeans, 500, 1, "less").pValue).toBeGreaterThan(0);
  });

  test("same seed replays identically", () => {
    const rng = makeRng(9);
    const a = Array.from({ length: 15 }, () => rng());
    const b = Array.from({ length: 15 }, () => rng());
    expect(pt(a, b, diffOfMeans, 500, 3).pValue).toBe(pt(a, b, diffOfMeans, 500, 3).pValue);
  });

  test("the null distribution is actually centred near zero (the shuffle really shuffles)", () => {
    const a = Array.from({ length: 20 }, () => 1);
    const b = Array.from({ length: 20 }, () => 0);
    expect(Math.abs(pt(a, b, diffOfMeans, 2000, 11).nullMean)).toBeLessThan(0.15);
  });
});
