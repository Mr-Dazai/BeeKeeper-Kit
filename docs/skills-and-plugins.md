# Skills and plugins

What to install alongside this kit, and what was reviewed and left out.

## Update Claude Code first

```
claude update
```

Older versions failed to install some marketplace plugins. Updating first avoids the problem.

## Install

### The bee-keeper kit (superpowers, andrej-karpathy-skills, hive-router, agent-hud)

```
claude plugin marketplace add Mr-Dazai/BeeKeeper-Kit
claude plugin install bee-keeper@bee-keeper --scope project
```

The setup script does this for you by writing the project's `.claude/settings.json`. Then run
`/bee-keeper:bee-scout` to add optional skills (taste-skill, graphify, caveman) that fit the project. See the
[README](../README.md).

If superpowers is also installed from obra's marketplace, remove that copy so it does not load twice:

```
claude plugin uninstall superpowers@superpowers-dev --scope user
```

### From claude-plugins-official

```
claude plugin install code-review@claude-plugins-official
claude plugin install claude-md-management@claude-plugins-official
```

- `code-review`: structured review of a change or pull request.
- `claude-md-management`: audits and improves `CLAUDE.md` files so the instructions stay short and current.

These are Anthropic's own plugins, so they stay manual and are not part of the bee-keeper catalog.

### Account skills worth knowing

- `skill-creator`: builds and tests new skills. Use it when a repeated workflow should become a skill.

## Reviewed and not adopted

- **han-coding** (testdouble/han): most of its skills need the han-core agents; its tdd skill was copied, then dropped
  because superpowers covers it.
- **grill-me** (mattpocock/skills): overlaps superpowers brainstorming.
- **context-mode** (mksglu/context-mode): hooks every tool call, ships minified code under the Elastic-2.0 licence, and
  conflicts with superpowers' session hook.
- **VoltAgent awesome-claude-code-subagents**: 115 of 163 agents are template boilerplate. Five were adopted and
  adapted (see `agents/` and `THIRD_PARTY_NOTICES.md`).
- **ponytail** (DietrichGebert/ponytail): duplicates andrej-karpathy-skills; runs hooks after every turn and logs a row
  per task; its cost band clashes with agent-hud.
- **mattpocock/skills** (whole pack): 27 skills in one plugin, most overlapping superpowers (brainstorming, TDD,
  debugging, plans, subagent-driven development, code review).
- **ui-ux-pro-max** (nextlevelbuilder/ui-ux-pro-max-skill): a second frontend design skill next to taste-skill; both
  would trigger on every UI request.
