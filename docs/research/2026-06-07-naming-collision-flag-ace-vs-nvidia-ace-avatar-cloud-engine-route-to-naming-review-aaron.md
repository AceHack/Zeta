# Naming-collision FLAG: our "Ace" vs NVIDIA ACE (Avatar Cloud Engine) — route to naming review (Aaron, 2026-06-07)

Aaron: *"I think NVIDIA has something called NVIDIA ACE that is LLM-based or something."* Verified — it's a real,
significant collision. **Flagging for `naming-expert` + human decision; no unilateral rename.**

## The collision (verified)

**NVIDIA ACE = "Avatar Cloud Engine"** — a generally-available suite of generative-AI **digital-human**
technologies (LLM-powered interactive avatars), packaged as NVIDIA NIM microservices. Components: **Riva** ASR +
TTS (speech), **Audio2Face** (facial animation), **NeMo LLMs / Nemotron** SLMs (conversation). Used in gaming,
customer service, telehealth. It is an **AI/LLM brand from a major vendor.**

Our **Ace** = the package-manager-of-package-managers / external-state closure engine (081KSGS9H0008QG0R0031PBNGA/081KSKBP80008QG0R000F4311E; #6939–
#6945). Same three letters, AI-adjacent space.

## Why this matters (and why the backronyms worsen it)

- **It's a vendor brand in an overlapping domain (AI).** "Ace" for an AI-ecosystem tool risks confusion and
  trademark friction, especially on public surfaces (the 081KSKBP80008QG0R000F4311E curl-install, distribution, marketing).
- **"Autonomous Cognition Engine" (#6945) collides hardest.** NVIDIA ACE *is* LLM/cognition-adjacent (avatars
  that think/talk). An "Autonomous **Cognition** Engine" reads right into NVIDIA ACE's lane — far more
  collision-prone than "Awesome Closure Engine" (#6943, package-manager/closure framing) or the plain
  package-manager sense. The cognition backronym is the riskiest piece.
- **Severity:** medium-high for *public* use; low for *internal* use (the factory can keep using "Ace"
  internally). The risk is at the public/marketing/trademark boundary, not the codebase.

## Options (for naming-expert + human to decide — NOT decided here)

1. **Rename the public surface** (keep "Ace" internal-only, or pick a new public name for the PM/distribution).
2. **Disambiguate** — never bare "Ace" publicly; always a qualified form (e.g. "Zeta Ace" / a distinct product
   name) so it's clearly not NVIDIA ACE.
3. **Drop / demote the "Autonomous Cognition Engine" backronym** (the worst collider) for public use; keep
   "Awesome Closure Engine" / package-manager framing, which sits in a different lane.
4. **Accept** — argue different markets (dependency management vs avatars) make confusion unlikely; document the
   risk acceptance. (Weakest option given both are AI-space and NVIDIA is a major mark.)

Recommendation (advisory only): treat **internal use as fine**, but **gate any public/marketing/repo-public use
of "Ace" — and especially "Autonomous Cognition Engine" — on `naming-expert` (Ilyana) review + human sign-off**,
leaning toward disambiguation or a public rename. The decision is the human's (naming is a gated class).

## Honest scope

- A **naming-governance flag**, not a decision and not a rename. Per the naming discipline (anchor-to-human-prior-
  art / `naming-expert`), public naming is gated on review + human sign-off; this doc surfaces the risk and
  options, nothing more.
- The collision is **verified** (NVIDIA ACE = Avatar Cloud Engine, GA, LLM-based). The severity assessment is a
  judgment to confirm with naming-expert + (if it goes public) counsel.

## Ties

- **ACE backronyms** — #6943 (Awesome Closure Engine) + #6945 (Autonomous Cognition Engine); the latter is the
  highest-collision framing.
- **Ace lane** — 081KSGS9H0008QG0R0031PBNGA / 081KSKBP80008QG0R000F4311E / 081KSGS9H0008QG0R001Y9FB62 (`ACTIVE-WORKSTREAMS.md`); public-surface naming risk lands here.
- **Naming discipline** — `naming-expert` (Ilyana) + human sign-off for public names; glossary hygiene.

## Beacon anchors

- **NVIDIA ACE (Avatar Cloud Engine)** — generative-AI digital-human suite (Riva/Audio2Face/NeMo), GA. Sources:
  [NVIDIA Newsroom — digital-human ACE microservices](https://nvidianews.nvidia.com/news/digital-humans-ace-generative-ai-microservices) ·
  [NVIDIA — Build Lifelike Digital Humans with ACE (GA)](https://developer.nvidia.com/blog/build-lifelike-digital-humans-with-nvidia-ace-now-generally-available/) ·
  [NVIDIA ACE overview](https://archive.docs.nvidia.com/ace/overview/latest/index.html). · **Trademark
  confusion / same-name-different-product** (the governance concern). Honest novelty: none — a verified naming-
  collision flag routing the "Ace"/"Autonomous Cognition Engine" public-naming question to naming-expert + human.
