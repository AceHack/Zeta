// full-ai-cluster/platform-controller/src/signals.ts
//
// Trigger detection — the "detect" step of the operating loop (COLLABORATION-
// MODEL.md §6). Kubernetes object conditions are SIGNALS, and per HC-3 a signal
// is DATA, not a directive: we classify it into a candidate Action (domain +
// maybe a gated class), but the Policy still decides whether the persona may act.
// This is a deterministic reflex baseline; richer personas extend it. No I/O.
/** Classify a Pod's current condition into a Signal (or healthy). */
export function podSignal(pod) {
    const cs = pod.status?.containerStatuses ?? [];
    for (const c of cs) {
        const w = c.state?.waiting;
        const lastTerm = c.lastState?.terminated;
        if (lastTerm?.reason === "OOMKilled" || c.state?.terminated?.reason === "OOMKilled") {
            return { kind: "oom", detail: `OOMKilled (restarts=${c.restartCount ?? 0})` };
        }
        if (w?.reason === "CrashLoopBackOff")
            return { kind: "crashloop", detail: w.message ?? `CrashLoopBackOff (restarts=${c.restartCount ?? 0})` };
        if (w?.reason === "ImagePullBackOff" || w?.reason === "ErrImagePull")
            return { kind: "image-pull-error", detail: w.message ?? w.reason };
    }
    const ready = pod.status?.conditions?.find((c) => c.type === "Ready");
    if (ready && ready.status !== "True")
        return { kind: "unready", detail: ready.reason ?? "not ready" };
    return { kind: "healthy", detail: pod.status?.phase ?? "Running" };
}
/** Is a PVC stuck Pending (commonly: no provisioner / capacity)? */
export function pvcSignal(pvc) {
    if (pvc.status?.phase === "Pending")
        return { kind: "pvc-pending", detail: "PVC Pending — storage not bound" };
    return undefined;
}
// ── signal → proposed remediation ─────────────────────────────────────
/**
 * Map a signal to the Action a persona would propose. `withinQuota` is the
 * tenant-quota check the persona performs first: a memory bump that stays in
 * quota is plain `scaling` (auto under the default Policy); one that exceeds it
 * is `scaling` + gated:budget (→ propose, needs a human grant). Same fix, the
 * gating flips on whether it costs more — exactly the no-directives line.
 */
export function remediate(signal, opts) {
    const withinQuota = opts?.withinQuota ?? true;
    switch (signal.kind) {
        case "oom": {
            const gated = withinQuota ? undefined : "budget";
            return {
                signal,
                action: { domain: "scaling", summary: "increase memory limit + restart", ...(gated ? { gated } : {}) },
                plan: withinQuota ? "OOM: bump memory one tier and restart (within quota)." : "OOM: needs more memory than the quota allows — requesting a budget increase.",
            };
        }
        case "crashloop":
            return { signal, action: { domain: "lifecycle", summary: "inspect logs + restart" }, plan: "CrashLoop: pull recent logs, restart, and watch for recurrence." };
        case "unready":
            return { signal, action: { domain: "lifecycle", summary: "restart to clear unready state" }, plan: "Unready: restart the workload and re-check readiness." };
        case "pvc-pending":
            return { signal, action: { domain: "config", summary: "verify storageClass + provisioner" }, plan: "PVC Pending: confirm the longhorn StorageClass is default and the provisioner is healthy." };
        case "image-pull-error":
            // An image/registry fix usually means a config change the tenant must confirm.
            return { signal, action: { domain: "config", summary: "correct image ref / pull secret", gated: "external-repo" }, plan: "ImagePull error: the image or pull secret is wrong — proposing a corrected reference for approval." };
        case "healthy":
            return undefined; // nothing to do
    }
}
