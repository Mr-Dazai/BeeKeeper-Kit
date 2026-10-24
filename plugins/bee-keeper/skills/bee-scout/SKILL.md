---
name: bee-scout
description: Scout this project and propose optional skills (taste-skill, graphify, caveman) for the owner to approve.
disable-model-invocation: true
---

# bee-scout

Check this project's skill setup, propose optional skills that fit, and install only what the owner approves. Work through the steps in order. Install nothing before step 5 is answered.

## 1. State

Read `${CLAUDE_PLUGIN_ROOT}/catalog.json`. Run `claude plugin list` with Bash. Also read the project's `.claude/settings.json` and `.claude/settings.local.json` and note their `enabledPlugins`.

Show a short table of every catalog entry (defaults and optionals) and whether it is on for this project. "On for this project" means the enabled status that `claude plugin list` reports when run from the project directory (dependencies enabled through bee-keeper count as on). A plugin installed only elsewhere does not count. Use the settings files only as a fallback if the list output is unclear.

Flag problems:
- A default entry is missing for this project. Its fix is `claude plugin install <install.plugin> --scope <install.scope>` (defaults use `--scope project`).
- Duplicate: for every catalog entry with an `install.plugin` id `<name>@bee-keeper`, if a plugin with the same `<name>` is enabled from any other marketplace (for example `superpowers@superpowers-dev` or `hive-router@<old-marketplace>`), use the scope that `claude plugin list` shows for the other copy. If the `<name>@bee-keeper` copy is enabled for this project, report that it loads twice; the fix is `claude plugin uninstall <name>@<other-marketplace> --scope <its scope>`. If the `<name>@bee-keeper` copy is NOT enabled in this project, offer ONE paired step 5 item, labelled "would load twice once installed": install `<name>@bee-keeper --scope project` AND uninstall the other copy (`claude plugin uninstall <name>@<other-marketplace> --scope <its scope>`). Run both or neither.

Do not run any fix in this step. Carry each one into the step 5 question as an item and run it in step 6 only if approved.

## 2. Read

Read these in order, skipping any that do not exist:
1. `docs/ARCHITECTURE.md`
2. `docs/PLAN.md`
3. the newest file in `docs/superpowers/specs/`
4. `CLAUDE.md`
5. stack files: `package.json`, `pyproject.toml`, `requirements*.txt`, `Dockerfile`, `go.mod`, `Cargo.toml`, and framework configs

If there are no stack files and no docs, print what you read, say there was nothing to go on, and that the owner can re-run `/bee-keeper:bee-scout` once a plan or code exists. If step 1 found fixes, skip steps 3 and 4 proposals, still list caveman as available, ask in step 5 only about the fixes, and run steps 6 and 7 for the approved ones. If step 1 found nothing to fix or remove, do not ask anything: list caveman as available with how to turn it on (ask Claude to run `claude plugin install caveman@bee-keeper --scope local`, or run that command), and end. In that no-fix case skip steps 5 to 7; no `/reload-plugins` note, since nothing changed.

## 3. Match

Check each catalog entry that is `optional` and not `optIn` against its `signals`. Never suggest an `optIn` entry from signals.

- taste-skill: the project has a web or app UI (React, Vue, Svelte, Next, Astro, HTML pages, Tailwind), or the docs describe a dashboard, landing page, site or app screens. Use the entry's `signals.files` and `signals.keywords` as hints.
- graphify: the source file count reaches the entry's `signals.minSourceFiles`, or the docs describe a legacy, inherited or unfamiliar codebase. Count tracked source files with `git ls-files` filtered to common source extensions (for example py, js, ts, tsx, jsx, go, rs, java, kt, rb, php, cs, c, cpp, h, swift, vue, svelte). If the project is not a git repo, count with Glob instead. Report the number.

Judge from what you read, not from file names alone.

## 4. Propose

Give a short list. For each match include:
- the skill name and its `summary`
- one reason that quotes or cites what you found
- its `requires`
- the hooks it adds, taken from `notes`

Also list caveman as available (opt-in, not recommended by signals). Also list any optional skill already on for this project that no longer matches, and suggest removing it. Never remove anything without approval.

## 5. Ask

Ask the owner once which items to accept, using the AskUserQuestion tool with `multiSelect` where available, otherwise a plain numbered question. Include the proposed installs, any suggested removals, and the step 1 fixes (missing defaults, duplicates). If there is nothing to propose, fix or remove, do not ask; end as described in step 2. If the owner picks nothing, stop here.

## 6. Apply

Handle only the approved items. Before running any command, show it to the owner.

- Plugin entries: run `claude plugin install <install.plugin> --scope <install.scope>`. Use the scope from the catalog: taste-skill `--scope project`; caveman `--scope local`, because terse output is a personal preference and must not be committed for a team.
- External entries (graphify): print the `install.external` commands for the owner to run themselves. Never run them. Mention the `requires`.
- Approved removals: run `claude plugin uninstall <id> --scope <scope>`, using the scope where it is installed. Approved step 1 fixes run here too (for example `claude plugin uninstall superpowers@superpowers-dev --scope user`).

Report each result. If a command fails, show the error and stop on that item.

## 7. Reload

Tell the owner to run `/reload-plugins` so the new skills load in this session. A skill cannot run it.

Re-running `/bee-keeper:bee-scout` later repeats steps 1 to 6 against the project as it has grown.
