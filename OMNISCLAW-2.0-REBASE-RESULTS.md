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

**Not run:** `pnpm test` / `test:all` / e2e / docker / `test:unit` beyond `test:unit:fast`. Named skip of the full suite, not a silent skip of a failing test.

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

Governs: final delivery (BIFROST/CLARION/COSMIC-lite), Telegram draft default, and pre-spawn TERMINUS on the three 2.0 exec chokepoints. Inherits unmodified: SQLite sessions, onboarding, Control UI, llama-server, 2.0 exec-approval, plugin API, pinning/auth onboarding, and the rest of the `2026.8.1` tree.
