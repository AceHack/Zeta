//! mesh-pong — the mesh-pong world (integer-grid lockstep pong). Rust parity oracle; mirrors
//! `src/Core/MeshPong.fs` (the F# oracle that LOCKED the game-state treaty) and the C#/TS siblings.
//! GAME-STATE TREATY: `step` + `to_line` must replay the shared session
//! (`src/Core.TypeScript/mesh-pong/golden-vectors.lines`) to byte-identical checkpoint lines.

pub const WIDTH: i32 = 16;
pub const HEIGHT: i32 = 9;
pub const PADDLE_LEN: i32 = 3;

/// The whole pong world — small, integer, byte-stable across oracles.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Game {
    pub ball_x: i32,
    pub ball_y: i32,
    pub vx: i32,
    pub vy: i32,
    pub paddle_a: i32,
    pub paddle_b: i32,
    pub score_a: i32,
    pub score_b: i32,
}

impl Game {
    /// Center serve, heading right-down.
    pub fn create() -> Self {
        Self {
            ball_x: WIDTH / 2,
            ball_y: HEIGHT / 2,
            vx: 1,
            vy: 1,
            paddle_a: HEIGHT / 2 - 1,
            paddle_b: HEIGHT / 2 - 1,
            score_a: 0,
            score_b: 0,
        }
    }

    fn serve(mut self, vx: i32) -> Self {
        self.ball_x = WIDTH / 2;
        self.ball_y = HEIGHT / 2;
        self.vx = vx;
        self.vy = 1;
        self
    }

    /// One lockstep tick — the pure physics fold (parity with `MeshPong.step`).
    pub fn step(&self, input_a: i32, input_b: i32) -> Self {
        let mut g = self.clone();
        g.paddle_a = clamp_paddle(g.paddle_a + input_a.clamp(-1, 1));
        g.paddle_b = clamp_paddle(g.paddle_b + input_b.clamp(-1, 1));

        let nx = g.ball_x + g.vx;
        let ny_raw = g.ball_y + g.vy;
        let bounced = !(0..HEIGHT).contains(&ny_raw);
        let vy = if bounced { -g.vy } else { g.vy };
        let ny = if bounced { g.ball_y - g.vy } else { ny_raw };

        if nx <= 0 {
            if ny >= g.paddle_a && ny < g.paddle_a + PADDLE_LEN {
                g.ball_x = 1;
                g.ball_y = ny;
                g.vx = 1;
                g.vy = vy;
                g
            } else {
                g.score_b += 1;
                g.serve(-1)
            }
        } else if nx >= WIDTH - 1 {
            if ny >= g.paddle_b && ny < g.paddle_b + PADDLE_LEN {
                g.ball_x = WIDTH - 2;
                g.ball_y = ny;
                g.vx = -1;
                g.vy = vy;
                g
            } else {
                g.score_a += 1;
                g.serve(1)
            }
        } else {
            g.ball_x = nx;
            g.ball_y = ny;
            g.vy = vy;
            g
        }
    }

    /// Serialize to the canonical treaty line (byte-identical to the F# oracle).
    pub fn to_line(&self) -> String {
        format!(
            "ponggame1\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
            self.ball_x, self.ball_y, self.vx, self.vy, self.paddle_a, self.paddle_b, self.score_a, self.score_b
        )
    }

    /// Parse a canonical game-state line; `None` on malformed (honest refusal).
    pub fn of_line(line: &str) -> Option<Self> {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() != 9 || parts[0] != "ponggame1" {
            return None;
        }
        let mut vals = [0i32; 8];
        for (i, v) in vals.iter_mut().enumerate() {
            *v = parts[i + 1].parse().ok()?;
        }
        Some(Self {
            ball_x: vals[0],
            ball_y: vals[1],
            vx: vals[2],
            vy: vals[3],
            paddle_a: vals[4],
            paddle_b: vals[5],
            score_a: vals[6],
            score_b: vals[7],
        })
    }
}

fn clamp_paddle(p: i32) -> i32 {
    p.clamp(0, HEIGHT - PADDLE_LEN)
}

/// Parse a crossing payload (`pong:a,b`); `None` = not a pong input (honest refusal).
pub fn parse_inputs(payload: &str) -> Option<(i32, i32)> {
    let rest = payload.strip_prefix("pong:")?;
    let (a, b) = rest.split_once(',')?;
    Some((a.parse().ok()?, b.parse().ok()?))
}
