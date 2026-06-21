# full-ai-cluster/nixos/modules/zeta-ai-agent.nix
#
# B-0850 Phase 3 refactor — parameterized AI-agent systemd module.
# Generalizes the Phase 1 zeta-otto.nix shape (PR #5392) into a
# multi-vendor multi-persona substrate. Each AI persona gets its own
# systemd unit via `zeta.aiAgents.enable.<persona> = true;` —
# operator opts in per-persona, per-node.
#
# Operator framing 2026-05-27 (verbatim, three messages):
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
# sub-rows fill in.

{ config, pkgs, lib, ... }:

let
  cfg = config.zeta.aiAgents;

  # Persona registry — STATIC declarations of all supported AI
  # personas + their vendor metadata. NOT exposed as a NixOS option
  # (would cause submodule-merge issues per the build-iso PR #5394
  # CI failure). Operator opts in per-persona via the boolean
  # enable.<persona> options below.
  #
  # Per .claude/rules/agent-roster-reference-card.md canonical
  # persona-to-vendor mapping. Each persona's binary path follows
  # the bun/mise install pattern established by iter-5.5.0 substrate
  # (PR #5388 + #5389): ~/.bun/bin/<binary> for `bun install --global`
  # packages.
  personas = {
    otto = {
      vendor = "anthropic";
      binary = "claude";
      # Claude Code uses --print for non-interactive one-shot mode
      # with the <<autonomous-loop>> sentinel triggering the
      # autonomous-loop skill (per `.claude/rules/tick-must-never-stop.md`).
      invocationArgs = [ "--print" "<<autonomous-loop>>" ];
      description = "Otto AI agent — Claude Code (Anthropic)";
    };

    # Sub-row B-0850.3a target — Kiro/Qwen integration
    # Module skeleton; implementation pending per sub-row research
    # of kiro install path + auth mechanism.
    alexa = {
      vendor = "alibaba-qwen";
      binary = "kiro";  # placeholder; verify per sub-row
      invocationArgs = [ ];  # placeholder per sub-row
      description = "Alexa AI agent — Kiro (Qwen Coder)";
    };

    # Sub-row B-0850.3b target — Grok integration
    riven = {
      vendor = "xai-grok";
      binary = "grok";  # placeholder; grok-build CLI per peer-call
      invocationArgs = [ ];  # placeholder per sub-row
      description = "Riven AI agent — Grok / Grok-Build (xAI)";
    };

    # Sub-row B-0850.3c — Codex/OpenAI integration (shipped this PR).
    # Codex uses `exec` SUBCOMMAND (not a --print flag) for non-
    # interactive mode per the codex CLI docs. The <<autonomous-loop>>
    # string is a Claude Code sentinel; codex sees it as a literal
    # prompt and responds conversationally (acceptable for first ship;
    # B-0850 Phase 3.x can introduce per-vendor prompt mapping).
    vera = {
      vendor = "openai";
      binary = "codex";
      invocationArgs = [ "exec" "<<autonomous-loop>>" ];
      description = "Vera AI agent — Codex (OpenAI)";
    };

    # Sub-row B-0850.3d — Antigravity CLI integration.
    # agy uses -p flag (NOT --print) for non-interactive prompts.
    # Like codex, the <<autonomous-loop>> sentinel is a Claude Code
    # convention; agy sees it as a literal prompt.
    lior = {
      vendor = "google-gemini";
      binary = "agy";
      invocationArgs = [ "-p" "<<autonomous-loop>>" ];
      description = "Lior AI agent — Antigravity CLI (Google)";
    };
  };

  # Helper to build a systemd unit for a persona. Mirrors the
  # Phase 1 zeta-otto.nix shape (PR #5392) but parameterized over
  # the static persona registry.
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
        "PATH=${cfg.home}/.bun/bin:${cfg.home}/.local/bin:${cfg.home}/.local/share/mise/shims:/run/current-system/sw/bin:/usr/bin:/bin"
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
        # Per-persona invocationArgs (P0 fix per Copilot review on
        # PR #5398: each CLI has different non-interactive flags —
        # claude --print, gemini -p, codex exec — NOT all --print).
        while true; do
          ${persona.binary} ${lib.concatStringsSep " " (map (a: "\"${a}\"") persona.invocationArgs)} 2>&1 || true
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

  # Filter to only enabled personas from the static registry
  enabledPersonas = lib.filterAttrs (n: p: cfg.enable.${n} or false) personas;
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

    # Per-persona enable booleans — opt-in for each AI agent
    # persona. Persona registry is static (in `let` above); operator
    # picks which ones to deploy on each node via these options.
    enable = {
      otto = lib.mkEnableOption "Otto (Anthropic Claude Code) systemd service";
      alexa = lib.mkEnableOption "Alexa (Kiro / Qwen Coder) systemd service [B-0850.3a pending implementation]";
      riven = lib.mkEnableOption "Riven (xAI Grok / Grok-Build) systemd service [B-0850.3b pending implementation]";
      vera = lib.mkEnableOption "Vera (OpenAI Codex) systemd service [B-0850.3c pending implementation]";
      lior = lib.mkEnableOption "Lior (Google Antigravity CLI) systemd service";
    };
  };

  config = lib.mkIf (enabledPersonas != { }) {
    # Pre-evaluation assertions — fail flake evaluation with clear
    # message if operator enables a persona whose implementation
    # substrate has NOT yet shipped (per Copilot review on PR #5395:
    # placeholder binaries would cause restart-looping services at
    # boot; better to fail at flake-eval time with actionable error).
    #
    # Each pending persona's install + login flow lands via the
    # corresponding B-0850 Phase 3 sub-row. Until that sub-row ships,
    # the persona's enable boolean is reserved-but-blocked.
    assertions = [
      {
        assertion = !cfg.enable.alexa;
        message = ''
          zeta.aiAgents.enable.alexa = true requires B-0850.3a
          (Alexa/Kiro install + login substrate) which has not shipped.
          Enabling now would create a zeta-alexa.service that fails
          ExecStart (binary kiro doesn't exist at ~/.bun/bin/kiro).
        '';
      }
      {
        assertion = !cfg.enable.riven;
        message = ''
          zeta.aiAgents.enable.riven = true requires B-0850.3b
          (Riven/Grok install + login substrate) which has not shipped.
          Enabling now would create a zeta-riven.service that fails
          ExecStart (binary grok doesn't exist at ~/.bun/bin/grok).
        '';
      }
      # B-0850.3c/3d (Vera/Codex + Lior/Antigravity) shipped: the
      # assertions are removed. zeta-install.sh Step 6.95 delegates
      # package installation to tools/setup/install.sh, whose
      # mechanisms/from-bun-global.sh consumes tools/setup/manifests/from-bun-global
      # for codex/claude, and one-liner-tools.sh consumes manifests/one-liner-tools
      # for agy. The persona-specific Step 6.95b login flows remain
      # in zeta-install.sh for codex/claude because auth is operator-interactive.
    ];

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
