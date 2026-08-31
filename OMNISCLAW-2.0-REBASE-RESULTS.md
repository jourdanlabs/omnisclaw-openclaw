# OMNIS CLAW 2.0 rebase results — 2026-08-31

Builder: Tifa (Cursor, on-disk). TERMINUS exec path: **Bulma re-checks.** Not a self-CLEAR. No push. No npm publish. No Fly deploy.

|                                  |                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Base                             | OpenClaw `v2026.8.1` (`ea806575e64`, package was `2026.8.1`)                   |
| Fork HEAD this pass started from | `bd3d22e970` — _CLAW runExec and runCommandWithTimeout go through TERMINUS_    |
| Working branch                   | `omnisclaw/openclaw-2.0-rebase-2026-08-31`                                     |
| Worktree                         | `/Users/sokpyeon/projects/.worktrees/omnisclaw-openclaw-2.0-rebase-2026-08-31` |
| Package after green              | `omnisclaw@2026.8.1-omnisclaw.0`                                               |
| Push                             | **none**                                                                       |

## Honest status

OMNIS CLAW 2.0 is OpenClaw `2026.8.1` plus the JL trust layer: BIFROST/CLARION on final delivery, COSMIC-lite advisory seal, Telegram drafts off by default, and TERMINUS `authorizeAction` on `runExec` / `runCommandWithTimeout` / `runExecProcess` (display command and, when 2.0 substitutes one, `execCommand`). Session storage, onboarding, Control UI, llama-server, certificate pinning, and 2.0 exec-approval are inherited unmodified. vscode-style “meets 2.0 feature parity” is not the claim. The gate fires on the new exec path; weakening it (gate off) and calling raw `spawnCommand` (no gate) are both proven. Provider-gate **intercept** is not on specified HEAD — only the live artifact file is.

## Step 0 — JL delta (`95b936fd46a` .. `bd3d22e970`)

Merge-base used: `95b936fd46a` (OpenClaw `2026.5.6` / local `upstream` main before the `v2026.8.1` fetch). 13 commits, oldest first. Every one landed or was dropped with a reason.

| SHA          | Subject                                                    | Disposition                                                                                                                  |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `341ce56a3e` | Add OMNISCLAW BIFROST delivery filter                      | **re-applied** on 2.0 `src/auto-reply/dispatch.ts` (`createOmnisclawBifrostBeforeDeliver` wraps both dispatcher paths)       |
| `9230505bb9` | Point package metadata at OMNISCLAW repo                   | **re-applied** (`name: omnisclaw`, homepage, repo, bins `omnisclaw` + `openclaw`)                                            |
| `9a74effcfc` | Port CLARION verification into OMNISCLAW delivery          | **re-applied** (`src/omnisclaw/clarion/**`)                                                                                  |
| `f8ff3e2065` | Make OMNISCLAW delivery conversational                     | **re-applied** (`src/agents/command/delivery.ts` → `applyOmnisclawBifrostToReplyPayload` inside 2.0 `NormalizeReplyOutcome`) |
| `b4422fbff6` | Disable Telegram draft previews by default                 | **re-applied** (`preview-streaming.ts` default `"off"`; 2.0 default was `"progress"`)                                        |
| `1e54f00d6b` | Add OMNISCLAW BIFROST stack helper                         | **re-applied** (`scripts/omnisclaw-stack.mjs` + `omnisclaw:*` npm scripts)                                                   |
| `c6394b01a6` | docs: add omnisclaw operating guide                        | **re-applied** (`docs/OMNISCLAW.md`)                                                                                         |
| `3208ae7a04` | README: OMNISCLAW front door                               | **re-applied** (front-matter on 2.0 README; upstream README kept below)                                                      |
| `cfd23ec69e` | BIFROST fluid: refusal resolves                            | **re-applied** (`src/omnisclaw/clarion/bifrost/fluid.ts`)                                                                    |
| `6a84fc073f` | COSMIC-lite as a second delivery seal                      | **re-applied** (`src/omnisclaw/cosmic-lite.ts`)                                                                              |
| `dc80a813f7` | CLARION fluid: negation-aware absolute-language            | **re-applied**                                                                                                               |
| `d05f1f91b3` | Persist live provider-gate artifact                        | **re-applied** (artifact JSON + `scripts/omnis-claw-verify-plan.mjs` only)                                                   |
| `bd3d22e970` | CLAW runExec and runCommandWithTimeout go through TERMINUS | **re-wired** onto 2.0 paths (see TERMINUS)                                                                                   |

Not on specified HEAD `bd3d22e970` (other branches):

| SHA                         | Branch                                    | Disposition                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `6b9e1b26df` / `0349e8d317` | `codex/claw-apache-release-prep-20260809` | **dropped-with-reason:** not on specified HEAD. 2.0 `LICENSE` is still MIT. Apache headers are a follow-on (HANDOFF).                                                                                                                                                                                                                                                |
| `22d9d1a741` / `c6b089aba7` | `toph/claw-identity-version`              | **partial re-apply:** `CORE_PACKAGE_NAMES` includes `omnisclaw` so `VERSION` resolves after the package rename; `cli-name.ts` accepts `omnisclaw`. `resolveProductDisplayName` / `OMNIS CLAW` banner from that branch were **not** ported — CLI still prints `OpenClaw 2026.8.1-omnisclaw.0` (declared exception). `scripts/omnisclaw-product-proof.mjs` not ported. |

JL diff file count on the 13: **45 files**. None matched session / transcript / sqlite / onboard / llama / plugin / Control UI / pinning paths.

## §1 SQLite (own commit)

See `docs/SQLITE-2.0-INHERIT.md`. **JL does not touch session/transcript storage.** Inherit 2.0 SQLite. Operator backup is a Captain action — this rebase did not run `backup create` against live `~/.openclaw`.

```bash
mkdir -p ~/Backups/openclaw
openclaw backup create --output ~/Backups/openclaw --verify
# downgrade:
openclaw doctor --session-sqlite restore --session-sqlite-all-agents
```

## TERMINUS on the 2.0 exec path

2.0 split the 2026.5.6 `src/process/exec.ts` pair:

| 2.0 function                                          | File                                    | Gate                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `runExec`                                             | `src/process/exec.ts`                   | `assertTerminusAllow` before `spawnCommand`                                                                                      |
| `runCommandWithTimeout` / `runUtf8CommandWithTimeout` | `src/process/exec-runner.ts`            | `assertTerminusAllow` at start of `runCommandWithOutputEncoding` (shared)                                                        |
| `runExecProcess`                                      | `src/agents/bash-tools.exec-runtime.ts` | `assertTerminusAllow(opts.command)` **and** `assertTerminusAllow(opts.execCommand)` when 2.0 substitutes a sanitized exec string |

Raw 2.0 spawn (`src/process/exec-spawn.ts` `spawnCommand`) has **no** TERMINUS import. That is the load-bearing hole the can-fail uses.

2.0 exec-approval (`beforeSpawn` / `infra/exec-approvals`) is **left in place**. TERMINUS is a separate pre-spawn layer. They compose; neither was removed.

Fail-closed: missing CLI → `REFUSE` / `terminus_unavailable`. Vitest skips the live CLI unless `TERMINUS_AUTHORIZE` or `CADUCEUS_ROOT` is set. `TERMINUS_ACTION_GATE=0` disables the wrap.

## Breaking-change checklist (OpenClaw 2.0)

| #   | 2.0 change                                                                                                        | Resolution                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sessions/transcripts → SQLite                                                                                     | **inherit-upstream.** JL delta does not touch that path. Backup documented; Captain must run it on live state. Own commit: `docs/SQLITE-2.0-INHERIT.md`.                                                                                                     |
| 2   | `node-llama-cpp` → managed `llama-server`                                                                         | **inherit-upstream.** 2.0 `package.json` has no `node-llama-cpp`. OMNIS CLAW on HEAD had no local-GGUF path that still required it.                                                                                                                          |
| 3   | Onboarding rewrite (`--json`, `--skip-bootstrap`, `--import-from claude\|codex\|hermes`, `--gateway-bind custom`) | **inherit-upstream.** JL did not customize onboarding on specified HEAD. `--import-from hermes` is a WING-lineage question, not a CLAW patch. Not re-proved.                                                                                                 |
| 4   | Model/provider routing + `doctor` migration                                                                       | **partial.** `provider-gate-live-artifact.json` persisted (commit `d05f1f91b3`). Intercept module (`provider-gate.mjs` / `provider-gate.test.ts`) is **not** on `bd3d22e970`. Residency-block of `api.moonshot.cn` was **not** re-proved. Logged in HANDOFF. |
| 5   | Permissions / approval model                                                                                      | **compose.** 2.0 exec-approval + limited-mode pairing remain. TERMINUS runs before spawn on the three chokepoints. Neither shadows the other.                                                                                                                |
| 6   | Plugin / extension API                                                                                            | **none on HEAD.** No JL plugins shipped on specified HEAD. Inherit 2.0 API.                                                                                                                                                                                  |
| 7   | Web Control UI redesign                                                                                           | **inherit-upstream.** No JL Control UI patches on specified HEAD.                                                                                                                                                                                            |
| 8   | Packaging · Node 22.22.2+ · bins                                                                                  | **inherit 2.0 engines** `>=22.22.3 <23 \|\| >=24.15.0 <25 \|\| >=25.9.0`. `omnisclaw` + `openclaw` bins both point at `openclaw.mjs`. Smoke: `node openclaw.mjs --version` → `OpenClaw 2026.8.1-omnisclaw.0 (ea80657)`.                                      |
| 9   | Security · network-install auth · cert pinning                                                                    | **not re-proved.** No JL network path on HEAD assumed old pinning. Logged, not claimed.                                                                                                                                                                      |

No additional 2.0 release-note rows touched a JL patch on specified HEAD.

## Re-prove

### 1. TERMINUS on the exec path

Live CADUCEUS CLI (`~/projects/caduceus/scripts/terminus-authorize.mjs`), `TERMINUS_ACTION_GATE=1`:

| Input                                       | Verdict                                    | Execution                               |
| ------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| `rm -rf /`                                  | **REFUSE** `action_catastrophic`           | did not run                             |
| `echo smoke-ok` / `echo ok`                 | **ALLOW**                                  | authorized                              |
| `ls -la`, `git status`, `npm test`          | **ALLOW** (runtime mock + live `echo`)     | authorized                              |
| `touch /etc/hosts`                          | **HOLD**                                   | did not run                             |
| `touch /etc/hosts` + `human_override: true` | **ALLOW** `action_hold_override`           | authorize only (no spawn in this prove) |
| `rm -rf /` + `human_override: true`         | **REFUSE** (override does not lift REFUSE) | did not run                             |

Receipts: `caduceus/receipts/actions.jsonl`. Last lines: `kind=action.shell`, `has_rm=false`, `has_echo_payload=false` (raw command / decoded inner command absent).

Chain (copy of live ledger, 38 signed receipts):

- `verifyChain()` clean → `{ ok: true, chain_ok: true, count: 38, signed: 38 }`
- Tamper last `payload_digest` → `{ ok: false, at: 37, reason: "sig_mismatch" }`
- Tamper copy deleted. Live ledger not mutated.

### Can-fail (two)

1. **Gate off.** `TERMINUS_ACTION_GATE=0` + `VITEST=true` → `assertTerminusAllow("rm -rf /")` does **not** throw (`action-gate.runtime.test.ts`). Weakening the wrap reddens the invariant: REFUSE does not fire.
2. **Raw 2.0 spawn.** Scratch `scripts/_canfail-raw-spawn.mts` called `spawnCommand(["rm", "-rf", <dedicated-temp-dir>])` from `src/process/exec-spawn.ts` (no TERMINUS import). The dedicated temp dir was deleted. Scratch deleted after. **Did not** run `rm -rf /`. Proves the ungated 2.0 spawn path is load-bearing: the wrap is what stops a catastrophic argv, not `spawnCommand` itself.

### 2. Suites (verbatim)

JL slice (`vitest` action-gate, bifrost, cosmic-lite, telegram helpers, version) earlier this pass:

```
Test Files  6 passed (6)
Tests  42 passed (42)
```

After `execCommand` double-gate + live HOLD/override:

```
Test Files  2 passed (2)
Tests  7 passed (7)
```

(`action-gate.test.ts` + `action-gate.runtime.test.ts`)

OpenClaw unit-fast (rebased tree, before the `execCommand` one-line and HOLD assertions — those tests are additive and do not touch upstream files except `bash-tools.exec-runtime.ts`):

```
Test Files  1291 passed | 2 skipped (1293)
Tests  15387 passed | 6 skipped (15393)
```

Version fast-path after `omnisclaw` alias:

```
Test Files  1 passed (1)
Tests  4 passed (4)
```

Provider-gate artifact persist (key-less, on-HEAD JSON only):

```
Test Files  1 passed (1)
Tests  2 passed (2)
```

`pnpm test` (full local suite, `TERMINUS_ACTION_GATE=0`, no `TERMINUS_AUTHORIZE`) — **RED**. Wrapper verbatim:

```
[test] failed 597 Vitest shards in 9800.67s; Vitest summaries above are per-shard, not aggregate totals.
[test] failed shard digest (29):
```

Exit 1. Elapsed 9801462 ms. **0** `TERMINUS HOLD` / `TERMINUS REFUSED` lines. Wrapper does not print an aggregate pass/fail test count.

29 shards failed. FAIL lines by file (105 logged `FAIL` rows):

| n           | File                                                                   | Notes                                                                                  |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 25          | `test/scripts/release-telegram-candidate-archive.test.ts`              | local `zstd` exit `null`                                                               |
| 25          | `test/scripts/ci-git-owner.test.ts`                                    | git/push fixture                                                                       |
| 12          | `src/cli/update-cli.test.ts`                                           | profile/env handoff                                                                    |
| 7           | `ui/src/components/mcp-app-view.test.ts`                               | bridge mount timeout                                                                   |
| 6+3+3+1+1   | `extensions/codex/**`                                                  | Codex app-server / node-exec                                                           |
| 4           | `src/plugins/discovery-checkout.test.ts`                               |                                                                                        |
| 3           | `extensions/telegram/src/doctor.test.ts`                               | **possible JL** — drafts default `"off"`                                               |
| 2           | `src/commands/doctor/shared/missing-configured-plugin-install.test.ts` | **JL version:** spec became `@openclaw/codex@2026.8.1-omnisclaw.0`                     |
| 2+1+1+1+1+1 | other `test/scripts/*`                                                 | CI/release tooling; one `packages/ai version must match openclaw 2026.8.1-omnisclaw.0` |
| 1+1         | message-tool sandbox / source-reply                                    |                                                                                        |
| 1+1+1       | whatsapp / slack / help-exit / auto-reply delivery-order               |                                                                                        |

**Not run:** `test:all` / e2e / docker / live.

### 3. `omnisclaw` smoke

- `node openclaw.mjs --version` → `OpenClaw 2026.8.1-omnisclaw.0 (ea80657)` (banner word **OpenClaw** is a declared exception; version identity is the JL suffix).
- Bins in `package.json`: `omnisclaw` and `openclaw` → `openclaw.mjs`.
- Governed exec: `rm -rf /` → `TERMINUS REFUSED (action_catastrophic)`; `echo smoke-ok` → ALLOW; `terminus.action` / `action.shell` receipt landed on `caduceus/receipts/actions.jsonl`.

### 4. Branding

`rg -i -l openclaw` excluding `node_modules`/`dist`/`.git`: **21480** files. This is **not** “only declared exceptions.”

Honest exception list for **this pass**:

- Entire inherited 2.0 tree (README below the fold, UI, apps, `@openclaw/*` packages, docs, scripts, `openclaw.mjs` filename).
- Compatibility bin alias `openclaw`.
- LICENSE / `THIRD_PARTY_NOTICES.md` / OpenClaw Foundation attribution.
- CLI banner `OpenClaw ${VERSION}`.
- JL front door (`README.md` lines 1–13, `docs/OMNISCLAW.md`, `package.json` `name`/`bin`/`homepage`) is OMNIS CLAW.

A full-tree rebrand of 2.0 is **not** this pass. Logged, not faked.

### 5. Provider gate

`d05f1f91b3` persisted `src/omnisclaw/terminus/provider-gate-live-artifact.json` (minimax, 2026-08-27) and a verify-plan script that _calls_ `provider-gate.test.ts`. That test file and `provider-gate.mjs` are **not** on `bd3d22e970`. Untracked copies exist on the dirty main checkout and were **not** promoted. Residency-block (`api.moonshot.cn`) **not re-proved**. Artifact file is on the 2.0 tree.

## Self-gate notes

- RED meant fix, not advance: `runExecProcess` initially gated only `opts.command`. 2.0 can spawn `opts.execCommand`. Fixed before close; source-order test requires `assertTerminusAllow(opts.execCommand`.
- Can-fail proven (gate off + raw spawn). Scratch deleted.
- No test deleted or weakened to pass.
- Version bumped to `2026.8.1-omnisclaw.0` only after `test:unit:fast` was green.

## What OMNIS CLAW 2.0 governs vs inherits

Governs: final delivery (BIFROST/CLARION/COSMIC-lite), Telegram draft default, and pre-spawn TERMINUS on the 2.0 exec helpers **and** `supervisor.spawn()`. Inherits unmodified: SQLite sessions, onboarding, Control UI, llama-server, 2.0 exec-approval, plugin API, pinning/auth onboarding, and the rest of the `2026.8.1` tree.

---

## Pass 2 — 2026-08-31 (Tifa)

Continues `PAN-TIFA-OMNISCLAW-2.0-SECOND-PASS-2026-08-31.md`. HEAD at start of this write-up: `81ccc56d80f`. No push.

### §A — of-ours test failures

| Item                                                             | Decision                                                                                                                                                                                                                                          | Result                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 3 × Telegram `doctor.test.ts` drafts default `off`               | **JL default stays `"off"`** (`preview-streaming.ts`, commit `b4422fbff6`). 2.0 doctor tests now set `streaming: { mode: "progress" }` so they still test the quote/progress warning. Implicit-off already had a skip test.                       | telegram doctor file green                                                                                      |
| 2 × doctor plugin-install `@openclaw/codex@2026.8.1-omnisclaw.0` | Keep the fork suffix on **our** `VERSION`. Strip it for npm cohort pins (`stripOmnisclawForkSuffix` / `resolveCompatibilityHostVersion`) and for stale-version compare. `@openclaw/codex` is published as `2026.8.1`, not `2026.8.1-omnisclaw.0`. | plugin-install file green (including "does not downgrade 9999.1.1")                                             |
| changelog / preflight suffix                                     | **Regex accepts `-omnisclaw.N`**. Fork mark stays. Changelog extract falls back to the upstream heading (`2026.8.1`). `parseReleaseVersion` treats the suffix as stable.                                                                          | `package-changelog.test.ts` 21 passed, including `2026.8.1-omnisclaw.0` → `["2026.8.1-omnisclaw.0","2026.8.1"]` |

Targeted §A suite this pass: telegram doctor + plugin-install + version + changelog = **green**.

### §B — branding

User-facing landed: `--version` prints `OMNIS CLAW ${VERSION}`; default CLI name `omnisclaw`; `package.json` description/author/license; README attribution line kept.

`rg -i -l openclaw` excluding `node_modules`/`dist`/`.git`: **~23064** files. **Not** exceptions-only. Catalog of stays is in `HANDOFF-BLOCKERS.md`. Control UI / inherited doctor / upstream README below the fold are **not** swept. This is the branding block.

### §C — Apache

`codex/claw-apache-release-prep-20260809` (`6b9e1b26df` / `0349e8d317`) is **still MIT** and has **no NOTICE**. The branch name does not match the tree. Pass 2 applied Apache-2.0 `LICENSE`, `NOTICE` (upstream MIT grant preserved), `package.json` `license: Apache-2.0`, SPDX on the JL pin files. Not a cherry-pick of missing work. 2.0 inherited files do not have Apache headers (they never did on that branch).

### §D — fail-closed missing CLI

Already on `81ccc56d80f` for `assertTerminusAllow`. This pass: in-package `scripts/terminus-authorize.mjs` (forwards to CADUCEUS or REFUSE `terminus_unavailable`; does **not** copy policy). `defaultCliPath` prefers the pin. `package.json` `files` includes it. Test asserts the pin is present.

Can-fail: gate not off + missing CLI → `rm -rf /` throws `TERMINUS REFUSED (terminus_unavailable)` (`action-gate.runtime.test.ts`). Restore → live CADUCEUS path still used when pointed.

### §E — provider-gate

Accepted scope. Not an open block. See HANDOFF.

### §F — supervisor chokepoint

`assertTerminusAllow(spawnInputPayload(input))` at the top of `supervisor.spawn()` before `startRun`. Covers `child` / `pty` / `anchored-shell`. `runExecProcess` `:984` is downstream of `:709/711` — double-gate, intended.

Can-fail (`supervisor.terminus.test.ts`):

1. Missing CLI + gate on → child / pty / anchored-shell throw before adapter dispatch.
2. Neutralize `assertTerminusAllow` (vi.doMock no-op) → real `node -e` child writes `supervisor-neutralized`.
3. Gate off → real child writes `supervisor-canfail`.

### Suites this pass (verbatim)

```
Test Files  6 passed (6)
Tests  159 passed (159)
```

(action-gate ×2, supervisor.terminus, plugin-install, telegram doctor, version)

```
Test Files  2 passed (2)
Tests  29 passed (29)
```

(package-changelog + cli help)

`pnpm test` full 597-shard re-run: **not repeated**. Inherit confirmation on clean `v2026.8.1`: **not done**.

### Smoke still owed

`node openclaw.mjs --version` → `OMNIS CLAW 2026.8.1-omnisclaw.0 (fa0446a)` (launcher fast path in `openclaw.mjs`; commit pin is the JL-layer SHA the launcher resolves, not HEAD).
