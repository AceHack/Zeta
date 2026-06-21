# Merge1 §08 — Identity/Isolation Stack → Agentic-Org Migration

**Scope:** Port the identity, isolation, and credential stack from `full-ai-cluster/` into the agentic-organization TypeScript codebase. SPIRE/SPIFFE becomes `AgentIdentity`, Cilium L7 policy becomes room egress filtering, Vault dynamic secrets become the real `CredentialProxyPort`, and the boot-time credential restore becomes room credential bootstrap.

**Outside sources:**

- `full-ai-cluster/k8s/applications/spire/Application.yaml` — SPIRE workload identity, SVIDs, chains to Vault
- `full-ai-cluster/k8s/applications/cilium/Application.yaml` — Cilium L7 service mesh, mTLS, Hubble
- `full-ai-cluster/k8s/applications/vault/Application.yaml` — Vault secrets engine
- `full-ai-cluster/k8s/applications/external-secrets/Application.yaml` — ESO (Vault → K8s Secret sync)
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix` — boot-time credential restore (scrypt + HKDF + AES-256-GCM)
- `full-ai-cluster/INJECTION-POINTS.md` — credential injection catalog (public identifier vs secret material)
- `full-ai-cluster/k8s/applications/cert-manager/Application.yaml` — cert-manager
- `full-ai-cluster/k8s/applications/trust-manager/Application.yaml` — trust-manager

**Agentic-org files touched:**

- `packages/application/src/room.ts` — Room with AgentIdentity, SandboxSpec, CredentialProxyPort, mockCredentialProxy
- `packages/application/src/sandbox-tool.ts` — SandboxToolPort
- `packages/application/src/control-plane-guard.ts`
- `packages/application/src/ports.ts`
- `packages/application/src/change-control-port.ts`
- `docs/ROOMS_AS_DETERMINISTIC_SIMULATIONS.md` — §8 (bwrap + credential proxy + OAuth)
- NEW: `packages/application/src/spiffe-identity.ts`
- NEW: `packages/application/src/vault-credential-proxy.ts`
- NEW: `packages/application/src/bwrap-sandbox.ts`
- NEW: `packages/application/src/credential-bootstrap.ts`

**Governing doctrine:** §10 (MP-2 Seam Injectability, MP-3 ZetaId Addressability, MP-4 Retraction-Native, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| Component | File:Line | What it does |
|---|---|---|
| SPIRE Server | `spire/Application.yaml:33` | Issues short-lived SVIDs; chains to Vault as upstream CA; trust domain `zeta.local` |
| SPIRE Agent | `spire/Application.yaml:51` | Workload attestors: k8s + unix; attaches SVIDs to workloads via containerd socket |
| SPIFFE CSI Driver | `spire/Application.yaml:59` | Mounts SPIFFE workload API into pods |
| Cilium CNI | `cilium/Application.yaml:24` | kubeProxyReplacement, BPF MASQUERADE, native routing |
| Cilium Service Mesh | `cilium/Application.yaml` | L7 mTLS, traffic shifting, observability — replaces Istio |
| Hubble | `cilium/Application.yaml:43` | Flow observability (dns, drop, tcp, flow, icmp, http metrics) |
| Vault | `vault/Application.yaml` | Secrets engine; PKI mount for SPIRE upstream CA |
| External Secrets Operator | `external-secrets/Application.yaml` | Syncs Vault secrets → K8s Secrets |
| cert-manager | `cert-manager/Application.yaml` | X.509 certificate lifecycle |
| trust-manager | `trust-manager/Application.yaml` | Distributes CA bundles to workloads |
| zeta-creds-restore | `zeta-creds-restore.nix:1` | Boot-time credential restore from ESP; scrypt + HKDF + AES-256-GCM; passphrase modes: file + interactive |
| INJECTION-POINTS | `INJECTION-POINTS.md:1` | Canonical catalog: public identifier (SSH pubkey, hostname) vs secret material (passwords, WiFi, GPG, age, K8s tokens) |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs full-ai-cluster |
|---|---|---|---|
| `AgentIdentity` | `room.ts:67` | `{ agentId, subject }` | No SPIFFE ID; no SVID; no trust domain |
| `SandboxSpec` | `room.ts:79` | `{ engine: "bwrap"\|"subprocess"\|"none", workspaceMount, allowedEgress, revokeOnExpiry }` | No Cilium L7 policy integration; no mTLS |
| `CredentialProxyPort` | `room.ts:102` | `{ grantsFor(identity, hatIds) → ToolGrant[] }` | No Vault dynamic secrets; mock only |
| `mockCredentialProxy` | `room.ts:150` | Deterministic mock: one tool per hat | No real adapter |
| `SandboxToolPort` | `sandbox-tool.ts` | Sandbox tool port | No bwrap implementation |
| `createDeterministicRoom` | `room.ts:165` | All-mock room factory | No `createRealRoom` with live adapters |

---

## 3. Migration Plan

### 3.1 SPIFFE identity → AgentIdentity

**Create:** `packages/application/src/spiffe-identity.ts`

Port SPIRE/SPIFFE workload identity as the real `AgentIdentity` implementation.

```typescript
// packages/application/src/spiffe-identity.ts

/** SPIFFE workload identity — port of full-ai-cluster/k8s/applications/spire/.
 * SPIRE issues short-lived SVIDs to every workload so pod-to-pod auth
 * doesn't depend on long-lived K8s ServiceAccount tokens. */
export interface SpiffeIdentity {
  /** SPIFFE ID: spiffe://<trust-domain>/<path> */
  readonly spiffeId: string;
  /** Trust domain (e.g., "zeta.local") */
  readonly trustDomain: string;
  /** Short-lived SVID (X.509 or JWT) */
  readonly svid: SpiffeSvid;
  /** Expiry time of the SVID */
  readonly expiresAt: string;
}

export type SpiffeSvid =
  | { readonly type: "x509"; readonly certChain: string; readonly privateKey: string }
  | { readonly type: "jwt"; readonly token: string };

/** Create an AgentIdentity from a SPIFFE identity.
 * The room runs as this identity; the credential proxy binds tool grants to it. */
export function agentIdentityFromSpiffe(spiffe: SpiffeIdentity): AgentIdentity {
  return {
    agentId: spiffe.spiffeId.split("/").pop() ?? "unknown",
    subject: spiffe.spiffeId,
    zetaId: {
      category: "observation",
      authority: "trusted_agent",
      persona: "firefly_coherence",
    },
  };
}

/** Real SPIFFE identity provider — fetches SVID from SPIRE workload API.
 * Mock = deterministic SVID from seed (DST). */
export interface SpiffeIdentityProvider {
  fetchIdentity(workloadId: string): Promise<Result<SpiffeIdentity, SpiffeError>>;
}

export type SpiffeError =
  | { readonly kind: "workload_not_found"; readonly workloadId: string }
  | { readonly kind: "svid_expired" }
  | { readonly kind: "trust_domain_mismatch"; readonly expected: string; readonly actual: string };
```

**Upgrade `room.ts`:** `AgentIdentity` gains optional SPIFFE fields:

```typescript
export type AgentIdentity = {
  agentId: string;
  subject: string;
  zetaId?: { category: ZetaCategory; authority: ZetaAuthority; persona: ZetaPersona };
  /** NEW: SPIFFE identity (when running in the real cluster). */
  spiffe?: SpiffeIdentity;
};
```

### 3.2 Cilium L7 policy → room egress filtering

**Upgrade `room.ts`:** `SandboxSpec.allowedEgress` becomes a structured Cilium L7 policy.

```typescript
// room.ts — AFTER upgrade
export type EgressPolicy = {
  /** Allowed hosts (L3/L4). */
  readonly hosts: readonly string[];
  /** Allowed HTTP methods per host (L7). Empty = all methods. */
  readonly httpRules?: readonly { host: string; methods: readonly string[]; paths: readonly string[] }[];
  /** Require mTLS (Cilium service mesh). */
  readonly requireMtls: boolean;
  /** Allowed service accounts (SPIFFE-based). */
  readonly allowedServiceAccounts?: readonly string[];
};

export type SandboxSpec = {
  engine: "bwrap" | "subprocess" | "none";
  workspaceMount: string;
  /** UPGRADE: structured egress policy (was flat string[]). */
  egress: EgressPolicy;
  revokeOnExpiry: boolean;
  /** Back-compat: flat allowedEgress derived from egress.hosts. */
  allowedEgress: readonly string[];
};
```

### 3.3 Vault dynamic secrets → real CredentialProxyPort

**Create:** `packages/application/src/vault-credential-proxy.ts`

Port Vault dynamic secrets as the real `CredentialProxyPort` implementation.

```typescript
// packages/application/src/vault-credential-proxy.ts

/** Real credential proxy backed by Vault dynamic secrets.
 * Port of full-ai-cluster/k8s/applications/vault/.
 *
 * Given the room's authenticated identity (SPIFFE SVID) and the hats it
 * wears, returns the tool grants the agent may use. Each grant is a
 * Vault-issued dynamic secret with a short TTL.
 *
 * The agent never names a tool or holds a raw secret — observe.ts invokes
 * this proxy to turn a chosen slot into a scoped, allowed tool grant. */
export function createVaultCredentialProxy(
  vaultAddr: string,
  deps: { fetchSvid: () => Promise<SpiffeSvid>; requestSecret: (path: string, params: Record<string, string>) => Promise<Result<VaultSecret, VaultError>> },
): CredentialProxyPort {
  return {
    grantsFor: async (identity, hatIds) => {
      const grants: ToolGrant[] = [];
      for (const hatId of hatIds) {
        const path = `zeta/hats/${hatId}/tool-grant`;
        const result = await deps.requestSecret(path, { spiffe_id: identity.subject });
        if (result.outcome === "ok") {
          grants.push({
            tool: `tool:${hatId}`,
            credentialScope: `vault:${path}`,
          });
        }
      }
      return grants;
    },
  };
}

export type VaultSecret = {
  readonly leaseId: string;
  readonly leaseDurationSeconds: number;
  readonly data: Record<string, string>;
};

export type VaultError =
  | { readonly kind: "permission_denied"; readonly path: string }
  | { readonly kind: "secret_not_found"; readonly path: string }
  | { readonly kind: "lease_expired"; readonly leaseId: string };
```

### 3.4 bwrap sandbox → real SandboxSpec.engine

**Create:** `packages/application/src/bwrap-sandbox.ts`

Port bwrap (bubblewrap) as the production sandbox engine.

```typescript
// packages/application/src/bwrap-sandbox.ts

/** bwrap (bubblewrap) sandbox — port of the production sandbox engine.
 * Process-level defence-in-depth inside the k3s/Cilium/SPIRE/OPA stack.
 *
 * The sandbox creates a restricted process namespace:
 *   - Read-only root filesystem (except workspace mount)
 *   - No network access (except allowed egress via Cilium)
 *   - No access to host devices, IPC, or kernel modules
 *   - Hard kill when the hat token expires or is revoked */
export interface BwrapSandbox {
  spawn(command: readonly string[], opts: BwrapSpawnOptions): Promise<Result<SandboxProcess, SandboxError>>;
}

export type BwrapSpawnOptions = {
  readonly workspaceMount: string;
  readonly egress: EgressPolicy;
  readonly env: Record<string, string>;
  readonly revokeOnExpiry: boolean;
};

export type SandboxProcess = {
  readonly pid: number;
  readonly wait: () => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readonly kill: () => Promise<void>;
};

export type SandboxError =
  | { readonly kind: "bwrap_not_found" }
  | { readonly kind: "mount_failed"; readonly path: string }
  | { readonly kind: "spawn_failed"; readonly reason: string };

/** Real bwrap sandbox — spawns a restricted process. */
export function createBwrapSandbox(): BwrapSandbox {
  // Full implementation: shell to bwrap with --ro-bind, --dev, --proc,
  // --unshare-all, --die-with-parent, etc.
}

/** Mock sandbox — in-process execution (DST). */
export function createMockSandbox(): BwrapSandbox {
  return {
    spawn: async (command, opts) => ({
      outcome: "ok",
      value: {
        pid: 1,
        wait: async () => ({ exitCode: 0, stdout: "mock output", stderr: "" }),
        kill: async () => {},
      },
    }),
  };
}
```

### 3.5 Credential bootstrap → room credential restore

**Create:** `packages/application/src/credential-bootstrap.ts`

Port the boot-time credential restore (scrypt + HKDF + AES-256-GCM) as room credential bootstrap.

```typescript
// packages/application/src/credential-bootstrap.ts

/** Port of full-ai-cluster/nixos/modules/zeta-creds-restore.nix.
 * Boot-time credential restore from encrypted blob.
 *
 * The encrypted blob is produced at install time and stored on the ESP.
 * At boot, the operator enters a passphrase; the blob is decrypted via
 * scrypt (KDF) + HKDF (key expansion) + AES-256-GCM (decryption).
 * Per-cred paths are populated before user-facing services start. */
export interface CredentialBootstrap {
  restore(blob: Uint8Array, passphrase: string): Promise<Result<readonly RestoredCredential[], BootstrapError>>;
}

export type RestoredCredential = {
  readonly name: string;
  readonly path: string;
  readonly contentClass: "public_identifier" | "secret_material";
  readonly value: string;
};

export type BootstrapError =
  | { readonly kind: "decryption_failed"; readonly reason: string }
  | { readonly kind: "passphrase_required" }
  | { readonly kind: "blob_not_found"; readonly path: string };

/** Real credential bootstrap — scrypt + HKDF + AES-256-GCM.
 *
 * SECURITY requirements (must be enforced in implementation):
 *   - scrypt parameters: N=2^20, r=8, p=1 (per source zeta-creds-restore.nix)
 *   - Salt: random 16+ bytes, stored alongside blob (NOT hardcoded)
 *   - Passphrase: reject empty string; minimum 8 chars recommended
 *   - Passphrase comparison: timing-safe (crypto.timingSafeEqual) if verified
 *   - Memory hygiene: zero passphrase buffer from memory after key derivation
 *     (overwrite Uint8Array with zeros; cannot guarantee for JS strings but
 *     should use Uint8Array for passphrase input where possible)
 *   - AES-256-GCM: authenticate associated data (blob header + salt)
 *   - Never log or emit passphrase, derived key, or decrypted credentials */
export function createCredentialBootstrap(): CredentialBootstrap {
  return {
    restore: async (blob, passphrase) => {
      // 1. Validate passphrase (non-empty, min length)
      // 2. Derive key via scrypt(passphrase, salt, N=2^20, r=8, p=1)
      // 3. Expand via HKDF-SHA256
      // 4. Decrypt via AES-256-GCM (verify auth tag)
      // 5. Zero passphrase from memory
      // 6. Return restored credentials
    },
  };
}
```

### 3.6 INJECTION-POINTS → room seam visibility

The `INJECTION-POINTS.md` content classes map to room seam visibility:

| Content Class | Room Seam Visibility | Example |
|---|---|---|
| Public identifier | Visible in room metadata | SSH pubkey, hostname, ZetaId |
| Secret material | Never visible to agent; only via credential proxy | Passwords, WiFi creds, GPG keys, K8s tokens |

```typescript
// room.ts — AFTER upgrade
export type RoomSeamVisibility = "public" | "secret";

export type RoomSeamBinding = {
  seam: RoomSeamName;
  mode: SeamMode;
  adapter: string;
  /** NEW: visibility class — port of INJECTION-POINTS.md content class. */
  visibility?: RoomSeamVisibility;
};
```

### 3.7 createRealRoom — bind all live adapters

**Create:** `packages/application/src/create-real-room.ts`

The `createRealRoom` factory binds all live adapters at the same seams that `createDeterministicRoom` binds mocks.

```typescript
// packages/application/src/create-real-room.ts

/** Bind all real adapters at the room's seams.
 * This is the production counterpart to createDeterministicRoom. */
export async function createRealRoom(input: CreateRealRoomInput): Promise<Room> {
  const spiffeProvider = createSpiffeIdentityProvider();
  const spiffeResult = await spiffeProvider.fetchIdentity(input.workloadId);
  if (spiffeResult.outcome === "feedback") {
    return Promise.reject(spiffeResult.feedback);
  }
  const identity = agentIdentityFromSpiffe(spiffeResult.value);
  const env = createSystemEnvironment();
  const credentialProxy = createVaultCredentialProxy(input.vaultAddr, {
    fetchSvid: async () => spiffeResult.value.svid,
    requestSecret: input.requestSecret,
  });
  const sandbox = createBwrapSandbox();
  return {
    roomId: input.roomId,
    seamMode: "real",
    env,
    clock: clockFromEnv(env),
    ids: idGeneratorFromEnv(env),
    seams: [
      { seam: "clock", mode: "real", adapter: "system-clock", visibility: "public" },
      { seam: "ids", mode: "real", adapter: "crypto-random", visibility: "public" },
      { seam: "sandbox", mode: "real", adapter: "bwrap", visibility: "public" },
      { seam: "credential_proxy", mode: "real", adapter: "vault-dynamic", visibility: "secret" },
      { seam: "transport", mode: "real", adapter: "nats", visibility: "public" },
      { seam: "chat_completion", mode: "real", adapter: "ollama", visibility: "public" },
    ],
    hatIds: input.hatIds,
    communicationStrategy: input.communicationStrategy ?? "english",
    budget: input.budget ?? { maxSteps: 1024 },
    identity,
    sandbox: {
      engine: "bwrap",
      workspaceMount: input.workspaceMount,
      egress: input.egress,
      allowedEgress: input.egress.hosts,
      revokeOnExpiry: true,
    },
    credentialProxy,
  };
}
```

---

## 4. Upgrade Path

### 4.1 `room.ts` — EXTEND

**Before:** `createDeterministicRoom` binds all-mock seams. No `createRealRoom` exists.

**After:** `createRealRoom` binds all-real seams (SPIRE, Vault, bwrap, NATS, Ollama). `AgentIdentity` gains SPIFFE fields. `SandboxSpec` gains structured `EgressPolicy`. `RoomSeamBinding` gains `visibility`.

### 4.2 `sandbox-tool.ts` — EXTEND

**Before:** `SandboxToolPort` with no bwrap implementation.

**After:** `BwrapSandbox` interface with real and mock implementations.

### 4.3 `ports.ts` — EXTEND

**Before:** No identity or credential ports.

**After:** `SpiffeIdentityProvider` and `CredentialBootstrap` interfaces added.

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — ZetaId for SPIFFE IDs), §07 (hat-system — HatBinding wearer is SPIFFE ID)
- **Blocks:** §09 (systemd runtime — needs credential bootstrap for first boot)

---

## 6. Testing Strategy

### 6.1 Mock vs real seam flip

```typescript
Deno.test("Room works with both mock and real seams", async () => {
  const mockRoom = createDeterministicRoom({ roomId: "test", hatIds: ["hat-1"] });
  // ... test with mock seams
  const realRoom = await createRealRoom({ roomId: "test", hatIds: ["hat-1"], ... });
  // ... test with real seams (in integration env)
});
```

### 6.2 SPIFFE identity

```typescript
Deno.test("SPIFFE identity has valid trust domain", () => {
  const spiffe: SpiffeIdentity = {
    spiffeId: "spiffe://zeta.local/agent/otto",
    trustDomain: "zeta.local",
    svid: { type: "jwt", token: "..." },
    expiresAt: "2026-12-31T23:59:59Z",
  };
  const identity = agentIdentityFromSpiffe(spiffe);
  assertEquals(identity.agentId, "otto");
  assertEquals(identity.subject, "spiffe://zeta.local/agent/otto");
});
```

### 6.3 Credential proxy grants

```typescript
Deno.test("Vault credential proxy returns grants for hats", async () => {
  const proxy = createVaultCredentialProxy("https://vault.vault.svc:8200", {
    fetchSvid: async () => ({ type: "jwt", token: "test" }),
    requestSecret: async (path) => ({ outcome: "ok", value: { leaseId: "l1", leaseDurationSeconds: 3600, data: { token: "secret" } } }),
  });
  const grants = await proxy.grantsFor({ agentId: "otto", subject: "spiffe://zeta.local/otto" }, ["hat-1"]);
  assertEquals(grants.length, 1);
  assertEquals(grants[0].tool, "tool:hat-1");
});
```

### 6.4 Credential bootstrap

```typescript
Deno.test("Credential bootstrap decrypts blob with passphrase", async () => {
  const bootstrap = createCredentialBootstrap();
  const blob = encryptCredentials(testCredentials, "test-passphrase");
  const result = await bootstrap.restore(blob, "test-passphrase");
  assertEquals(result.outcome, "ok");
});
```

### 6.5 Egress policy

```typescript
Deno.test("Egress policy blocks non-allowed hosts", () => {
  const policy: EgressPolicy = { hosts: ["api.github.com"], requireMtls: true };
  assert(isAllowedEgress(policy, "api.github.com"));
  assert(!isAllowedEgress(policy, "evil.com"));
});
```
