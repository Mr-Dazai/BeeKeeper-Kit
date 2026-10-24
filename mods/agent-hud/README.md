# agent-hud

A Claude Code plugin that adds a context bar above the prompt and an agents panel.

- Context bar above the prompt.
- Agents panel: the main agent and every subagent with an icon, active or idle state, context fill, tokens and estimated cost, plus what the last completed task burned.

## Commands

- `/hud` opens the agents panel.

## Dependency

`agent-hud` depends on `hive-router`. Install both:

```
/plugin marketplace add Mr-Dazai/BeeKeeper-Kit
/plugin install hive-router@bee-keeper
/plugin install agent-hud@bee-keeper
```

## Configure

- `hooks/hud-lib.ts`, `DISPLAY_NAMES`: display names per agent type.
- `hooks/bots.ts`, `SPECS`: the bot (colors and accessory) per agent type.

The entries shipped are examples for one project. Edit them to match your agents. Unknown types get a stable pooled bot and their own name.

## Tests

`claude plugin test mods/agent-hud`
