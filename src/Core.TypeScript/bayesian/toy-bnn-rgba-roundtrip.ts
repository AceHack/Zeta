// TOY — the falsifier runner. Produces the numbers quoted in
// docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*.md
//
// Run: bun src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts
//
// Nothing here is metered. Every claim in the doc that carries a number comes from this file.

import {
  type GaussianNp, type NormalGamma, type NormalGammaNp,
  npFromMoments, npToMoments, npFuse, momentFuseNaive, npKl,
  ngToNp, ngFromNp, ngFuse, ngKl, ngStudentT,
  asF32, asF16, asU8, f16RoundSelfCheck,
} from "./toy-bnn-rgba-codec";

// deterministic PRNG (DST discipline — no ambient entropy)
const mkRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x1_0000_0000;
  };
};
const gauss = (r: () => number) => {
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const fmt = (x: number) => (Number.isFinite(x) ? x.toExponential(3) : String(x));
const line = (s: string) => console.log(s);

// A synthetic MinimalBnn-shaped layer: 4096 weights, prior N(0,1), each updated by a
// varying number of observations so the posterior precisions span several decades —
// which is exactly the dynamic range a real trained layer has.
const layer = (n: number, seed: number) => {
  const r = mkRng(seed);
  const out: NormalGamma[] = [];
  for (let i = 0; i < n; i++) {
    const nObs = 1 + Math.floor(r() * 400);          // 1..400 observations
    const m = gauss(r) * 0.5;                        // weight means, ~N(0, 0.5^2)
    const lambda = 1 + nObs;                         // pseudo-count on the mean
    const alpha = 1 + nObs / 2;                      // shape -> nu = 2*alpha
    const beta = 0.5 + Math.abs(gauss(r)) * nObs * 0.05;
    out.push({ m, lambda, alpha, beta });
  }
  return out;
};

line("=".repeat(78));
line("TOY BNN -> RGBA round-trip.  REGISTER: toy.  Nothing below is metered.");
line("=".repeat(78));

// The binary16 converter is hand-rolled (no es2025 lib dependency), so it is cross-checked
// against the platform intrinsic first. A converter that is wrong would fake every f16 result.
{
  const probes: number[] = [];
  const rp = mkRng(31337);
  for (let i = 0; i < 20000; i++) probes.push((rp() - 0.5) * 10 ** Math.floor(rp() * 12 - 6));
  probes.push(0, -0, 1, 65504, 65520, 131072, 6e-8, 1e-7, 5.96e-8, Infinity, -Infinity, NaN);
  const bad = f16RoundSelfCheck(probes);
  line(bad < 0
    ? "\n[0] binary16 self-check: NO platform Math.f16round on this runtime - UNCHECKED."
    : `\n[0] binary16 self-check vs Math.f16round over ${probes.length} probes: ${bad} disagreements`);
}

// ── 1. NP2: Gaussian (eta, tau), two weights per rgba texel ────────────────────────────────
line("\n[1] NP2 — Gaussian in natural params (eta,tau). 2 weights / rgba texel.");
{
  const src = layer(4096, 12345).map((p) => {
    const t = ngStudentT(p);
    return npFromMoments(t.loc, t.scale * t.scale);
  });
  const run = (name: string, enc: (x: number) => number) => {
    let maxKl = 0, sumKl = 0, bad = 0;
    for (const g of src) {
      const back: GaussianNp = { eta: enc(g.eta), tau: enc(g.tau) };
      if (!Number.isFinite(back.tau) || back.tau <= 0) { bad++; continue; }
      const kl = Math.abs(npKl(g, back));
      maxKl = Math.max(maxKl, kl); sumKl += kl;
    }
    line(`    ${name.padEnd(16)} maxKL=${fmt(maxKl)}  meanKL=${fmt(sumKl / src.length)}  nonfinite=${bad}`);
  };
  run("rgba32float", asF32);
  run("rgba16float", asF16);
  const etas = src.map((g) => g.eta), taus = src.map((g) => g.tau);
  const lo1 = Math.min(...etas), hi1 = Math.max(...etas);
  const lo2 = Math.min(...taus), hi2 = Math.max(...taus);
  line(`    channel ranges: eta [${lo1.toFixed(2)}, ${hi1.toFixed(2)}]  tau [${lo2.toFixed(2)}, ${hi2.toFixed(2)}]`);
  {
    let maxKl = 0, sumKl = 0;
    for (const g of src) {
      const back: GaussianNp = { eta: asU8(g.eta, lo1, hi1), tau: asU8(g.tau, lo2, hi2) };
      const kl = Math.abs(npKl(g, back));
      maxKl = Math.max(maxKl, kl); sumKl += kl;
    }
    line(`    ${"rgba8unorm".padEnd(16)} maxKL=${fmt(maxKl)}  meanKL=${fmt(sumKl / src.length)}   <- what OracleRGBA writes today`);
  }
}

// ── 2. NG4: Normal-Gamma, one weight per texel, Student-t marginal ─────────────────────────
line("\n[2] NG4 — Normal-Gamma natural params. 1 weight / rgba texel. Marginal = Student-t.");
{
  const src = layer(4096, 999).map(ngToNp);
  const run = (name: string, enc: (x: number) => number) => {
    let maxKl = 0, sumKl = 0, bad = 0, maxNu = 0, maxLoc = 0, maxScale = 0;
    for (const h of src) {
      const back: NormalGammaNp = { h1: enc(h.h1), h2: enc(h.h2), h3: enc(h.h3), h4: enc(h.h4) };
      const p0 = ngFromNp(h), p1 = ngFromNp(back);
      if (!(p1.beta > 0 && p1.lambda > 0 && p1.alpha > 0)) { bad++; continue; }
      const kl = Math.abs(ngKl(h, back));
      if (Number.isFinite(kl)) { maxKl = Math.max(maxKl, kl); sumKl += kl; } else bad++;
      const t0 = ngStudentT(p0), t1 = ngStudentT(p1);
      maxNu = Math.max(maxNu, Math.abs(t1.nu - t0.nu) / t0.nu);
      maxLoc = Math.max(maxLoc, Math.abs(t1.loc - t0.loc));
      maxScale = Math.max(maxScale, Math.abs(t1.scale - t0.scale) / t0.scale);
    }
    line(`    ${name.padEnd(16)} maxKL=${fmt(maxKl)}  meanKL=${fmt(sumKl / src.length)}  invalid=${bad}`);
    line(`    ${" ".repeat(16)} rel-err  nu=${fmt(maxNu)}  scale=${fmt(maxScale)}  abs loc=${fmt(maxLoc)}`);
  };
  run("rgba32float", asF32);
  run("rgba16float", asF16);
  for (const k of ["h1", "h2", "h3", "h4"] as const) {
    const v = src.map((h) => h[k]);
    line(`    range ${k}: [${Math.min(...v).toFixed(3)}, ${Math.max(...v).toFixed(3)}]`);
  }
  // per-channel 8-bit, uniform grid
  const ranges = (["h1", "h2", "h3", "h4"] as const).map((k) => {
    const v = src.map((h) => h[k]);
    return [Math.min(...v), Math.max(...v)] as const;
  });
  let maxKl = 0, sumKl = 0, bad = 0;
  for (const h of src) {
    const back: NormalGammaNp = {
      h1: asU8(h.h1, ranges[0]![0], ranges[0]![1]),
      h2: asU8(h.h2, ranges[1]![0], ranges[1]![1]),
      h3: asU8(h.h3, ranges[2]![0], ranges[2]![1]),
      h4: asU8(h.h4, ranges[3]![0], ranges[3]![1]),
    };
    const p1 = ngFromNp(back);
    if (!(p1.beta > 0 && p1.lambda > 0 && p1.alpha > 0)) { bad++; continue; }
    const kl = Math.abs(ngKl(h, back));
    if (Number.isFinite(kl)) { maxKl = Math.max(maxKl, kl); sumKl += kl; } else bad++;
  }
  line(`    ${"rgba8unorm/chan".padEnd(16)} maxKL=${fmt(maxKl)}  meanKL=${fmt(sumKl / src.length)}  invalid=${bad}`);
}

// ── 3. The beta cancellation hazard, named and measured ────────────────────────────────────
line("\n[3] Catastrophic cancellation in the beta decode, as |m| grows (rgba32float).");
{
  for (const m of [0, 1, 10, 100, 1000, 10000]) {
    const p: NormalGamma = { m, lambda: 50, alpha: 25, beta: 2 };
    const h = ngToNp(p);
    const back = ngFromNp({ h1: asF32(h.h1), h2: asF32(h.h2), h3: asF32(h.h3), h4: asF32(h.h4) });
    line(`    m=${String(m).padStart(6)}  beta ${p.beta} -> ${back.beta.toPrecision(9)}  rel-err=${fmt(Math.abs(back.beta - p.beta) / p.beta)}`);
  }
}

// ── 4. Associativity — the fold falsifier ──────────────────────────────────────────────────
line("\n[4] Associativity of combination over 3 parents.");
{
  const A = npFromMoments(1.0, 0.5), B = npFromMoments(-2.0, 4.0), C = npFromMoments(0.3, 0.01);
  const o1 = npToMoments(npFuse(npFuse(A, B), C));
  const o2 = npToMoments(npFuse(A, npFuse(B, C)));
  line(`    (eta,tau)  (A*B)*C mu=${o1.mu.toPrecision(12)}   A*(B*C) mu=${o2.mu.toPrecision(12)}   |d|=${fmt(Math.abs(o1.mu - o2.mu))}`);
  const a = npToMoments(A), b = npToMoments(B), c = npToMoments(C);
  const m1 = momentFuseNaive(momentFuseNaive(a, b), c);
  const m2 = momentFuseNaive(a, momentFuseNaive(b, c));
  line(`    (mu,s^2)   (A*B)*C mu=${m1.mu.toPrecision(12)}   A*(B*C) mu=${m2.mu.toPrecision(12)}   |d|=${fmt(Math.abs(m1.mu - m2.mu))}`);

  const P = ngToNp({ m: 0.4, lambda: 10, alpha: 6, beta: 1.5 });
  const Q = ngToNp({ m: -1.1, lambda: 3, alpha: 2.5, beta: 0.7 });
  const R = ngToNp({ m: 2.2, lambda: 40, alpha: 20, beta: 5.0 });
  const g1 = ngFromNp(ngFuse(ngFuse(P, Q), R)), g2 = ngFromNp(ngFuse(P, ngFuse(Q, R)));
  line(`    NG4        (P*Q)*R m=${g1.m.toPrecision(12)}    P*(Q*R) m=${g2.m.toPrecision(12)}    |d|=${fmt(Math.abs(g1.m - g2.m))}`);

  // Student-t (mu,sigma,nu) with moment-matched product — the option-2 candidate.
  // A product of two Student-t densities is NOT a Student-t, so any implementation must
  // project back. Projection is where associativity dies. Moment-matched projection below.
  type T3 = { mu: number; sigma: number; nu: number };
  const tFuseMoment = (x: T3, y: T3): T3 => {
    const vx = (x.sigma * x.sigma * x.nu) / (x.nu - 2);
    const vy = (y.sigma * y.sigma * y.nu) / (y.nu - 2);
    const mu = (x.mu / vx + y.mu / vy) / (1 / vx + 1 / vy);
    const v = 1 / (1 / vx + 1 / vy);
    const nu = Math.min(x.nu, y.nu) + 1;      // any closure rule; all of them break associativity
    return { mu, sigma: Math.sqrt((v * (nu - 2)) / nu), nu };
  };
  const X: T3 = { mu: 0.4, sigma: 1.0, nu: 5 };
  const Y: T3 = { mu: -1.1, sigma: 0.4, nu: 12 };
  const Z: T3 = { mu: 2.2, sigma: 2.0, nu: 30 };
  const t1 = tFuseMoment(tFuseMoment(X, Y), Z), t2 = tFuseMoment(X, tFuseMoment(Y, Z));
  line(`    t(mu,s,nu) (X*Y)*Z mu=${t1.mu.toPrecision(12)}  nu=${t1.nu}`);
  line(`               X*(Y*Z) mu=${t2.mu.toPrecision(12)}  nu=${t2.nu}   |dmu|=${fmt(Math.abs(t1.mu - t2.mu))}`);
}

// ── 5. Quantisation schemes, measured by KL — not by an L2 on channels ─────────────────────
line("\n[5] 8-bit quantisation of the NG4 channels, scored by KL(original || recovered).");
{
  const src = layer(4096, 777).map(ngToNp);
  const chan = (k: "h1" | "h2" | "h3" | "h4") => src.map((h) => h[k]);
  const score = (dec: NormalGammaNp[]) => {
    let maxKl = 0, sum = 0, bad = 0;
    for (let i = 0; i < src.length; i++) {
      const p = ngFromNp(dec[i]!);
      if (!(p.beta > 0 && p.lambda > 0 && p.alpha > 0)) { bad++; continue; }
      const kl = Math.abs(ngKl(src[i]!, dec[i]!));
      if (Number.isFinite(kl)) { maxKl = Math.max(maxKl, kl); sum += kl; } else bad++;
    }
    return { maxKl, meanKl: sum / src.length, bad };
  };

  // (a) per-TENSOR uniform: one scale for all four channels together.
  {
    const all = [...chan("h1"), ...chan("h2"), ...chan("h3"), ...chan("h4")];
    const lo = Math.min(...all), hi = Math.max(...all);
    const dec = src.map((h) => ({
      h1: asU8(h.h1, lo, hi), h2: asU8(h.h2, lo, hi), h3: asU8(h.h3, lo, hi), h4: asU8(h.h4, lo, hi),
    }));
    const s = score(dec);
    line(`    (a) per-tensor uniform      maxKL=${fmt(s.maxKl)}  meanKL=${fmt(s.meanKl)}  invalid=${s.bad}`);
  }
  // (b) per-CHANNEL uniform (Krishnamoorthi 2018 / Nagel et al. 2021 per-channel scales).
  const rng = (["h1", "h2", "h3", "h4"] as const).map((k) => {
    const v = chan(k); return [Math.min(...v), Math.max(...v)] as const;
  });
  {
    const dec = src.map((h) => ({
      h1: asU8(h.h1, rng[0]![0], rng[0]![1]), h2: asU8(h.h2, rng[1]![0], rng[1]![1]),
      h3: asU8(h.h3, rng[2]![0], rng[2]![1]), h4: asU8(h.h4, rng[3]![0], rng[3]![1]),
    }));
    const s = score(dec);
    line(`    (b) per-channel uniform     maxKL=${fmt(s.maxKl)}  meanKL=${fmt(s.meanKl)}  invalid=${s.bad}`);
  }
  // (c) per-channel QUANTILE grid — NF4's method (Dettmers 2023) generalised: fit the grid to
  //     the observed marginal instead of assuming uniformity. NF4's *grid* assumes normality;
  //     h3/h4 are not normal, so the grid is refit per channel from the data.
  const quantGrid = (v: number[], levels: number) => {
    const s = [...v].sort((a, b) => a - b);
    const g: number[] = [];
    for (let i = 0; i < levels; i++) g.push(s[Math.min(s.length - 1, Math.floor(((i + 0.5) / levels) * s.length))]!);
    return g;
  };
  const nearest = (g: number[], x: number) => {
    let lo = 0, hi = g.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (g[mid]! < x) lo = mid + 1; else hi = mid; }
    const c = [g[Math.max(0, lo - 1)]!, g[lo]!];
    return Math.abs(c[0]! - x) <= Math.abs(c[1]! - x) ? c[0]! : c[1]!;
  };
  {
    const grids = (["h1", "h2", "h3", "h4"] as const).map((k) => quantGrid(chan(k), 256));
    const dec = src.map((h) => ({
      h1: nearest(grids[0]!, h.h1), h2: nearest(grids[1]!, h.h2),
      h3: nearest(grids[2]!, h.h3), h4: nearest(grids[3]!, h.h4),
    }));
    const s = score(dec);
    line(`    (c) per-channel quantile    maxKL=${fmt(s.maxKl)}  meanKL=${fmt(s.meanKl)}  invalid=${s.bad}`);
  }
  // (d) outlier-split: keep the top 1% by |value| per channel in f32 alongside an 8-bit bulk
  //     (LLM.int8(), Dettmers et al. 2022 — mixed-precision decomposition).
  {
    const grids = (["h1", "h2", "h3", "h4"] as const).map((k) => quantGrid(chan(k), 256));
    const cut = (["h1", "h2", "h3", "h4"] as const).map((k) => {
      const v = chan(k).map(Math.abs).sort((a, b) => a - b);
      return v[Math.floor(v.length * 0.99)]!;
    });
    const dec = src.map((h) => ({
      h1: Math.abs(h.h1) >= cut[0]! ? asF32(h.h1) : nearest(grids[0]!, h.h1),
      h2: Math.abs(h.h2) >= cut[1]! ? asF32(h.h2) : nearest(grids[1]!, h.h2),
      h3: Math.abs(h.h3) >= cut[2]! ? asF32(h.h3) : nearest(grids[2]!, h.h3),
      h4: Math.abs(h.h4) >= cut[3]! ? asF32(h.h4) : nearest(grids[3]!, h.h4),
    }));
    const s = score(dec);
    line(`    (d) quantile + 1% outliers  maxKL=${fmt(s.maxKl)}  meanKL=${fmt(s.meanKl)}  invalid=${s.bad}`);
  }
  // (e) the asymmetry the LLM literature does not cover: quantise ONLY the location channel
  //     (h2, the mu-carrier) and keep the shape/scale channels exact — and the converse.
  {
    const grids = (["h1", "h2", "h3", "h4"] as const).map((k) => quantGrid(chan(k), 256));
    const onlyLoc = src.map((h) => ({ h1: asF32(h.h1), h2: nearest(grids[1]!, h.h2), h3: asF32(h.h3), h4: asF32(h.h4) }));
    const onlyShape = src.map((h) => ({ h1: nearest(grids[0]!, h.h1), h2: asF32(h.h2), h3: nearest(grids[2]!, h.h3), h4: nearest(grids[3]!, h.h4) }));
    const sl = score(onlyLoc), ss = score(onlyShape);
    line(`    (e) 8-bit LOCATION only     maxKL=${fmt(sl.maxKl)}  meanKL=${fmt(sl.meanKl)}`);
    line(`    (e) 8-bit SHAPE/SCALE only  maxKL=${fmt(ss.maxKl)}  meanKL=${fmt(ss.meanKl)}`);
  }
}

// ── 6. Multi-texture / SoA cost, in fetches per weight ─────────────────────────────────────
line("\n[6] Layout cost, in texture fetches per weight and bytes per weight.");
{
  const rows: [string, number, number, string][] = [
    ["NP2 packed rgba32float", 0.5, 8, "2 weights/texel, Gaussian only"],
    ["NG4 packed rgba32float", 1, 16, "1 weight/texel, Student-t marginal"],
    ["NG4 SoA, 4 x r32float", 4, 16, "independent range per parameter"],
    ["NG4 SoA, 4 x rgba32float (16 wts)", 4, 16, "4 weights per fetch-set, amortised"],
    ["NG4 hi/lo planes, 2 x rgba32float", 2, 32, "not needed: f32 already round-trips"],
    ["NG4 8-bit bulk + 1% f32 outliers", 1.01, 4.12, "lossy, see [5d]"],
  ];
  for (const [n, f, b, note] of rows) line(`    ${n.padEnd(36)} ${String(f).padStart(5)} fetch/wt  ${String(b).padStart(6)} B/wt   ${note}`);
}

// ── 7. RGB <-> CMYK: is the conversion a model of `snap`? ──────────────────────────────────
line("\n[7] Is naive RGB->CMYK a model of SoftValue.snap?  (directional / lossy / non-invertible)");
{
  const toCmyk = (r: number, g: number, b: number) => {
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return [0, 0, 0, 1] as const;
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k] as const;
  };
  const toRgb = (c: number, m: number, y: number, k: number) =>
    [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)] as const;
  const r = mkRng(4242);
  let maxErr = 0;
  for (let i = 0; i < 100000; i++) {
    const R = r(), G = r(), B = r();
    const [c, m, y, k] = toCmyk(R, G, B);
    const [R2, G2, B2] = toRgb(c, m, y, k);
    maxErr = Math.max(maxErr, Math.abs(R - R2), Math.abs(G - G2), Math.abs(B - B2));
  }
  line(`    RGB -> CMYK -> RGB  max round-trip error over 100k random colours: ${fmt(maxErr)}`);
  line(`    dim(RGB)=3, dim(CMYK)=4  =>  the naive map goes UP in dimension, and is a bijection`);
  line(`    off the K=1 point. snap goes DOWN (distribution -> point) and is not invertible.`);
}

line("\n" + "=".repeat(78));
