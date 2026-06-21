// full-ai-cluster/portal/src/memory-usage.ts
//
// The byte size of a Room's durable log == the size of its JSONL on disk (one
// JSON line per Event). Computed the same way for the in-memory and file stores
// so the Memory view reports a consistent number (the persistent agent-memory
// footprint, #5).
export function roomBytes(room) {
    let n = 0;
    for (const e of room.events)
        n += JSON.stringify(e).length + 1; // +1 for the newline
    return n;
}
