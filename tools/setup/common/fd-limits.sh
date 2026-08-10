#!/usr/bin/env bash
# fd-limits.sh — file-descriptor headroom for parallel builds.
#
# WHY THIS EXISTS
# ---------------
# A three-way parallel build (three git worktrees, each running `dotnet build -c Release`
# with its own MSBuild node set) died with:
#
#     Too many open files in system
#
# Note "in system", not "in process". These are two different limits and only one of them
# was low:
#
#   per-process   ulimit -n            1048576   ← already fine
#   system-wide   kern.maxfiles           65536   ← the actual ceiling that was hit
#
# Raising `ulimit -n` does nothing for this failure. The knob is the system-wide table.
#
# IS RAISING IT SAFE?
# -------------------
# The limit is a CEILING, not a RESERVATION. The kernel does not preallocate anything when
# you raise it; memory is consumed per *open* descriptor (a small kernel struct, order of
# hundreds of bytes), so cost tracks actual usage rather than the limit. Raising it 10x
# costs nothing until 10x the descriptors are actually open.
#
# The low default is resource-exhaustion protection — one runaway process should not be able
# to drain a system-wide table and wedge the machine for every other process. That is a
# fork-bomb/DoS guard, and it is the real reason the default is conservative rather than any
# memory concern. macOS additionally ships legacy-conservative values that predate machines
# with dozens of cores building in parallel.
#
# So the tradeoff is: keep a low ceiling and let honest parallel builds fail, or raise it and
# lose some protection against a runaway process. For a development host running our own
# builds, raised is correct.
#
# NOT APPLIED AUTOMATICALLY. Raising system limits needs root and changes machine-wide
# settings, so this file only DETECTS and PRINTS the exact command. A human applies it.

ZETA_FD_WANT_SYSTEM=${ZETA_FD_WANT_SYSTEM:-655360}   # 10x the macOS default
ZETA_FD_WANT_PERPROC=${ZETA_FD_WANT_PERPROC:-262144}

# Print the current system-wide max, or empty if it cannot be determined.
zeta_fd_system_max() {
  case "$(uname -s)" in
    Darwin) sysctl -n kern.maxfiles 2>/dev/null ;;
    Linux)  cat /proc/sys/fs/file-max 2>/dev/null ;;
    *)      echo "" ;;
  esac
}

# 0 if there is enough headroom for parallel builds, 1 if not.
zeta_fd_headroom_ok() {
  local cur
  cur=$(zeta_fd_system_max)
  [ -n "$cur" ] || return 0            # unknown platform — do not nag
  [ "$cur" -ge "$ZETA_FD_WANT_SYSTEM" ]
}

# The exact commands a human runs to fix it. Printed, never executed.
zeta_fd_remedy() {
  case "$(uname -s)" in
    Darwin)
      cat <<REMEDY
  # macOS — raise the system-wide file table (needs sudo).
  # Live, until reboot:
  sudo sysctl -w kern.maxfiles=${ZETA_FD_WANT_SYSTEM} kern.maxfilesperproc=${ZETA_FD_WANT_PERPROC}

  # Persist across reboots — launchd owns this on macOS, /etc/sysctl.conf is NOT reliable:
  sudo tee /Library/LaunchDaemons/limit.maxfiles.plist >/dev/null <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>limit.maxfiles</string>
  <key>ProgramArguments</key><array>
    <string>launchctl</string><string>limit</string><string>maxfiles</string>
    <string>${ZETA_FD_WANT_PERPROC}</string><string>${ZETA_FD_WANT_SYSTEM}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>ServiceIPC</key><false/>
</dict></plist>
PLIST
  sudo launchctl load -w /Library/LaunchDaemons/limit.maxfiles.plist
REMEDY
      ;;
    Linux)
      cat <<REMEDY
  # Linux — raise the system-wide file table and the per-user cap (needs sudo).
  echo "fs.file-max = ${ZETA_FD_WANT_SYSTEM}" | sudo tee /etc/sysctl.d/60-zeta-file-max.conf
  sudo sysctl --system

  # Per-user soft/hard limits for login shells:
  printf '* soft nofile %s\n* hard nofile %s\n' ${ZETA_FD_WANT_PERPROC} ${ZETA_FD_WANT_PERPROC} \\
    | sudo tee /etc/security/limits.d/60-zeta-nofile.conf

  # systemd services do NOT read limits.conf — set it there too if builds run under systemd:
  sudo mkdir -p /etc/systemd/system.conf.d
  printf '[Manager]\nDefaultLimitNOFILE=%s\n' ${ZETA_FD_WANT_PERPROC} \\
    | sudo tee /etc/systemd/system.conf.d/60-zeta-nofile.conf
  sudo systemctl daemon-reexec
REMEDY
      ;;
  esac
}
