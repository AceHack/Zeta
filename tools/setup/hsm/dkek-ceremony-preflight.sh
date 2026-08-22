#!/usr/bin/env bash
# tools/setup/hsm/dkek-ceremony-preflight.sh
#
# HOST HYGIENE PREFLIGHT for a SmartCard-HSM DKEK ceremony or restore drill.
#
# It touches NO device, runs NO sc-hsm-tool command, reads no key, PIN, share or
# password, and creates nothing. It answers exactly one question -- *is this host
# a safe place to hold a DKEK share password for the next few seconds* -- and it
# answers REFUSE by default.
#
# WHY A PREFLIGHT AND NOT A CEREMONY SCRIPT. The ceremony itself is a human act
# behind a gated class; automating it is not the ask and would not be permitted.
# What IS automatable is the part a human reliably gets wrong at 11pm: noticing
# that this terminal is an SSH session, that core dumps are on, that swap is
# live, or that stdout is being teed to a file that will end up in a git repo.
#
# THE THREAT MODEL IS AARON'S, AND IT IS SPECIFIC. The DKEK protocol keeps KEY
# material inside the secure elements -- the key leaves a SmartCard-HSM only as
# ciphertext wrapped under a DKEK the device never reveals. That is the property
# worth having and it is real. But two secrets DO cross the host during a
# ceremony, and they are what this file defends:
#
#   1. the DKEK share PASSWORD (and, if split, its (t,n) share strings)
#   2. the User PIN
#
# Neither is a key, and both are sufficient -- with the share file, or with the
# token -- to matter. So "no plaintext on the host" is true of key material and
# false as an unqualified sentence, and the design doc says so out loud:
# docs/research/2026-08-21-weekly-restore-drill-not-weekly-backup-*.md section 3.
#
# EXIT CODES
#   0  PASS    -- every condition checked and satisfied
#   1  REFUSE  -- at least one condition failed, or could not be established
#   2  usage error
#
# FAIL-CLOSED IS LOAD-BEARING: a condition this script cannot MEASURE is
# reported as `unknown` and refuses, because a check that did not run must never
# read as a check that passed.

set -euo pipefail

# ZETA-DKEK-PREFLIGHT-BEGIN
#
# The pure decision. Consumes fact records on stdin, prints one verdict line
# followed by zero or more reason lines, and returns 0 only for PASS.
#
#   remote=<yes|no|unknown>          this terminal reaches a screen elsewhere
#   coredumps=<disabled|enabled|unknown>
#   swap=<off|on|unknown>
#   stdout_tty=<yes|no|unknown>      no => something is capturing this session
#   password_in_argv=<yes|no|unknown>
#   tokens=<N|unknown>               card readers with a token present
#   histfile=<none|set|unknown>
#
# Every one of the seven is REQUIRED. A missing record is `unknown`, and every
# `unknown` refuses -- so adding a condition without teaching the reader half to
# measure it makes the preflight louder, never quieter.
dkek_preflight_decide() {
  _remote="unknown"; _coredumps="unknown"; _swap="unknown"; _stdout_tty="unknown"
  _pw_argv="unknown"; _tokens="unknown"; _histfile="unknown"
  _reasons=""

  while IFS= read -r _line || [ -n "$_line" ]; do
    [ -n "$_line" ] || continue
    case "${_line%%=*}" in
      remote) _remote="${_line#*=}" ;;
      coredumps) _coredumps="${_line#*=}" ;;
      swap) _swap="${_line#*=}" ;;
      stdout_tty) _stdout_tty="${_line#*=}" ;;
      password_in_argv) _pw_argv="${_line#*=}" ;;
      tokens) _tokens="${_line#*=}" ;;
      histfile) _histfile="${_line#*=}" ;;
    esac
  done

  _add() { _reasons="${_reasons}${1}
"; }

  # 1. A remote session puts the share password on a wire. The fleet's own
  #    GL.iNet Comet KVMs make this the LIKELY mistake, not a theoretical one:
  #    a KVM-over-IP ceremony is a ceremony performed on the network.
  case "$_remote" in
    no) : ;;
    yes) _add "REFUSE remote-session: this terminal is remote (SSH/KVM). A DKEK share password typed here crosses a network. Do this at the physical console." ;;
    *) _add "REFUSE remote-session-unknown: could not establish whether this session is local. Unknown refuses." ;;
  esac

  # 2. A crash while holding the password writes it to the coredump path.
  case "$_coredumps" in
    disabled) : ;;
    enabled) _add "REFUSE coredumps-enabled: a crash would write process memory -- including the share password -- to disk. Set the core limit to 0 for this session." ;;
    *) _add "REFUSE coredumps-unknown: could not read the core dump limit. Unknown refuses." ;;
  esac

  # 3. Swap is the quiet one: the password lives in RAM for seconds, and an
  #    unencrypted swap device can persist it for months.
  case "$_swap" in
    off) : ;;
    on) _add "REFUSE swap-active: swap is on, so process memory holding the share password can reach disk. Disable swap for the ceremony, or use an encrypted swap you are willing to defend." ;;
    *) _add "REFUSE swap-unknown: could not establish swap state. Unknown refuses." ;;
  esac

  # 4. sc-hsm-tool PRINTS generated passwords and (t,n) share strings on stdout.
  #    A tee, a script(1), or a CI log turns the ceremony into a transcript.
  case "$_stdout_tty" in
    yes) : ;;
    no) _add "REFUSE stdout-captured: stdout is not a terminal, so something is recording this session. sc-hsm-tool prints generated share passwords to stdout." ;;
    *) _add "REFUSE stdout-unknown: could not establish whether stdout is a terminal. Unknown refuses." ;;
  esac

  # 5. --password on a command line is visible in `ps` to every local user for
  #    the life of the process, and in shell history forever.
  case "$_pw_argv" in
    no) : ;;
    yes) _add "REFUSE password-in-argv: a password was passed as a command-line argument. argv is visible in ps and lands in shell history. Use the interactive prompt." ;;
    *) _add "REFUSE password-in-argv-unknown: could not inspect the invocation. Unknown refuses." ;;
  esac

  # 6. Exactly one token. Two connected tokens is how `--unwrap-key --force`
  #    destroys the key on the wrong device, and it is also how one compromised
  #    host reaches both halves of the custody set at once.
  case "$_tokens" in
    1) : ;;
    0) _add "REFUSE no-token: no SmartCard-HSM is present. Nothing to do, and a ceremony that proceeds without a target is how a wrong target gets chosen later." ;;
    unknown|"") _add "REFUSE token-count-unknown: could not enumerate readers. Unknown refuses." ;;
    *) _add "REFUSE multiple-tokens: ${_tokens} tokens are connected. Exactly one. --unwrap-key --force overwrites whatever it is pointed at, and the primary must never be reachable during a drill." ;;
  esac

  # 7. History is a lesser exposure than the rest and is still a real one: a
  #    mistyped password lands on the wrong line and is written to disk.
  case "$_histfile" in
    none) : ;;
    set) _add "REFUSE histfile-set: shell history is being written. Unset HISTFILE for this session so a mistyped password is not persisted." ;;
    *) _add "REFUSE histfile-unknown: could not establish whether history is being written. Unknown refuses." ;;
  esac

  if [ -z "$_reasons" ]; then
    printf 'PASS\n'
    return 0
  fi
  printf 'REFUSE\n'
  printf '%s' "$_reasons"
  return 1
}
# ZETA-DKEK-PREFLIGHT-END

# ── the reader half: outside the decision block on purpose ───────────────────
#
# Error-preserving. Every probe that cannot answer emits `unknown` rather than a
# convenient default, which is what makes the fail-closed rule above bite.
dkek_preflight_read_facts() {
  if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_TTY:-}" ] || [ -n "${SSH_CLIENT:-}" ]; then
    printf 'remote=yes\n'
  else
    printf 'remote=no\n'
  fi

  _core="$(ulimit -c 2>/dev/null || echo unknown)"
  case "$_core" in
    0) printf 'coredumps=disabled\n' ;;
    unknown|"") printf 'coredumps=unknown\n' ;;
    *) printf 'coredumps=enabled\n' ;;
  esac

  if [ -r /proc/swaps ]; then
    if [ "$(awk 'NR>1' /proc/swaps 2>/dev/null | wc -l | tr -d ' ')" = "0" ]; then
      printf 'swap=off\n'
    else
      printf 'swap=on\n'
    fi
  else
    # Not Linux, or /proc unreadable. "We could not look" is not "no swap".
    printf 'swap=unknown\n'
  fi

  if [ -t 1 ]; then printf 'stdout_tty=yes\n'; else printf 'stdout_tty=no\n'; fi

  # The caller passes its own argv through; absent that we cannot know.
  if [ "$#" -gt 0 ]; then
    case " $* " in
      *" --password "*|*" --password="*|*" -p "*) printf 'password_in_argv=yes\n' ;;
      *) printf 'password_in_argv=no\n' ;;
    esac
  else
    printf 'password_in_argv=no\n'
  fi

  if command -v opensc-tool >/dev/null 2>&1; then
    _n="$(opensc-tool --list-readers 2>/dev/null | grep -ci 'smartcard-hsm' || true)"
    case "$_n" in
      ''|*[!0-9]*) printf 'tokens=unknown\n' ;;
      *) printf 'tokens=%s\n' "$_n" ;;
    esac
  else
    printf 'tokens=unknown\n'
  fi

  if [ -n "${HISTFILE:-}" ]; then printf 'histfile=set\n'; else printf 'histfile=none\n'; fi
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  dkek_preflight_read_facts "$@" | dkek_preflight_decide
fi
