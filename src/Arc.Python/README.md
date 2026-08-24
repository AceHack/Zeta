# `src/Arc.Python` — the ARC-AGI-3 lane

The first rung of
[`docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md`](../../docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md)
that **runs**. That design's §13 says of itself:

> **Nothing here ran.** I installed no Python package, started no server, made
> no ARC call, and scored nothing.

This directory is the part that installs the package, drives the engine, and
scores an episode.

## Run it

```bash
uv run --project src/Arc.Python python -m zeta_arc.play              # greedy
uv run --project src/Arc.Python python -m zeta_arc.play --agent random --seed 7
uv run --project src/Arc.Python python -m pytest src/Arc.Python/tests -q
```

No API key. No network. `OperationMode.OFFLINE` is measured to initialise with
`arc_api_key=''` and never contact the API.

## Measured facts (2026-08-24)

The toolkit is pre-1.0, so these are **facts with an expiry date** — the design
doc's own warning, kept.

| fact | value | note |
|---|---|---|
| install | `arc-agi` + `arcengine` | Python **≥3.12 required** — this container's system 3.11.15 will not do |
| API base URL | `https://three.arcprize.org` | the design doc recorded *"no base URL anywhere"*; this is `Arcade.__init__`'s default |
| API key | `arc_api_key: str = ''` | genuinely optional; OFFLINE never fetches, other modes mint an anonymous key |
| modes | `NORMAL` `ONLINE` `OFFLINE` `COMPETITION` | also settable via `OPERATION_MODE` env var |
| host reachable | yes | `GET https://three.arcprize.org/api/environments` → 404 (wrong path, but DNS/TLS/HTTP work from CI) |
| environment discovery | `environments_dir` scanned for `metadata.json` | so `Arcade.make()` is for *published* environments |
| game base | `ARCBaseGame(game_id, levels, camera, debug, win_score, available_actions, seed)` | **it takes a `seed`** — DST-compatible |
| the loop | `perform_action(ActionInput)` | *"DO NOT OVERRIDE THIS METHOD, Your Game Logic should be in step()"* |
| actions | `RESET`, `ACTION1..7`; `ACTION6` carries `{x, y}` | the coordinate action the design doc's §2 non-embedding is about |

## Layout

- `zeta_arc/environments/chase.py` — **ZetaChase**, a Zeta-authored ARC
  environment: reach the goal, four moves, walls block, three levels that add
  structure rather than turning a difficulty dial. Deliberately the same
  *shape* as `chip8/games/mutual-sim.ts` so the perception ladder we already
  have can be pointed at it later without inventing a second agent.
- `zeta_arc/driver.py` — **the seam**. The only file that knows the engine's
  names. Calls the engine's public loop rather than reimplementing it (see
  below).
- `zeta_arc/play.py` — an episode and its score.
- `tests/test_chase.py` — nine falsifiers.

## The score, and what it is not

ARC's level formula (design doc §6) is `S = min(1.0, h/a)²` with `a` the
agent's action count and `h` a reference count. ARC uses the **second-best
human** for `h`. Offline there are no humans, so `h` here is the **BFS-optimal**
path length over the level's own geometry.

That substitution is stated rather than hidden. It makes this number an
efficiency-against-perfect-play, **strictly harsher than ARC's and not
comparable to a leaderboard figure.**

## Measured results

```
agent   seed  levels_cleared  environment_score
random     0               0  0.0
random     7               0  0.0
random    42               0  0.0
greedy     0               1  0.1667
greedy     7               1  0.1667
greedy    42               1  0.1667
```

The greedy agent plays level 0 **perfectly** (10 actions, optimal 10, score
1.0) and is then honestly defeated by level 1's wall, because it has no wall
model. A benchmark that could not separate it from a random walk would be a
decoration; this one does, and it does not flatter the agent it scores.

## One mistake worth keeping

The first driver reimplemented the engine's action loop by hand and deadlocked.
A level-clearing action sets `_next_level`, and

```python
def is_action_complete(self):
    return not self._next_level and self._action_complete
```

so a loop that only calls `step()` can never finish the action that **wins** a
level. `perform_action` — which the engine documents as *"DO NOT OVERRIDE"* —
already handles it. Calling their loop is both less code and the only correct
version. `tests/test_chase.py::test_reaching_the_goal_advances_the_level` is
the regression.

## Isolation (design doc §3.2)

Its own `uv` project, deliberately:

> A resolution failure in the ARC lane must not be able to break
> `uv sync --project src/Core.Python`, and separate projects is the only
> structural way to guarantee that.

So: never a dependency of `zeta-core`, never referenced by
`BOOTSTRAP_SURFACES`, and **no `gate (required)` job may depend on it.**

## Not done yet

- **The hosted leaderboard.** Needs `ARC_API_KEY`
  (`op://Lucent/ARCPrize API Key/credential`), which is not reachable from this
  container and is not in GitHub secrets. Everything above is the offline half
  and stays useful without it.
- **The real ARC environments.** `ft09` / `ls20` / `vc33` are ARC's, not ours;
  playing them is an ONLINE-mode job.
- **Pointing our own agent at it.** The perception ladder and the posterior
  sampling from the CHIP-8 arena are not wired here yet — that is the rung
  where the score starts saying something about Zeta rather than about a
  greedy baseline.
