# HANDOFF-BLOCKERS — OMNIS CLAW 2.0 rebase 2026-08-31

Builder: Tifa. Documented block = success. No self-CLEAR.

## Needs Captain

| Item                      | File:line                           | Question                                                                                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live `~/.openclaw` backup | `docs/SQLITE-2.0-INHERIT.md`        | Run `openclaw backup create --output ~/Backups/openclaw --verify` **before** pointing a 2.0 binary at the live state dir. This rebase does not do that.                                                                                                                    |
| Push / npm / Fly          | —                                   | None until gated.                                                                                                                                                                                                                                                          |
| Branding remainder        | ~23064 files still match `openclaw` | User-facing display (`--version`, default bin name, package metadata) is OMNIS CLAW. A mechanical rename of `@openclaw/*`, `OPENCLAW_*` env, and `~/.openclaw` would break the product. Call: accept the exception catalog below, or order a follow-on identifier rewrite. |
| Apache vs named branch    | `LICENSE`, `NOTICE`                 | `codex/claw-apache-release-prep-20260809` is still MIT and has no NOTICE. Pass 2 applied Apache-2.0 + NOTICE from scratch (not a cherry-pick). Confirm that is the intended license.                                                                                       |

## Closed this packet (FIX 3 / §G)

| Item                              | Fact                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Declared spawn-exemption manifest | `src/omnisclaw/terminus/spawn-exemptions.{json,ts}` — 82 production sites. Guard: `scripts/check-spawn-exemptions.mjs` (`pnpm check:spawn-exemptions`). Unlisted `child_process` / `createChildAdapter` import → exit 2. |
| Not model-derived                 | Per listed site (except `gated-path` / `the-gate-itself`): source must not read `request.command` / `tool.command` / `opts.execCommand`. Can-fail in `spawn-exemptions.test.ts`.                                         |
| Caller-argv helper                | `spawnWithFallback` now calls `assertTerminusAllow` before spawn. Listed as `gated-path`.                                                                                                                                |

Honest line: **the model-directed exec path is gated**, and every other `src/` spawn site is **named**. Naming is not the same as TERMINUS on that site.

## Needs Bulma

| Item                    | File:line                                | Question                                                                                |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Exec re-check r2        | `supervisor.spawn()` + spawn-exemptions  | Supervisor still first. §G manifest + guard + can-fail are on this HEAD. Re-check both. |
| Fail-closed missing CLI | `src/omnisclaw/terminus/action-gate.mjs` | Unchanged. Missing CLI → `terminus_unavailable`.                                        |
| Chain / override        | CADUCEUS ledger                          | Unchanged. CLAW does not own the ledger.                                                |

## Openclaw hits that stay (reason)

| Stay                                                             | Reason                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `NOTICE` MIT grant + OpenClaw Foundation / Peter Steinberger     | Attribution. Required.                                                   |
| One README line: "OMNIS CLAW is built on OpenClaw by…"           | Declared.                                                                |
| `package.json` `bin.openclaw`                                    | Compat alias. Real bin is `omnisclaw`.                                   |
| git remote `upstream`                                            | Not in-tree.                                                             |
| `@openclaw/*` npm names + import paths                           | Upstream-owned package / API identifiers. Renaming breaks the workspace. |
| `OPENCLAW_*` env + `~/.openclaw` state dir + `openclaw.json`     | Live-install compat. A rename is a breaking migration; not this pass.    |
| `docs.openclaw.ai` / `github.com/openclaw` / i18n community URLs | Upstream community refs.                                                 |
| `CHANGELOG.md` historical notes                                  | Inherited release history.                                               |
| Type names (`OpenClawConfig`, …)                                 | Code identifiers, not operator-facing.                                   |
| `LICENSE`                                                        | Now Apache-2.0 text (no "OpenClaw"). Upstream MIT lives in `NOTICE`.     |

Everything else that still says OpenClaw (Control UI, inherited doctor/help, upstream README below the fold, apps) is **not swept**. That is the branding block.

## Accepted scope (not an open block)

| Item                    | Fact                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-gate intercept | Artifact-only by design on specified HEAD (`d05f1f91b3`). `provider-gate.mjs` was never on that HEAD. A live intercept is a separate future spec. |

## Other (logged, not faked)

| Item                  | Fact                                                                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full suite re-run     | Pass 1 `pnpm test` RED 29/597. Pass 2 fixed the of-ours slice (telegram doctor, plugin-install suffix, changelog regex). Full 597-shard re-run **not** repeated this pass (~3h). Inherit failures (zstd, git-owner, UI bridge, Codex) **not** confirmed on a clean `v2026.8.1` checkout this pass. |
| `pnpm test:unit:fast` | Pass 1: 15387 / 6 skip. Not re-run after DEFAULT_CLI_NAME change.                                                                                                                                                                                                                                  |
| Dirty main checkout   | `/Users/sokpyeon/projects/omnisclaw-openclaw` — do not commit there.                                                                                                                                                                                                                               |
