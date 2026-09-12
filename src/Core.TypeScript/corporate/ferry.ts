/**
 * corporate/ferry.ts — how many things the organization does at once, as a knob.
 *
 * MEASURED on agentic-tpm, 2026-09-12: one run took 2h04m to follow up three merge requests, and
 * every second of it was one thing at a time - session, review, review, verify, push, next request.
 * Nothing in the organization said it had to be: an agent exists per hat, and the assignment engine
 * is perfectly willing to bind the same hat for two pieces of work. The runtime simply awaited
 * everything in a row.
 *
 * ── WHY A KNOB AND NOT A REWRITE ─────────────────────────────────────────────
 * `.claude/rules/async-all-the-way-truthful-signatures.md`: run beautifully on one - deterministic,
 * replayable - and scale to N, same code path, no special cases. So this is a queue with a
 * degree-of-parallelism: at DoP=1 it is exactly the sequential loop it replaces, in the same order,
 * which is what keeps a run reproducible; at DoP=N, N ferries drain the same queue.
 *
 * RESULTS COME BACK IN INPUT ORDER whatever the DoP, so nothing downstream can tell the difference
 * except by wall clock. A task that throws is not caught here: the caller's own error handling is
 * what it was when the loop was sequential.
 */

/** One thing at a time - the organization as it ran before any of this was a knob. */
export const SEQUENTIAL = 1;

/**
 * Run `work` over `items` with at most `dop` in flight, results in INPUT ORDER.
 *
 * A dop below 1 is SEQUENTIAL, and a fractional one is rounded down, rather than either being an
 * error: this is a throughput knob, and a bad value must not stop an organization from working.
 */
export async function ferry<T, R>(items: readonly T[], dop: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const width = dop > 1 ? Math.floor(Math.min(dop, items.length)) : SEQUENTIAL;
  const out = new Array<R>(items.length);
  let next = 0;
  const oneFerry = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, width) }, oneFerry));
  return out;
}

/**
 * A gate only one thing may be inside at a time, however wide the ferry is.
 *
 * The organization's verification runs the repository's own test suite, and two of those on one
 * machine fight: agentic-tpm's suite starts a MongoMemoryServer, and `Port "…" already in use` is
 * already the most common red in its pipeline. So the sessions may overlap and the suites may not -
 * which is the whole reason parallelism here needs a critical section rather than a bigger number.
 */
export function oneAtATime(): <R>(work: () => Promise<R>) => Promise<R> {
  let queue: Promise<unknown> = Promise.resolve();
  return <R>(work: () => Promise<R>): Promise<R> => {
    // Each caller waits for the one before it, and failures do not poison the queue for the next.
    const mine = queue.then(work, work);
    queue = mine.then(
      () => undefined,
      () => undefined,
    );
    return mine;
  };
}
