/**
 * internal-channel.ts — bounded async channel with synchronous tryRead.
 *
 * Extracted from ferry-throttler.ts as a shared module so that both the
 * single-queue FerryThrottler and the multi-lane PriorityFerryThrottler
 * can reuse the same backpressure-aware channel primitive.
 */

// ─── InternalChannel ────────────────────────────────────────────────────────

/**
 * Internal channel with synchronous `tryRead` for the ferry drain loop.
 */
export interface InternalChannel<T> {
  write(item: T, signal?: AbortSignal): Promise<void>;
  tryWrite(item: T): boolean;
  tryRead(): T | undefined;
  waitToRead(signal: AbortSignal): Promise<boolean>;
  complete(): void;
  /** Total number of items waiting: buffered + blocked in writers. */
  readonly queueDepth: number;
}

export function createInternalChannel<T>(capacity?: number): InternalChannel<T> {
  const buffer: T[] = [];
  let closed = false;

  let readerWaiters: Array<(hasData: boolean) => void> = [];
  let writerWaiters: Array<{
    item: T;
    resolve: () => void;
    reject: (err: unknown) => void;
  }> = [];

  function drainWriters(): void {
    while (
      writerWaiters.length > 0 &&
      (capacity === undefined || buffer.length < capacity)
    ) {
      const w = writerWaiters.shift()!;
      buffer.push(w.item);
      w.resolve();
    }
  }

  function notifyReaders(): void {
    while (readerWaiters.length > 0 && buffer.length > 0) {
      const r = readerWaiters.shift()!;
      r(true);
    }
  }

  return {
    get queueDepth(): number {
      return buffer.length + writerWaiters.length;
    },

    write(item: T, signal?: AbortSignal): Promise<void> {
      if (closed) return Promise.reject(new Error("Channel closed"));
      if (signal?.aborted) return Promise.reject(signal.reason);

      if (capacity === undefined || buffer.length < capacity) {
        buffer.push(item);
        notifyReaders();
        return Promise.resolve();
      }

      // Bounded and full — wait
      return new Promise<void>((resolve, reject) => {
        const entry = { item, resolve, reject };
        writerWaiters.push(entry);
        if (signal) {
          signal.addEventListener(
            "abort",
            () => {
              const idx = writerWaiters.indexOf(entry);
              if (idx >= 0) {
                writerWaiters.splice(idx, 1);
                reject(signal.reason);
              }
            },
            { once: true },
          );
        }
      });
    },

    tryWrite(item: T): boolean {
      if (closed) return false;
      if (capacity === undefined || buffer.length < capacity) {
        buffer.push(item);
        notifyReaders();
        return true;
      }
      return false;
    },

    tryRead(): T | undefined {
      if (buffer.length > 0) {
        const item = buffer.shift()!;
        drainWriters();
        return item;
      }
      if (writerWaiters.length > 0) {
        const w = writerWaiters.shift()!;
        w.resolve();
        return w.item;
      }
      return undefined;
    },

    waitToRead(signal: AbortSignal): Promise<boolean> {
      if (signal.aborted) return Promise.reject(signal.reason);
      if (buffer.length > 0 || writerWaiters.length > 0) return Promise.resolve(true);
      if (closed) return Promise.resolve(false);

      return new Promise<boolean>((resolve, reject) => {
        const handler = (hasData: boolean): void => {
          signal.removeEventListener("abort", onAbort);
          resolve(hasData);
        };
        const onAbort = (): void => {
          const idx = readerWaiters.indexOf(handler);
          if (idx >= 0) readerWaiters.splice(idx, 1);
          reject(signal.reason);
        };
        readerWaiters.push(handler);
        signal.addEventListener("abort", onAbort, { once: true });
      });
    },

    complete(): void {
      closed = true;
      for (const r of readerWaiters) r(false);
      readerWaiters = [];
      for (const w of writerWaiters) w.reject(new Error("Channel closed"));
      writerWaiters = [];
    },
  };
}
