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

| Item                    | Fact                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full suite re-run       | `/tmp/omnisclaw-full-test-s1.log` PID 5341: **597 shards / 8342.75s / 64 shards red / 256 unique files**. Same Node v24.18.0. **Pan re-gates.** Most reds were leftover David-facing command copy (tests expected `omnisclaw …`, production still emitted `openclaw …`). Copy wrap this packet; Pan cluster re-ran green except inherit `help-exit` respawn. |
| `pnpm test:unit:fast`   | After remaining production command-copy wrap: **15387 passed / 6 skipped / 0 failed** (`/tmp/omnisclaw-retest/unit-fast4.log`).                                                                                                                                                                                                                              |
| Clean upstream checkout | Detached worktree `~/projects/.worktrees/openclaw-v2026.8.1-s1-repro` @ `ea806575e64` (`v2026.8.1^{commit}`; annotated tag object `4d37fc4b0f8`). `pnpm install --frozen-lockfile`. No OMNIS layer. Logs: `/tmp/omnisclaw-upstream-s1{,b,c,d,e}.log`.                                                                                                        |

## Inherit residuals (fails on clean `v2026.8.1` too — same box, same Node)

Repro: `cd ~/projects/.worktrees/openclaw-v2026.8.1-s1-repro && node scripts/run-vitest.mjs run <file>`.

| File                                                                      | Upstream fail                                     | Note                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `test/scripts/ci-git-owner.test.ts`                                       | 25 tests × ~8s                                    | git-owner inherit                                                 |
| `test/scripts/release-telegram-candidate-archive.test.ts`                 | zstd `status` not 0                               | zstd inherit                                                      |
| `test/scripts/live-docker-stage.test.ts`                                  | `timeout command not found; expected 127 to be 0` | macOS has no GNU `timeout`                                        |
| `test/scripts/release-workflow-matrix-plan.test.ts`                       | `bash: ${GITHUB_REPOSITORY,,}: bad substitution`  | macOS bash 3.2                                                    |
| `src/tui/tui-pty-harness.e2e.test.ts`                                     | PTY `timed out waiting for`                       | UI/PTY inherit                                                    |
| `src/tui/tui-session-identity-pty.e2e.test.ts`                            | PTY timeout                                       | UI/PTY inherit                                                    |
| `src/cli/help-exit.process.test.ts`                                       | `bootstrapRecords.length >= 2` got 1              | compile-cache respawn; helper sets `NODE_DISABLE_COMPILE_CACHE=1` |
| `extensions/codex/src/node-exec-server.test.ts`                           | Codex exec-server                                 | Codex inherit                                                     |
| `extensions/codex/src/app-server/sandbox-exec-server.http.test.ts`        | 308 POST redirect                                 | Codex inherit                                                     |
| `extensions/anthropic/index.test.ts`                                      | provider replay / token math                      | inherit                                                           |
| `extensions/amazon-bedrock-mantle/discovery.test.ts`                      | implicit provider + bearer token                  | inherit                                                           |
| `src/cli/completion-runtime.test.ts`                                      | zsh completion install dir                        | inherit (same fail on tag)                                        |
| `src/agents/tools/message-tool.internal-source-reply.integration.test.ts` | remote-only bridge                                | inherit                                                           |
| `src/agents/tools/message-tool.sandbox-attachments.test.ts`               | sandbox attachments / `remote proof`              | inherit                                                           |

`src/transcripts/store.test.ts` case-distinct / case-variant tests **passed** on this same macOS box on clean `v2026.8.1`. Not a case-FS inherit. OMNIS reds there were copy (`omnisclaw` vs `openclaw` in assertions).
| Dirty main checkout | `/Users/sokpyeon/projects/omnisclaw-openclaw` — do not commit there. |
