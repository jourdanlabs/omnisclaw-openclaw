# BUILD-RECEIPT — OMNIS CLAW 2.0 last copy + CLI-copy guard

Tree: `omnisclaw/openclaw-2.0-rebase-2026-08-31`  
**Not pushed.** §1 is **not closed** on this receipt. Pan re-gates.

## HEAD

Sweep + guard landed as one commit (amended after the 597 named leftover copy). `git log -1 --oneline` on this tree is the receipt HEAD.

## Gates

| Gate                          | Result                                                 | Log                                            |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `pnpm check:cli-copy`         | clean — `cli-copy: 2 exempted site(s), walk clean`     | stdout                                         |
| `pnpm test:unit:fast`         | **15387 passed / 6 skipped / 0 failed**                | `/tmp/omnisclaw-unit-fast5.log`                |
| `--version` / `--help`        | `OMNIS CLAW 2026.8.1-omnisclaw.0` / `Usage: omnisclaw` | source `node openclaw.mjs`                     |
| Full `pnpm test` (597 shards) | **39 shards red / 10550.23s** — **not inherit-only**   | `/tmp/omnisclaw-full-test-cli-copy-guard2.log` |

## Full 597 on this packet

All **14 inherit files** from `HANDOFF-BLOCKERS.md` still red (same box, same Node). That table is unchanged.

**46 additional files** also red on that run. Split:

1. **Leftover David-facing copy found by the 597** (folded into this same commit after the run):
   - `resolveUpdateCliArgv` fallback still emitted `openclaw update --yes` (argv spread, guard miss). Now `resolveCliName()`.
   - Codex native hook relay trust hashes follow the rewritten relay command.
   - Wizard completion tests stubbed `resolveCliName` to `openclaw` while expecting `omnisclaw`.
   - Cron-add exec detector only matched basename `openclaw`; now also `omnisclaw`.
   - QA runtime-pair titles stay `openclaw vs codex` (runtime id, not CLI). Tests that expected `omnisclaw vs codex` were reverted.
   - `lint-suppressions` allowlist: `src/omnisclaw/cosmic-lite.ts|no-console`.
2. **Isolation-green on this tree before/during the 597** (load/flake under the full fan-out, not leftover `openclaw <cmd>` copy): CLI process, plugins-list, error-output, help, skills, update-cli, daemon lifecycle, gateway option-collisions, memory-core, matrix CLI, devices, gateway-boot, tui, shim.
3. **Not this copy pass** (tooling/version/runtime, still red on the 597 log): `package-source-preflight` (`invalid release tag: v2026.8.1-omnisclaw.0`), `release-plan-producer` (`packages/ai version must match openclaw 2026.8.1-omnisclaw.0`), Codex transport/orphan, iMessage TERMINUS, WhatsApp mime, image-generate stack, acpx elicitation, TLS pinning.

## Guard

`scripts/check-cli-copy.mjs` + `scripts/cli-copy-exemptions.json` + `pnpm check:cli-copy`, wired into `scripts/check.mts` PREFLIGHT_CHECKS.

Scans `src/`, `extensions/`, `packages/` for unwrapped `openclaw <subcommand>` literals and CLI argv arrays `["openclaw", "<verb>"`. Template helpers that return the raw name for a `formatCliCommand` caller stay exempt. Protocol `Type.Literal("openclaw update")` on the node-host wire stays exempt.

**Known remaining hole:** `["openclaw", ...updateArgs]` style spreads (no adjacent `"update"` literal). The handoff site is now `resolveCliName()`. A new spread of that shape can still slip the guard.

`cmd:openclaw` protocol prefixes stay. `OPENCLAW_*`, `~/.openclaw`, `@openclaw/*`, changelog, type names, Control UI, `apps/` stay.

## §1 / §4 / §5

- **§1:** not closed. Pan re-gates `/tmp/omnisclaw-full-test-cli-copy-guard2.log` plus this amend. Do not treat isolation-green as a 597 inherit-only proof.
- **§4:** `--version` / `--help` / README first-run already read OMNIS CLAW / `omnisclaw`. Folded, not a separate commit.
- **§5:** no push. Open question for Captain: worktree `origin` is `jourdanlabs/omnisclaw-openclaw`; `jourdanlabs/omnisclaw` also exists (private, stale since May). Which is the public release home?
