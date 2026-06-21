import { forgeError } from "../result";
export function classifyGhError(status, stderr) {
    const lower = stderr.toLowerCase();
    if (lower.includes("401") || lower.includes("authentication") || lower.includes("auth token") || lower.includes("not logged in")) {
        return forgeError("auth-failure", stderr);
    }
    if (lower.includes("403") || lower.includes("permission") || lower.includes("forbidden") || lower.includes("resource not accessible")) {
        return forgeError("permission-denied", stderr);
    }
    if (lower.includes("404") || lower.includes("not found") || lower.includes("could not resolve")) {
        return forgeError("not-found", stderr);
    }
    if (lower.includes("rate limit") || lower.includes("429") || lower.includes("secondary rate") || lower.includes("api rate")) {
        return forgeError("rate-limited", stderr);
    }
    if (lower.includes("timeout") || lower.includes("connection") || lower.includes("network") || lower.includes("tls") || lower.includes("dns")) {
        return forgeError("network", stderr);
    }
    if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("internal server error") || lower.includes("bad gateway") || lower.includes("service unavailable") || lower.includes("gateway timeout")) {
        return forgeError("network", stderr);
    }
    return forgeError("internal", `gh exit ${String(status ?? "null")}: ${stderr}`);
}
