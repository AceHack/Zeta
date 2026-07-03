# The gh-auth surface: two paths, closed over by both halves — Otto tests the token (headless) path in QEMU, Aaron tests interactive device-login; + the AI-creates-token-and-saves-as-secret CYOA

*Captured 2026-06-09 from Aaron, correcting Otto's mis-split ("test everything except gh"). The truth: **only gh
*interactive device-login* is Aaron's half; the gh *token* path is Otto's half** — and together they close over the
full gh-auth surface. Plus a choose-your-own-adventure where the **AI creates a token and saves it as a secret**.
Registers: [correction — Aaron], [division of labor], [design — CYOA].*

## The statement

Aaron: *"I didn't say test everything except gh — I said gh **interactive login**. We can allow for **gh tokens with
minimal auth** needed at first. We can have a **choose-your-own-adventure on how to have AI create [a token] for you
and save as secret** — if you fork, or for me / Addison / Max, or future contributors if we forget. **You can test
the gh-token way and I'll test the gh-interactive-device-login way — full surface gets closed over. We each do our
half.**"*

## The two paths — who tests which

| gh-auth path | Screen needed? | Who tests | How |
|---|---|---|---|
| **Interactive device-login** (`gh auth login`, device-flow shows a code at github.com/login/device) | **Yes** (a human reads the code) | **Aaron** | by hand |
| **Token** (`gh auth login --with-token`, minimal scope first) | **No** (headless) | **Otto** | **QEMU/CI** — the test-infra path; `ZETA_TEST_INFRA_SSH_KEY` + a test gh token in a secret |

**Both together = the full gh-auth surface closed over.** Neither alone is "all of gh"; the surface is the *union*.

## The CYOA: AI creates a token and saves it as a secret

A choose-your-own-adventure branch (part of the first-run CYOA, #7253) for **how a token gets provisioned**, so
nobody is stuck:

- **For a forker / new contributor:** the AI walks them to create a **minimal-scope** gh token (least privilege —
  `repo` + `admin:public_key` for the ssh-key path, per the DX review) and **saves it as a secret** (repo-scope or a
  `test`/`prod` environment) — the same `gh secret set` mechanism already used for `ZETA_TEST_INFRA_SSH_KEY`.
- **For Aaron / Addison / Max (or any of us who forget):** same flow — AI provisions + stores the token as the
  named secret so future headless boots have it without re-doing interactive login.
- **Honest nuance on "AI creates a token":** `gh` mints classic PATs via the UI/device-flow (interactive), and
  fine-grained PATs are UI-only — so the AI cannot *mint* a brand-new PAT fully headlessly today. What the AI **can**
  do headlessly: (a) use/forward an **existing** authorized token (`gh auth token`), (b) **save** a supplied token as
  a GH secret (`gh secret set`), and (c) guide the human through the *one* interactive mint when a fresh PAT is
  required — i.e., the AI automates everything except the irreducible mint click. So the CYOA = **AI-automates-the-
  save + minimal-scope guidance; the human does the one mint** (or reuses an existing token). The headless boot then
  consumes the secret via `gh auth login --with-token` — Otto's testable half.

## Otto's half — the build/test plan (my commitment)

Test the **gh-token headless path** in QEMU/CI, no human:

1. Bake/restore a **minimal-scope** test gh token (from a GH secret) into the `--test` image's encrypted creds.
2. QEMU-boot the `--test` image; assert `gh auth login --with-token` succeeds headlessly + `gh auth setup-git`
   works + the self-register PR path runs.
3. Cover the **AI-saves-token-as-secret** step (`gh secret set`) + minimal-scope validation.

Aaron tests the interactive device-login half by hand; the union is reported green.

## Honest scope

[correction — Aaron]: only gh *interactive device-login* is Aaron's half; the gh *token* path is **Otto's** to test
(headless, QEMU) — Otto had wrongly excluded all of gh. [division]: interactive device-login = Aaron; token =
Otto; union = full surface closed over; we each do our half. [design]: a CYOA where the AI provisions a
minimal-scope token + saves it as a GH secret (forkers / operators / future contributors), with the honest nuance
that the irreducible PAT *mint* may need one human/UI step; the AI automates the save + the headless consumption. No
code shipped here; corrects the split + specs Otto's testable half.

## Pointers

- First-run CYOA + the install.sh/.ps1 close-over (#7253) · the headless gh `--with-token` DX finding (Bodhi, this
  session — PAT scope `admin:public_key` trap) · the test-infra key + `ZETA_TEST_INFRA_SSH_KEY` secret (#7254/#7259)
  · the trust model (#7251) · `gh auth setup-git` + self-register (`zeta-install.sh`).
