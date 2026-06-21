/**
 * forge-host/types.ts — host-agnostic data types for the ForgeHost abstraction.
 *
 * These types define the contract between the core loop/tools and any forge host
 * (GitHub, GitLab, Gitea, etc.). No host-specific fields leak through this boundary.
 *
 * Architectural rule: "GitHub is NOT git-native — it's a plugin."
 * (src/Core.FSharp.Git/CredentialSource.fs, Aaron 2026-06-07)
 */
