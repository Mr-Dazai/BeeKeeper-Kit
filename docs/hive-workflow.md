# The hive workflow

How the pieces of this kit work together.

## Roles

- **Brain (main agent)**: the project manager. Plans, briefs, dispatches, reviews, reports to the owner. It does the
  work itself only for tiny things (a question it can answer, a one-line change, reading a file to write a brief).
  The rules live in `CLAUDE.md`.
- **Specialists**: agents in `.claude/agents/` for a recurring kind of task (stack work, architecture check, secrets
  check, milestone status, final review). The dispatch table in `CLAUDE.md` says which to use.
- **hive-worker**: the catch-all worker for anything no specialist covers. It reports in a fixed format
  (`RESULT: DONE | PARTIAL | BLOCKED`, what it did, how it checked, open items, decisions needed).
- **hive-worker-deep**: the same worker at high effort. Not dispatched directly; the router switches to it when
  `hive-worker` tasks of that kind have fallen short.

The loop is delegate, then review. When a result falls short, the Brain re-dispatches it with a sharper brief instead
of fixing it itself, because that re-dispatch is the signal the router learns from.

## The hive-router mod (`mods/hive-router`)

Picks the model for each subagent when it starts.

- **Routing rules**: in the mod's `hooks/rules.ts`. Light tasks (search, status, formatting) go to Haiku, ordinary
  building and checking to Sonnet, architecture, security design and final reviews to Opus.
- **Learning ladder**: Haiku, then Sonnet, then Opus, with high-effort rungs for `hive-worker` (each model also at high
  effort through `hive-worker-deep`). A kind of task that misses starts one rung higher next time.
- **Miss signals**: the run errors; it reports `RESULT: PARTIAL`; the same task is re-sent within 30 minutes; or the
  owner types `/hive up`.
- **Stepping down**: 5 successes in a row at a raised rung step it back down. `/hive down` rates the last task as a
  success.
- **Commands**: `/hive` shows what has been learned; `/hive up` and `/hive down` rate the last finished task;
  `/hive reset` clears the learning.
- It also reminds the Brain to delegate after 5 edits in a turn without starting a subagent.

## The agent-hud mod (`mods/agent-hud`)

A heads-up display for the hive.

- **Status card**: shows the Brain and the running subagents.
- **`/hud` panel**: opens the detailed view.
- **Bots**: running subagents appear as small bots with display names.
- **Router line**: shows the hive-router's current decision or learned rung.

## Adding a new specialist

1. Create `.claude/agents/<name>.md` with `name`, `description`, `tools`, `model` and `effort` in the front matter, then
   the instructions and a report format.
2. Add a row for it to the dispatch table in `CLAUDE.md`.
3. Add its starting model to `SPECIALIST_BASE` in the hive-router (`mods/hive-router`), so escalation has a base rung.
4. Optional: add a friendly name to `DISPLAY_NAMES` in agent-hud (`mods/agent-hud`).

The Brain has standing permission to do this when a kind of task keeps coming back; it tells the owner what it created
and why.
