# BeeKeeper Kit

A starter kit for Claude Code projects. One setup script and one plugin give every new project the same base: a set of
agents, a `CLAUDE.md` that makes the main agent a manager ("the hive"), plan and architecture docs, and a short list
of skills. `bee-scout` then reads the project and suggests extra skills only when they fit.

Run `claude update` first. The plugin features here need a recent Claude Code.

## Quick start

1. Run the setup script for your project.

   PowerShell:
   ```
   ./scripts/setup.ps1 -Target C:\path\to\project
   ```
   Shell:
   ```
   ./scripts/setup.sh /path/to/project
   ```
   It copies the agents, `CLAUDE.md`, `docs/PLAN.md` and `docs/ARCHITECTURE.md`, and writes
   `.claude/settings.json` so the project enables `bee-keeper@bee-keeper`. Existing files are skipped unless you pass
   `-Force` (PowerShell) or `--force` (shell). An existing `settings.json` is never changed. No network access.
2. Open the project in Claude Code and trust it. You are offered the bee-keeper marketplace and plugin.
3. Turn on auto-update once: `/plugin`, then Marketplaces, then bee-keeper, then Enable auto-update. Without it, run
   `claude plugin marketplace update bee-keeper` to pull changes.
4. Fill in `docs/PLAN.md` and `docs/ARCHITECTURE.md`, then run `/bee-keeper:bee-scout`.
5. Run `/reload-plugins` so newly installed skills load in the current session.

Manual install, for a project set up without the script:
```
claude plugin marketplace add Mr-Dazai/BeeKeeper-Kit
claude plugin install bee-keeper@bee-keeper --scope project
```
In the desktop app `/plugin` does not run. Click **+** next to the prompt box, then Plugins, then Add marketplace.

One-time cleanup: if you installed superpowers from obra's marketplace, remove that copy so it does not load twice.
```
claude plugin uninstall superpowers@superpowers-dev --scope user
```

## What you get

Every enabled skill adds its description to every session, and some add hooks. So the kit keeps the default small.

| Plugin | Tier | Why | Hooks |
| --- | --- | --- | --- |
| superpowers | default | Workflow skills: brainstorming, plans, TDD, debugging, verification | SessionStart |
| andrej-karpathy-skills | default | One small guideline skill: think first, keep it simple, make surgical changes | none |
| hive-router | default | Picks the model for each subagent and learns from misses | mod hooks (engine events) |
| agent-hud | default | Status card and `/hud` panel; depends on hive-router | mod hooks (engine events) |
| taste-skill | optional | Design guidance for frontend and web UI projects | none |
| graphify | optional | Code knowledge graph for large or unfamiliar codebases | PreToolUse before Read/Glob/search, optional git hooks |
| caveman | optional, opt-in | Terse answers to save tokens | SessionStart, SubagentStart |

- Default plugins are enabled for the project by `bee-keeper`.
- taste-skill needs Node 22 or later and Chrome or Chromium, plus network access for images.
- graphify is not a Claude plugin. bee-scout prints its commands (`uv tool install graphifyy`, `graphify install`) for
  you to run.
- caveman is installed with local scope, so it is not committed for your team.
- Outside plugins track their authors' repos. The kit holds no copies.

## bee-scout

`/bee-keeper:bee-scout` reads the project's `CLAUDE.md`, plan, architecture doc and stack files. It then:

1. Checks the defaults: reports a missing one, or a duplicate such as superpowers installed from two marketplaces.
2. Suggests optional skills that match what it found, and lists caveman as available.
3. Asks which to accept. It applies only what you approve, and never runs external commands itself.

Run it again as the plan grows. It ends by asking you to run `/reload-plugins`.

## Layout

```
.claude-plugin/marketplace.json    the bee-keeper marketplace
plugins/bee-keeper/                the plugin: catalog.json and the bee-scout skill
mods/hive-router, mods/agent-hud   the two own plugins
agents/core/                       generic agents copied into every project
agents/examples/python-fastapi-discord/   stack-specific examples to learn from
templates/                         PLAN.md, ARCHITECTURE.md and settings.json for new projects
CLAUDE.template.md                 the CLAUDE.md to start from
docs/skills-and-plugins.md         what else to install, and what was left out
docs/hive-workflow.md              how the pieces work together
scripts/setup.ps1, scripts/setup.sh   copy the kit into a project
THIRD_PARTY_NOTICES.md             licences and attributions
```

See [docs/hive-workflow.md](docs/hive-workflow.md) for how the agents and mods fit together.

## Keeping up to date

- Own plugins (`bee-keeper`, `hive-router`, `agent-hud`) are versioned. A new version ships when the version number
  is bumped.
- Outside plugins follow their source repos and update when the author releases.
- With auto-update on, Claude Code pulls changes in the background. Otherwise run
  `claude plugin marketplace update bee-keeper`.

## Credits

Agents adapted from [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
(including `surgeon-reviewer` from LucianFord/agent-pack). agent-hud takes design cues from johnnyvizz/claude-kit and
xuanji86/claude-statuspane. Workflow plugins come from obra/superpowers. Details and licences are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). BeeKeeper-Kit itself is MIT licensed, see [LICENSE](LICENSE).
