/**
 * In-memory delta log — the reference implementation + the test substrate.
 */
export class InMemoryDeltaLog {
    entries = [];
    nextSeq = 0;
    async append(delta, captured) {
        this.nextSeq += 1;
        this.entries.push({ seq: this.nextSeq, delta, captured });
        return this.nextSeq;
    }
    async replay(fromSeqExclusive) {
        return this.entries.filter((e) => e.seq > fromSeqExclusive);
    }
    highWater() {
        return this.nextSeq;
    }
    async truncate(throughSeqInclusive) {
        const idx = this.entries.findIndex((e) => e.seq > throughSeqInclusive);
        if (idx === -1) {
            this.entries.length = 0;
        }
        else if (idx > 0) {
            this.entries.splice(0, idx);
        }
    }
}
