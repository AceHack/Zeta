import {} from "./types";
import {} from "../bonsai/bonsai";
const ALLOWED_FUNCTIONS = new Set([
    "filter",
    "map",
    "get_field",
    "get_zset_field",
    "add",
    "sub",
    "mul",
    "eq",
    "lt",
    "and",
    "or"
]);
const ALLOWED_CODECS = new Set([
    "json",
    "yaml",
    "markdown-frontmatter",
    "npm",
    "cargo"
]);
const MAX_EXPR_DEPTH = 128;
function checkQueryExpression(expr, depth) {
    if (depth > MAX_EXPR_DEPTH) {
        throw new Error(`Expression nesting depth exceeds limit of ${MAX_EXPR_DEPTH}`);
    }
    switch (expr.kind) {
        case "const":
        case "param":
            return;
        case "cond":
            checkQueryExpression(expr.test, depth + 1);
            checkQueryExpression(expr.then, depth + 1);
            checkQueryExpression(expr.else, depth + 1);
            return;
        case "binary":
            checkQueryExpression(expr.left, depth + 1);
            checkQueryExpression(expr.right, depth + 1);
            return;
        case "lambda":
            checkQueryExpression(expr.body, depth + 1);
            return;
        case "call":
            if (!ALLOWED_FUNCTIONS.has(expr.fn)) {
                throw new Error(`Forbidden function call: ${expr.fn} (violates determinism contract)`);
            }
            for (const arg of expr.args) {
                checkQueryExpression(arg, depth + 1);
            }
            return;
    }
}
/**
 * Validates a plugin against the data-plane determinism contract.
 */
export function validatePlugin(plugin) {
    if (!ALLOWED_CODECS.has(plugin.parserRef)) {
        return { ok: false, reason: `Forbidden parser reference: ${plugin.parserRef}` };
    }
    if (!ALLOWED_CODECS.has(plugin.serializerRef)) {
        return { ok: false, reason: `Forbidden serializer reference: ${plugin.serializerRef}` };
    }
    for (const view of plugin.views) {
        try {
            checkQueryExpression(view.query, 0);
        }
        catch (e) {
            return {
                ok: false,
                reason: `View '${view.name}' violates determinism contract: ${e.message}`
            };
        }
    }
    return { ok: true };
}
