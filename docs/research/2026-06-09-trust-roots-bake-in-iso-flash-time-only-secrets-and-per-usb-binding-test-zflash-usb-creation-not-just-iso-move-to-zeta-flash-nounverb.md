# Now that pubkeys are checked in: trust ROOTS bake into the ISO; flash-time only embeds SECRETS + the per-USB binding — and test zflash USB-*creation* (not just ISO), move it to a `zeta flash` noun-verb

*Captured 2026-06-09 from Aaron's questions. Registers: [architecture answer], [grounded], [testing-scope gap],
[build front].*

## The questions (Aaron)

1. *"You need to **test zflash** — testing the ISO is great but **testing the ISO does not test creating the USB**;
   we need to do that too."*
2. *"Move it into our common **verbs/nouns** (the `iso`/`usb` CLI)."*
3. *"Now that we're checking in pub trust keys — can we put **everything needed in the ISO**, or does flash-usb still
   need to **embed stuff based on the human who ran it + their GitHub account**? Do we need to **capture any trust at
   USB-flash time** and write it to the USB, or can **all trust roots be baked in the ISO**?"*

## The answer — what goes where (the layer model, post-checked-in-pubkeys)

| Layer | What it carries | Public? | Why |
|---|---|---|---|
| **ISO (baked from repo)** | **ALL trust ROOTS** — `operator-ssh-keys.txt`, `maintainers/*/ssh-pubkeys.txt`, GPG pubkeys; **+** the trust-resolution logic + the boot-time owner-fetch unit + the install/cancel-window logic | **public/shared** | the ISO is built from the repo, so every **checked-in public key** is already in it. **Trust roots are public — they belong in the ISO.** |
| **Flash-time (post-ISO, per-USB)** | **SECRETS only** — the encrypted creds blob (wifi, gh **token**, passphrase-bound) **+** the per-USB **binding** (the stable hardware key / USB-iSerial for the KDF) | **NOT public** | secrets **cannot** live in a public shared ISO; the per-USB binding is instance-specific |
| **Boot (dynamic)** | **repo-owner `<owner>.keys`** fetch | n/a | ownership changes **without reflash** |

**So: can all trust roots be baked in the ISO? — YES.** Now that operator/maintainer pubkeys are checked in
(#7249/#7250/#7261), the **flash-time embed of "the human who ran it + their GitHub key" is no longer needed for
trust** — that key, *if checked in* to `maintainers/<them>/`, is **already in the ISO**. Flash-time stops being a
trust-root step.

**Does flash-time still need to capture/write anything? — only three things, none of them trust roots:**

1. **Secrets** — the encrypted creds blob (wifi + gh token), which can't be in a public ISO.
2. **Per-USB binding** — the stable hardware key the creds KDF binds to (the iSerial rebind).
3. **Fallback only:** an operator key that **isn't** checked in (a one-off contributor who hasn't added their
   `maintainers/<them>/ssh-pubkeys.txt`) — the old flash-embed path, now a fallback, not the norm. The clean path is
   **check your key in → it's in the ISO.**

This is the simplification Aaron's "check in the pubkeys" enables: **ISO = all public trust + logic; flash = only
the private/per-instance bits; boot = the dynamic owner keys.** No per-flasher trust embedding on the happy path.

## The testing-scope gap — test zflash USB-*creation*, not just ISO boot

Today the QEMU harness boots a **pre-built ISO** (`qemu-boot-test.ts`). That does **not** exercise **zflash creating
the USB** — the `dd` write, the ESP inject (creds/secrets), the per-USB binding. To close the gap, the QEMU test
must also:

1. Run **zflash against a virtual block device** (a raw/qcow2 image standing in for the USB) — exercises the
   create-USB path (`dd` + ESP write + cred-bake), `--test`-scoped.
2. **Assert the ESP content** on the virtual USB (keys present per the ISO-bake model; the encrypted creds blob
   written; the binding).
3. **Boot that virtual USB** in QEMU and assert (trust resolves, creds restore, headless cancel-window).

That's the full surface: **create-USB → flash content → boot → assert**, not just "boot a given ISO."

## Move it to a `zeta flash` noun-verb (Aaron #2)

Fold zflash into the noun-verb CLI (`zeta flash …` / the `iso`·`usb` nouns) — the #7230/#7253 wrapper front. Closing
over the *invocation* (one verb) composes with closing over the *trust* (ISO-baked) and the *creation* (the tested
flash path).

## Honest scope

[architecture answer]: trust ROOTS bake in the ISO (public, checked-in pubkeys); flash-time embeds only SECRETS
(creds: wifi/token) + the per-USB binding; boot fetches dynamic owner keys; the per-flasher key-embed is now a
fallback (check your key in instead). [grounded]: pubkeys checked in (#7249/#7250/#7261); creds blob + USB-UUID
binding in `zeta-install.sh`/`zeta-creds-*`; #7251 trust model. [testing gap]: the harness boots an ISO but does
**not** test zflash USB-creation — add create-USB→assert-ESP→boot to the QEMU plan (Otto's half). [build front]:
`zeta flash` noun-verb (#7230/#7253). No code shipped; answers the layering question + expands the test scope.

## Pointers

- Trust: #7251 (model) · #7249/#7250/#7261 (checked-in ssh+gpg pubkeys) · `operator-ssh-keys.txt` ·
  `maintainers/*/ssh-pubkeys.txt`. Secrets/binding: `zeta-creds-*` + the iSerial-rebind (#remember-creds root-cause).
- Testing: `tools/ci/qemu-boot-test.ts` / `qemu-full-install-test.ts` · the test-infra key `--test` path (#7254/#7259)
  · 081KSNY2Z0008QG0R0008PN7RQ harness. Wrapper: `zeta flash` (#7230/#7253). gh-token half (#7263).
