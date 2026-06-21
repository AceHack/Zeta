// full-ai-cluster/portal/src/room-agent.ts
//
// The Room agent — the persona you chat with INSIDE a resource's Room. It is
// structurally SANDBOXED to that one resource: respond() receives only the
// resource it was invoked for plus that resource's own context, and returns
// intents the caller executes against THAT resource's ops alone. It has no
// reference to, and cannot name, any other resource (no list/registry access).
//
// Authority is no-directives: every operation is classified into a domain (+
// maybe a gated class) and run through decide(). `auto` acts on standing
// authority; `propose` emits an authorization-request a human must grant;
// `forbidden` is refused in words (the human uses the Danger zone). This is a
// deterministic responder for the demo; a real LLM persona slots in behind the
// same respond() contract — still resource-scoped, still Policy-gated.
/** The default Policy (mirrors k8s/applications/platform/policy-default.yaml). */
export const DEFAULT_POLICY = {
    domains: [
        { name: "lifecycle", autonomy: "auto" },
        { name: "scaling", autonomy: "auto" },
        { name: "config", autonomy: "auto" },
        { name: "mods", autonomy: "propose" },
        { name: "spend", autonomy: "propose" },
        { name: "data", autonomy: "forbidden" },
        { name: "security", autonomy: "forbidden" },
    ],
    gatedClasses: ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"],
};
const HARD_FLOOR = new Set(["wont-do", "hard-limits"]);
/** no-directives decision: a gated class always escalates above auto. */
export function decide(policy, a) {
    const dom = policy.domains.find((d) => d.name === a.domain);
    if (!dom)
        return { level: "forbidden", reason: `unknown domain "${a.domain}"` };
    if (dom.autonomy === "forbidden")
        return { level: "forbidden", reason: `${a.domain} is human-only` };
    if (a.gated) {
        if (HARD_FLOOR.has(a.gated))
            return { level: "forbidden", reason: `${a.gated} is a hard floor` };
        return { level: "propose", reason: `${a.gated} needs a human grant`, gated: a.gated };
    }
    return dom.autonomy === "auto" ? { level: "auto", reason: "standing authority" } : { level: "propose", reason: `${a.domain} needs a proposal` };
}
const nextMem = (m) => {
    const n = parseInt(m, 10) || 4;
    return `${n + 2}Gi`;
};
/**
 * Interpret a human's chat message about ONE resource and respond. Pure: the
 * only resource it knows is `resource`; every op it returns targets that
 * resource. Returns a reply and (optionally) one Policy-classified operation.
 */
export function respond(resource, text, ctx) {
    const t = text.toLowerCase().trim();
    const name = resource.split("/")[1] ?? resource;
    // read-only intents
    if (/\b(status|health|how('?s| is) it|what('?s| is) (going on|wrong)|state)\b/.test(t))
        return { reply: `${name} is ${ctx.phase}, ${ctx.replicas} replica(s), memory limit ${ctx.memory}. Ask me to restart, scale, give it more memory, or change config — I can only act on this resource.` };
    if (/\b(help|what can you|commands?)\b/.test(t))
        return { reply: `I operate ${name} within its Policy and only this resource. Try: "restart it", "scale to 3", "give it more memory", ${ctx.game ? `"change the map to gm_construct", ` : ""}"stop it". Deleting data is human-only — use the Danger zone.` };
    // ── observability: analyze logs / traces (the log/trace connector) ──
    if (/\b(analyze|analyse|investigate|diagnose|look at|read|check)\b.*\b(log|logs|error|errors|trace|traces|crash|failure|why)\b|\bwhy.*(fail|crash|error|down|slow|restart)|what('?s| is) wrong\b/.test(t)) {
        const errs = ctx.recentErrors ?? [];
        const slow = (ctx.slowTraces ?? []).filter((s) => s.status === "error" || s.ms > 1000);
        if (errs.length === 0 && slow.length === 0)
            return { reply: `I pulled ${name}'s recent logs and traces — nothing abnormal: no errors in the log tail and no failing or slow spans. It looks healthy from the telemetry.` };
        const oom = errs.find((e) => /OOM|out of memory|memory limit/i.test(e));
        const lines = [`I read ${name}'s recent logs${slow.length ? " and traces" : ""}. Here's what stands out:`];
        if (oom)
            lines.push(`• ${oom.trim()} — the container is hitting its ${ctx.memory} memory ceiling. The fix is more memory; say "give it more memory" and I'll raise it (it's budget-gated, so you'll approve the spend).`);
        else if (errs[0])
            lines.push(`• ${errs[0].trim()}`);
        for (const s of slow.slice(0, 2))
            lines.push(`• trace "${s.name}" took ${s.ms}ms${s.status === "error" ? " and errored" : ""} — worth a look.`);
        return { reply: lines.join("\n") };
    }
    // delete / destroy — forbidden (data), refused in words
    if (/\b(delete|destroy|wipe|remove|nuke)\b/.test(t))
        return { reply: `I can't do that — deleting ${name} or its data is a gated, non-reversible action and is human-only. Use the Danger zone in this console; I won't perform it.` };
    // restart
    if (/\b(restart|reboot|bounce|recreate)\b/.test(t))
        return { reply: `Restarting ${name} now — this clears the crash loop with fresh pods.`, op: { kind: "restart", action: { domain: "lifecycle", summary: `restart ${name}` } } };
    // stop
    if (/\b(stop|shutdown|shut down|pause|turn off)\b/.test(t))
        return { reply: `Stopping ${name} (scaling to 0). Storage is preserved; say "start it" to bring it back.`, op: { kind: "stop", action: { domain: "lifecycle", summary: `stop ${name}` } } };
    // scale
    const scaleM = t.match(/\b(?:scale|set replicas|run)\s*(?:to|=)?\s*(\d+)\b|\b(\d+)\s*replicas?\b/);
    if (scaleM) {
        const n = Number(scaleM[1] ?? scaleM[2]);
        return { reply: `Scaling ${name} to ${n} replica(s).`, op: { kind: "scale", replicas: n, action: { domain: "scaling", summary: `scale ${name} to ${n}` } } };
    }
    // memory bump / fix OOM — treated as exceeding quota → budget-gated (propose)
    if (/\b(more memory|bump (the )?memory|increase memory|out of memory|oom|memory|fix( the)? crash|stop crashing|crashloop)\b/.test(t)) {
        const target = nextMem(ctx.memory);
        return {
            reply: `${name} is hitting its memory limit (${ctx.memory}). Bumping to ${target} would exceed this tenant's quota, so I need your approval before I spend more — I've posted a request below.`,
            op: { kind: "config", patch: { memory: target }, action: { domain: "scaling", gated: "budget", summary: `raise ${name} memory ${ctx.memory}→${target} (exceeds quota)` } },
        };
    }
    // map change (game) — a mod/content change → propose
    const mapM = t.match(/\b(?:change|set|switch)?\s*(?:the\s*)?map\s*(?:to|=)?\s*([a-z0-9_]+)\b/);
    if (mapM && ctx.game)
        return { reply: `Changing the map to ${mapM[1]} touches tenant content, so I've proposed it for your approval below.`, op: { kind: "config", patch: { values: { MAP: mapM[1] } }, action: { domain: "mods", summary: `set map to ${mapM[1]}` } } };
    // maxplayers (game)
    const mpM = t.match(/\b(?:max\s*players?|maxplayers|player\s*limit)\s*(?:to|=)?\s*(\d+)\b/);
    if (mpM && ctx.game)
        return { reply: `Setting max players to ${mpM[1]} — proposed for approval (it changes server content).`, op: { kind: "config", patch: { values: { MAXPLAYERS: mpM[1] } }, action: { domain: "mods", summary: `set maxplayers to ${mpM[1]}` } } };
    return { reply: `I can operate ${name} for you — restart, scale, adjust memory or config${ctx.game ? ", change the map" : ""}, or stop it. I only have access to this resource. What would you like?` };
}
