# OMNIS CLAW 2.0 — release notes (DRAFT — held)

**Status:** DRAFT. Do not publish until Captain's send.

- ✅ CLAW exec r2 — **Bulma CLEAR** at `000e5f1aa5a` (narrow language, below)
- ✅ `pnpm test:unit:fast` — **15387 passed / 6 skipped / 0 failed** after stale `openclaw` assertion updates + David-facing copy (`Usage: omnisclaw`, `OMNIS CLAW` banner)
- ✅ `action-gate.mjs` comment matches the mandated sentence
- ✅ tarball `omnisclaw-2026.8.1-omnisclaw.0.tgz` contains `package/scripts/terminus-authorize.mjs` (`npm pack --ignore-scripts`; prepack workspace-dep guard still blocks a vanilla `npm pack`)
- ⏳ full `pnpm test` (597 shards) — started after unit-fast green; inherit-upstream residuals documented if any remain
- ⏳ Captain's send → push / tag / GitHub release

**Pin at publish:** the actual release SHA on `omnisclaw/openclaw-2.0-rebase-2026-08-31` (not `000e5f1aa5a` once this packet is committed).

---

## OMNIS CLAW 2.0

A governed fork of [OpenClaw](https://github.com/openclaw/openclaw) `2026.8.1` ("OpenClaw 2.0"). Every process the agent runs passes through **TERMINUS** — a deterministic refuse / hold / allow gate — before it executes, and every decision is written to a hash-chained receipt you can re-run.

### Built on OpenClaw 2026.8.1

OMNIS CLAW 2.0 tracks OpenClaw `2026.8.1` upstream. The 2.0 base — SQLite session/transcript storage, the Control UI, the onboarding rewrite, local-model support via managed `llama-server` — is inherited as-is. Security fixes from OpenClaw are cherry-picked through the `upstream` remote; this tree is the product and does not auto-pull. See `docs/UPSTREAM-POLICY.md`.

Attribution: `LICENSE`, `NOTICE`. Upstream: `openclaw/openclaw`.

### What OMNIS adds

| Layer                       | What it does                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TERMINUS action gate**    | `assertTerminusAllow` on the process-launch path. `rm -rf /` and its variants → REFUSE, no execution, signed refusal receipt. `ls` / `git status` / `npm test` → ALLOW. Ambiguous / system-dir → HOLD (human approval, no side effect). On by default whenever the authorize CLI is present; fail-closed when it isn't. Calls CADUCEUS — does not copy policy. |
| **CLARION**                 | Negation-aware absolute-language audit over agent output — clockwork / echo / fossil / gravity / prism / sentinel / trial engines.                                                                                                                                                                                                                             |
| **BIFROST delivery filter** | Governs what leaves the agent on the delivery path.                                                                                                                                                                                                                                                                                                            |
| **cosmic-lite**             | The COSMIC engine surface, trimmed for the fork.                                                                                                                                                                                                                                                                                                               |
| **Provider-gate artifact**  | Persists the live provider-gate evidence across key-less verify runs.                                                                                                                                                                                                                                                                                          |

### The honest line (Bulma-mandated wording — CLEAR only under this sentence)

> **OMNIS CLAW 2.0 gates model-directed exec paths through TERMINUS; every other `src/` spawn site is named in the exemption manifest and guarded against model-derived argv.**

Do **not** state "every CLAW process exec is gated" — §G deliberately names **82** internal/operational spawn sites (the runtime's own workers, container start, `ps` / `mount` / tunnels with fixed arguments) that are not individually TERMINUS-gated. Each is declared with a reason and an argv shape, and `scripts/check-spawn-exemptions.mjs` fails the build if a new `child_process` / `createChildAdapter` path appears unlisted, or if a listed site reads model/tool argv. `spawnWithFallback` — which _can_ take caller argv — is on the gated path, not exempted.

It is an **authorization gate**, not an OS sandbox — a caller that can already run code on the machine is outside its scope. Packaged without CADUCEUS installed, the gate is **fail-closed** (`REFUSE_SCANNER_FAILURE`), not silently open.

### License

**Apache-2.0.** (Upstream MIT grant retained in `NOTICE`.)

### Install / run

```
# npm
npm install -g @jourdanlabs/omnisclaw    # <bin>: omnisclaw
omnisclaw --version                       # OMNIS CLAW 2026.8.1-omnisclaw.0 (<sha>)
```

### Scope notes

- **Branding:** user-facing surfaces read OMNIS CLAW (`--version`, the `omnisclaw` bin, README, first-run, defaults). Internal identifiers (`OPENCLAW_*` env vars, the `~/.openclaw` state dir, `@openclaw/*` package names, upstream URLs, changelog history, type names) are retained for compatibility with existing installs and upstream cherry-picks — enumerated with reasons in `HANDOFF-BLOCKERS.md`.
- **Not claimed:** "meets ABSOLUTE", "sandbox", "tamper-proof", parity beyond the governance layer. Receipt tampering is detectable, not prevented; a stolen writer key can still sign — the out-of-process writer is the named next step.

🐦‍⬛ + 🔑
