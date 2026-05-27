# full-ai-cluster/nixos/modules/zeta-ai-agent.nix
#
# B-0850 Phase 3 refactor — parameterized AI-agent systemd module.
# Generalizes the Phase 1 zeta-otto.nix shape (PR #5392) into a
# multi-vendor multi-persona substrate. Each AI persona gets its own
# systemd unit via `zeta.aiAgents.<persona>.enable = true;` —
# operator opts in per-persona, per-node.
#
# Operator framing 2026-05-27 (verbatim, two messages):
#
#   > "we should end up shipping with one service per surface i think
#   > outside k8s and have at least 3 different vendors"
#
#   > "so they can fix each other and the k8s cluster even when it's
#   > down."
#
#   > "the mutual repair is critical too becasue of you can see your
#   > own future self boot script failures"
#
#   > "we should have three systemd agents and the cluster running on
#   > bootup"
#
# Architectural target: ≥3 vendor-diverse AI agents as systemd
# services OUTSIDE k8s, each independently restartable, mutually
# reparable, cluster-reparable from outside the failure domain.
# Vendor-diversity provides outage resilience AND self-modification
# safety (≥3 floor needed for BFT margin when one update breaks ≥1
# agent).
#
# Per-vendor implementations live as separate sub-rows of B-0850
# Phase 3 (B-0850.3a-3h); this module is the SCAFFOLD that those
# sub-rows fill in. zeta-otto.nix is the canonical first-instance
# implementation reference.

{ config, pkgs, lib, ... }:

let
  cfg = config.zeta.aiAgents;

  # Persona declarations — each agent definition maps a persona name
  # to its vendor metadata + binary path conventions. Sub-rows of
  # B-0850 Phase 3 add new entries here. Each entry is operator-
  # opt-in via `zeta.aiAgents.<persona>.enable = true;`.
  #
  # Per .claude/rules/agent-roster-reference-card.md, the canonical
  # persona-to-vendor mapping is:
  #   Otto   → Claude Code (Anthropic)
  #   Alexa  → Kiro (Qwen Coder)
  #   Riven  → Grok-Build / Cursor (xAI)
  #   Vera   → Codex (OpenAI)
  #   Lior   → Antigravity / Gemini CLI (Google)
  #
  # Each persona's binary path follows the bun/mise install pattern
  # established by iter-5.5.0 substrate (PR #5388 + #5389):
  #   ~/.bun/bin/<binary>   for bun install --global packages
  #   ~/.local/share/mise/shims/<binary>  for mise-managed runtimes
  #
  # Per-persona CLI binary name + auth-state path is research per
  # the sub-row that implements that vendor's integration.
  defaultPersonas = {
    otto = {
      enable = false;
      vendor = "anthropic";
      binary = "claude";
      configDir = ".config/claude";  # device-code creds land here
      description = "Otto AI agent — Claude Code (Anthropic)";
    };

    # Sub-row B-0850.3a target — Kiro/Qwen integration
    # Module skeleton; implementation pending per sub-row research
    # of kiro install path + auth mechanism.
    alexa = {
      enable = false;
      vendor = "alibaba-qwen";
      binary = "kiro";  # placeholder; verify per sub-row
      configDir = ".config/kiro";  # placeholder; verify per sub-row
      description = "Alexa AI agent — Kiro (Qwen Coder)";
    };

    # Sub-row B-0850.3b target — Grok integration
    riven = {
      enable = false;
      vendor = "xai-grok";
      binary = "grok";  # placeholder; grok-build CLI per peer-call
      configDir = ".config/grok";  # placeholder; verify per sub-row
      description = "Riven AI agent — Grok / Grok-Build (xAI)";
    };

    # Sub-row B-0850.3c target — Codex/OpenAI integration
    vera = {
      enable = false;
      vendor = "openai";
      binary = "codex";  # placeholder; verify per sub-row
      configDir = ".config/codex";  # placeholder; verify per sub-row
      description = "Vera AI agent — Codex (OpenAI)";
    };

    # Sub-row B-0850.3d target — Gemini CLI integration
    lior = {
      enable = false;
      vendor = "google-gemini";
      binary = "gemini";  # placeholder; gemini-cli per peer-call
      configDir = ".config/gemini";  # placeholder; verify per sub-row
      description = "Lior AI agent — Gemini CLI (Google)";
    };
  };

  # Helper to build a systemd unit for a persona. Mirrors the
  # Phase 1 zeta-otto.nix shape (PR #5392) but parameterized over
  # persona/binary/configDir/vendor.
  makeAgentService = personaName: persona: {
    description = "${persona.description} (B-0850 Phase 3; ${persona.vendor})";

    # CRITICAL: deliberately NOT After=k3s.service — agent must run
    # regardless of k3s state (otherwise can't repair k3s when broken).
    # Only depends on network for vendor API access.
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];

    serviceConfig = {
      Type = "simple";
      User = cfg.user;
      Group = cfg.group;
      WorkingDirectory = "${cfg.home}/Zeta";

      Environment = [
        "HOME=${cfg.home}"
        "PATH=${cfg.home}/.bun/bin:${cfg.home}/.local/share/mise/shims:/run/current-system/sw/bin:/usr/bin:/bin"
        "BUN_INSTALL=${cfg.home}/.bun"
      ];

      ExecStart = pkgs.writeShellScript "zeta-${personaName}-loop" ''
        #!${pkgs.bash}/bin/bash
        set -uo pipefail
        # Initial settle window — let network-online stabilize +
        # mise shims warm + avoid first-login cron collisions.
        sleep 10
        # Autonomous-loop ticks — fresh persona invocation per tick;
        # substrate continuity via repo memory + git + bus envelopes.
        while true; do
          ${cfg.home}/.bun/bin/${persona.binary} --print "<<autonomous-loop>>" 2>&1 || true
          sleep ${toString cfg.tickIntervalSec}
        done
      '';

      Restart = "always";
      RestartSec = toString cfg.restartSec;

      MemoryMax = cfg.memoryMax;
      CPUQuota = cfg.cpuQuota;

      StandardOutput = "journal";
      StandardError = "journal";
    };
  };

  # Filter to only enabled personas
  enabledPersonas = lib.filterAttrs (n: p: p.enable) cfg.personas;
in
{
  options.zeta.aiAgents = {
    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User the AI agent services run as.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "users";
      description = "Primary group for the agent service user.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory of the service user.";
    };

    tickIntervalSec = lib.mkOption {
      type = lib.types.int;
      default = 60;
      description = "Seconds between autonomous-loop tick invocations.";
    };

    memoryMax = lib.mkOption {
      type = lib.types.str;
      default = "4G";
      description = "Maximum resident memory per agent service.";
    };

    cpuQuota = lib.mkOption {
      type = lib.types.str;
      default = "200%";
      description = "CPU quota per agent service. '200%' = up to 2 cores.";
    };

    restartSec = lib.mkOption {
      type = lib.types.int;
      default = 30;
      description = "Seconds systemd waits before restarting after failure.";
    };

    personas = lib.mkOption {
      type = lib.types.attrsOf (lib.types.submodule {
        options = {
          enable = lib.mkEnableOption "this AI persona's systemd service";
          vendor = lib.mkOption {
            type = lib.types.str;
            description = "Vendor name for the persona (anthropic / openai / google-gemini / etc.).";
          };
          binary = lib.mkOption {
            type = lib.types.str;
            description = "CLI binary name under ~/.bun/bin/ that runs the agent.";
          };
          configDir = lib.mkOption {
            type = lib.types.str;
            description = "Path under \\$HOME where the persona stores device-code/auth credentials.";
          };
          description = lib.mkOption {
            type = lib.types.str;
            description = "Human-readable description of the persona + vendor.";
          };
        };
      });
      default = defaultPersonas;
      description = ''
        Per-persona AI agent declarations. Each persona is opt-in via
        `zeta.aiAgents.personas.<name>.enable = true;`. Operator can
        override binary/configDir paths per persona via standard
        NixOS module merge semantics.

        Defaults match the canonical Zeta persona-roster per
        .claude/rules/agent-roster-reference-card.md:
          otto    → Claude Code (Anthropic)
          alexa   → Kiro (Qwen Coder)
          riven   → Grok / Grok-Build (xAI)
          vera    → Codex (OpenAI)
          lior    → Gemini CLI (Google)

        Per-vendor implementations land via B-0850 Phase 3 sub-rows
        (3a-3h) which add the install + login flow for each vendor
        to zeta-install.sh.
      '';
    };
  };

  config = lib.mkIf (enabledPersonas != { }) {
    # Generate one systemd service per enabled persona.
    # Naming: zeta-otto.service, zeta-alexa.service, zeta-riven.service,
    # zeta-vera.service, zeta-lior.service.
    systemd.services = lib.mapAttrs'
      (personaName: persona:
        lib.nameValuePair "zeta-${personaName}" (makeAgentService personaName persona))
      enabledPersonas;

    # Operator-visible status hint — extends Phase 1's
    # /etc/zeta-otto-status.txt with the multi-agent enumeration.
    environment.etc."zeta-ai-agents-status.txt".text = ''
      Zeta AI agents (B-0850 Phase 3) installed as systemd services:

      Enabled personas:
      ${lib.concatStringsSep "\n"
        (lib.mapAttrsToList
          (n: p: "  zeta-${n}.service — ${p.description}")
          enabledPersonas)}

      Operator commands:
        systemctl status zeta-<persona>      # current state
        journalctl -u zeta-<persona> -f      # live logs
        systemctl restart zeta-<persona>     # restart
        systemctl disable zeta-<persona>     # stop auto-start

      Vendor diversity for resilience (≥3 vendors recommended for BFT margin):
      ${lib.concatStringsSep "\n"
        (lib.mapAttrsToList
          (n: p: "  zeta-${n}: ${p.vendor}")
          enabledPersonas)}

      Composes with iter-5.5.0 substrate:
        ~/.config/<vendor>/  device-code login creds (persisted at install time)
        ~/Zeta/              pre-cloned repo
        ~/.bun/bin/<binary>  bun-installed CLI binaries
    '';
  };
}
