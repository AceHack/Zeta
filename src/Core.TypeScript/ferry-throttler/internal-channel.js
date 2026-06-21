/**
 * internal-channel.ts — bounded async channel with synchronous tryRead.
 *
 * Extracted from ferry-throttler.ts as a shared module so that both the
 * single-queue FerryThrottler and the multi-lane PriorityFerryThrottler
 * can reuse the same backpressure-aware channel primitive.
 */
export function createInternalChannel(capacity) {
    const buffer = [];
    let closed = false;
    let readerWaiters = [];
    let writerWaiters = [];
    function drainWriters() {
        while (writerWaiters.length > 0 &&
            (capacity === undefined || buffer.length < capacity)) {
            const w = writerWaiters.shift();
            buffer.push(w.item);
            w.resolve();
        }
    }
    function notifyReaders() {
        while (readerWaiters.length > 0 && buffer.length > 0) {
            const r = readerWaiters.shift();
            r(true);
        }
    }
    return {
        get queueDepth() {
            return buffer.length + writerWaiters.length;
        },
        write(item, signal) {
            if (closed)
                return Promise.reject(new Error("Channel closed"));
            if (signal?.aborted)
                return Promise.reject(signal.reason);
            if (capacity === undefined || buffer.length < capacity) {
                buffer.push(item);
                notifyReaders();
                return Promise.resolve();
            }
            // Bounded and full — wait
            return new Promise((resolve, reject) => {
                const entry = { item, resolve, reject };
                writerWaiters.push(entry);
                if (signal) {
                    signal.addEventListener("abort", () => {
                        const idx = writerWaiters.indexOf(entry);
                        if (idx >= 0) {
                            writerWaiters.splice(idx, 1);
                            reject(signal.reason);
                        }
                    }, { once: true });
                }
            });
        },
        tryWrite(item) {
            if (closed)
                return false;
            if (capacity === undefined || buffer.length < capacity) {
                buffer.push(item);
                notifyReaders();
                return true;
            }
            return false;
        },
        tryRead() {
            if (buffer.length > 0) {
                const item = buffer.shift();
                drainWriters();
                return item;
            }
            if (writerWaiters.length > 0) {
                const w = writerWaiters.shift();
                w.resolve();
                return w.item;
            }
            return undefined;
        },
        waitToRead(signal) {
            if (signal.aborted)
                return Promise.reject(signal.reason);
            if (buffer.length > 0 || writerWaiters.length > 0)
                return Promise.resolve(true);
            if (closed)
                return Promise.resolve(false);
            return new Promise((resolve, reject) => {
                const handler = (hasData) => {
                    signal.removeEventListener("abort", onAbort);
                    resolve(hasData);
                };
                const onAbort = () => {
                    const idx = readerWaiters.indexOf(handler);
                    if (idx >= 0)
                        readerWaiters.splice(idx, 1);
                    reject(signal.reason);
                };
                readerWaiters.push(handler);
                signal.addEventListener("abort", onAbort, { once: true });
            });
        },
        complete() {
            closed = true;
            for (const r of readerWaiters)
                r(false);
            readerWaiters = [];
            for (const w of writerWaiters)
                w.reject(new Error("Channel closed"));
            writerWaiters = [];
        },
    };
}
