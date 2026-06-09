#!/usr/bin/env bash
# Zeta keyring — one BIP-39 seed phrase -> every key type, type-separated paths.
# SECURITY INVARIANTS:
#   1. The seed phrase is NEVER passed as a command-line argument (ps / shell
#      history would capture it). It is either generated in-process (`generate`)
#      or read with `read -s` (no echo, not added to history) and piped via STDIN.
#   2. Private key material NEVER goes to stdout/history by default. It goes to
#      Vault (preferred) or a umask-077 file the operator controls.
#   3. Public artifacts (pubkeys / addresses / npub) are safe to publish and are
#      written to maintainers/<name>/ for the human-trust roots in main.
#
# Usage:
#   keyring.sh generate <name> [--public-only] [--vault PATH | --out DIR]
#   keyring.sh import   <name> [--public-only] [--vault PATH | --out DIR]
#     generate = fresh 24-word seed made in-process (personas, or a new human).
#     import   = bring your own seed; you type it hidden (read -s). Nothing leaks.
#
# Examples:
#   # Persona otto: fresh seed, private bits straight to Vault, pubkeys to repo
#   keyring.sh generate otto --vault zeta/personas/otto
#   # Aaron resets his keys WITHOUT ever sharing the seed; only pubkeys emitted
#   keyring.sh import aaron --public-only --out maintainers/aaron
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"

mode="${1:-}"; name="${2:-}"; shift 2 2>/dev/null || true
public_only=""; vault_path=""; out_dir=""; gh_secret=""; gh_repo="Lucent-Financial-Group/Zeta"
while [ $# -gt 0 ]; do case "$1" in
  --public-only) public_only="--public-only";;
  --vault) vault_path="${2:?}"; shift;;       # equipment mode: cluster Vault
  --gh-secret) gh_secret="${2:?}"; shift;;     # github-free mode: GH Actions secret
  --gh-repo) gh_repo="${2:?}"; shift;;
  --out) out_dir="${2:?}"; shift;;
  *) echo "unknown arg: $1" >&2; exit 2;;
esac; shift; done

[ -n "$mode" ] && [ -n "$name" ] || { sed -n '2,30p' "$0"; exit 2; }
[ "$mode" = "generate" ] || [ "$mode" = "import" ] || { echo "mode must be generate|import" >&2; exit 2; }

# deps (idempotent; bun installs into this dir only)
command -v bun >/dev/null || { echo "bun required (closed over in install.sh)"; exit 1; }
[ -d "$HERE/node_modules" ] || (cd "$HERE" && bun install >/dev/null)

umask 077
tmp="$(mktemp -t zeta-keyring.XXXXXX.json)"
cleanup(){ rm -f "$tmp" 2>/dev/null; (command -v shred >/dev/null && shred -u "$tmp" 2>/dev/null) || true; unset SEED; }
trap cleanup EXIT INT TERM

if [ "$mode" = "generate" ]; then
  bun "$HERE/gen.ts" --generate --user "$name" $public_only > "$tmp"
else
  # import: read the seed hidden; read does not echo and is not added to history
  printf 'Paste %s seed phrase (hidden, never stored/printed): ' "$name" >&2
  IFS= read -rs SEED; echo >&2
  printf '%s' "$SEED" | bun "$HERE/gen.ts" --user "$name" $public_only > "$tmp"
  unset SEED
fi

# ---- public artifacts -> maintainers/<name>/ (safe to commit; the trust root) ----
dest="${out_dir:-$REPO/maintainers/$name}"
mkdir -p "$dest"
python3 - "$tmp" "$dest" "$name" <<'PY'
import json,sys,os
d=json.load(open(sys.argv[1])); dest,name=sys.argv[2],sys.argv[3]
open(os.path.join(dest,"ssh-pubkeys.txt"),"w").write(d["ssh"]["public"].rstrip()+f"  {name}@lucent.financial\n")
open(os.path.join(dest,"gpg-pubkey.asc"),"w").write(d["pgp"]["public"])
open(os.path.join(dest,"keyring-public.json"),"w").write(json.dumps({
  "user":name,
  "ssh_fingerprint":d["ssh"]["fingerprint"],
  "pgp":{"keyId":d["pgp"]["keyId"],"fingerprint":d["pgp"]["fingerprint"]},
  "nostr_npub":d["nostr"]["npub"],
  "eth":d["eth"]["address"],"btc":d["btc"]["address"],"sol":d["sol"]["address"],
  "paths":{k:d[k]["path"] for k in ("ssh","pgp","nostr","eth","btc","sol")}
},indent=2)+"\n")
print(f"public artifacts -> {dest}")
PY

# ---- private bits -> a sink (never stdout/history) ----
# Two modes (Aaron 2026-06-09):
#   equipment mode  -> Vault (cluster has it; preferred)
#   github-free mode -> GitHub Actions secret ("choose your own adventure", no equipment)
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
echo "done: $name"
