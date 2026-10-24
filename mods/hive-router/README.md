# hive-router

A Claude Code plugin that picks each subagent's model and effort from the task.

- Routes subagents by type and task (Haiku, Sonnet or Opus, standard or high effort).
- Learns from runs that fall short and climbs a tier (Haiku, Sonnet, Opus, then high effort).
- Steps back down after a streak of successes.
- Reminds the main agent to delegate when it keeps editing on its own.

## Commands

- `/hive` shows what the router has learned.
- `/hive up` / `/hive down` moves the last finished task kind one step up or down.
- `/hive reset` forgets what was learned for the last finished task kind.

## Configure

Edit `hooks/rules.ts`:

- `BY_TYPE`: per agent type, a fixed tier or `'file'` to keep the model named in the agent's own file.
- `SPECIALIST_BASE`: the model each specialist's file names, so escalation knows where it starts.

The entries shipped are one example project's specialists. Replace them with the agents in your `.claude/agents`. An unknown agent type is simply left on its own model.

## Install

```
/plugin marketplace add Mr-Dazai/BeeKeeper-Kit
/plugin install hive-router@bee-keeper
```

`agent-hud` depends on this plugin; install both.

## Tests

`claude plugin test mods/hive-router`
