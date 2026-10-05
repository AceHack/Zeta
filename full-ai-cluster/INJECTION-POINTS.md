# Cluster install-time injection points — canonical catalog

End-to-end map of every credential / identifier / configuration value
that can be injected into a fresh NixOS install at flash time or first
console boot. Each row is declaratively backed by a NixOS module that
reads its value at evaluation time via `builtins.readFile`.

## Constitutional rail (from `usb-nixos-installer/zeta-install.sh`)

> _"Secrets shouldn't transit non-operator surfaces (USB ESP, Aaron's
> Mac keychain, etc.); operator-typed at install time is the safest
> path."_

This rail partitions injection points by **content class** + **transit
surface**:

| Content class                                                                                             | Allowed transit surfaces                                                |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Public identifier** (SSH pubkey, hostname)                                                              | USB ESP at flash time; cluster console at install time                  |
| **Secret material** (passwords, WiFi creds, GPG, age, K8s tokens, ArgoCD admin, cosign signing key, etc.) | Cluster console at install time ONLY (operator-typed; never on USB ESP) |

Secret-class material that doesn't fit the operator-typed-once
discipline (e.g., long random tokens, multi-secret bundles) goes via
post-install secrets management (out of scope for this catalog;
candidates: SOPS, age, sealed-secrets, External Secrets Operator).

### The rail is now machine-checked (081KTWFYC9108QG0R001C8RDPK)

Until 2026-08-17 the rail above existed **only as this prose**. `FileBackedEspWrite`
in `src/Core.TypeScript/zflash/lib.ts` carried a closed union of six ESP
destinations and no notion of what class any of them held, so nothing in the
build could tell `/zeta-hostname.txt` from `/zeta-join-token`.

`src/Core.TypeScript/zflash/injection-rail.ts` makes the class a type,
**exhaustive over that same union** (`satisfies Record<EspDestination, …>`), in
the shape #11485 set for `VendorTrustRoot`: an ESP destination added without a
declared content class is a TypeScript error, not a review miss.
`runFileBackedZflash` calls `railFindingsForEspWrites` and discloses every
secret-class and unclassified write to the operator at flash time.

**The guard has already fired once, and that is the evidence it works.** The
module was written against the six-destination union. While it waited to land,
`lib.ts` grew to **eight** — `/zeta-bind-uefi-keyfile` and
`/zeta-qemu-creds-passphrase` — and the `satisfies` clause turned the two
unclassified arrivals into a compile error rather than a silent gap. Under the
prose-only rail they would simply have shipped unclassified, which is exactly
what §4a below records happening to the WiFi PSK.

Three classes, not two — the table above cannot express why `/zeta-creds.enc`
is permitted while being called secret material. It is permitted because it is
an **encrypted envelope** whose key is not on the medium, so that is its own
class. **The class is DECLARED, never measured:** the rail does not open the
file to confirm it is an AES-256-GCM envelope.

| ESP destination               | Content class                               | ESP verdict                                                 |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `/zeta-authorized-keys.pub`   | public identifier                           | permitted by class                                          |
| `/zeta-hostname.txt`          | public identifier                           | permitted by class                                          |
| `/zeta-firstboot.conf`        | public identifier                           | permitted by class                                          |
| `/zeta-bind-uefi-keyfile`     | public identifier (the literal bytes `1\n`) | permitted by class                                          |
| `/zeta-qemu-bake-test-cred`   | public identifier (the literal bytes `1\n`) | permitted by class                                          |
| `/zeta-creds.enc`             | encrypted envelope                          | permitted by class (declared, not measured)                 |
| `/zeta-join-token`            | **secret material**                         | **refused by class; ships under the §6 recorded exception** |
| `/zeta-wifi-credentials.json` | **secret material**                         | **REFUSED — no exception on file; see §4a**                 |
| `/zeta-qemu-creds-passphrase` | **UNDECIDED — pending security review**     | **REFUSED; see §4b**                                        |
| `/zeta-qemu-k3s-first-boot-verify` | public identifier (the literal bytes `1\n`) | permitted by class                                     |

A ninth destination arrived later: `/zeta-qemu-bake-test-cred` (081M12178AR), a
public-identifier marker (`1\n`) that asks the guest picker to bake one
deterministic gh-cli _test_ token. The token is not on the ESP.

A tenth destination, `/zeta-qemu-k3s-first-boot-verify` (WP11), is the same
shape again: presence asks the INSTALLED disk's own first multi-user boot to
run `zeta-k3s-first-boot-verify.nix`'s bounded k3s + first-boot-roster
bring-up check and print a JSON verdict to serial. Reading the marker
discloses nothing and grants nothing.

**What is NOT claimed.** This module performs no cryptography and no key
material passes through it. Nothing here is sealed, bound, attested, or
verified. It classifies destinations and returns verdicts.

### 4b. `/zeta-qemu-creds-passphrase` — content class UNDECIDED, awaiting review

081KTWFYC9108QG0R001C8RDPK carries the gate _"Nazar (ops) + Mateo (research)
review the surface BEFORE implementation; no key handling lands without it."_
Seven of the eight destinations above are classified by reading the bytes they
carry. This one is not, and it was not classified here.

**What it carries, factually.** `planFileBackedZflashImage` writes the plaintext
passphrase for `/zeta-creds.enc` when `--qemu-creds-passphrase-file` is passed;
`installer/uefi-keyfile-esp.ts` reads it back off the boot USB ESP
(`QEMU_CREDS_PASSPHRASE_IMAGE_PATH`) so a non-interactive QEMU run can bind the
blob. It is documented in `lib.ts` as a QEMU-only test secret, not a production
operator path.

**Why it is a judgement and not a reading.** `/zeta-creds.enc` earns the
`encrypted-envelope` class _because the key is not on the medium_. This file is
that key. Whether a QEMU-only, flag-gated path makes that acceptable — and
whether the rail should model "test-only" as a class at all — is a security
call, so the rail carries the explicit sentinel `pending-security-review`
instead of a guess.

**Undecided fails closed and stays loud.** The write is REFUSED, no recorded
exception can rescue it (the ordering in `evaluateEspWrite` puts the sentinel
before the exception lookup, so a review gate cannot be satisfied by a roster
entry the reviewers never saw), and the flash-time disclosure reads `CONTENT
CLASS NOT YET REVIEWED` rather than the ordinary refusal — a missing review must
never read as a completed one. The question, the four options the rail can
actually express, and their consequences are enumerated in code as
`PENDING_CLASSIFICATIONS`, with a test asserting `decided: false` and a second
asserting that every sentinel in the map has a roster entry.

### 4a. WiFi credentials on the ESP — a divergence, not an exception

Found 2026-08-17 while making the rail machine-checkable, and recorded rather
than quietly fixed (the #11477 standard).

§4 below classifies WiFi credentials as **"Secret material (NEVER on USB ESP)"**
and says they are typed at the console into `nmtui`. **The shipping code does
otherwise.** `planFileBackedZflashImage` writes `/zeta-wifi-credentials.json` —
the SSID and the PSK as plain JSON — onto the ESP whenever `--wifi-ssid` /
`--wifi-password` / `--wifi-credentials` is passed;
`composeWifiCredentialsFileContent` validates and serialises, and performs no
encryption. Three existing tests in `file-backed.test.ts` assert that plaintext
write as expected behaviour, so the path is live, not vestigial.

This is a **divergence**, categorically different from §6's exception: §6 was
decided and written down; this was not noticed. It is left UNRESOLVED here on
purpose — removing a shipped operator flag is a maintainer call, and the
correct destination (the §7 encrypted blob, or console-only per §4) is the same
open question §6 already carries. Recorded in code as
`RAIL_DIVERGENCES` in `injection-rail.ts`, and disclosed at every flash that
carries it.

## Supported injection points (live catalog)

Each injection point has: stage (when injected) + content class +
flag/prompt (how operator drives it) + ESP filename (if ESP-transit) +
NixOS module (declarative reader) + iter/backlog tag.

### 1. Operator SSH pubkey

| Property                   | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Stage**                  | macOS at `zflash` time → USB ESP write                                                                     |
| **Content class**          | Public identifier                                                                                          |
| **Operator-driven via**    | `zflash --ssh-key <path>` (default `~/.ssh/id_ed25519.pub`); `--no-inject` to skip                         |
| **ESP filename**           | `zeta-authorized-keys.pub`                                                                                 |
| **NixOS reader module**    | `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` (+ `operator-authorized-keys.nix` variant)           |
| **Backed by file**         | `full-ai-cluster/nixos/modules/operator-ssh-keys.txt`                                                      |
| **Iter / backlog**         | iter-4.2 / [081KSGS9H0008QG0R002T3BJ2R](../docs/backlog/)                                                  |
| **Reader entry point**     | `builtins.readFile keysFile` → `users.users.zeta.openssh.authorizedKeys`                                   |
| **Mechanism on Mac**       | `diskutil mount` ESP + `sudo tee` write (read-only on `~/.ssh/`)                                           |
| **Mechanism on installer** | `zeta-install.sh` probes mounted USB FAT/ESP partitions; writes file into `/mnt/etc/zeta/` (or equivalent) |

### 2. Cluster node hostname

| Property                | Value                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | macOS at `zflash` time → USB ESP write                                                                                |
| **Content class**       | Public identifier (RFC1123-validated)                                                                                 |
| **Operator-driven via** | `zflash --host <name>` (default = flake's per-host config)                                                            |
| **ESP filename**        | `zeta-hostname.txt`                                                                                                   |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-hostname.nix`                                                                 |
| **Backed by file**      | `/mnt/etc/zeta/cluster-node-id` (written by installer from ESP)                                                       |
| **Iter / backlog**      | iter-5.2 / [081KSGS9H0008QG0R003V23XNZ](../docs/backlog/)                                                             |
| **Reader entry point**  | `builtins.readFile idFile` → `networking.hostName` (via `lib.mkOverride 50`)                                          |
| **Validation**          | `VALID_HOSTNAME_REGEX` in `zflash-lib.ts`; mirror grep `[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$` in `zeta-install.sh` |

### 3. `zeta` user initial password

| Property                | Value                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Stage**               | Cluster console at install time → typed twice                                                     |
| **Content class**       | **Secret material** (NEVER on USB ESP)                                                            |
| **Operator-driven via** | `read -s` prompt in `zeta-install.sh` (a typed password always wins); Enter to skip → the console-password **policy** decides (below) |
| **Policy carrier**      | `zflash --console-password default\|mint` → `ZETA_CONSOLE_PASSWORD_POLICY='…'` on the ESP `/zeta-firstboot.conf` (a **policy choice, not a secret**: the one ESP value in this row that is allowed there; exported by `zeta-first-boot.sh`). Unset = `default`. Never baked into the ISO's own conf. Validated by `installer/console-password-policy.ts`; shell twin `ZETA-CONSOLE-PW-POLICY` block (parity-tested); an unknown value refuses the install **before the wipe** |
| **Hash mechanism**      | `mkpasswd -m sha-512 -s` (sha512crypt; reads from stdin to avoid argv exposure)                   |
| **Backed by file**      | `/mnt/etc/zeta/initial-hashedpassword` (chmod 0600, chown root:root)                              |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/initial-password.nix`                                              |
| **Iter / backlog**      | iter-5.3 (+ 081KSGS9H0008QG0R00120EEHM Bug 3b runtime-injection fix)                              |
| **Reader entry point**  | `builtins.readFile` → `users.users.zeta.hashedPassword`                                           |
| **Why console-only**    | Per constitutional rail above; password shouldn't transit Mac keychain OR USB ESP                 |
| **No password typed, policy `default`** (repo default; **the owner's decision** after a minted password scrolled off on a real node and locked them out of their own console) | the **PUBLIC** `zeta-change-me`: its sha512crypt hash (stdin, never argv) is written to the hash file plus marker `/etc/zeta/initial-password-default`; **NOT locked, NOT minted**; a loud banner (`CONSOLE PASSWORD IS THE PUBLIC DEFAULT zeta-change-me — change it: sudo passwd zeta. SSH password login stays disabled.`) goes to stdout + `/dev/console` + `/dev/tty1` and is repeated in the install-complete summary. Applied ONCE (state file) so a later `passwd zeta` is never reverted. First boot: `zeta-default-password-reminder` (service + 5-min timer) keeps `/run/zeta/console-password-is-default` while the live `/etc/shadow` hash still equals the applied one; login shells print it; `passwd zeta` clears it within one tick. **Risk:** anyone with console access is root via `sudo` (physical-access threat model) — do not use on exposed hardware. SSH `PasswordAuthentication = false` is unchanged. |
| **No password typed, policy `mint`** (explicit opt-in: `zflash --console-password mint`) | **minted per install** (24 lowercase base32 chars from `/dev/urandom`), shown ONCE on `/dev/console` + `/dev/tty1` and never on the tee'd stdout (so not in the log copied onto the node); hash written as above plus marker `/etc/zeta/initial-password-minted`; applied ONCE (state file). Not shown anywhere -> account LOCKED (`/etc/zeta/console-password-locked`). The safe choice for anyone else (docs/ops/INSTALL-TIME-CONFIG.md row 19). `initial-password.nix` also carries the public hash as the build-time default for a system built WITHOUT the installer |

### 4. WiFi credentials

| Property                | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Stage**               | Cluster console at first boot → `nmtui`                                             |
| **Content class**       | **Secret material** (NEVER on USB ESP)                                              |
| **Operator-driven via** | `nmtui` TUI on `zeta-first-boot.sh`                                                 |
| **Backed by**           | NetworkManager system connections (under `/etc/NetworkManager/system-connections/`) |
| **Iter / backlog**      | sibling exception in `zeta-first-boot.sh` (per `zeta-install.sh` line 392 comment)  |
| **Why console-only**    | Same constitutional rail; WiFi PSK is secret                                        |

### 5. Node role (first control plane vs joiner)

| Property                | Value                                                                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | macOS/Linux at flash time → USB ESP write                                                                                                                                                                                                                                    |
| **Content class**       | Public identifier (role, flake host attribute, join endpoint)                                                                                                                                                                                                                |
| **Operator-driven via** | `--role first-control-plane\|joiner` `--flake-host <attr>` `--join-server-url https://host[:port]` on the file-backed zflash CLI and `prepare-boot-image.ts`                                                                                                                 |
| **ESP filename**        | `zeta-firstboot.conf`                                                                                                                                                                                                                                                        |
| **NixOS reader module** | none — the conf is read by **bash**: `zeta-first-boot.sh` sources it in preference to the ISO's `/etc/zeta-firstboot.conf`, then execs `zeta-install "$HOST"`. The join URL half is read at Nix evaluation time by `full-ai-cluster/nixos/modules/injected-join-server.nix`. |
| **Backed by file**      | `/mnt/etc/zeta/cluster-join-server-url` (extracted from the conf by `zeta-install.sh`)                                                                                                                                                                                       |
| **Composer**            | `src/Core.TypeScript/zflash/firstboot-role.ts` (pure; unit-tested in `firstboot-role.test.ts`)                                                                                                                                                                               |
| **Validation**          | flake host must match `VALID_FLAKE_HOST_ATTRIBUTE_REGEX`; join URL must be `https` host-and-port; **every emitted value passes `SHELL_SAFE_CONF_VALUE_REGEX` and is single-quoted**, because the file is `.`-sourced by bash                                                 |
| **Iter / backlog**      | 081KSNY2Z0008QG0R0008PN7RQ scenario 5; supersedes the "per-flash `--role` deferred to v2" note in `usb-nixos-installer/nixos/installer/configuration.nix`                                                                                                                    |

**Why it exists:** before this, the role was fixed at ISO-BUILD time
(`environment.etc."zeta-firstboot.conf"` ships `HOST=control-plane`), so every
medium cut from one ISO installed a control plane and a second node could not
be provisioned as a joiner.

**UNEXERCISED.** The composer is unit-tested; the bash and Nix halves have not
been booted. See `JoinBlocker` in `src/Core.TypeScript/zflash/test-harness/scenarios.ts`.

### 5b. Cluster segment addressing — plaintext on ESP, NOT secret, but TAMPERABLE

| Property           | Value                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**          | flash time → USB ESP write, inside `zeta-firstboot.conf`                                                                                                                                                      |
| **Content class**  | Public identifiers (an IPv4 address, a prefix length, a MAC) — **not secret material**                                                                                                                        |
| **Conf keys**      | `ZETA_CLUSTER_NODE_CIDR`, `ZETA_CLUSTER_SEGMENT_MAC`, `ZETA_CLUSTER_CONTROL_PLANE_IP`                                                                                                                         |
| **Composer**       | `src/Core.TypeScript/zflash/cluster-address.ts` (pure; unit-tested in `cluster-address.test.ts`)                                                                                                              |
| **Consumer**       | `zeta-install.sh` re-validates and stages `/mnt/etc/zeta/cluster-segment-address`, `…-segment-mac`, `…-control-plane-address`; `nixos/modules/injected-cluster-address.nix` reads them at Nix evaluation time |
| **Validation**     | derived (never free-typed): founder `.1`, joiner `.2+` in `10.88.0.0/24`; MAC must be six lowercase hex octets **and unicast**; shape re-checked independently in TypeScript, in bash, and in Nix             |
| **Iter / backlog** | 081KSNY2Z0008QG0R0008PN7RQ scenario 5, `joining-node-address-assignment`                                                                                                                                      |

**Why it exists:** the shared cluster segment has no DHCP server and no DNS, so
a joining node had no address and could not resolve the host in its own
`--server` URL. mDNS is not the fix — `k3s-server.nix` records that it was
tried and never resolved, and it ships only `--tls-san=control-plane`, so a
`.local` name would fail certificate verification even if it did resolve.

**HONEST CAVEAT — plaintext and tamperable, stated rather than shipped quietly.**
Unlike point 6, nothing here is secret: an address and a MAC leak nothing by
being readable. The exposure is the other direction — **anyone with physical
possession of the stick can REWRITE these values**, and the obvious attack is
repointing `ZETA_CLUSTER_CONTROL_PLANE_IP` at a rogue node so a joiner dials it.
What limits that, and what does not:

- It **does not** buy a silent takeover of the joiner. The joiner still verifies
  the API certificate against the name `control-plane`, and a rogue node cannot
  present a certificate for it without the cluster CA. The join fails rather
  than succeeding against the wrong cluster.
- It **does** buy denial of service and misdirection — a joiner sent to an
  address that answers nothing, or to a node that can now see its connection
  attempts. Neither is authenticated away by anything on the medium.
- The same physical access already reaches the point-6 join token, which is the
  strictly worse exposure. This is recorded as **not making that any better**,
  not as being safe on its own.
- The long-term home is the same one point 6 names: the AES-256-GCM cred blob
  bound to a passphrase and the USB UUID (081KSKBP80008QG0R003AX2A69).

**UNEXERCISED.** The derivation is unit-tested with no network and no QEMU. The
`injected-cluster-address.nix` no-op path is evaluated (it yields `{}`); the
populated path, the NetworkManager keyfile pickup, MAC-based NIC selection, and
reachability of 6443 across the segment are **UNVERIFIED**. See `JoinBlocker`
in `src/Core.TypeScript/zflash/test-harness/scenarios.ts`.

### 5c. Server-side join — the branch that decides FOUND vs JOIN

| Property                | Value                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | reuses point 5's `zeta-firstboot.conf` and point 6's `zeta-join-token`; **no new ESP file**                                                                                                                                                              |
| **Content class**       | one public identifier (the join endpoint) + one secret (the token, already covered by point 6's recorded exception)                                                                                                                                      |
| **Backed by files**     | `/etc/zeta/cluster-join-server-url` **and** `/etc/zeta/k3s-join-token` (0600) — both staged by `zeta-install.sh` and symlinked so Nix evaluation sees what the installed system will see                                                                 |
| **NixOS reader module** | `nixos/modules/injected-server-join.nix`                                                                                                                                                                                                                 |
| **Validation**          | ALL-OR-NONE. Both present ⇒ `clusterInit := false`, `serverAddr := <url>`, `tokenFile := /etc/zeta/k3s-join-token`. Exactly one present ⇒ **assertion failure at Nix evaluation**, naming which half is missing. Neither ⇒ founding, byte-for-byte unchanged |
| **Runtime guard**       | `nixos/modules/k3s-datastore-preflight.nix` — refuses to start k3s when a node provisioned to join already holds a datastore, because k3s IGNORES every one of the options above in that state                                                            |
| **Checked by**          | `nixos/tests/k3s-server-join-eval-test.nix` (5 scenarios) · `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts` (executes the guard over fixtures)                                                                                        |

**Why it exists:** point 5 provisioned a role, and `injected-join-server.nix`
guards itself to `services.k3s.role == "agent"`. So a WORKER could be told to
join and a CONTROL PLANE could not — every machine built from the
`control-plane` flake host called `--cluster-init` and founded its own cluster
whatever the medium said. The signature of that defect is two k3s CAs on one
LAN with founding epochs twelve days apart.

**Why the token is NOT at `/var/lib/rancher/k3s/server/token`:** k3s manages and
writes that path itself. Pre-seeding it conflates "the credential I present to
join" with "the credential I hand out". `/etc/zeta/k3s-join-token` is neither.

**Only its PRESENCE is read at evaluation time.** A NixOS module evaluates into
the world-readable Nix store, so `builtins.readFile` on a cluster credential
would copy it there. The `K10<64 hex>::…` content check stays in
`zeta-install.sh`, on the machine, where the bytes already are.

**UNEXERCISED on hardware.** Every branch is pinned at Nix evaluation and the
runtime guard is executed over fixtures in CI; nothing here has been booted.

### 6. k3s node-token (joiner) — plaintext on ESP, opt-in

| Property                  | Value                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                 | flash time → USB ESP write, **only when explicitly requested**                                                                                                         |
| **Content class**         | **Secret material, stored PLAINTEXT** — see the caveat below                                                                                                           |
| **Operator-driven via**   | `--join-token <path>` (requires `--role joiner`)                                                                                                                       |
| **ESP filename**          | `zeta-join-token`                                                                                                                                                      |
| **Consumer**              | `zeta-install.sh` copies it to `/mnt/var/lib/rancher/k3s/agent/token` (0600), which is exactly the path `nixos/modules/k3s-agent.nix` sets as `services.k3s.tokenFile` |
| **Source of the value**   | the founding server's `/var/lib/rancher/k3s/server/node-token`                                                                                                         |
| **Shape, enforced twice** | `K10<64 lowercase hex>::<creds>` — refused at flash time by `firstboot-role.ts` `validateJoinTokenMaterial`, and again by `zeta-install.sh` before install             |

**WHY THE SHAPE IS ENFORCED AND NOT ASSUMED (traced upstream 2026-08-21).** The
`K10<hash>::` prefix is not decoration; it is the only thing authenticating the
server a joiner hands its credential to. In k3s `pkg/clientaccess/token.go`:

- `parseToken` does **not** reject a token lacking the prefix — it rewrites it
  to `K10:::<password>`, so `caHash` becomes the empty string.
- `getCACerts` downloads the cluster CA from `/cacerts` using `insecureClient`,
  declared in that same file with `tls.Config{InsecureSkipVerify: true}`.
- `validateCAHash` with an empty `caHash` and a non-empty CA bundle emits
  `logrus.Warn(...)` and returns nil — the join proceeds.

So a bare shared secret (`K3S_TOKEN=hunter2`) yields a joiner that accepts
whatever CA answers first on the segment and then presents the cluster token to
it. `https://` in the server URL does not close this: the request that ignores
TLS is the CA download itself. Refusing the shape costs a correct operator
nothing — `server/token` and its `node-token` symlink are both written by
`handlers.WriteToken` → `clientaccess.FormatToken`, which always prepends the
digest.

**CONSTITUTIONAL-RAIL CAVEAT — read before using this on real hardware.** Point
7's "Encrypted cred-blob" earns its place on the ESP by being AES-256-GCM
encrypted and bound to an operator passphrase plus the USB UUID. **This one is
not.** A k3s node-token written here sits in the clear on a FAT filesystem that
anyone with physical possession of the stick can read, and it grants cluster
membership. That is a weaker bar than the rail sets for secret material, and it
is recorded as a gap rather than argued away:

- It is **never written implicitly** — only when the operator passes `--join-token`.
- It is intended for the QEMU harness, where the token is deterministic test
  material and the "stick" is a file in `/tmp`.
- The correct long-term home is the existing encrypted blob path
  (081KSKBP80008QG0R003AX2A69), which already has the passphrase + UUID binding
  this needs. Folding the join token into that blob is the follow-up.

### 9. Workload identity (SPIFFE) at the door — NOT SHIPPED; derivation + policy only

081KTWFYC9108QG0R001C8RDPK. What exists today is **pure derivation and policy**
in `src/Core.TypeScript/zflash/injection-rail.ts`. **No workload identity is
issued, sealed, bound, attested, or injected by anything in this repo.** No
node has been flashed or booted against any of it.

A SPIFFE workload identity is three artifacts, and only the third is what people
mean by "the key":

| Artifact                                       | Content class     | ESP verdict |
| ---------------------------------------------- | ----------------- | ----------- |
| SPIFFE ID (the URI)                            | public identifier | permitted   |
| trust bundle (trust-domain CA **public** keys) | public identifier | permitted   |
| SVID **private key**                           | secret material   | **refused** |

The refusal has two independent reasons, either sufficient: the rail (secret
material, unencrypted medium), and SPIFFE's own design — the workload generates
its own private key and only a CSR leaves it. So the honest reading of "keys
injected at the door" is that **the key is not injected**; what can travel with
the medium is the public half and the node coordinate.

**The composition that already exists:** the hostname zflash writes to
`/zeta-hostname.txt` is exactly the `@<node>` coordinate of the identity-treaty
form (`docs/research/2026-07-03-persona-cell-identity-treaty-*` Article 3,
`spiffe://zeta/persona/<persona>/cell/<surface>[/<instance>][@<node>]`).
`deriveNodeWorkloadSpiffeId` derives it and validates by round-tripping through
`parseSpiffe` — necessary, because `VALID_HOSTNAME_REGEX` accepts uppercase and
the actor-ref segment charset does not, so `--host Node-A` flashes cleanly and
yields a SPIFFE ID this repo's own parser rejects.

**Missing injection point (candidate, not filed as a change):** the **trust
bundle** has no ESP destination. It is a public identifier, so the rail permits
it, and without a trust anchor on the medium a booting node has nothing to
verify an issuer against — first contact is TOFU. Adding an ESP destination is
key handling and therefore behind this work-item's review gate (Nazar + Mateo),
so it is named here rather than shipped.

**Custody decisions this deliberately does NOT make** (`WORKLOAD_IDENTITY_CUSTODY_DECISIONS`,
each `decided: false`, asserted by test):

1. Where an SVID private key is **sealed at rest** — TPM 2.0, Secure Enclave,
   software keystore, or nothing. (The 2026-08-14 hardware probe found no TPM
   and no usable seal tier on the Mac Studio; the x86 nodes are unprobed.)
2. Whether the node identity is **TPM-bound** — sealing and binding are separate
   choices and either can be made without the other.
3. **Who authorizes issuance** at first boot. SPIRE node attestation answers
   "which node is this" from a vendor-rooted claim; nothing here answers "and
   may it have an identity in this trust domain".
4. Which **governance class** a node workload key takes (self-sovereign /
   shared-capability / delegated-operational — taxonomy fixed by the 2026-08-14
   L0→L6 ladder, per-key assignment explicitly left to ratification).

### 10. Public TLS — ACME contact email + public base domain (081M3JG74G0087G0R001XJC837)

**Why it is an injection point and not a manifest value.** `platform/clusterissuer.yaml`
used to ship `email: you@example.com # ← CHANGE`, and the Gateway / portal route shipped
`portal.example.com` / `portal.zeta.example.com`. A generic installer changes no file, so
every install applied them. Measured on a bare-metal node: the ClusterIssuers failed
`invalidContact ... forbidden domain "example.com"`, ArgoCD's sync of `platform` sat on
`waiting for healthy state of cert-manager.io/ClusterIssuer/letsencrypt-prod` forever, and
the controller, portal, Gateway, HTTPRoute, monitoring objects and Blueprints were never
applied. **No value is defaulted anywhere in the repo or the installer now.**

| Property                | Value                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | (1) flash time → ESP conf, or (2) cluster console at the **start** of the install (before disk enumeration)                        |
| **Content class**       | Public identifier (an ACME contact is not secret; LE does not publish it)                                                          |
| **Operator-driven via** | `zflash --acme-email <addr> --public-domain <domain>` (device and file-backed), else the installer prompt                          |
| **ESP carrier**         | `ZETA_ACME_EMAIL='…'` / `ZETA_PUBLIC_DOMAIN='…'` appended to `/zeta-firstboot.conf` (exported by `zeta-first-boot.sh`)             |
| **Backed by files**     | `/mnt/etc/zeta/acme-email` + `/mnt/etc/zeta/public-domain` (written only when SET; symlinked to `/etc/zeta/` for `--impure` eval)  |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-public-tls.nix` (k3s servers only)                                                          |
| **Reaches the cluster** | the k3s auto-deploy roster — the same door `root-application.yaml` uses — as the ArgoCD Application `platform-public-tls`          |
| **Validation**          | `src/Core.TypeScript/installer/public-endpoint.ts`; shell twin `ZETA-PUBLIC-TLS` block in `zeta-install.sh` (parity-tested)       |

**Resolution order** (installer, `zeta_public_tls_resolve`): **(1)** the ESP pair when both
are present and valid → **(2)** otherwise ask → **(3)** otherwise **UNSET**. Enter at either
question, EOF, no TTY, or no keypress in the first-boot window all mean UNSET — never a
default. An ESP value that fails validation is refused loudly and treated as absent; half a
pair is never applied. A joiner does not ask: the endpoint is a property of the cluster.

**Validation.** Email: `[A-Za-z0-9._%+-]{1,64}@<domain>` (deliberately narrower than RFC
5322 so no quote, space, `$` or backtick reaches a sourced file or a manifest). Domain: two
or more LDH labels, last label starting with a letter, `portal.<domain>` ≤ 253. **Reserved
names are refused** in both: RFC 2606 `.test` `.example` `.invalid` `.localhost` and
`example.com/.net/.org` (any subdomain), plus RFC 6762 `.local`.

**What the prompt looks like.** Interactive `zeta-install` asks directly. On the zero-typing
first-boot path (a TTY, `ZETA_AUTO_CONFIRM=WIPE`) it is one keypress away:

```text
[public-tls] ── public TLS (ACME email + public domain) ──
[public-tls] Press 'p' within 15s to set up PUBLIC TLS (Let's Encrypt for portal.<your-domain>).
[public-tls] Any other key, or waiting, installs LAN-only (no public hostname, no certificate).
[public-tls] ACME contact email (Let's Encrypt expiry notices): _
[public-tls] Public base domain (portal.<domain> will be served), e.g. yourdomain.net: _
```

(`PUBLIC_TLS_PROMPT_SECS` overrides the 15 s window.)

**UNSET (a clean, working state).** `platform` applies no ClusterIssuer, no Certificate, and
nothing with a hostname: `zeta-gateway` has one `:80` listener with no hostname, and the
`portal` HTTPRoute matches any Host. The portal is reachable on the LAN at the `zeta-gateway`
LoadBalancer IP.

**SET.** A separate Application, `platform-public-tls`, applies `full-ai-cluster/k8s/public-tls/`
(kustomize base: both Let's Encrypt ClusterIssuers, the `zeta-public-gateway` Gateway with
`:80` + `:443`, and the `portal-public` HTTPRoute) with the two values arriving **only** as
the Application's inline patches: the issuers' `spec.acme.email`, the HTTPS listener's
`hostname: portal.<domain>`, and the route's `hostnames: [portal.<domain>]`. Being its own
Application with no sync waves inside it, an issuer or Certificate that cannot go Ready never
gates `platform` again.

**GitLab rides the same values** (081M3K253BR087G0R001151P2A). SET adds two more HTTPS
listeners (`gitlab.<domain>`, `registry.<domain>`, one certificate each), the `gitlab-public` /
`gitlab-registry-public` HTTPRoutes, and Job `gitlab-public-hosts`, which merge-patches the
`gitlab` Application's `spec.source.helm.parameters` so GitLab's external URL is
`https://gitlab.<domain>` (`zeta-root` ignores exactly that field). UNSET: GitLab is LAN-only at
**`http://<last address of the resolved LB range>/`** (§11) — its own hostname-less `gitlab-lan`
Gateway pinned to that address; the registry is the same address (`/v2/`). The address is no longer
in git: Job `gitlab-lan-address` (in `cilium-lb-ipam-pool`) merge-patches three valuesObject leaves.

**Forgejo rides them too** (docs/ops/INSTALL-TIME-CONFIG.md row 28). Its chart renders
`DOMAIN` / `ROOT_URL` / `SSH_DOMAIN` = `git.example.com` when nothing sets them, and nothing did.
UNSET: they are its in-cluster Service names (`forgejo-http.forgejo.svc:3000`). SET: a fifth listener
`git.<domain>` with its own certificate, the `forgejo-public` route, and Job `forgejo-public-hosts`,
which merge-patches the `forgejo` Application's helm parameters to `https://git.<domain>/` (`zeta-root`
ignores exactly that field). Same shape as GitLab above, a separate Job scoped to Application/forgejo.

**The operator step when SET** (also printed in the installer's completion banner):

1. **DNS:** an `A` record `portal.<domain>` → your public IP (and `gitlab.<domain>`,
   `registry.<domain>`, `git.<domain>` → the same IP to publish GitLab / Forgejo).
2. **Router:** forward TCP **443** to **the node** (its own, DHCP-reserved LAN address) — NOT to the
   public gateway's LoadBalancer address. A home router forwards to a _device_, and the node answers for
   several addresses on one MAC (measured 2026-10-02: the forward was bound to `.250`, the GitLab-only
   gateway, and production vanished). The node serves `:443` itself: `nixos/modules/node-public-https.nix`
   opens it and the `node-lan-hosts` relay passes it to the Gateway. **HTTP-01** additionally needs TCP
   **80** to reach the Gateway's own address
   (`sudo k3s kubectl -n zeta-platform get gateway zeta-public-gateway -o jsonpath='{.status.addresses[0].value}'`),
   which a device-keyed router may not deliver — the DNS-01 opt-in below needs no inbound port. Port 80 is not
   open on the node's own address, on purpose. Decision + measurements:
   `docs/DECISIONS/2026-10-02-the-router-reaches-the-node-not-a-loadbalancer-address-so-the-node-serves-443-itself.md`.
3. Watch `sudo k3s kubectl -n zeta-platform get certificate portal-tls` go Ready. HTTP-01
   reaches back on :80, so the certificate cannot issue before 1 and 2 hold.

**The node's own resolver** (`nixos/modules/injected-public-hosts.nix`, row 30) reads the **same**
`/etc/zeta/public-domain` and answers `gitlab.<domain>` and `registry.<domain>` with the node's loopback,
which the relay forwards to the Gateway. Without it the kubelet resolved those names to the public IP — which
the node can reach only through the router's (absent) hairpin — and every image pull from the in-cluster
registry timed out. Only those two names: `git.`/`portal.` are not pulled from by the kubelet, and `api.*` is
deliberately left to public DNS.

**Opt-in DNS-01 (no inbound :80)** — an operator-created Secret, never an injection point: both issuers also
carry a Cloudflare DNS-01 solver chosen only by the label `zeta.io/acme-solver: dns01` on the Gateway.
Secret `cloudflare-api-token` (ns `cert-manager`, key `api-token`) is EXTERNAL — the operator creates it on the
node, nothing mints it, and its absence is not a defect unless the label is set (same posture as
`hindsight-llm-api-key` below). `docs/ops/CLOUDFLARE-DNS01-CERTS.md`; the `--acme-solver` install-time flag is a
documented follow-up.

**Adding or changing it after install:** write both files under `/etc/zeta/` on the control
plane and `sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>`.

**Not verified here:** that ArgoCD's bundled kustomize applies the inline patches exactly as
`src/Core.TypeScript/cluster/public-tls.ts` mirrors them, and that `nix` renders the template
byte-for-byte as the TypeScript mirror does — both are pinned by tests on the text, not run.

### 11. LoadBalancer address range + LAN collision check (docs/ops/INSTALL-TIME-CONFIG.md rows 3–5)

**Supersedes §10's mention of `cilium-lb-ipam/ip-pool.yaml`: that file is gone.** It carried
`192.168.1.240–250`, free addresses on exactly one home subnet; on any other network Cilium handed
every `type: LoadBalancer` Service an address no router knew and reported it healthy. The range is
now resolved per install by the **same mechanism as §10** — nothing is invented twice.

| Property                | Value                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | (1) flash time → ESP conf, or (2) cluster console at the **start** of the install (Step 0.6, before disk enumeration)                        |
| **Content class**       | Public identifier (IPv4 addresses on the node's own LAN)                                                                                      |
| **Operator-driven via** | `zflash --lb-pool auto\|<first-ip>-<last-ip>` (device and file-backed), else the installer prompt                                              |
| **ESP carrier**         | `ZETA_LB_POOL='…'` appended to `/zeta-firstboot.conf` (exported by `zeta-first-boot.sh`)                                                       |
| **Backed by file**      | `/mnt/etc/zeta/lb-pool` = `<first-ip>-<last-ip>` (written only when SET; symlinked to `/etc/zeta/` for `--impure` eval)                         |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-lb-pool.nix` (k3s servers only)                                                                       |
| **Reaches the cluster** | the k3s auto-deploy roster, as the ArgoCD Application `cilium-lb-ipam-pool` (kustomize base `k8s/lb-ipam/` carries **no** address; inline patch) |
| **Validation**          | `src/Core.TypeScript/installer/lan-config.ts`; shell twin `ZETA-LB-POOL` block in `zeta-install.sh` (parity-tested); shape + pod/service overlap re-asserted in Nix |

**Resolution order** (`zeta_lb_pool_resolve`): **(1)** the ESP value (`auto` or a range) when it
validates **against the LAN the installer measured** → **(2)** otherwise ask, offering `.240–.250`
of the node's /24 _only on an explicit `y`_ → **(3)** otherwise **UNSET, loudly**. A range is refused
if it is outside the node's subnet, includes the network/broadcast address, the node itself or the
gateway, overlaps the cluster's derived pod/service CIDR or the `10.88.0.0/24` segment, spans more
than 256 addresses, **or any of its addresses already answers a ping**. An ESP value that fails any of
these **refuses the install before the wipe** when nobody can be asked (at a console it is re-asked).
A joiner never asks and never applies one: the range is the founder's.

**UNSET (visible, not a placeholder).** No pool exists; Services of type LoadBalancer stay
`<pending>`; the installer's prompt output and completion banner both say exactly that and how to fix
it (`/etc/zeta/lb-pool` + `nixos-rebuild switch --impure`).

**The collision check (row 4).** Before the wipe the installer compares every network the node can
already route to with the cluster's derived pod `/17`, service `/19` and the inter-node segment, and
**refuses** on overlap (`ZETA_ALLOW_CIDR_OVERLAP=1` overrides, and is named in the refusal). It is
detection, not injection, because the Cilium CIDRs live in git (see `cluster-identity.json`). The ISO
ships `/etc/zeta-cluster-identity.json` so the pre-wipe check knows the cluster name; after the clone
the check repeats against the cloned tree's own copy.

**GitLab follows the range** (inventory row 6). `applications/gitlab/Application.yaml` holds no real
address: its three LAN-address leaves (`global.hosts.gitlab.name`, `global.hosts.registry.name`,
`global.zeta.lanAddress`) carry the RFC 5737 documentation sentinel `192.0.2.250`, and the `gitlab-lan`
Gateway is created by the PostSync hook Job `gitlab-exposure`, which READS `global.zeta.lanAddress` from the LIVE
Application (the release does not render it: an operation started before the pin lands would wait on it for ever). With a range resolved, Job
`gitlab-lan-address` merge-patches those three leaves to the range's LAST address (LB-IPAM allocates
lowest-first, so the pin does not race automatic allocations); `zeta-root` ignores exactly those
paths. It writes `valuesObject` leaves while `gitlab-public-hosts` writes `parameters`, so the two
Jobs cannot clobber each other, and with a public domain also set its helm parameters outrank these
hosts values. UNSET keeps the sentinel: the hook creates no `gitlab-lan` Gateway (GitLab stays reachable in-cluster), and the
advertised host is an address no network can route.

**Not verified here:** nothing in §11 has been booted (no nix, no QEMU); see
`docs/ops/INSTALL-TIME-CONFIG.md` "Not verified".

### 12. Storage profile (docs/ops/INSTALL-TIME-CONFIG.md row 29)

The Longhorn PVC sizes used to be whatever the committed tree said — the `measured` rung of
`k8s/storage-profiles.json`, 943 GiB declared. A box whose pool could not hold it was **refused at
install** (a hard stop on an ordinary single-1-TB-disk machine: 607 GiB schedulable against 943). The
installer now measures the pool it provisions and installs the **largest profile that fits**, through
the **same mechanism as §10/§11** — and over the **same ladder**, not a fourth one.

| Property                | Value                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | (1) flash time → ESP conf (optional), or (2) automatic: Step 2.8, after the pool is measured and **before** the wipe                                                  |
| **Content class**       | Public identifier (a rung name from the catalogue)                                                                                                                     |
| **Operator-driven via** | `zflash --storage-profile auto\|minimal\|standard\|measured\|large` (device, Windows and file-backed), or `ZETA_STORAGE_PROFILE=<name>` in the environment; default `auto` |
| **ESP carrier**         | `ZETA_STORAGE_PROFILE='…'` appended to `/zeta-firstboot.conf` (exported by `zeta-first-boot.sh`)                                                                       |
| **Backed by file**      | `/mnt/etc/zeta/storage-profile` = one rung name (written **only** for a rung that differs from the committed one; symlinked to `/etc/zeta/` for `--impure` eval)         |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-storage-profile.nix` (k3s servers only)                                                                                         |
| **Reaches the cluster** | the k3s auto-deploy roster, as the ArgoCD Application `zeta-storage-profile` (kustomize base `k8s/storage-profile/` carries **no** profile; inline patch) whose per-Application Jobs merge-patch the git-owned Applications' size leaves; `zeta-root` ignores exactly those leaves |
| **Validation**          | `src/Core.TypeScript/installer/storage-profile-selection.ts`; shell twin `ZETA-STORAGE-PROFILE` block in `zeta-install.sh` (parity-tested); the ladder is **generated** from the catalogue |

**Selection** (`zeta_storage_profile_decide`): `auto` picks the largest rung whose demand ≤ the pool's
schedulable GiB; it **refuses only when even `minimal` does not fit**, listing the three existing
remedies. A named profile is forced (and refused before the wipe if the pool cannot hold it); a name
that is not a rung is refused, never read as `auto`. On the owner's numbers (607 GiB schedulable, 943
declared) it installs `standard` (571 GiB) and says what that changes: `ollama/models` and
`vllm/hf-cache` 200Gi→48Gi. **Never shrinks:** an install that recognises a prior one never goes below
the profile that install ran, and the node-side module ratchets
(`/var/lib/zeta/storage-profile-high-water`).

**Not verified here:** nothing in §12 has been booted; see `docs/ops/INSTALL-TIME-CONFIG.md` row 29 and
"Not verified".

### 13. Container-store disk (docs/ops/INSTALL-TIME-CONFIG.md row 35, 081M44HD9T2087G0R000G9NR1N)

k3s's container store (`/var/lib/rancher/k3s/agent/containerd`: images, snapshots) used to live on the root
filesystem the installer sizes at a computed 120 GiB floor — 48 GiB of it on the measured node, on a root the
kubelet evicts pods from, while the data disks beside it were 88% free. It is now **bound onto a data disk
before k3s starts, and k3s refuses to start without that mount**. Not a zflash option: the installer measures
the disks it just mounted and decides.

| Property                | Value                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | automatic: Step 6.64d, after Step 5 has mounted `/mnt/var/lib/longhorn-disk{1..N}`                                                                          |
| **Content class**       | Public identifier (a mount-point path)                                                                                                                      |
| **Backed by file**      | `/mnt/etc/zeta/containerd-data-disk` = one mount point, e.g. `/var/lib/longhorn-disk2` (written **only** when a disk of >= 200 GiB exists; symlinked to `/etc/zeta/`) |
| **Choice**              | `zeta_containerd_disk_pick`: the **largest** mounted `/var/lib/longhorn-disk*`, ties to the lowest number, at least `ZETA_CONTAINERD_MIN_GIB` (200). Below it: nothing written, the store stays on root |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/containerd-on-data-disk.nix` (every role: a joiner's k3s agent has a containerd too); option `zeta.containerdStore.dataDisk`   |
| **Reaches the node**    | a `systemd.mounts` bind `<disk>/containerd` → the store path; `k3s.service` `Requires=` it, has `RequiresMountsFor=` it, and its first `ExecStartPre` asserts it (`containerd-store.sh`) |
| **Failure mode**        | **fail closed**: a missing disk / directory / wrong source keeps k3s down (silent fallback would re-pull every image onto root). Absent file = module inert    |
| **Validation**          | evaluation asserts the disk is a declared `fileSystems` entry (a plain directory would keep the store on root); `lint-containerd-store.test.ts` executes the script; flake check `containerd-on-data-disk-eval` resolves the shipping host |

Adding it after install: write the mount point to `/etc/zeta/containerd-data-disk` and `nixos-rebuild switch --impure` **only
on a node whose store is still empty** — on a populated one the prepare unit **refuses** (a mount would hide the 48 GiB), and
the copy-first path is `docs/ops/CONTAINERD-ON-BIG-DISK.md`.

**Not verified here:** nothing in §13 has been booted; the eval and the script are tested, the systemd ordering on a real boot is not.

## Operator-driven `zflash` flag inventory (current)

Allowlist from `zflash.ts`:

```text
--help / -h          show usage + exit
--ssh-key <path>     override SSH pubkey injected to ESP
                     (default: ~/.ssh/id_ed25519.pub)
--no-inject          skip SSH pubkey injection entirely
--host <name>        inject RFC1123 hostname to ESP as zeta-hostname.txt
--skip-freshness-check
                     bypass main-vs-local divergence check
                     (NOT recommended — surfaces silent flash-without-inject hazard)
--skip-iso-pull      use the existing newest ~/Downloads/zeta-installer-*.iso
                     instead of pulling latest CI artifact
--agent              authorized-agent mode (auto-types `yes <nonce>` challenge;
                     operator's Touch ID still gates the dd)
--acme-email <addr>  public TLS (§10): Let's Encrypt contact → ZETA_ACME_EMAIL in
                     /zeta-firstboot.conf; requires --public-domain
--public-domain <d>  public TLS (§10): base domain; portal.<d> is published →
                     ZETA_PUBLIC_DOMAIN. Both omitted: the installer asks at the
                     start of the install. RFC 2606 names refused.
--lb-pool <v>        LoadBalancer range (§11): `auto` (.240-.250 of the node's /24) or
                     <first-ip>-<last-ip> → ZETA_LB_POOL. Omitted: the installer asks;
                     nobody there → UNSET, loudly. Checked against the LAN at install.
--storage-profile <v>
                     storage profile (§12): `auto` (default — the installer picks the largest
                     profile that fits the Longhorn pool it measures) or one of minimal, standard,
                     measured, large → ZETA_STORAGE_PROFILE. Refused only when even `minimal` does
                     not fit. Never shrinks a profile an existing install already runs.
--console-password <v>
                     console password when none is typed at the installer (§3):
                     `default` (the PUBLIC zeta-change-me, loud banner; also what omitting
                     this means) or `mint` (random one-time password) →
                     ZETA_CONSOLE_PASSWORD_POLICY. A typed password always wins.
```

## In-flight injection points (substrate-engineering targets — not yet shipped)

### 7. Encrypted cred-blob on USB ESP (081KSKBP80008QG0R003AX2A69 Phase 1, in-flight)

| Property                           | Value                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                          | Cluster console at install time → encrypted blob persisted to USB ESP after successful auth (post-install service trigger)                                                                                                                                          |
| **Content class**                  | **Secret material** (encrypted-at-rest; key never hits disk)                                                                                                                                                                                                        |
| **Operator-driven via**            | Boot-sequence auth-method picker (4 options: restore-from-blob / fresh-device-flow / operator-PAT / skip) + operator passphrase                                                                                                                                     |
| **Encryption**                     | AES-256-GCM; key derived via 2-layer scrypt → HKDF chain (full mechanism + parameters below)                                                                                                                                                                        |
| **ESP filenames**                  | `/esp/zeta-creds.enc` (encrypted) + `/esp/zeta-creds-manifest.yaml` (declarative + operator-readable)                                                                                                                                                               |
| **Backlog**                        | [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) (P1, open, M-effort)              |
| **Covers credentials**             | per declarative manifest: `gh-cli` (`~/.config/gh/hosts.yml`), `claude` (per-persona), `gemini` (per-persona), `codex` (per-persona), `ssh-host-keys`, `ssh-operator-pubkey`                                                                                        |
| **Constitutional-rail compliance** | Secret material; encrypted-at-rest on ESP IS allowed because the operator-passphrase + USB-UUID binding means the ESP-stored blob is useless without operator presence — the consent floor stays at operator-typed passphrase, not at USB-physical possession alone |

#### KDF chain detail (mechanism + parameters)

The 32-byte AES-256-GCM key is derived in two layers; full implementation in `tools/installer/zeta-creds-crypto.ts` (the `deriveKey` function + the `SCRYPT_*` + `KEY_LEN` + `SALT_LEN` + `HKDF_INFO` constants declared near the top of the file).

**Layer 1 — scrypt** (memory-hard work-factor KDF):

```text
stretched = scrypt(passphrase, salt, length=32, N=2^17, r=8, p=1, maxmem=256MB)
```

scrypt does NOT increase the underlying entropy of the operator passphrase (a weak passphrase remains weak in information-theoretic terms). What scrypt provides is a tunable **work-factor cost** per guess: with the parameters below, each candidate passphrase requires ~128MB of memory and (empirically per `zeta-creds-crypto.ts` Layer 1 source comments, on the maintainer's modern CPU at parameter-selection time) ~1-2 seconds of CPU per derivation. This makes brute-force attacks memory-prohibitively expensive on GPU/ASIC (per the 2026-05-27 security-review HIGH finding documented in the source: HKDF alone assumes high-entropy IKM, which user-typed passphrases violate; scrypt is the layer that makes the IKM cryptographically suitable for HKDF input).

Parameter selection: `N=2^17`, `r=8`, `p=1` — per [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) recommended scrypt parameters (current at parameter-selection time 2026-05-27; bump procedure: visit the cheat sheet at next security-review cadence, update both the cheat-sheet-citation date here AND the `SCRYPT_N`/`SCRYPT_R`/`SCRYPT_P` constants in `zeta-creds-crypto.ts`). Per-machine operational cost will vary with CPU + memory bandwidth; the ~1-2s figure is anchored to the source-code comment's empirical timing context.

**Layer 2 — HKDF-SHA256** (binds key to USB UUID):

```text
ikm  = concat(usbUuid_utf8, "|", stretched)
key  = HKDF-SHA256(ikm, salt, info="zeta-b0852-cred-persistence-v1", length=32)
```

HKDF binds the stretched secret to the USB UUID via IKM concatenation. Wrong USB → different IKM → different HKDF output → AES-GCM auth tag verification fails → structured error returned (not garbled plaintext). Defends against copy-blob-to-different-USB attack (operator-named threat 2026-05-27: _"we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid"_).

Both layers must reproduce identically at decrypt time for the AES-GCM auth tag to verify; salt is per-blob (generated at encrypt time; stored in envelope; required at decrypt).

### 8. GitHub-creds-at-flash-time variants (081KSKBP80008QG0R003AX2A69 picker options 1 + 3)

Per operator 2026-05-27 verbatim: _"the current ones on my machine OR a token i generate on the website."_

Maps directly to 081KSKBP80008QG0R003AX2A69 Sub-target 2 (boot-sequence auth-method picker):

| Picker option                                 | Operator-driven via                                                                | Credential source                                                                                                    | Constitutional-rail compliance                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Option 1: Restore from encrypted USB blob** | Operator passphrase at boot picker prompt; default when blob present               | Previously-persisted operator Mac `~/.config/gh/hosts.yml` (encrypted into the blob on prior boot's successful auth) | Encrypted-at-rest; operator-passphrase-derived key |
| **Option 2: Fresh device-flow login**         | Operator visits github.com on phone/browser to enter device code                   | gh CLI device-flow (current behavior; uses gh-CLI quota)                                                             | Operator-driven directly; no transit issue         |
| **Option 3: Operator-provided PAT**           | Operator pastes fine-grained PAT at prompt (created at github.com/settings/tokens) | Operator-typed at cluster console                                                                                    | Typed once; same rail as initial-password          |
| **Option 4: Skip**                            | Operator presses Enter at picker                                                   | (no GitHub-side substrate)                                                                                           | Cluster operates degraded; no inject               |

## Architectural-principle layer — USB self-healing direction on reformat (operator 2026-05-27)

Operator 2026-05-27 verbatim:

> _"this makes the usb move in the self healing instead of full wipe direction on reformat"_

Substrate-engineering principle: when 081KSKBP80008QG0R003AX2A69 lands, **the DEFAULT behavior on USB reformat = preserve previous keys + choices** (081KSKBP80008QG0R00146WEX1's reformat-with-current-keys mode). Full-wipe (new-keys + new-decisions) becomes the OPT-IN path, not the default.

Three-mode reformat substrate (per [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md)):

| Mode                                          | What it does                                                                                         | Default?                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **1. Boot off USB again (fix mode)**          | Substrate diagnoses + repairs broken state on cluster machines                                       | Always available                            |
| **2. Reformat with current keys + decisions** | Wipe cluster machine; reflash from USB; restore previously-persisted creds + architectural decisions | **DEFAULT post-081KSKBP80008QG0R003AX2A69** |
| **3. Full reflash with new decisions + keys** | Wipe cluster machine; reflash from USB; generate new creds + start fresh architectural state         | Opt-in (fresh-identity case)                |

This direction-of-default matters because:

- **AI worry-about-mistakes dissolves** when reformat preserves identity (per 081KSKBP80008QG0R00146WEX1 operational-freedom mechanism)
- **Operator re-flash workflow becomes lower-friction** (the common case = preserve; the rare case = wipe)
- **Cred-leak / identity-corruption recovery stays available** via mode 3 opt-in (not default)
- **Self-healing direction composes with operator's persistent-recovery vision**: 3-machine quorum + remote-KVM + remote-power-button-press (per 081KSKBP80008QG0R00146WEX1) means substrate survives as long as ONE of {any cluster machine, the USB, operator's re-flash ability} survives

Operator's substrate-honest acknowledgment 2026-05-27: _"i know you can't preserve what i have now but for the next time would be cool"_ — current ISO (`fd0ca0c8b` 25.11 Xantusia) doesn't yet ship 081KSKBP80008QG0R003AX2A69; this catalog tracks the direction for when it does. Today's flash IS full-wipe-default (because mode 2 doesn't exist yet); next flash post-081KSKBP80008QG0R003AX2A69 IS preserve-default.

## Related in-flight backlog (composes with this catalog)

- [081KSGS9H0008QG0R003JNSVR5](../docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md) — installer interactive-login vs baked-in keys tension
- [081KSGS9H0008QG0R00120EEHM](../docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md) — installer-config-bugs RCA (gh-auth not respected, banner password disclosure, etc.)
- [081KSGS9H0008QG0R001EZKNCB](../docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md) — zflash `--agent` flag native implementation
- [081KSGS9H0008QG0R002T0XQ50](../docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) — each AI gets own GitHub identity (per-persona attribution)
- [081KSGS9H0008QG0R001JNKBFD](../docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-node-local-claude-agent-stewards-own-registration-pr-then-reports-k8s-cluster-status-operator-interactive-login-pattern-aaron-2026-05-26.md) — node-local Claude agent stewards own registration PR
- [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) — credential persistence on USB ESP + boot-sequence auth-method picker (the active substrate this catalog cross-references for in-flight rows 5 + 6 above)
- [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md) — post-boot AI as home-owner; 3-mode USB-boot recovery substrate (fix / reformat-with-current-keys / full-reflash); operational-freedom mechanism; AI-worry-about-mistakes dissolves

## In-cluster catalog Secrets — who mints them on metal vs dev (WP14, 081M343EEP8087G0R000BAF6QF)

Everything above is USB-ESP / flash-time injection. This section is the OTHER
half: Secrets the AUTO-SYNCED ArgoCD catalog (`k8s/applications/`) references
by name (`existingSecret`, `secretKeyRef`, `envFrom`, `imagePullSecrets`) but
does not create itself — the class `audit-existing-secret-is-minted.ts`
watches for the dev/CI lane. `first-boot-replica.ts` run 35700790207 (real
NixOS k3s roster in Docker, ArgoCD syncing the dev rung) found
`CreateContainerConfigError` for hindsight, loki, mimir and opensearch, all
traced to this gap.

The split that matters: **INTERNAL** (a random credential used only BETWEEN
in-cluster components — nothing outside the cluster ever needs to know it) vs
**EXTERNAL** (operator-supplied — a real third-party credential this cluster
cannot generate for itself). INTERNAL + nobody-mints-it-on-metal is a
first-boot defect; EXTERNAL + nobody-mints-it-on-metal is an operator gap, not
a bug, and MUST NOT be papered over with a randomly-generated value.

| Secret                         | Namespace(s)                             | Class        | Mints on metal                                                                                  | Mints in dev/CI                                            |
| ------------------------------- | ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `grafana-admin-credentials`     | `monitoring`                              | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml` (Job, create-if-absent)                              | `DEV_GRAFANA_ADMIN_SECRET` (`dev-cluster/lib.ts`)            |
| `ziti-admin-credentials`        | `openziti`                                | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml`                                                      | `DEV_ZITI_ADMIN_SECRET`                                      |
| `opensearch-admin-credentials`  | `opensearch`                              | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml`                                                      | `DEV_OPENSEARCH_ADMIN_SECRET`                                |
| `forgejo-initial-admin`         | `forgejo`                                 | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml`                                                      | `DEV_FORGEJO_ADMIN_SECRET`                                   |
| `gitlab-initial-root-password`  | `gitlab`                                  | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml` (WP24, 081M35K4PV6087G0R001Z3E0P8)                    | `DEV_GITLAB_ROOT_SECRET`                                     |
| `zeta-blob-store`               | `object-store`, `loki`, `mimir`, `gitlab` | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml` (ONE value, four namespaces, one pod)                 | `DEV_BLOB_STORE_SECRET`                                      |
| `postgres-backup-s3`            | `postgres-shared`, `temporal`             | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml` (the SAME pod as `zeta-blob-store`, a SEPARATE draw: a bucket-scoped `pgBackup` SeaweedFS identity, not the admin key) | none — both consumers are dev-excluded (`postgres-shared/**`, `temporal/**`) |
| `redis-auth`                    | `redis`, `orleans`                        | INTERNAL     | `k8s/bootstrap/internal-secret-seeding.yaml` (ONE value, two namespaces, one pod)                  | `DEV_REDIS_AUTH_SECRET`                                      |
| `hindsight-llm-api-key`         | `hindsight`                               | **EXTERNAL** | **NOBODY — see below.** A real Groq API key; this cluster cannot draw one for itself.              | `DEV_HINDSIGHT_LLM_SECRET` (placeholder value; boot-check only, no LLM call succeeds) |
| `ghcr-pull` (`imagePullSecrets`) | `zeta-platform`                           | **EXTERNAL** | **NOBODY — already tracked above** ("GHCR pull token" row, 081M33TN49G087G0R000X5ZJ75)             | `DEV_GHCR_PULL_SECRET` (from a CI-held token)                |
| `arc-github-app` (`githubConfigSecret`) | `arc-runners`                     | **EXTERNAL** | **NOBODY.** A real GitHub App id/installation id/private key; `arc-runner-set/Application.yaml`'s own header says so ("Materialised by external-secrets from Vault"). Acknowledged in `existing-secret-is-minted.baseline.json` (`arc-runner-set\|arc-github-app`) — `arc-runner-set` is also in `DEV_EXCLUDED_REASONS`, so no pod in the dev lane ever resolves the name. | none — operator/Vault-provisioned on metal, never minted in dev/CI |

### The six INTERNAL rows above were the first-boot defect; five fixed by WP14, `gitlab-initial-root-password` by WP24

Before WP14, nothing on a real USB/metal install minted any of the first five
INTERNAL credentials — matching this repo's own `existing-secret-is-minted.baseline.json`
`orleans|redis-auth` entry ("redis's OWN Application.yaml has the identical
unminted reference … metal: Sealed Secret / Vault") and the `redis` chart
comment ("create via Sealed Secret / Vault") that named the intent without
ever shipping the mechanism. `gitlab-initial-root-password` was a SIXTH such
gap that WP14/WP16's own accounting missed for a mechanical reason: the
reference (`global.initialRootPassword.secret`, a bare `secret:` leaf) was
INVISIBLE to `audit-existing-secret-is-minted.ts` until WP24 widened that
script's detection — see the workitem for the full trace, including why this
tree seeds the Secret itself rather than relying on the GitLab chart's own
`shared-secrets` pre-install hook (broader `get`/`list`/`create`/`patch` RBAC
than every sibling credential in this class uses).

`k8s/bootstrap/internal-secret-seeding.yaml` is a k3s first-boot manifest
(`nixos/modules/k3s-server.nix`'s `services.k3s.manifests` roster — the SAME
mechanism `openziti-namespace.yaml` and the other `*-install.yaml` bootstrap
files already use), applied BEFORE ArgoCD exists. It mints exactly these seven
credentials, per-namespace RBAC-scoped (`create` on `secrets` only, nothing
else), `kubectl create` (never `apply`/`replace`, so an existing Secret is
never overwritten). Key shapes are cross-checked against `dev-cluster/lib.ts`'s
`DEV_BOOTSTRAP_SECRETS` / `DEV_SHARED_SECRETS` by
`internal-secret-seeding.test.ts` so the two cannot silently drift apart.

**Randomness (hardened WP16, 081M349QTRM087G0R001HM7ESM):** each Job's FIRST
step is a `draw-entropy` initContainer (`busybox`, pinned by tag AND digest —
the one container here with a shell) that reads `/dev/urandom` and writes the
value ONLY to an in-memory (`emptyDir: {medium: Memory}`, tmpfs) volume shared
with the rest of that pod. The `kubectl` containers
(`docker.io/rancher/kubectl:v1.35.6` — the same shell-less, FROM-scratch image
the spire chart's hooks already pull in the bootstrap roster, so the preload
archive carries one kubectl rather than two; 081M3C10FFX087G0R0033DYXG0) read the secret value
off that file with `--from-file`, never as an argv token or env var. WP14's
original mechanism drew randomness from each Job's own pod UID via the
Kubernetes Downward API, which was weak: a pod UID is readable by anyone with
`get`/`list` on Pods in the namespace and appears in events/audit
logs/`kubectl describe`, and a UUIDv4's ~122 bits come from the apiserver's ID
generator, not a CSPRNG designated for secrets.

### `hindsight-llm-api-key` stays an EXTERNAL gap, on purpose

`hindsight/Application.yaml`'s own header already made this call (Aaron
2026-09-07, "the decision that is not mine to make": ESO on metal + a minted
dev Secret) — the Secret's NAME is shared between metal and dev, but its
PROVENANCE is not, and metal's half (a `ClusterSecretStore` + `ExternalSecret`)
does not exist yet. This is not something WP14 papers over: a randomly-drawn
value here would clear the crash loop and never do the one thing the
credential exists for (an actual LLM call). Isolation check: `hindsight` is
NOT `zeta.io/gates-later-waves` (not in the annotated set anywhere under
`k8s/applications/*/Application.yaml`), so its `CreateContainerConfigError`
today does not block any later sync wave — matching `kube-prometheus-stack`'s
same deliberate non-gating annotation. Lifts when a `ClusterSecretStore` +
`ExternalSecret` land for this namespace; see the Application's own header for
the five layers that still have to exist first.

**While the Secret is absent, hindsight holds ZERO pods** (2026-10-02). With nothing supplying the key, its
api and control-plane pods sat in `CreateContainerConfigError`, and on the real node each one evicted under
DiskPressure was replaced by another (168 `Failed` pod objects from one evening,
[`docs/ops/NODE-DISK-HEADROOM.md`](../docs/ops/NODE-DISK-HEADROOM.md)). `cluster-hygiene`'s
`hindsight-secret-gate` CronJob now scales both Deployments to 0 until `hindsight-llm-api-key` exists and
restores them to their declared replicas the moment it does -- so the operator step is unchanged
(create the Secret; within ~2 minutes the pods come up) and nothing is minted on the operator's behalf.

## Remaining gaps (no backlog row yet — candidates per constitutional rail)

Substrate-engineering targets NOT covered by 081KSKBP80008QG0R003AX2A69 or sibling rows.
Each new credential-type filing should walk the constitutional-rail
decision before authoring: **public identifier → ESP allowed; secret
material → console or post-install secrets management only**.

When 081KSKBP80008QG0R003AX2A69 ships, secret-class additions become MANIFEST EDITS
(declarative; new entry in `/esp/zeta-creds-manifest.yaml`) rather than
new code. Per Aaron 2026-05-27 in 081KSKBP80008QG0R003AX2A69: _"the keep credentials options
we should declare each credential we need and save and restore so it's
not so imparative too."_ Adding a new cred type post-081KSKBP80008QG0R003AX2A69 = one YAML
entry; the persist/restore code reads the manifest + iterates.

| Candidate                                       | Content class | Likely transit (post-081KSKBP80008QG0R003AX2A69)                                       | Notes                                         |
| ----------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| GPG signing key (operator)                      | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | Per constitutional rail                       |
| age key (operator)                              | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | For SOPS / age-encrypted state                |
| K8s join token                                  | Secret        | Cluster console at install time OR auto-generated on bootstrap                         | Per constitutional rail                       |
| ArgoCD admin initial password                   | Secret        | Cluster console at install time                                                        | Per constitutional rail                       |
| Cosign signing key (cluster-issued)             | Secret        | Post-install secrets mgmt                                                              | For artifact signing                          |
| Cluster TLS root CA                             | Secret        | Post-install secrets mgmt                                                              | For internal-CA bootstrap                     |
| Tailscale / WireGuard auth key                  | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | For overlay-network bootstrap                 |
| Time-server NTP override                        | Public config | USB ESP at flash time (candidate)                                                      | Cheap; non-secret                             |
| Locale / timezone                               | Public config | USB ESP at flash time (candidate)                                                      | Cheap; non-secret                             |
| Per-node disk role hints                        | Public config | USB ESP at flash time (candidate)                                                      | Currently in flake per-host config            |
| **GHCR pull token (`zeta-platform/ghcr-pull`)** | **Secret**    | **Cluster console at install time, OR retired entirely by making the packages public** | **Live blocker, not a candidate — see below** |

### The GHCR pull token is the first entry here that is BLOCKING something today

> **STATUS 2026-10-01 -- NO LONGER BLOCKING; the exit below was taken.** An ANONYMOUS
> pull (a token-less `ghcr.io/token` exchange, then a manifest GET on `:latest`) returns
> **HTTP 200** for `zeta-platform-controller`, `zeta-portal` and `zeta-orleans-silo` --
> and `k8s/image-source-provenance.json` has recorded all three as `artifact: public`
> since 2026-09-22. So the platform pods do not take `ImagePullBackOff` on metal, the
> missing `zeta-platform/ghcr-pull` Secret is a kubelet warning and not a failure (an
> absent `imagePullSecrets` entry is skipped and the pull proceeds anonymously), and the
> `imagePullSecrets` reference in `platform/controller.yaml` and `platform/portal.yaml` is
> INERT, exactly as the last paragraph of this section predicted. What remains true:
> the row stays an inventory entry for a cluster whose packages are made private again,
> and `hat-system-operator:placeholder` is the one referenced GHCR image that still
> answers 401 (it is `replicas: 0`, so nothing pulls it). The text below is kept as the
> record of the 2026-08-22 measurement, not as the current state. **Not verified:** a
> metal node pulling these images -- this is a registry-side measurement, not a cluster run.

Every other row above is a target. This one names why the metal platform control
plane has never started, and it is recorded here because the constitutional rail
already decides how it would have to arrive.

**Measured 2026-08-22.** `ghcr.io/lucent-financial-group/zeta-platform-controller`
and `.../zeta-portal` are both `visibility: private` (36 published versions each,
built by `.github/workflows/build-platform-images.yml`). An anonymous manifest GET
returns HTTP 401; a credentialed one returns 200. The pods therefore take
`ImagePullBackOff` on **every** substrate, and ArgoCD reports that as
`Progressing` rather than `Degraded`, so nothing ever went red about it.

**The dev/CI half is now wired** — `applyDevRegistryPullSecret` mints
`zeta-platform/ghcr-pull` at bring-up from a token in the environment, and both
pod specs reference it. CI can do this because a workflow already holds a token.

**Metal cannot**, and that is the finding worth stating plainly against the
standing goal that hardware comes up with no manual step:

> A registry pull token is **secret material** under the rail at the top of this
> file, so its only sanctioned transit is **operator-typed at the cluster console
> at install time** (or, later, the encrypted cred-blob of
> 081KSKBP80008QG0R003AX2A69). There is no path by which an unattended node
> obtains it. **So as long as these packages are private, unattended metal
> bring-up of `platform` is not achievable** — not for want of automation, but
> because the node has no way to hold a credential nobody gave it.

**The exit that removes the requirement rather than satisfying it** is making the
two packages public, after which `imagePullSecrets` becomes inert and metal needs
no credential at all. That is a **disclosure decision and it is the maintainer's
alone** — it is recorded here as the alternative, not advocated. The two options
are genuinely different trades: operator-typed keeps the images closed and costs a
manual step per cluster; public costs disclosure and buys unattended bring-up.

## Source-of-truth pointers

- `src/Core.TypeScript/zflash/cli.ts` — flash-time orchestrator + USB ESP injection
- `src/Core.TypeScript/zflash/lib.ts` — pure logic (hostname regex; ESP partition detection)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — installer-side injection probes + console prompts
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` — first-boot console prompts (WiFi)
- `full-ai-cluster/nixos/modules/injected-hostname.nix` — hostname reader
- `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` — SSH pubkey reader
- `full-ai-cluster/nixos/modules/operator-authorized-keys.nix` — sibling SSH authorized_keys reader
- `full-ai-cluster/nixos/modules/initial-password.nix` — password hash reader

## Substrate-engineering composition

- 081KSGS9H0008QG0R002T3BJ2R (iter-4.2 SSH pubkey injection)
- 081KSGS9H0008QG0R003V23XNZ (iter-5.2 hostname injection)
- 081KSGS9H0008QG0R00120EEHM (initial-password runtime activation fix)
- 081KSKBP80008QG0R0039RW25E (streams-are-relationships substrate — each injection-point pipeline is a tiny typed function per the distribute-across-tiny-functions architectural principle)

## Composes with rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — secret-class material requires operator-typed consent at the cluster console; ESP-transit for non-public secrets would violate HC-8 floor
- `.claude/rules/glass-halo-bidirectional.md` — each injection mechanism is type-visible; operator can inspect every path
- `.claude/rules/honor-those-that-came-before.md` — iter-4.2 / 5.2 / 5.3 substrate preserved + named in catalog
- `.claude/rules/verify-existing-substrate-before-authoring.md` — this catalog is the substrate-inventory pass for future credential-type additions
