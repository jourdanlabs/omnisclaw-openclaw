# OMNISCLAW Operating Guide

OMNISCLAW is the JourdanLabs fork of OpenClaw with a BIFROST delivery gate installed in the reply path. The goal is simple: keep OpenClaw useful while making final user-visible answers harder to overclaim.

## What It Gates

OMNISCLAW applies BIFROST to:

- Final auto-reply payloads before delivery to connected channels.
- Direct `omnisclaw agent` command payloads before they are shown or delivered.
- Replies that contain gate language, absolute claims, legal/medical/financial/current claims, URLs, dates, numbers, or other high-risk assertions.

OMNISCLAW intentionally does not apply BIFROST to:

- Reasoning payloads.
- Error payloads.
- Compaction notices.
- Non-final tool or block payloads.
- Casual low-claim replies that do not make risky assertions.

## Requirements

- Node 24 recommended, Node 22.16+ minimum.
- pnpm 10.
- A local BIFROST checkout. By default the helper expects `../bifrost` next to this repository. Override with `BIFROST_REPO_DIR=/path/to/bifrost`.
- macOS launchd is supported by the stack helper today. Linux service packaging is a follow-up.

## Cold Start

From the OMNISCLAW checkout:

```bash
pnpm install
pnpm build
pnpm omnisclaw:install
```

That command builds BIFROST `cosmic-lite`, installs the local BIFROST service, and installs the OMNISCLAW/OpenClaw gateway service.

## Status Checks

```bash
pnpm omnisclaw:status
omnisclaw gateway status
# or: node openclaw.mjs gateway status
```

Expected shape:

- BIFROST service is running.
- BIFROST endpoint is `http://127.0.0.1:8787/verify`.
- Gateway loopback is running on `127.0.0.1:18789`.
- Connectivity check passes.

## Verification Probes

```bash
pnpm omnisclaw:probe
node scripts/test-projects.mjs \
  src/omnisclaw/bifrost-delivery-filter.test.ts \
  src/agents/command/delivery.test.ts \
  src/auto-reply/dispatch.test.ts \
  src/auto-reply/reply/before-deliver.test.ts
```

The probe set checks clean factual output, unsafe code, contradiction handling, and overconfidence handling through the local BIFROST service. The targeted tests check the delivery filter, direct command payloads, and auto-reply hook wiring.

## Environment Controls

```bash
# Disable the delivery gate for debugging only.
OMNISCLAW_BIFROST=0

# Delivery behavior. Defaults to careful.
OMNISCLAW_BIFROST_MODE=silent|careful|audit|debug

# Optional context inputs consumed by the delivery gate.
OMNISCLAW_VERIFIED_FACTS="one verified fact per line"
OMNISCLAW_BLOCKED_CLAIMS="one blocked claim per line"
OMNISCLAW_STALE_FACTS="one stale claim per line"
OMNISCLAW_SOURCE_NOTES="one source note per line"
```

Legacy `OPENCLAW_*` equivalents are also accepted for the BIFROST environment keys.

## Security Boundary

The gateway and BIFROST verifier are local loopback services. Do not expose either service to a public network without authentication, rate limiting, and request logging. Connected messaging channels should keep OpenClaw's normal DM pairing and allowlist rules enabled.

## Current Boundary

The BIFROST gate is a release filter, not a replacement for upstream model selection, sandboxing, channel allowlists, or human review. It should reduce unsupported final-answer claims; it does not prove correctness for every answer.

## Release Checklist

Before telling someone to download and try this fork, run:

```bash
pnpm omnisclaw:status
pnpm omnisclaw:probe
node scripts/test-projects.mjs \
  src/omnisclaw/bifrost-delivery-filter.test.ts \
  src/agents/command/delivery.test.ts \
  src/auto-reply/dispatch.test.ts \
  src/auto-reply/reply/before-deliver.test.ts
```

For a full source release, also run `pnpm build` from this repository and `pnpm test && pnpm build` from the BIFROST checkout.
