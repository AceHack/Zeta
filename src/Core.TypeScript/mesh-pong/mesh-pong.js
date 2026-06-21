/**
 * mesh-pong — the mesh-pong world (integer-grid lockstep pong). TS parity oracle; mirrors
 * src/Core/MeshPong.fs (the F# oracle that LOCKED the game-state treaty) and the C#/Rust siblings.
 * GAME-STATE TREATY: step + toLine must replay the shared session (./golden-vectors.lines) to
 * byte-identical checkpoint lines.
 */
export const WIDTH = 16;
export const HEIGHT = 9;
export const PADDLE_LEN = 3;
/** Center serve, heading right-down. */
export function create() {
    return {
        ballX: Math.floor(WIDTH / 2),
        ballY: Math.floor(HEIGHT / 2),
        vx: 1,
        vy: 1,
        paddleA: Math.floor(HEIGHT / 2) - 1,
        paddleB: Math.floor(HEIGHT / 2) - 1,
        scoreA: 0,
        scoreB: 0,
    };
}
function clampPaddle(p) {
    return Math.max(0, Math.min(HEIGHT - PADDLE_LEN, p));
}
function serve(g, vx) {
    return { ...g, ballX: Math.floor(WIDTH / 2), ballY: Math.floor(HEIGHT / 2), vx, vy: 1 };
}
/** One lockstep tick — the pure physics fold (parity with MeshPong.step). */
export function step(inputA, inputB, g0) {
    const g = {
        ...g0,
        paddleA: clampPaddle(g0.paddleA + Math.max(-1, Math.min(1, inputA))),
        paddleB: clampPaddle(g0.paddleB + Math.max(-1, Math.min(1, inputB))),
    };
    const nx = g.ballX + g.vx;
    const nyRaw = g.ballY + g.vy;
    const bounced = nyRaw < 0 || nyRaw >= HEIGHT;
    const vy = bounced ? -g.vy : g.vy;
    const ny = bounced ? g.ballY - g.vy : nyRaw;
    if (nx <= 0) {
        return ny >= g.paddleA && ny < g.paddleA + PADDLE_LEN
            ? { ...g, ballX: 1, ballY: ny, vx: 1, vy }
            : serve({ ...g, scoreB: g.scoreB + 1 }, -1);
    }
    if (nx >= WIDTH - 1) {
        return ny >= g.paddleB && ny < g.paddleB + PADDLE_LEN
            ? { ...g, ballX: WIDTH - 2, ballY: ny, vx: -1, vy }
            : serve({ ...g, scoreA: g.scoreA + 1 }, 1);
    }
    return { ...g, ballX: nx, ballY: ny, vy };
}
/** Parse a crossing payload ("pong:a,b"); null = not a pong input (honest refusal). */
export function parseInputs(payload) {
    if (!payload.startsWith("pong:"))
        return null;
    const parts = payload.slice(5).split(",");
    if (parts.length !== 2)
        return null;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isInteger(a) || !Number.isInteger(b) || parts[0] === "" || parts[1] === "")
        return null;
    return [a, b];
}
/** Serialize to the canonical treaty line (byte-identical to the F# oracle). */
export function toLine(g) {
    return `ponggame1\t${g.ballX}\t${g.ballY}\t${g.vx}\t${g.vy}\t${g.paddleA}\t${g.paddleB}\t${g.scoreA}\t${g.scoreB}`;
}
/** Parse a canonical game-state line; null on malformed (honest refusal). */
export function ofLine(line) {
    const parts = line.split("\t");
    if (parts.length !== 9 || parts[0] !== "ponggame1")
        return null;
    const vals = [];
    for (let i = 1; i < 9; i++) {
        const v = Number(parts[i]);
        if (!Number.isInteger(v) || parts[i] === "")
            return null;
        vals.push(v);
    }
    return {
        ballX: vals[0],
        ballY: vals[1],
        vx: vals[2],
        vy: vals[3],
        paddleA: vals[4],
        paddleB: vals[5],
        scoreA: vals[6],
        scoreB: vals[7],
    };
}
