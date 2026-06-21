/**
 * src/Core.TypeScript/workflow-engine/trueskill.ts
 *
 * 081KDX1YWP008QG0R003F59WB0 — pure-TS TrueSkill 1v1 scaffold for workflow engine
 * ranking-agent (per Aaron 2026-05-28: 'they are doing this for their
 * idea ranking with Infra.net basically' + 'just ship stuff' calibration).
 *
 * Substrate-engineering substrate: cross-vendor benchmark on common ground
 * (081KSNY2Z0008QG0R0002BEZMR) REQUIRES TS-side ranking substrate because Infer.NET can't
 * run in vendor skill runtimes (Claude / GPT / Gemini / Grok / Cursor /
 * Continue / Codex / Kiro / Antigravity skill stores). Pure-TS TrueSkill
 * implementation lets the same framework substrate run cross-vendor.
 *
 * Hybrid substrate-engineering pattern:
 *   - TS-side (this file): pure-TS TrueSkill 1v1 for vendor skill runtime
 *   - F# / .NET side (future Zeta.Bayesian work): Infer.NET TrueSkill for
 *     deep production integration + full BP/EP framework
 *   - Both compose via shared API shape (TrueSkillRating + match update fn)
 *
 * Source: Herbrich + Minka + Graepel 2007 — 'TrueSkill: A Bayesian Skill
 * Rating System' (NeurIPS 2006 / NIPS 2006). Implementation from the
 * published algorithm; minimal 1v1 case; team-play extension deferred to
 * future substrate-engineering work.
 *
 * Composes with:
 *   - 081KDX1YWP008QG0R003F59WB0 backlog row (TrueSkill ranking-agent extension)
 *   - 081KSKBP80008QG0R000B3Y19A workflow engine substrate
 *   - 081KSNY2Z0008QG0R003WFDCJ9 lifecycle DU split (rank action gets pr-review-light level
 *     per Mod 1 escape-hatch semantic — surfaces substrate-engineering
 *     observation worth reviewer eyes)
 *   - 081KSKBP80008QG0R003NM9XEC + 081KSNY2Z0008QG0R0002BEZMR cross-vendor benchmark substrate (TrueSkill IS
 *     the cross-vendor scoring substrate)
 *   - Microsoft Infer.NET upstream reference (added in PR #5763)
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 *     (Result<T, TFeedback> shape per asymmetric-authorship)
 *
 * PoC scope: 1v1 TrueSkill (skill mean + variance gaussians; match update
 * via the classical TrueSkill formulas). Teams + multi-player matches
 * deferred to substrate-engineering work after operator-substrate-direction.
 */
/**
 * Default initial rating per Xbox Live defaults.
 */
export const DEFAULT_INITIAL_RATING = {
    mu: 25,
    sigma: 25 / 3,
};
export const DEFAULT_PARAMS = {
    beta: 25 / 6,
    tau: 25 / 300,
    drawProbability: 0.1,
};
/**
 * Standard normal PDF.
 */
function normalPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
/**
 * Standard normal CDF via error function approximation (Abramowitz & Stegun 7.1.26).
 *
 * Returns Φ(x) — accurate to ~1.5e-7.
 */
function normalCdf(x) {
    // Constants per A&S 7.1.26
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * ax);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return 0.5 * (1.0 + sign * y);
}
/**
 * Truncated normal correction functions per the TrueSkill paper:
 *   v(t, ε) = pdf(t - ε) / cdf(t - ε)        for non-draw outcome
 *   w(t, ε) = v(t, ε) * (v(t, ε) + (t - ε))  for non-draw outcome
 *
 * Used to compute the posterior mean+variance shift from a non-draw match.
 */
function vWin(t, epsilon) {
    const denom = normalCdf(t - epsilon);
    if (denom < 1e-100) {
        // Numerical floor; v approaches (epsilon - t) as t goes to -inf
        return epsilon - t;
    }
    return normalPdf(t - epsilon) / denom;
}
function wWin(t, epsilon) {
    const v = vWin(t, epsilon);
    return v * (v + (t - epsilon));
}
/**
 * Truncated normal correction functions for draw outcomes:
 *   v_draw(t, ε) = (pdf(-ε - t) - pdf(ε - t)) / (cdf(ε - t) - cdf(-ε - t))
 *   w_draw(t, ε) = v_draw² + ((ε - t) * pdf(ε - t) - (-ε - t) * pdf(-ε - t))
 *                  / (cdf(ε - t) - cdf(-ε - t))
 */
function vDraw(t, epsilon) {
    const denom = normalCdf(epsilon - t) - normalCdf(-epsilon - t);
    if (denom < 1e-100) {
        return -t;
    }
    return (normalPdf(-epsilon - t) - normalPdf(epsilon - t)) / denom;
}
function wDraw(t, epsilon) {
    const denom = normalCdf(epsilon - t) - normalCdf(-epsilon - t);
    if (denom < 1e-100) {
        return 1;
    }
    const v = vDraw(t, epsilon);
    const numerator = (epsilon - t) * normalPdf(epsilon - t) - (-epsilon - t) * normalPdf(-epsilon - t);
    return v * v + numerator / denom;
}
/**
 * Compute the draw margin (epsilon) from the draw probability + skill noise.
 *
 * Per the paper: ε = sqrt(2) * β * inverseCdf((1 + p_draw) / 2)
 *
 * Uses iterative inverse-normal-CDF via Newton's method (~5-10 iterations).
 */
function inverseNormalCdf(p) {
    // Initial guess via rational approximation (Beasley-Springer-Moro)
    if (p <= 0 || p >= 1) {
        throw new Error(`inverseNormalCdf domain: ${p}`);
    }
    let x = 0; // initial guess
    // Newton's method on F(x) = cdf(x) - p (F'(x) = pdf(x))
    for (let i = 0; i < 30; i++) {
        const f = normalCdf(x) - p;
        const fp = normalPdf(x);
        if (Math.abs(fp) < 1e-30)
            break;
        const dx = f / fp;
        x = x - dx;
        if (Math.abs(dx) < 1e-10)
            break;
    }
    return x;
}
function drawMargin(drawProbability, beta) {
    return Math.sqrt(2) * beta * inverseNormalCdf((1 + drawProbability) / 2);
}
/**
 * Update two TrueSkill ratings after a 1v1 match.
 *
 * Algorithm per Herbrich + Minka + Graepel 2007 NeurIPS:
 *   1. Compute c² = 2β² + σ_A² + σ_B² (total skill+performance variance)
 *   2. Compute draw margin ε
 *   3. Compute t = (μ_A - μ_B) / c
 *   4. Look up v(t, ε) + w(t, ε) (win) OR v_draw + w_draw (draw)
 *   5. New μ_A = μ_A + sign * (σ_A² / c) * v
 *   6. New μ_B = μ_B - sign * (σ_B² / c) * v
 *   7. New σ_A² = σ_A² * (1 - (σ_A² / c²) * w)
 *   8. New σ_B² = σ_B² * (1 - (σ_B² / c²) * w)
 *   9. Apply dynamics: σ² += τ² (skill drift over time)
 *
 * sign = +1 for win-A, -1 for win-B; draw uses v_draw/w_draw (sign unused).
 */
export function rate1v1(a, b, outcome, params = DEFAULT_PARAMS) {
    // Input validation
    if (!Number.isFinite(a.mu) || !Number.isFinite(a.sigma) || a.sigma <= 0) {
        return {
            ok: false,
            feedback: {
                kind: "InvalidRating",
                identity: "A",
                reason: `mu=${a.mu} sigma=${a.sigma}`,
            },
        };
    }
    if (!Number.isFinite(b.mu) || !Number.isFinite(b.sigma) || b.sigma <= 0) {
        return {
            ok: false,
            feedback: {
                kind: "InvalidRating",
                identity: "B",
                reason: `mu=${b.mu} sigma=${b.sigma}`,
            },
        };
    }
    const beta2 = params.beta * params.beta;
    const tau2 = params.tau * params.tau;
    const sigmaA2 = a.sigma * a.sigma;
    const sigmaB2 = b.sigma * b.sigma;
    const c2 = 2 * beta2 + sigmaA2 + sigmaB2;
    const c = Math.sqrt(c2);
    const epsilon = drawMargin(params.drawProbability, params.beta);
    let v;
    let w;
    let signA; // direction of mu update for player A
    let signB;
    switch (outcome.kind) {
        case "win-A": {
            const t = (a.mu - b.mu) / c;
            v = vWin(t, epsilon);
            w = wWin(t, epsilon);
            signA = +1;
            signB = -1;
            break;
        }
        case "win-B": {
            const t = (b.mu - a.mu) / c;
            v = vWin(t, epsilon);
            w = wWin(t, epsilon);
            signA = -1;
            signB = +1;
            break;
        }
        case "draw": {
            // Draw uses symmetric truncated-normal correction
            const t = (a.mu - b.mu) / c;
            v = vDraw(t, epsilon);
            w = wDraw(t, epsilon);
            // For draws, the mu shifts toward the opponent's mu
            signA = +1;
            signB = -1;
            break;
        }
    }
    if (!Number.isFinite(v) || !Number.isFinite(w)) {
        return {
            ok: false,
            feedback: {
                kind: "NumericalInstability",
                reason: `v=${v} w=${w}`,
            },
        };
    }
    // Posterior updates per the TrueSkill paper
    const newMuA = a.mu + signA * (sigmaA2 / c) * v;
    const newMuB = b.mu + signB * (sigmaB2 / c) * v;
    const newSigmaA2 = sigmaA2 * (1 - (sigmaA2 / c2) * w);
    const newSigmaB2 = sigmaB2 * (1 - (sigmaB2 / c2) * w);
    // Apply dynamics: skill drift over time
    const newSigmaA = Math.sqrt(newSigmaA2 + tau2);
    const newSigmaB = Math.sqrt(newSigmaB2 + tau2);
    if (!Number.isFinite(newMuA) || !Number.isFinite(newSigmaA) || newSigmaA <= 0) {
        return {
            ok: false,
            feedback: {
                kind: "NumericalInstability",
                reason: `newMuA=${newMuA} newSigmaA=${newSigmaA}`,
            },
        };
    }
    if (!Number.isFinite(newMuB) || !Number.isFinite(newSigmaB) || newSigmaB <= 0) {
        return {
            ok: false,
            feedback: {
                kind: "NumericalInstability",
                reason: `newMuB=${newMuB} newSigmaB=${newSigmaB}`,
            },
        };
    }
    return {
        ok: true,
        ratingA: { mu: newMuA, sigma: newSigmaA },
        ratingB: { mu: newMuB, sigma: newSigmaB },
    };
}
/**
 * Conservative skill estimate per Xbox Live convention:
 *   skill = mu - 3*sigma
 *
 * Used for leaderboard ranking: confident lower bound on skill.
 */
export function conservativeSkill(rating) {
    return rating.mu - 3 * rating.sigma;
}
