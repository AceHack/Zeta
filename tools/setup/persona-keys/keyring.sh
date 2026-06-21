#!/usr/bin/env bash
# Zeta keyring — one BIP-39 seed phrase -> every key type, type-separated paths.
# SECURITY INVARIANTS:
#   1. The seed phrase is NEVER passed as a command-line argument (ps / shell
#      history would capture it). It is generated in-process, or read with
#      `read -s` (no echo, not added to history) and piped via STDIN.
#   2. Private key material NEVER goes to stdout/history by default. It goes to a
#      sink (Vault or a GitHub secret). The temp file is umask-077 + shred-on-exit.
#   3. Public artifacts (pubkeys / addresses / npub) are safe to publish and are
#      written to maintainers/<name>/ — the GitHub/main human-trust root.
#
# Modes:
#   generate <name>  fresh seed made in-process, seed NOT shown (personas, or the
#                    Otto-runs-the-awkward-bootstrap step for a new maintainer).
#   import   <name>  bring your own seed; typed hidden (read -s). Nothing leaks.
#   rotate   <name>  the NEW-MAINTAINER self-custody step: choose [g]enerate (the
#                    seed is SHOWN once so you write it down — physical-first) or
#                    [i]mport, then re-derive + re-store + re-publish pubkeys.
#
# The onboarding blueprint is GENERATE-THEN-ROTATE (Aaron 2026-06-09): Otto runs
# `generate` (does the hard bits, you're running fast), then you run `rotate` to
# take a seed you pick and hold — which also proves both code paths from the jump.
#
# Sinks:  --vault PATH (equipment/cluster)  |  --gh-secret NAME (github-free)
# Out:    --out DIR (default maintainers/<name>)   Flags: --public-only
#
# Examples:
#   keyring.sh generate otto   --vault zeta/personas/otto          # persona bootstrap
#   keyring.sh generate aaron  --gh-secret ZETA_MAINTAINER_AARON_KEYRING --out maintainers/aaron
#   keyring.sh rotate   aaron  --gh-secret ZETA_MAINTAINER_AARON_KEYRING --out maintainers/aaron
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"

mode="${1:-}"; name="${2:-}"; shift 2 2>/dev/null || true
public_only=""; vault_path=""; out_dir=""; gh_secret=""; gh_repo="Lucent-Financial-Group/Zeta"; publish=""; dry_run=""
while [ $# -gt 0 ]; do case "$1" in
  --public-only) public_only="--public-only";;
  --vault) vault_path="${2:?}"; shift;;
  --gh-secret) gh_secret="${2:?}"; shift;;
  --gh-repo) gh_repo="${2:?}"; shift;;
  --out) out_dir="${2:?}"; shift;;
  --publish) publish="--publish";;
  --dry-run) dry_run="--dry-run";;
  *) echo "unknown arg: $1" >&2; exit 2;;
esac; shift; done

[ -n "$mode" ] && [ -n "$name" ] || { sed -n '2,30p' "$0"; exit 2; }
case "$mode" in generate|import|rotate|onboard) ;; *) echo "mode must be generate|import|rotate|onboard" >&2; exit 2;; esac

command -v bun >/dev/null || { echo "bun required (closed over in install.sh)"; exit 1; }
[ -d "$HERE/node_modules" ] || (cd "$HERE" && bun install >/dev/null)

if [ "$mode" = "onboard" ]; then
  # Reuse-only orchestrator: chains status -> user-keyring(instruction) -> machine-key ->
  # publish(biometric-gated, via publish.ts) -> trust-resolve. It NEVER runs seed-gen (a
  # missing user keyring prints the keyring.sh generate|rotate instruction); the GitHub
  # publish always goes THROUGH publish.ts's biometric gate (no --publish toggle, no bypass).
  extra_args=()
  [ -n "$dry_run" ] && extra_args+=("--dry-run")
  [ -n "$out_dir" ] && extra_args+=("--repo-root" "$out_dir")
  bun "$HERE/onboard-cli.ts" --user "$name" "${extra_args[@]}"
  exit 0
fi

umask 077
tmp="$(mktemp -t zeta-keyring.XXXXXX.json)"
cleanup(){ rm -f "$tmp" 2>/dev/null; (command -v shred >/dev/null && shred -u "$tmp" 2>/dev/null) || true; unset SEED; }
trap cleanup EXIT INT TERM

# Show a freshly-generated seed to the human, physical-first, and require ack.
show_and_confirm_seed() { # $1 = mnemonic ; prints only to stderr (the tty)
  {
    echo
    echo "============================================================"
    echo "  YOUR SEED PHRASE — write it on PAPER now (24 words):"
    echo "============================================================"
    echo
    echo "  $1"
    echo
    echo "  This is the ONLY thing that recovers ALL your keys + funds."
    echo "  * Stamp it on METAL (fireproof/waterproof) — or paper — in 2 safe places."
    echo "  * Do NOT photograph it, screenshot it, or paste it anywhere digital/online."
    echo "  * No one (not even Otto) can recover it for you if lost."
    echo "============================================================"
    printf '  Type SAVED once it is written down: '
  } >&2
  local ack; IFS= read -r ack
  [ "$ack" = "SAVED" ] || { echo "not confirmed (expected SAVED); aborting — nothing stored." >&2; exit 1; }
}

# Produce the keyring JSON into $tmp from the chosen seed source.
case "$mode" in
  generate)
    bun "$HERE/gen.ts" --generate --user "$name" $public_only > "$tmp"
    ;;
  import)
    printf 'Paste %s seed phrase (hidden, never stored/printed): ' "$name" >&2
    IFS= read -rs SEED; echo >&2
    printf '%s' "$SEED" | bun "$HERE/gen.ts" --user "$name" $public_only > "$tmp"; unset SEED
    ;;
  rotate)
    printf '%s: [g]enerate a new seed you will write down, or [i]mport one you already have? [g/i] ' "$name" >&2
    IFS= read -r choice
    case "$choice" in
      g|G)
        SEED="$(bun "$HERE/gen.ts" --emit-mnemonic)"
        show_and_confirm_seed "$SEED"
        printf '%s' "$SEED" | bun "$HERE/gen.ts" --user "$name" $public_only > "$tmp"; unset SEED
        ;;
      i|I)
        printf 'Paste %s seed phrase (hidden): ' "$name" >&2
        IFS= read -rs SEED; echo >&2
        printf '%s' "$SEED" | bun "$HERE/gen.ts" --user "$name" $public_only > "$tmp"; unset SEED
        ;;
      *) echo "expected g or i; aborting." >&2; exit 2;;
    esac
    ;;
esac

# ---- public artifacts -> maintainers/<name>/ (safe to commit; the trust root) ----
# Status: `generate` keys are BOOTSTRAP/test (Otto holds the seed) until the human
# `rotate`s to a self-held seed -> `self-custody`. `import` = self-custody (own seed).
case "$mode" in
  generate) status="bootstrap-test" ;;   # provisional until rotated
  rotate|import) status="self-custody" ;;
esac
dest="${out_dir:-$REPO/maintainers/$name}"
mkdir -p "$dest"
python3 - "$tmp" "$dest" "$name" "$status" <<'PY'
import json,sys,os
d=json.load(open(sys.argv[1])); dest,name,status=sys.argv[2],sys.argv[3],sys.argv[4]
open(os.path.join(dest,"ssh-pubkeys.txt"),"w").write(d["ssh"]["public"].rstrip()+f"  {name}@lucent.financial\n")
open(os.path.join(dest,"gpg-pubkey.asc"),"w").write(d["pgp"]["public"])
# preserve any human anchors already recorded (github/fido) across re-runs
pubpath=os.path.join(dest,"keyring-public.json")
prior={}
try: prior=json.load(open(pubpath))
except Exception: pass
anchors=prior.get("anchors") or {"github":None,"fido_webauthn":None,
  "note":"human anchor: GitHub (first trust root) + FIDO/WebAuthn/Windows Hello; recorded at rotate/anchor time"}
open(pubpath,"w").write(json.dumps({
  "user":name,
  "status":status,                       # bootstrap-test (unrotated) | self-custody
  "ssh_fingerprint":d["ssh"]["fingerprint"],
  "pgp":{"keyId":d["pgp"]["keyId"],"fingerprint":d["pgp"]["fingerprint"]},
  "nostr_npub":d["nostr"]["npub"],
  "eth":d["eth"]["address"],"btc":d["btc"]["address"],"sol":d["sol"]["address"],
  "paths":{k:d[k]["path"] for k in ("ssh","pgp","nostr","eth","btc","sol")},
  "anchors":anchors
},indent=2)+"\n")
print(f"public artifacts -> {dest}  [status={status}]")
PY

# ---- private bits -> a sink (never stdout/history) ----
if [ -z "$public_only" ]; then
  if [ -n "$vault_path" ]; then
    command -v vault >/dev/null || { echo "vault CLI not found (set VAULT_ADDR/token)" >&2; exit 1; }
    vault kv put "$vault_path" @"$tmp" >/dev/null
    echo "private keyring -> Vault: $vault_path"
  elif [ -n "$gh_secret" ]; then
    command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }
    gh secret set "$gh_secret" -R "$gh_repo" < "$tmp"
    echo "private keyring -> GitHub secret: $gh_secret ($gh_repo)"
  else
    echo "NOTE: no sink (--vault | --gh-secret) given; private bits are in the"
    echo "      shredded-on-exit tmp only. Re-run with a sink to persist securely."
  fi
fi
echo "done: $name ($mode)"
if [ "$mode" = "generate" ] && [ "$name" != "" ]; then
  case "$dest" in *maintainers*) echo "NEXT (self-custody): run 'keyring.sh rotate $name' to swap to a seed you pick + hold.";; esac
fi
