# OMNISCLAW Hardening Report

Date: 2026-05-26
Status: LOCAL_RELEASE_CANDIDATE
Boundary: DELIVERY_GATE_NOT_CORRECTNESS_PROOF

## Summary

OMNISCLAW is currently running as an OpenClaw fork with BIFROST verification wired into final delivery paths. The local stack is green on service status, live BIFROST probes, targeted delivery-gate tests, and full source build.

## What Is Working

- Local BIFROST `cosmic-lite` verifier is running on `http://127.0.0.1:8787/verify`.
- OMNISCLAW/OpenClaw gateway is installed and reachable on loopback.
- Final auto-reply payloads run through `createOmnisclawBifrostBeforeDeliver`.
- Direct `openclaw agent` command payloads run through `applyOmnisclawBifrostToReplyPayload`.
- Existing `beforeDeliver` hooks are preserved and then passed through the BIFROST filter.
- Reasoning, error, compaction, and non-final block payloads are intentionally left alone.
- Low-claim casual replies are allowed through without unnecessary gate text.
- Gate-language leakage is scrubbed from final answers.

## Verification

Commands run successfully:

```bash
pnpm omnisclaw:status
pnpm omnisclaw:probe
node scripts/test-projects.mjs \
  src/omnisclaw/bifrost-delivery-filter.test.ts \
  src/agents/command/delivery.test.ts \
  src/auto-reply/dispatch.test.ts \
  src/auto-reply/reply/before-deliver.test.ts
pnpm build
```

Results:

- BIFROST service: running.
- BIFROST clean fact probe: APPROVED, confidence 1.00.
- BIFROST unsafe code probe: REJECTED, confidence 0.59, finding `EDGE_CASE_FAILURE`.
- BIFROST contradiction probe: REJECTED, confidence 0.59, finding `CONTRADICTION_SNAP`.
- BIFROST overconfidence probe: LOW_CONFIDENCE, confidence 0.79, finding `OVERCONFIDENCE`.
- Targeted delivery-gate test shards: 32/32 tests passed.
- Full OMNISCLAW source build: PASS.

## New Operator Documentation

- `docs/OMNISCLAW.md` now documents cold start, status checks, probes, environment controls, security boundary, current boundary, and release checklist.
- Root `README.md` now links directly to the OMNISCLAW operating guide.

## Current Boundary

This is a local release candidate for a BIFROST-gated OpenClaw fork. It is not a formal correctness proof, not a remote-hosting security review, and not a guarantee that every answer is correct. The gate reduces unsupported final-answer claims and blocks known unsafe patterns before delivery.

Before broad release, the remaining hardening work is packaging polish, fresh install test on a clean user account, channel-specific live smoke tests, and remote-exposure review if any service is exposed beyond loopback.
