#!/usr/bin/env bash
#
# tools/setup/linux.sh — Linux bootstrap path (Debian/Ubuntu for now).
#
# Order matters:
#   1. apt packages from manifests/apt (build-essential, curl, etc.)
#   2. mise (via official installer; no apt package yet)
#   3. common/mise.sh     — installs dotnet/python/java/bun/uv per .mise.toml
#   4. ace-realize --all  — all mechanism realizers (install-graph order)
#   5. common/shellenv.sh — managed PATH file
#   6. common/profile-edit.sh — append the managed-PATH source line to the shell profile
#
# Non-Debian Linuxes (RHEL/Fedora/Arch/Alpine) are deferred — the
# install-script layering supports adding them alongside apt.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"
SETUP_REALIZE="$REPO_ROOT/src/Core.TypeScript/ace/setup-realize.ts"

# Bun setup realizers (081KLL7…); requires bun on PATH (from mise).
realize_mechanisms() {
  if ! command -v bun >/dev/null 2>&1; then
    echo "error: bun required for setup realizers — ensure common/mise.sh ran first" >&2
    exit 1
  fi
  bun "$SETUP_REALIZE" "$@"
}

# Retry-equipped curl helper — DST exception for external dep
# downloads, durable retry inside the script instead of ephemeral
# `gh run rerun --failed`. Sources curl_fetch (file-output, with
# `--retry 5 --retry-delay 2`, plus `--retry-all-errors` when the
# local curl supports it — curl-fetch.sh feature-detects and falls
# back on older curl builds).
# shellcheck source=tools/setup/common/curl-fetch.sh
source "$SETUP_DIR/common/curl-fetch.sh"

# Host tiers (081KTWQZY7F08QG0R0034KN17T). macos.sh has gated manifests/brew on
# `tier=` since that workitem landed; the apt leg did not, which is what this
# source line closes. Sourcing here (rather than inside the apt branch) resolves
# the tier ONCE for the whole install: children like common/mise.sh source the
# same file and, finding ZETA_HOST_TIER already exported, take the declared
# branch instead of re-detecting. Same value either way — detection is a pure
# function of the host's memory — so the only visible change downstream is that
# their logs now read `(declared)` where they read `(detected)`.
# shellcheck source=tools/setup/common/host-tier.sh
source "$SETUP_DIR/common/host-tier.sh"

# ── Detect NixOS — skip apt step entirely, use systemPackages instead ──
# iter-5.5.0 (081KSGS9H0008QG0R001JNKBFD Phase 2, operator 2026-05-27 ALIGNMENT catch):
# NixOS provides system packages declaratively via common.nix
# environment.systemPackages, NOT apt. The same install.sh entry-point
# can still bootstrap a NixOS cluster node by skipping the apt step and
# going directly to mise.sh for runtime version management. Operator
# framing: "our install.sh for mac and linux this is our default" —
# extending NixOS support keeps that default operational on cluster
# nodes invoked from zeta-install.sh Step 6.95a.
if [ -f /etc/NIXOS ]; then
  echo "✓ NixOS detected — skipping apt (system packages declared in common.nix);"
  echo "  proceeding directly to mise + downstream runtime setup"
  IS_NIXOS=1
else
  IS_NIXOS=0
  # ── Detect apt availability (Debian/Ubuntu) ─────────────────────────
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "error: this script currently supports Debian/Ubuntu + NixOS"
    echo "  (NixOS detected via /etc/NIXOS marker file)"
    echo "  RHEL/Fedora/Arch/Alpine support is backlogged — see"
    echo "  docs/research/build-machine-setup.md"
    exit 1
  fi
fi

# ── 1. apt packages (from manifest) ─────────────────────────────────
# NixOS handles system packages via common.nix systemPackages declarative;
# skip the entire apt step. mise + downstream still run.
APT_MANIFEST="$SETUP_DIR/manifests/apt"
if [ "$IS_NIXOS" = 1 ]; then
  echo "✓ skipping apt (NixOS — see common.nix environment.systemPackages)"
elif [ -f "$APT_MANIFEST" ]; then
  # Extract non-comment non-empty lines, then DROP the ones this host's tier
  # does not allow. The comment/whitespace parser is unchanged (it lives in
  # common/host-tier.sh now) and still guards the maintainer's 2026-05-26 bug
  # surface: `p7zip-full  # comment` was passed to apt-get install verbatim,
  # producing "Unable to locate package". awk (not `grep -vE`) because grep
  # exits 1 on no-match and would fail the script under pipefail when the
  # manifest is all comments.
  #
  # WHY THE TIER GATE IS HERE (081M0K36K69087G0R003BYSCF8). manifests/apt is
  # 388 packages / 713 MiB resolved, and it was installed IN FULL on every host
  # including the 1-vCPU ubuntu-slim runner, whose only job is `dotnet build`
  # on one csproj. manifests/brew has gated the same tools at tier=standard
  # since 081KTWQZY7F, so this is the missing half of a split that already
  # shipped — the manifest itself carried the debt in prose ("The right fix is
  # a tier= gate for apt, which does not exist yet"). Skips are LOUD (the
  # helper names every dropped package and both tiers on stderr): a package
  # that silently vanished would be the absent-check failure this repo refuses.
  PKGS="$(zeta_filter_manifest_by_tier "$APT_MANIFEST" | tr '\n' ' ')"
  # manifests/apt canonical names target Ubuntu 24.04 (Noble). Map to jammy
  # equivalents so install.sh works on 22.04 dev boxes / cloud VMs too.
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [ "${ID:-}" = "ubuntu" ] && [ "${VERSION_ID:-}" = "22.04" ]; then
      for _pair in libicu74:libicu70 libssl3t64:libssl3 cvc5:cvc4; do
        _noble="${_pair%%:*}"
        _jammy="${_pair#*:}"
        case " $PKGS " in
          *" $_noble "*)
            echo "↻ apt package alias: $_noble → $_jammy (Ubuntu 22.04 jammy)"
            PKGS="${PKGS//$_noble/$_jammy}"
            ;;
        esac
      done
    fi
  fi
  if [ -n "$PKGS" ]; then
    echo "↓ installing apt packages from $(basename "$APT_MANIFEST")..."
    # Use sudo only when not already root (CI containers often run as root).
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
    # ── THE APT PHASE RUNS UNDER ONE SHARED WALL-CLOCK DEADLINE ──────
    #
    # WHY A DEADLINE AND NOT A PER-ATTEMPT TIMEOUT (the defect this closes,
    # Dejan 2026-08-18). The 2026-08-14 hang guard bounded each `apt-get
    # install` at 600s and retried 3 times. MEASURED, that is a worst case of
    # 3 x 600s + 15s + 30s of backoff = 1845s = 30.75 minutes — while EVERY job
    # that runs this script has `timeout-minutes` between 5 and 45, and the
    # tightest ones (cross-verify, lint-shell, lint-typescript, lint-markdown,
    # ci-cache-paths-lint, budget-snapshot-cadence, ...) are 5-12 minutes. So
    # on a stalling mirror the JOB was killed part-way through attempt 2 and
    # reported `cancelled`: the guard made `apt-get` RETURN, but the retry loop
    # it returned into could never finish. A guard that cannot run to
    # completion is the vacuity class — it looks like protection and constrains
    # nothing. (Live instances: gate jobs 95796893156 / 95796898144 /
    # 95797644804 / 95797644737 / 95796898139, all killed inside this step;
    # ci-cache-paths-lint run 2026-08-18T18:26Z, killed at its 5-minute mark.)
    #
    # THE SHAPE. One deadline is taken once, and update + every install attempt
    # + every backoff draw their slice from what is LEFT of it. Three attempts
    # therefore cannot exceed the wall budget no matter what each one does, and
    # the arithmetic stays correct if someone later changes the attempt count,
    # the backoff, or `timeout-minutes` — which a fixed per-attempt timeout does
    # not. `src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts`
    # asserts the default below still fits inside EVERY job that runs install.sh,
    # alongside that job's own measured non-apt work, so a `timeout-minutes` edit
    # that breaks the relation goes red instead of going silent. It also reads the
    # `ZETA_APT_BUDGET_SECONDS` override below wherever a workflow declares it, so
    # raising the budget for one lane is checked the same way as raising it for all.
    #
    # WHY TWO DEFAULTS, AND WHY THAT IS NOT PARITY DRIFT (GOVERNANCE §24).
    # Parity is one script, one mechanism, one knob — not one constant. The
    # constraint being reconciled here (an outer job timeout that turns an
    # overrun into `cancelled`) EXISTS ONLY IN CI. On a laptop or in a
    # devcontainer there is no outer killer, so the deadline's job is only to
    # stop an unbounded hang, and a CI-sized 420s would false-fail a cold
    # 553 MB apt fetch over a home link. Both legs run the identical deadline
    # code path and honour the identical `ZETA_APT_BUDGET_SECONDS` override;
    # only the default differs, and it differs because the environments
    # genuinely differ. (Precedent: install.sh already derives ZETA_HOST_TIER
    # from GITHUB_ACTIONS for the same reason.)
    #
    # MEASURED HEALTHY COST, so the budget is sized rather than guessed: on
    # ubuntu-24.04, run 32151321559 (2026-08-18), the whole apt phase — update
    # + install of the full manifest, 553 MB fetched — took 38.2 seconds
    # (14:55:52.96 -> 14:56:31.13). The 420s CI default is ~11x that. It is
    # sized by the audit's requirement, which as of 2026-08-22 reads
    #     budget + kill_after + THIS JOB's measured non-apt seconds <= its timeout
    # per job, not once for the tightest. The earlier form of that line said
    # "+ 120s pre-apt reserve", and the reserve was defined in the audit itself as
    # "the work that PRECEDES it" — with NO term for the work that FOLLOWS. It
    # therefore passed `low-memory.yml` at 420 + 10 + 120 = 550 <= 840 while that
    # lane's non-apt work measured 571s at p90, i.e. it certified the one lane that
    # provably could not fit. The binding job now is helm-validate:structural —
    # 420 + 10 + 143 = 573 <= 600 — and low-memory is a recorded, reasoned exception
    # in audit-apt-budget-fits-job-timeout.baseline.json rather than a silent pass.
    #
    # A FIRST DRAFT OF THIS SHIPPED AT 150s AND WAS WRONG, which is worth
    # recording because the failure is subtle. 150s was pinned by three
    # FIVE-minute cadence jobs, and under the even split below it left attempt 1
    # with 45s — 1.2x the healthy cost. That bounds a STALL correctly and
    # false-fails a mirror that is merely SLOW, which is a worse trade than the
    # bug it replaced. Measured on job 95859213848: slices of 45s / 38s / 8s.
    # The three cadence jobs were raised to 12 minutes in the same commit — a
    # timeout is a cap, not a reservation, so on the healthy path (they finish
    # in ~2.5 min) it costs zero additional CI minutes.
    #
    # `timeout` converts a stall into an ordinary non-zero exit, which the
    # retry loop below and the 5-attempt install.sh wrapper in gate.yml can
    # both act on. Why apt's own timeouts do NOT catch this:
    # `Acquire::http::Timeout` is an INACTIVITY timer and a slow trickle keeps
    # resetting it — on 2026-08-14 azure.archive.ubuntu.com decayed from
    # 8083 kB/s to ~1.5 kB/s and then stopped mid-`pandoc` without closing the
    # socket, so apt was never idle long enough to trip.
    if ! command -v timeout >/dev/null 2>&1; then
      echo "error: coreutils \`timeout\` not found — it bounds the apt phase" >&2
      echo "  (Debian/Ubuntu ship it in the \`coreutils\` package)" >&2
      exit 1
    fi
    # Read by audit-apt-budget-fits-job-timeout.ts — ONE source, no duplicated
    # constant to drift. Keep the assignments on their own line, bare integer.
    ZETA_APT_CI_BUDGET_DEFAULT_SECONDS=420
    ZETA_APT_LOCAL_BUDGET_DEFAULT_SECONDS=1800
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
      apt_budget_default="$ZETA_APT_CI_BUDGET_DEFAULT_SECONDS"
    else
      apt_budget_default="$ZETA_APT_LOCAL_BUDGET_DEFAULT_SECONDS"
    fi
    apt_budget="${ZETA_APT_BUDGET_SECONDS:-$apt_budget_default}"
    apt_kill_after=10
    apt_deadline=$(( $(date +%s) + apt_budget ))
    # Seconds left on the shared deadline, floored at 0.
    apt_remaining() {
      local _left
      _left=$(( apt_deadline - $(date +%s) ))
      if [ "$_left" -lt 0 ]; then _left=0; fi
      printf '%s' "$_left"
    }
    echo "↻ apt phase budget: ${apt_budget}s (override: ZETA_APT_BUDGET_SECONDS)"

    # ── THE ARCHIVE CACHE — the root fix for the wall-budget class ─────
    #
    # `ZETA_APT_ARCHIVES_DIR`, when set, relocates apt's `.deb` archive
    # directory (`Dir::Cache::archives`) to a caller-owned path. In CI that
    # path is restored by `.github/actions/apt-archive-cache` before this
    # script runs and saved after it, so the mirror is asked for the bytes
    # ONCE per (distro, arch, tier, package set, week) instead of once per job.
    #
    # The failure this addresses, measured: 561 MB fetched on every ubuntu job
    # against a mirror whose rate decayed to ~1.1 MB/s — ~510s of download
    # inside a 420s budget. Every attempt made forward progress; the job ran
    # out of WALL CLOCK while succeeding slowly. More retry cannot fix that
    # (three attempts already share one deadline) and the budget cannot absorb
    # it (the tightest fitting job has 18s of margin). Removing the fetch is
    # the only lever left that costs less rather than more. Full derivation:
    # docs/research/2026-08-26-caching-var-cache-apt-archives-is-the-root-fix-for-the-apt-wall-budget-class.md
    #
    # WHY A STALE CACHE CANNOT INSTALL THE WRONG PACKAGE. `apt-get update`
    # still runs on every invocation, so version RESOLUTION always comes from
    # a freshly-fetched index. apt then asks the archive directory for ONE
    # exact filename per package — `<name>_<version>_<arch>.deb` — so a
    # superseded `.deb` is not "used instead": it is never asked for.
    # Measured against ubuntu:24.04 — a planted `jq_0.0.1-1_*.deb` and a
    # wrong-arch file were both ignored entirely while the real version
    # installed from cache (`Need to get 0 B`).
    #
    # AND THE HALF THAT DID NOT HOLD, recorded because the first draft of this
    # comment asserted it. apt does NOT re-hash a file that is already in the
    # archive directory; it accepts it on FILENAME AND SIZE. A truncated
    # `.deb` is caught (wrong size ⇒ re-download, measured). A SAME-SIZE
    # tampered `.deb` is not — apt hands it to dpkg, and what refuses it is
    # dpkg's decompressor checksum: "zstd error: Restored data doesn't match
    # checksum", rc=100, loudly. So the property is "cannot install silently",
    # not "apt verifies the cache". The containment that makes that acceptable
    # is GitHub's, not apt's: a cache entry is scoped to the branch that wrote
    # it, so a pull request cannot write bytes that `main` or another pull
    # request will read. Transcripts: §3 of the doc above.
    #
    # Unset (dev laptop, devcontainer, bare Linux): every line below behaves
    # exactly as it did — apt uses its own /var/cache/apt/archives, and the
    # only new work is a `du` per attempt to measure throughput.
    # Expanded below as `${apt_archives_opts[@]+"${apt_archives_opts[@]}"}`, NOT as
    # `"${apt_archives_opts[@]}"`. Under `set -u` an EMPTY array is an unbound
    # variable in bash 3.2 (macOS `/bin/bash`), which is where
    # `apt-phase-wall-budget.test.ts` executes this file — it caught exactly that,
    # four lines after the first draft claimed bash 5 was guaranteed here.
    apt_archives_opts=()
    if [ -n "${ZETA_APT_ARCHIVES_DIR:-}" ]; then
      apt_archives_dir="$ZETA_APT_ARCHIVES_DIR"
      case "$apt_archives_dir" in
        /*) : ;;
        *)
          echo "error: ZETA_APT_ARCHIVES_DIR must be an absolute path (got '$apt_archives_dir')" >&2
          echo "  apt resolves Dir::Cache::archives against Dir::, not against \$PWD." >&2
          exit 1
          ;;
      esac
      # apt writes in-flight downloads to `partial/` under this dir and takes a
      # `lock` beside them; both must exist and be writable by the apt process.
      mkdir -p "$apt_archives_dir/partial"
      apt_archives_opts=( -o "Dir::Cache::archives=$apt_archives_dir" )
      apt_restored_debs="$(find "$apt_archives_dir" -maxdepth 1 -name '*.deb' 2>/dev/null | wc -l | tr -d ' ')"
      echo "↻ apt archive cache: $apt_archives_dir (${apt_restored_debs} .deb present before install)"
    else
      apt_archives_dir=/var/cache/apt/archives
    fi

    # Kilobytes currently in the archive directory. Used to MEASURE each
    # attempt's throughput, so the budget-exhaustion banner can report what
    # happened instead of asserting a cause. An unmeasurable directory yields
    # 0 and the banner then says "throughput not measurable" rather than
    # printing a false 0 MB/s.
    apt_archive_kb() {
      local _kb=""
      # shellcheck disable=SC2086
      _kb="$($SUDO du -sk "$apt_archives_dir" 2>/dev/null | awk 'NR==1{print $1}')" || _kb=""
      case "$_kb" in ''|*[!0-9]*) _kb=0 ;; esac
      printf '%s' "$_kb"
    }

    # `apt-get update` refreshes EVERY configured source, including any
    # third-party PPAs the host image shipped that we don't control. Under
    # `set -euo pipefail` a single unreachable source (e.g. a launchpad PPA
    # returning 403 behind a restricted-network policy) aborts the whole
    # install before any runtime tooling is set up.
    #
    # apt's EXIT CODE is an unreliable partial-failure signal: a signature/403
    # error exits non-zero, but a DNS/connection failure on one source can exit
    # 0 with only `W: Some index files failed to download` (Codex review on
    # PR #6419, confirmed by docker-ubuntu-install-sh-test). So detect partial
    # failure from BOTH the exit code AND the output, and warn in either case —
    # otherwise a real third-party-source outage stays silent, which is the very
    # failure this guard exists to surface. Per
    # `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`
    # ("grace in the artifact, assert in the test"): the update is GRACEFUL
    # (warn + continue) while the install below stays STRICT — `apt-get install`
    # still fails loudly if a package we actually need is unavailable, so the
    # assert is preserved at install time rather than skipped to a false-green.
    # STREAM the output live (a slow/retry-heavy mirror must not look hung —
    # Copilot P1 on PR #6419) WHILE capturing it to a temp file for the
    # partial-failure probe. `tee` consumes ALL of apt's output, so the
    # SIGPIPE/pipefail hazard that ruled out `printf | grep -q` (Codex P2) does
    # not apply here — the probe greps the FILE, not a pipe. Take apt's OWN exit
    # from PIPESTATUS[0]; the pipeline's own status would be `tee`'s, masking
    # apt. grep on the file stays line-oriented so `^Err:` still anchors per-line.
    #
    # BOUNDED (Dejan 2026-08-18): `update` was the half the 2026-08-14 guard did
    # NOT wrap, so a stall in it had no ceiling at all and the job timeout was
    # again the only thing that fired. It draws at most HALF the remaining
    # budget, which reserves the other half for the install that actually has to
    # succeed, and at most ZETA_APT_UPDATE_TIMEOUT_SECONDS on top of that.
    apt_update_slice=$(( $(apt_remaining) / 2 ))
    apt_update_cap="${ZETA_APT_UPDATE_TIMEOUT_SECONDS:-60}"
    if [ "$apt_update_slice" -gt "$apt_update_cap" ]; then apt_update_slice="$apt_update_cap"; fi
    if [ "$apt_update_slice" -lt 1 ]; then apt_update_slice=1; fi
    apt_log="$(mktemp)"
    apt_update_rc=0
    # shellcheck disable=SC2086
    if timeout --signal=TERM --kill-after="${apt_kill_after}s" "$apt_update_slice" \
         $SUDO env DEBIAN_FRONTEND=noninteractive apt-get update -y 2>&1 | tee "$apt_log"; then :; else apt_update_rc="${PIPESTATUS[0]}"; fi
    if [ "$apt_update_rc" -eq 124 ]; then
      # NOT "stalled mirror": `timeout` firing says the slice expired, and says
      # nothing about whether the mirror was wedged or merely slow. Naming the
      # observable (the slice ran out) keeps the reader pointed at the two real
      # remedies — fewer bytes, or a warm cache — instead of at a hang that the
      # measurement usually does not support. Same correction as the install
      # banner below, which carries the throughput number.
      echo "⚠ apt-get update ran out of wall clock: its ${apt_update_slice}s slice of the" >&2
      echo "  ${apt_budget}s apt budget expired. Continuing to install;" >&2
      echo "  the install below still asserts the packages we need are present." >&2
    elif [ "$apt_update_rc" -ne 0 ] \
       || grep -qiE 'Failed to fetch|Some index files failed to download|^Err:' "$apt_log"; then
      echo "⚠ apt-get update reported errors — likely an unreachable third-party" >&2
      echo "  source the host image shipped (not a Zeta manifest source). Continuing;" >&2
      echo "  the apt-get install below still asserts the packages we need are present." >&2
    fi
    rm -f "$apt_log"

    apt_attempts=3
    apt_install_rc=0
    for apt_attempt in 1 2 3; do
      # EVERY attempt is sized from what is LEFT. That is what makes 3 attempts
      # fit inside the wall budget instead of multiplying it: the sum of the
      # slices is the remainder, not three times a constant.
      #
      # The share is WEIGHTED, not even, because the two failure modes want
      # opposite things. A mirror that is merely SLOW needs continuous time —
      # one long attempt succeeds where three short ones all fail. A mirror
      # that is WEDGED (the 2026-08-14 case: bytes trickling, socket never
      # closed) needs a fresh connection, which only a retry gives. So the
      # first attempt takes 60% and the retries share the rest; the last
      # attempt takes everything still on the clock.
      apt_left="$(apt_remaining)"
      if [ "$apt_left" -le 0 ]; then
        echo "⚠ apt budget (${apt_budget}s) exhausted before attempt ${apt_attempt}/${apt_attempts}" >&2
        if [ "$apt_install_rc" -eq 0 ]; then apt_install_rc=124; fi
        break
      fi
      if [ "$apt_attempt" -eq "$apt_attempts" ]; then
        apt_slice="$apt_left"
      else
        apt_slice=$(( apt_left * 3 / 5 ))
      fi
      if [ "$apt_slice" -lt 1 ]; then apt_slice=1; fi
      apt_install_rc=0
      apt_kb_before="$(apt_archive_kb)"
      apt_t_before="$(date +%s)"
      # shellcheck disable=SC2086
      # DEBIAN_FRONTEND=noninteractive + confdef/confold keep dpkg from stalling
      # on a conffile prompt (e.g. fuse3's fuse.conf) when this runs headless —
      # on a dev laptop, CI runner, devcontainer, or a fresh Cloud Agent base
      # image where the package is installed for the first time. Without it the
      # install dies with "end of file on stdin at conffile prompt" (rc=100).
      timeout --signal=TERM --kill-after="${apt_kill_after}s" "$apt_slice" \
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
          ${apt_archives_opts[@]+"${apt_archives_opts[@]}"} \
          -o Dpkg::Options::=--force-confdef \
          -o Dpkg::Options::=--force-confold \
          -o Acquire::Retries=3 \
          -o Acquire::http::Timeout=30 \
          -o Acquire::https::Timeout=30 \
          $PKGS || apt_install_rc=$?
      [ "$apt_install_rc" -eq 0 ] && break
      # 124 = `timeout` fired; anything else is a real apt error.
      if [ "$apt_install_rc" -eq 124 ]; then
        # THE BANNER SAYS WHAT WAS MEASURED, NOT WHAT IT ASSUMES.
        #
        # This used to read "stalled archive mirror, not a package error." The
        # first half is usually FALSE and it sent every reader at the wrong
        # fix. Measured on job 97946436709 (2026-08-25): all three attempts
        # made continuous forward progress and apt's archive cache carried
        # completed downloads across them — 561 MB wanted, ~1.1 MB/s delivered
        # against the ~14 MB/s the 420s budget was sized from. A mirror at
        # 1.1 MB/s is SLOW, not stalled, and the remedy for slow is fewer bytes
        # (a tier) or no bytes (a warm archive cache) — never a longer wait,
        # because 561 MB at 1.1 MB/s is ~510s and the budget has 18s of margin
        # fleet-wide.
        #
        # So: print the observable (the slice expired), print the MEASURED
        # throughput for this attempt, and let the number distinguish the two
        # causes instead of the banner guessing between them. Near-zero bytes
        # in a full slice IS the wedged case and now says so on evidence.
        apt_kb_after="$(apt_archive_kb)"
        apt_elapsed=$(( $(date +%s) - apt_t_before ))
        [ "$apt_elapsed" -ge 1 ] || apt_elapsed=1
        apt_kb_delta=$(( apt_kb_after - apt_kb_before ))
        echo "⚠ apt-get install ran out of wall clock: its ${apt_slice}s slice of the" >&2
        echo "  ${apt_budget}s apt budget expired (attempt ${apt_attempt}/${apt_attempts}, rc=124)." >&2
        if [ "$apt_kb_delta" -gt 0 ]; then
          echo "  MEASURED this attempt: $(( apt_kb_delta / 1024 )) MB into the archive cache in" >&2
          echo "  ${apt_elapsed}s = $(( apt_kb_delta / apt_elapsed )) kB/s. Bytes were still arriving, so this is a" >&2
          echo "  SLOW mirror against a fixed budget — not a hang and not a package error." >&2
          echo "  The fix is fewer bytes (ZETA_HOST_TIER) or none (a warm archive cache)," >&2
          echo "  not a longer budget: see docs/research/2026-08-26-caching-var-cache-apt-" >&2
          echo "  archives-is-the-root-fix-for-the-apt-wall-budget-class.md" >&2
        elif [ "$apt_kb_after" -eq 0 ] && [ "$apt_kb_before" -eq 0 ]; then
          echo "  Throughput not measurable (could not size ${apt_archives_dir})." >&2
        else
          echo "  MEASURED this attempt: NO bytes reached the archive cache in ${apt_elapsed}s." >&2
          echo "  That is the WEDGED case — a mirror holding the socket open and sending" >&2
          echo "  nothing — which is what this timeout exists to convert into an exit." >&2
        fi
      else
        echo "⚠ apt-get install failed rc=${apt_install_rc} (attempt ${apt_attempt}/${apt_attempts})" >&2
      fi
      [ "$apt_attempt" -eq "$apt_attempts" ] && break
      # DPKG RECOVERY — without this the 3-attempt loop is a 1-attempt loop.
      # The `timeout` above TERM/KILLs apt-get MID-DPKG, which leaves the
      # package database interrupted. The next attempt then fails INSTANTLY
      # with rc=100 ("E: dpkg was interrupted, you must manually run
      # 'sudo dpkg --configure -a'") and never reaches the mirror at all — so
      # ONE stall costs ALL THREE attempts, and the retry loop above is
      # decorative on precisely the failure it was written for.
      #
      # Measured 2026-08-18 from a surviving log on PR #11746 (the stall
      # normally hangs, so the log is usually lost); filed as
      # 081M096T3AN087G0R0008JZQ7B. This is verbatim what apt's own error
      # message instructs, and it is a no-op on a clean database, so it is
      # safe on the ordinary-error paths too. It draws from the same deadline —
      # a `dpkg --configure -a` that itself hangs must not eat the budget.
      #
      # AND IT MUST WAIT FOR THE LOCK, which the first version did not — so the
      # recovery was still vacuous on exactly the failure it was written for.
      # `timeout` signals the process it started (`sudo apt-get`); the `dpkg`
      # that apt-get forked is NOT in that process group's kill path and keeps
      # running, holding /var/lib/dpkg/lock. Read off run 32539... sibling
      # 32537060851 (low-memory, 2026-08-21), where the recovery fired 40 ms
      # after the kill and every step after it lost to the same lock:
      #   23:37:09.80  attempt 1 hits its 237s slice, timeout fires
      #   23:37:09.84  dpkg --configure -a -> "lock was locked by another
      #                process with pid 1072"                      (recovery lost)
      #   23:37:24.94  attempt 2  -> "Could not get lock ... held by 1072" rc=100
      #   23:37:24.98  dpkg --configure -a -> same lock error       (recovery lost)
      #   23:37:55.01  attempt 3  -> "dpkg was interrupted, you must manually
      #                run 'sudo dpkg --configure -a'"              rc=100
      # By 23:37:55 pid 1072 had exited and the lock was free, but nothing tried
      # again — so a recoverable interruption spent all three attempts and the
      # step failed. Polling turns that into a wait of a few seconds. Same 30s
      # cap and same shared deadline as before: this loop can only spend time
      # the budget already allowed the single call to spend.
      apt_dpkg_slice="$(apt_remaining)"
      if [ "$apt_dpkg_slice" -gt 30 ]; then apt_dpkg_slice=30; fi
      if [ "$apt_dpkg_slice" -ge 1 ]; then
        apt_dpkg_log="$(mktemp)"
        apt_dpkg_deadline=$(( $(date +%s) + apt_dpkg_slice ))
        apt_dpkg_waited=0
        while :; do
          apt_dpkg_left=$(( apt_dpkg_deadline - $(date +%s) ))
          [ "$apt_dpkg_left" -le 0 ] && break
          apt_dpkg_rc=0
          # DEBIAN_FRONTEND=noninteractive + confdef/confold so a conffile prompt
          # (e.g. fuse3's fuse.conf on a fresh headless base image) is answered
          # with the default instead of stalling on "end of file on stdin at
          # conffile prompt" — the same non-interactive guard as the install above.
          # shellcheck disable=SC2086
          timeout --signal=TERM --kill-after="${apt_kill_after}s" "$apt_dpkg_left" \
            $SUDO env DEBIAN_FRONTEND=noninteractive dpkg --force-confdef --force-confold --configure -a >"$apt_dpkg_log" 2>&1 || apt_dpkg_rc=$?
          if [ "$apt_dpkg_rc" -eq 0 ]; then
            if [ "$apt_dpkg_waited" -gt 0 ]; then
              echo "✓ dpkg database repaired after waiting ${apt_dpkg_waited}s for the lock" >&2
            fi
            break
          fi
          # Only a LOCK error is worth waiting on: the holder is the dpkg the
          # timeout orphaned, and it exits on its own. Any other failure is a
          # real dpkg problem and retrying it just burns the budget.
          if grep -qiE 'lock was locked|Could not get lock|Unable to lock|is another process using it' "$apt_dpkg_log"; then
            if [ "$apt_dpkg_waited" -eq 0 ]; then
              echo "↻ dpkg lock still held by the orphaned dpkg — waiting (<=${apt_dpkg_slice}s)" >&2
            fi
            apt_dpkg_waited=$(( apt_dpkg_waited + 2 ))
            sleep 2
            continue
          fi
          cat "$apt_dpkg_log" >&2
          break
        done
        rm -f "$apt_dpkg_log"
      fi
      # Backoff is part of the budget too, so it never spends more than a
      # QUARTER of what is left. Clamping only to `remaining` was not enough: on
      # a small budget the sleeps ate the clock and the later attempts were
      # skipped for lack of time, which is the retry loop going decorative again
      # by a different route.
      apt_backoff=$(( apt_attempt * 15 ))
      apt_left="$(apt_remaining)"
      apt_backoff_cap=$(( apt_left / 4 ))
      if [ "$apt_backoff" -gt "$apt_backoff_cap" ]; then apt_backoff="$apt_backoff_cap"; fi
      if [ "$apt_backoff" -gt 0 ]; then sleep "$apt_backoff"; fi
    done

    # ── HAND THE ARCHIVE DIRECTORY BACK, whatever the outcome ──────────
    #
    # Runs BEFORE the strict-exit below on purpose. apt wrote these files as
    # root; the CI step that saves them (`actions/cache`, a post step) tars
    # them as the unprivileged runner user, and `partial/` is mode 0700 root,
    # so without this the save fails with permission-denied — on the FAILURE
    # path, which is precisely the run whose partial download is worth
    # keeping. A cleanup that only runs on success would be the retry loop's
    # old bug in a new place.
    #
    # `autoclean` (not `clean`) drops exactly the `.deb`s that the freshly
    # updated index no longer offers — superseded versions — and keeps every
    # current one. Without it the directory accumulates one file per version
    # per week and the cache grows without bound; with it, the steady-state
    # size is the size of ONE resolved package set. `clean` would empty it and
    # defeat the whole mechanism.
    if [ -n "${ZETA_APT_ARCHIVES_DIR:-}" ]; then
      apt_autoclean_rc=0
      # shellcheck disable=SC2086
      $SUDO env DEBIAN_FRONTEND=noninteractive apt-get autoclean -y \
        "${apt_archives_opts[@]}" >/dev/null 2>&1 || apt_autoclean_rc=$?
      if [ "$apt_autoclean_rc" -ne 0 ]; then
        # Loud, never fatal: a cache that keeps a stale file is slightly larger,
        # which is not worth failing an install over — but a silent failure here
        # would show up months later as an unexplained cache-size climb.
        echo "⚠ apt-get autoclean rc=${apt_autoclean_rc} on ${apt_archives_dir};" >&2
        echo "  superseded .deb files were not pruned (cache will be larger than needed)." >&2
      fi
      $SUDO rm -rf "$apt_archives_dir/partial" "$apt_archives_dir/lock"
      if [ "$(id -u)" -ne 0 ]; then
        $SUDO chown -R "$(id -u):$(id -g)" "$apt_archives_dir"
      fi
      echo "✓ apt archive cache: $(find "$apt_archives_dir" -maxdepth 1 -name '*.deb' | wc -l | tr -d ' ') .deb," \
           "$(du -sh "$apt_archives_dir" 2>/dev/null | awk 'NR==1{print $1}') in $apt_archives_dir"
    fi

    # STRICT on exhaustion: the assert is preserved (see the update-vs-install
    # split above) — a package we actually need being unavailable still fails
    # loudly rather than degrading to a false-green. Failing HERE, inside the
    # budget, is the whole point: the script exits with a readable cause instead
    # of the job being killed mid-`apt-get` and reported as `cancelled`.
    if [ "$apt_install_rc" -ne 0 ]; then
      echo "✗ apt-get install did not succeed within the ${apt_budget}s apt budget" >&2
      echo "  (${apt_attempts} attempts, rc=${apt_install_rc})." >&2
      echo "  Read the per-attempt throughput above before reaching for a knob:" >&2
      echo "    bytes still arriving  → a SLOW mirror. Fetch fewer bytes" >&2
      echo "      (ZETA_HOST_TIER=slim) or none (ZETA_APT_ARCHIVES_DIR + a warm" >&2
      echo "      cache). In CI the budget is NOT the lever — it is sized to fit" >&2
      echo "      inside every job's timeout-minutes with 18s of fleet-wide margin." >&2
      echo "    no bytes arriving     → a WEDGED mirror, or a package genuinely" >&2
      echo "      unavailable. rc=100 above would name the package." >&2
      echo "  On a laptop, ZETA_APT_BUDGET_SECONDS=<larger> is the right override;" >&2
      echo "  there is no outer job timeout to collide with." >&2
      exit "$apt_install_rc"
    fi
  else
    echo "✓ apt manifest empty; skipping"
  fi
fi
echo "✓ apt packages up to date"

# ── 2. mise ─────────────────────────────────────────────────────────
# NixOS: use declarative system mise (common.nix / installer ISO). Upstream
# release tarballs are glibc-linked and fail with "cannot execute: required
# file not found" when copied to ~/.local/bin (observed iter-5.5.0 QEMU CI +
# zeta-install.sh Step 6.95a on the live ISO).
linux_sh_prepend_nixos_mise() {
  for _bin_dir in \
      /run/current-system/sw/bin \
      "${HOME}/.nix-profile/bin" \
      /nix/var/nix/profiles/default/bin; do
    if [ -x "${_bin_dir}/mise" ]; then
      export PATH="${_bin_dir}:${PATH}"
      return 0
    fi
  done
  return 1
}

if [ "$IS_NIXOS" = 1 ]; then
  linux_sh_prepend_nixos_mise || true
  if [ -f "${HOME}/.local/bin/mise" ] && ! "${HOME}/.local/bin/mise" --version >/dev/null 2>&1; then
    echo "↻ removing broken tarball mise from ${HOME}/.local/bin/mise (not executable on NixOS)"
    rm -f "${HOME}/.local/bin/mise"
  fi
fi

# Pinned to a specific mise release tarball + verified SHA256 (per
# arch). Resolves Scorecard PinnedDependenciesID #16 (downloadThenRun
# not pinned by hash). The official `curl mise.run | sh` installer
# auto-detects the latest release at runtime, which is what Scorecard
# flags. Bumping: pull /repos/jdx/mise/releases/latest, update
# MISE_VERSION + ALL MISE_SHA256_* values together (gnu + musl, three
# arches) — they form a content-pin set.
# Skipped on real NixOS — tarball mise is not FHS-compatible; use system mise.
# 081KSKBP80008QG0R000E3RKPK docker harness wires /lib64/ld-linux-*.so.* so tarball mise works there.
# 081KZETP6AT: these are THREE different questions and were previously one
# predicate. Enabling programs.nix-ld (foreign-binaries.nix) creates the loader
# stub at /lib64/ld-linux-x86-64.so.2, which under the old single predicate would
# have flipped `tarball_mise_allowed` to TRUE on real NixOS for the first time —
# silently re-enabling a path that is deliberately fatal there, and shadowing the
# pinned, autoPatchelf'd system mise with a tarball copy in ~/.local/bin.
# So: "is there a loader" (capability) is decoupled from "should we use the
# tarball" (policy).

# Capability: can a foreign dynamically-linked ELF exec here at all?
linux_sh_fhs_loader_present() {
  [ -e /lib64/ld-linux-x86-64.so.2 ] || [ -e /lib/ld-linux-aarch64.so.1 ]
}

# Is a DECLARATIVE (system/nix-profile) mise present? On NixOS this is the
# canonical one — pinned + autoPatchelf'd via overlays/mise-pin.nix.
linux_sh_nixos_system_mise_present() {
  local _sys_mise_dir
  for _sys_mise_dir in \
      /run/current-system/sw/bin \
      "${HOME}/.nix-profile/bin" \
      /nix/var/nix/profiles/default/bin; do
    [ -x "${_sys_mise_dir}/mise" ] && return 0
  done
  return 1
}

# Policy: may we install the TARBALL mise on NixOS?
#  - docker harness (081KSKBP80008QG0R000E3RKPK): yes — it wires a loader and
#    ships no system mise, so the tarball is the only route.
#  - real NixOS with a declarative mise: NO, even now that nix-ld provides a
#    loader. The system mise is canonical; a tarball copy would shadow it.
#  - real NixOS without a declarative mise: only if a loader exists at all.
# Order matters: the declarative-mise check comes FIRST so the stated policy
# ("system mise is canonical, never shadow it") actually holds everywhere,
# including a NixOS container that ships one. Checking /.dockerenv first would
# hand such a container the tarball and contradict the comment above (Kira, PR
# #10196 review). The docker harness is unaffected either way — it ships no
# system mise, and in BuildKit RUN steps /.dockerenv does not even exist, so it
# qualifies via the loader arm it wires itself.
linux_sh_nixos_tarball_mise_allowed() {
  linux_sh_nixos_system_mise_present && return 1
  [ -f /.dockerenv ] && return 0
  linux_sh_fhs_loader_present
}

MISE_PIN_VERSION="2026.6.12"
MISE_VERSION="v${MISE_PIN_VERSION}"
MISE_SHA256_X64="cc9b5bc96ba616d88d0ee515196bec6871a33d64cec774924fbfaa2717a921fd"
MISE_SHA256_ARM64="6cef74020f98b06a62d6f925c116235b629b4badb197b20a33217bff96d60f0f"
MISE_SHA256_ARMV7="24ac747716373ffa5efbdee889632d21569eae275ece929b1c04cfee6e4b7c45"
# musl twins of the same pinned release (part of the content-pin set —
# bump all six SHA256 values together with MISE_VERSION). Chosen
# automatically on hosts whose glibc is too old for the gnu build
# (mise gnu builds need glibc >= 2.38 since ~2025) and on musl libcs.
MISE_SHA256_X64_MUSL="3ce5ad40a9ce0280e0f80e447cfbcfa0b40281b9d4d0fd5a0a66c47c28c2a5e3"
MISE_SHA256_ARM64_MUSL="39905c8a85c3ef0bae3ba665b0ac602bc338da599f8c4a0c7912e7ebc4930201"
MISE_SHA256_ARMV7_MUSL="9b0e0959ff1bb8cca81bcaf3dedd963083a112408c06bde756f5ff3094ef613e"

installed_mise_version=""
if command -v mise >/dev/null 2>&1; then
  installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
fi

if [ "$installed_mise_version" != "$MISE_PIN_VERSION" ]; then
  if [ "$IS_NIXOS" = 1 ] && ! linux_sh_nixos_tarball_mise_allowed; then
    if linux_sh_nixos_system_mise_present; then
      # 081KZETP6AT: system mise exists but is not the pinned version. We refuse to
      # shadow it with a tarball copy — the fix is to bump the nix pin, not to
      # sidestep it (that is how the two version sources drift apart).
      echo "error: system mise on NixOS is '${installed_mise_version:-unknown}', expected pinned '${MISE_PIN_VERSION}'" >&2
      echo "  bump full-ai-cluster/nixos/overlays/mise-pin.nix to match MISE_PIN_VERSION" >&2
      echo "  (refusing to install a tarball mise that would shadow the declarative one)" >&2
    else
      echo "error: mise not found on PATH on NixOS" >&2
      echo "  declare mise in environment.systemPackages (installer ISO + common.nix)" >&2
      echo "  and ensure /run/current-system/sw/bin is on PATH during target bootstrap" >&2
    fi
    exit 1
  fi
  if [ -n "$installed_mise_version" ]; then
    echo "↓ upgrading mise ${installed_mise_version} → ${MISE_PIN_VERSION} (pinned release tarball)..."
  elif [ "$IS_NIXOS" = 1 ]; then
    echo "↓ NixOS (docker/FHS): installing mise from pinned tarball..."
  else
    echo "↓ installing mise from pinned release tarball..."
  fi
  # The previous `curl mise.run | sh` shape supported armv7 implicitly
  # (the installer auto-detects). Preserve that here — no Zeta CI leg
  # uses armv7 today, but dev laptops on a Raspberry Pi 4 in 32-bit
  # mode or older single-board computers do, and the cost of carrying
  # the case is tiny (one extra SHA256 to bump per release).
  # Libc flavor selection (2026-07-08, Otto cowork cell): the gnu tarballs
  # link against glibc >= 2.38 and die with "GLIBC_2.38 not found" on
  # older hosts (Ubuntu 22.04 = 2.35 — sandbox/container cells). The musl
  # twin of the SAME pinned version is static and runs anywhere, so the
  # declarative shape is unchanged: detect, pick the pinned musl asset.
  MISE_LIBC=gnu
  if ldd --version 2>&1 | head -n 1 | grep -qi musl; then
    MISE_LIBC=musl
  else
    _glibc_ver="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')" || _glibc_ver=""
    if [ -n "${_glibc_ver}" ]; then
      _glibc_major="${_glibc_ver%%.*}"
      _glibc_minor="${_glibc_ver#*.}"; _glibc_minor="${_glibc_minor%%.*}"
      if [ "${_glibc_major}" -lt 2 ] \
        || { [ "${_glibc_major}" -eq 2 ] && [ "${_glibc_minor}" -lt 38 ]; }; then
        MISE_LIBC=musl
      fi
    fi
  fi
  case "$(uname -m)" in
    x86_64|amd64)  MISE_ARCH=x64;    MISE_SHA256="${MISE_SHA256_X64}";   MISE_SHA256_MUSL="${MISE_SHA256_X64_MUSL}"   ;;
    aarch64|arm64) MISE_ARCH=arm64;  MISE_SHA256="${MISE_SHA256_ARM64}"; MISE_SHA256_MUSL="${MISE_SHA256_ARM64_MUSL}" ;;
    armv7l|armv7)  MISE_ARCH=armv7;  MISE_SHA256="${MISE_SHA256_ARMV7}"; MISE_SHA256_MUSL="${MISE_SHA256_ARMV7_MUSL}" ;;
    *) echo "error: unsupported arch $(uname -m) for mise install" >&2; exit 1 ;;
  esac
  if [ "${MISE_LIBC}" = "musl" ]; then
    echo "· libc gate: $(getconf GNU_LIBC_VERSION 2>/dev/null || echo musl) < glibc 2.38 — using musl build"
    MISE_ARCH="${MISE_ARCH}-musl"
    MISE_SHA256="${MISE_SHA256_MUSL}"
  fi
  MISE_TARBALL="mise-${MISE_VERSION}-linux-${MISE_ARCH}.tar.gz"
  MISE_URL="https://github.com/jdx/mise/releases/download/${MISE_VERSION}/${MISE_TARBALL}"
  MISE_TMP="$(mktemp -d)"
  # Always clean up the tmp dir, even on failure (download error, SHA
  # mismatch, tar extract failure). `set -euo pipefail` would otherwise
  # leak the directory on any failure path.
  trap 'rm -rf "${MISE_TMP}"' EXIT
  # Retry-equipped fetch — absorbs transient upstream 5xx without
  # requiring a workflow rerun.
  curl_fetch --output "${MISE_TMP}/${MISE_TARBALL}" "${MISE_URL}"
  # Portable SHA256 verification: sha256sum (Linux) or shasum (macOS,
  # though linux.sh runs on Linux only). Per the 4-shell portability
  # target (macOS bash 3.2 / Ubuntu / git-bash / WSL).
  if command -v sha256sum >/dev/null 2>&1; then
    echo "${MISE_SHA256}  ${MISE_TMP}/${MISE_TARBALL}" | sha256sum -c -
  else
    echo "${MISE_SHA256}  ${MISE_TMP}/${MISE_TARBALL}" | shasum -a 256 -c -
  fi
  tar -C "${MISE_TMP}" -xzf "${MISE_TMP}/${MISE_TARBALL}"
  mkdir -p "${HOME}/.local/bin"
  mv "${MISE_TMP}/mise/bin/mise" "${HOME}/.local/bin/mise"
  # Tmp dir cleanup happens via the EXIT trap above.
  export PATH="${HOME}/.local/bin:${PATH}"
fi
# Pinned tarball installs above; pre-existing mise on PATH is kept as-is.
# Always mark self-update disabled — Zeta bumps mise via linux.sh / flake / brew.
mkdir -p "${MISE_DATA_DIR:-$HOME/.local/share/mise}"
touch "${MISE_DATA_DIR:-$HOME/.local/share/mise}/.disable-self-update"
echo "✓ mise: $(mise --version)"

# ── 3-10. Common steps ──────────────────────────────────────────────
# 081KZETP6AT preflight — fail FAST and legibly, instead of slowly and cryptically.
# mise downloads PREBUILT toolchains (bun/node/python/rust/java/dotnet) that are
# dynamically linked against the FHS loader. Without a loader they cannot execve,
# and mise reports it as the famously misleading "cannot execute: required file
# not found" AFTER downloading ~2 GB — three times over, under the caller's retry.
# The condition is deterministic, so detect it up front and say what to do.
# Guarded on IS_NIXOS, so dev laptops / CI runners / devcontainers (no /etc/NIXOS)
# are provably unaffected; the docker harness wires a loader, so it passes too.
# NOTE: test the LOADER FILE nix-ld points at, never merely `[ -n "$NIX_LD" ]`.
# NIX_LD is an environment.variables export; the /lib64 stub is created by a
# DIFFERENT mechanism (nix-ld's systemd-tmpfiles rule). They are not the same
# fact, and NIX_LD is inherited by every subshell, `sudo -E`, container and
# chroot — so a leaked var with no stub present would silently disarm exactly
# the check this block exists to perform (Kira, PR #10196 review).
if [ "$IS_NIXOS" = 1 ] \
  && ! linux_sh_fhs_loader_present \
  && [ ! -e "${NIX_LD:-/nonexistent}" ]; then
  echo "error: NixOS without an FHS loader — mise's prebuilt toolchains cannot exec." >&2
  echo "  every dynamically-linked tool (bun/node/python/rust/java/dotnet) will fail" >&2
  echo "  with 'cannot execute: required file not found' (missing ELF interpreter)." >&2
  echo "  fix: enable programs.nix-ld — full-ai-cluster/nixos/modules/foreign-binaries.nix" >&2
  echo "  (imported by nixos/modules/common.nix and the installer ISO configuration)" >&2
  exit 1
fi

# mise.sh runs `mise install` from .mise.toml, which now includes
# dotnet (round-34 flip). No separate dotnet install step needed;
# mise shims handle PATH. `~/.dotnet/tools` still needs PATH for
# `dotnet tool install -g` globals — that's dotnet's own convention
# independent of where the SDK lives. shellenv.sh wires it.
"$SETUP_DIR/common/mise.sh"

# Put mise shims on THIS shell's PATH so subsequent common/*.sh
# subprocesses (python-tools, dotnet-tools, verifiers) inherit it
# and can invoke dotnet / uv / bun / java / python from the mise
# install. mise.sh also tries to export this but it exports inside
# its own subprocess; parent inherit needs the parent to export.
for shim_dir in \
    "$HOME/.local/share/mise/shims" \
    "/opt/homebrew/opt/mise/shims" \
    "/opt/homebrew/share/mise/shims"; do
  if [ -d "$shim_dir" ]; then
    export PATH="$shim_dir:$PATH"
    break
  fi
done

# Make ~/.dotnet/tools available for the remainder of this install.sh
# process so from-dotnet-global can install globals into $HOME/.dotnet/tools
# and find them on PATH in the same run.
export PATH="$HOME/.dotnet/tools:$PATH"

if [ "$IS_NIXOS" = 1 ]; then
  realize_mechanisms --post-mise
else
  realize_mechanisms --all
fi
"$SETUP_DIR/common/shellenv.sh"
"$SETUP_DIR/common/profile-edit.sh"

# -- Byte-lock toolchain (Oracles 10-16 / DLA 9-substrate byte-lock) -----------
# All 9 substrates declared in desired-state (common.nix for NixOS, here for
# non-NixOS Ubuntu/Debian). The byte-lock (src/wasm-dla/bytelock/) verifies
# byte-identical walker trajectories across all substrates at any seed.
# Substrates: WAT, LLVM/C, Emscripten, Rust, ASC, Zig (WASM)
#             + JS/V8, Lua 5.4, Go (bytecode/script)
#
# WABT and Lua are declared in manifests/apt; Go is pinned cross-platform in
# .mise.toml. Zig and Rust retain the dedicated idempotent verification scripts.
if [ "$IS_NIXOS" != 1 ]; then
  echo "-- installing Zig (wasm32-freestanding substrate) --"
  bash "$SETUP_DIR/common/install-zig.sh"
  echo "-- installing Rust + wasm32-unknown-unknown target --"
  bash "$SETUP_DIR/common/install-rust-wasm32.sh"
  # Source cargo env so rustc/cargo are on PATH for the remainder of this session
  # shellcheck source=/dev/null
  [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env" || true
fi
echo "OK byte-lock toolchain ready (WAT/C/Emcc/Rust/ASC/Zig WASM + JS/Lua/Go)"
