/**
 * forge-host/result.ts — Result helpers for the ForgeHost abstraction.
 *
 * Constructors for the Result<T, ForgeError> pattern. These are the only way
 * to create Result values — keeping construction uniform and type-safe.
 */
/** Construct a successful Result. */
export function ok(value) {
    return { ok: true, value };
}
/** Construct a failed Result. */
export function err(error) {
    return { ok: false, error };
}
/** Construct a ForgeError value with consistent retryable classification. */
export function forgeError(kind, message, raw) {
    return { kind, message, retryable: isRetryable(kind), raw };
}
/**
 * Retryable classification per R1 acceptance criterion 6:
 * - rate-limited, network → retryable
 * - auth-failure, not-supported, permission-denied → not retryable
 * - not-found, parse-failure, internal → not retryable
 */
function isRetryable(kind) {
    switch (kind) {
        case "rate-limited":
        case "network":
            return true;
        case "auth-failure":
        case "not-supported":
        case "permission-denied":
        case "not-found":
        case "parse-failure":
        case "internal":
            return false;
    }
}
