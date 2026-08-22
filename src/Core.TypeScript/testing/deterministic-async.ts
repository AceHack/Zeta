// DETERMINISTIC ASYNC — the three primitives that replace `await sleep(n)` in a test.
//
// THE DEFECT THEY EXIST TO REMOVE. A test that writes `await sleep(10)` and then asserts
// is not asserting on the code; it is asserting that 10ms of wall-clock was enough on THIS
// machine at THIS moment. Under CI contention it is not, and the test goes red with nothing
// wrong. The measured instance: `poll-pr-gate-batch.test.ts` runs its 14 pure in-memory
// tests in 1366ms idle and 5.46s under load on the same machine class — a 4x spread on
// identical code, which is the whole finding. Six open PRs were red for it.
//
// In this repo's own vocabulary a real timer is an UNDECLARED AMBIENT TIME CHANNEL. It
// violates `.claude/rules/dv2-data-split-discipline-activated.md` #4 (DST — replays
// deterministically) and #7 (noninterference — influence enters only through declared,
// metered channels), and it is the test-suite form of
// `.claude/rules/local-time-never-enters-the-shared-fold.md`: local wall-clock may steer
// local behaviour, and must never decide a shared verdict. A test verdict is a shared
// verdict.
//
// THE THREE PRIMITIVES, in the order you should reach for them:
//
//   1. `deferred()`  — a barrier. The code under test SIGNALS; the test AWAITS the signal.
//      Zero timers. Use whenever you control the thing you are waiting for (a fake
//      processor, an injected handler, a stub transport). This is the right answer for
//      "give the ferry time to pick up work": the ferry tells you it picked up work.
//
//   2. `yieldTurns(n)` — n macrotask turns, each a ZERO-delay timer. The number of event
//      loop turns granted is fixed and independent of machine load, so this is
//      deterministic in the only unit that matters. Use to drain promise chains that need
//      a bounded, known number of turns.
//
//   3. `waitUntil(predicate)` — poll until true, with a deadline. THE DEADLINE IS AN UPPER
//      BOUND ON PATIENCE, NOT A SYNCHRONIZATION STEP. That inversion is the entire point:
//      a slow machine makes this wait longer and still pass, where `await sleep(n)` makes a
//      slow machine fail. Use only where the awaited event is genuine external I/O (a real
//      socket, a spawned process) and no barrier is reachable.
//
// WHAT NONE OF THEM DO: weaken an assertion. Each is strictly stronger than the sleep it
// replaces — a barrier cannot pass before the event, and `waitUntil` cannot pass before the
// predicate holds, whereas a sleep can do both by luck.
//
// ENFORCEMENT: `src/Core.TypeScript/hygiene/audit-ambient-time-in-tests.ts` fails on a new
// non-zero sleep in a test file. `waitUntil`'s internal timer is the one sanctioned
// exception and it lives HERE, in one reviewed place, rather than inline in 40 test files.

/** A promise plus its resolvers — the barrier primitive. Zero timers. */
export interface Deferred<T = void> {
  readonly promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Create a barrier. The code under test calls `resolve`; the test awaits `promise`.
 *
 * Replaces: `await sleep(10) // give the worker time to start`
 * With:     `await entered.promise // the worker says it started`
 */
export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A barrier that also counts: resolves once it has been signalled `n` times.
 * `signal()` is safe to call more than `n` times.
 *
 * Replaces: `await sleep(50) // let three messages land`
 */
export function counting(n: number): { readonly promise: Promise<void>; signal: () => void; readonly count: number } {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`counting(n): n must be a positive integer, got ${n}`);
  const d = deferred<void>();
  let count = 0;
  return {
    promise: d.promise,
    signal: () => {
      count += 1;
      if (count >= n) d.resolve();
    },
    get count() {
      return count;
    },
  };
}

/**
 * Yield `n` macrotask turns. Each turn is a ZERO-delay timer, so the number of turns is
 * fixed regardless of machine load — deterministic in turns, which is the unit that
 * decides whether queued work has run.
 *
 * A zero-delay timer is NOT the defect this module exists to remove: `setTimeout(r, 0)`
 * grants exactly one turn on a fast machine and exactly one turn on a loaded one. It is a
 * non-zero delay that encodes a guess about speed.
 */
export async function yieldTurns(n = 1): Promise<void> {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`yieldTurns(n): n must be a positive integer, got ${n}`);
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
  }
}

export interface WaitUntilOptions {
  /**
   * Upper bound on PATIENCE, not a synchronization delay. Exceeding it is a genuine
   * failure ("the event never happened"), never a scheduling artefact — so it should be
   * generous. Default 5s.
   */
  readonly timeoutMs?: number;
  /** Turns between polls. Default 1. Larger values only reduce CPU spent polling. */
  readonly pollTurns?: number;
  /** Included in the throw so a red test names what it was waiting for. */
  readonly describe?: string;
}

/**
 * Poll `predicate` until it holds, then return. Throws with `describe` if the deadline
 * passes first.
 *
 * WHY THIS IS STRICTLY STRONGER THAN A SLEEP. `await sleep(50); expect(x).toBe(1)` has two
 * failure modes: it can pass before the code was correct (the value happened to be right
 * for another reason) and it can fail after the code was correct (the machine was busy).
 * `await waitUntil(() => x === 1)` has neither: it returns at the first instant the
 * property holds, and a loaded machine only makes it wait longer.
 *
 * ONLY for genuine external I/O — a real socket, a spawned process, the file system. If
 * you control the thing you are waiting for, use `deferred()`: a barrier cannot poll-miss
 * a transient state, and this can.
 */
export async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  options: WaitUntilOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const pollTurns = options.pollTurns ?? 1;
  const what = options.describe ?? "condition";
  // `Date.now` here reads the deadline only. It never decides the verdict: the verdict is
  // `predicate()`. Crossing the deadline means the event did not happen, which is a real
  // failure on any machine, not a slow one.
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `waitUntil: ${what} did not become true within ${timeoutMs}ms. ` +
          `This is a real failure (the event never happened), not a timing artefact — ` +
          `raising the timeout will not fix it.`,
      );
    }
    await yieldTurns(pollTurns);
  }
}

/**
 * `waitUntil` for a value: poll `read` until it returns non-undefined, then return it.
 * Saves the read-twice dance at every call site.
 */
export async function waitForValue<T>(
  read: () => T | undefined,
  options: WaitUntilOptions = {},
): Promise<T> {
  let captured: T | undefined;
  await waitUntil(
    () => {
      captured = read();
      return captured !== undefined;
    },
    options,
  );
  return captured as T;
}
