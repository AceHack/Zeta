/**
 * B-0831 slice 2 — ClusterNode registration YAML shape checks.
 * Mirrors zeta-install.sh Step 6.9 / B-0813 schema fields.
 */
export function validateClusterNodeYaml(yaml) {
    const errors = [];
    if (!yaml.includes("apiVersion: zeta.lucent-financial-group.com/v1")) {
        errors.push("missing apiVersion");
    }
    if (!yaml.includes("kind: ClusterNode")) {
        errors.push("missing kind ClusterNode");
    }
    if (!yaml.includes("spec:")) {
        errors.push("missing spec");
    }
    if (!yaml.includes("registration:")) {
        errors.push("missing spec.registration");
    }
    if (!yaml.includes("registered-via: \"iter-5.4.1\"")) {
        errors.push("missing registered-via iter-5.4.1");
    }
    if (!yaml.includes("roles:")) {
        errors.push("missing spec.roles array");
    }
    return { ok: errors.length === 0, errors };
}
