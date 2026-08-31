# OpenClaw 2.0 SQLite sessions — inherit, no JL re-apply

OMNIS CLAW 2.0 rebase · 2026-08-31 · own commit for the highest-risk 2.0 storage change.

## Finding

The Step 0 JL delta (`95b936fd46a` .. `bd3d22e970`, 13 commits) does **not** touch session or transcript storage. No session store, JSONL transcript writer, or SQLite schema files appear in that diff.

OpenClaw `2026.8.1` moved sessions/transcripts from file-backed to SQLite. OMNIS CLAW **inherits that layer unmodified**. There is no JL patch to rebase onto SQLite.

## Operator backup (required before a 2.0 binary writes `~/.openclaw`)

This rebase does **not** run backup against Captain's live state. Captain runs:

```bash
mkdir -p ~/Backups/openclaw
openclaw backup create --output ~/Backups/openclaw --verify
```

Downgrade / restore archived legacy artifacts:

```bash
openclaw doctor --session-sqlite restore --session-sqlite-all-agents
```

Sessions created after the SQLite migration exist only in SQLite. A downgrade without that restore loses them.

## Disposition

Inherit-upstream. No JL session-store conflict. Live backup is a Captain action, logged in `HANDOFF-BLOCKERS.md`.
