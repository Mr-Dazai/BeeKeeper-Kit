# Bee Keeper: one-line install of the kit's skills, plus a plan-driven picker

Date: 2026-10-23. Status: approved 2026-10-23.

## Intent

The owner (Mr-Dazai) starts every project from this template. Today that means running the setup script, installing
hive-router and agent-hud from this marketplace, then installing superpowers from obra's marketplace by hand, and
remembering which other skills suit the project. The goal is:

1. **One install line per project** gives every project the same base:
   `claude plugin install bee-keeper@bee-keeper --scope project` (the setup script does it for you).
2. **Outside skills follow their authors' repos**, so the kit never holds stale copies.
3. **Project-specific skills are added only when the project needs them**, chosen by reading the project's plan, so
   Claude's context is not bloated with skills that never fire.

The bloat point matters most to the owner: every enabled skill's description loads into every session, and some packs
add hooks that run on every session or tool call. The kit stays small on purpose.

## Goals

- A `bee-keeper` plugin in this marketplace whose installation pulls in every default plugin.
- Marketplace entries for outside plugins that point at their GitHub repos and track upstream.
- A `bee-scout` skill (run as `/bee-keeper:bee-scout`) that reads the project's architecture and plan, proposes optional
  skills with one reason each, and enables only the ones the owner approves.
- A catalog file listing every default and optional skill, so adding a skill later is one catalog entry plus one
  marketplace entry.
- A recommended project doc layout (`docs/PLAN.md`, `docs/ARCHITECTURE.md`) that the setup script seeds and bee-scout
  reads.

## Non-goals

- Copying (vendoring) any outside skill into this repo.
- A separate status command. bee-scout prints the project's current state first; that is enough.
- Removing or disabling default plugins from bee-scout.
- Installing anything without the owner's approval in that run.
- The skill packs reviewed and left out (below).

## Anti-goals (failure even if it technically works)

- Every project ends up with every skill enabled.
- A default adds hooks that run on every session, prompt or tool call, beyond today's setup (hive-router, agent-hud
  and superpowers' own SessionStart hook, which the owner already runs). Verification checks that
  andrej-karpathy-skills adds none.
- Anything changes the hive-worker report format that the main agent reviews.
- The same skill is loaded twice (for example superpowers from both obra's marketplace and this one).

## Decisions made with the owner

### Tiers

| Plugin | Tier | Source | Why |
|---|---|---|---|
| `superpowers` | default | `github: obra/superpowers` | Workflow skills: brainstorming, plans, TDD, debugging, verification |
| `andrej-karpathy-skills` | default | `github: multica-ai/andrej-karpathy-skills` | One small guideline skill (think first, simplicity, surgical changes, verifiable goals). No hooks |
| `hive-router` | default | `./mods/hive-router` (existing) | Picks subagent models |
| `agent-hud` | default | `./mods/agent-hud` (existing) | Status card and `/hud` panel; depends on hive-router |
| `taste-skill` | optional | `github: Leonxlnx/taste-skill` | Frontend and web UI projects. Needs Node 22+ and Chrome/Edge/Chromium, network for images |
| `graphify` | optional | not a Claude plugin: `uv tool install graphifyy` then `graphify install` | Large or unfamiliar codebases. Adds PreToolUse hooks before Read/Glob/search, and optional git hooks |
| `caveman` | optional, opt-in only | `github: JuliusBrussee/caveman` | Terse answers to save tokens. SessionStart and SubagentStart hooks; changes subagent output style |

Names on each repo were checked on 2026-10-23: the plugin names in their own manifests are `superpowers`,
`andrej-karpathy-skills`, `taste-skill` and `caveman`. Marketplace entry names must equal these manifest names.
`forrestchang/andrej-karpathy-skills` resolves to `multica-ai/andrej-karpathy-skills`; use the multica-ai path.

### Reviewed and not adopted

- **ponytail** (DietrichGebert/ponytail): duplicates karpathy-skills; runs hooks after every turn and logs a row per
  task (optional webhook); its cost band clashes with agent-hud.
- **mattpocock/skills**: 27 skills in one plugin, most overlapping superpowers (grill-me/brainstorming, tdd,
  diagnosing-bugs/systematic-debugging, to-spec/writing-plans, implement-spec/subagent-driven, code-review).
- **ui-ux-pro-max** (nextlevelbuilder/ui-ux-pro-max-skill): a second frontend design skill alongside taste-skill; both
  would trigger on every UI request.

### Install scope: per project (owner's decision)

bee-keeper and everything it brings are enabled **per project**, in that project's committed `.claude/settings.json`,
not once per machine. Anyone who opens and trusts the project is offered the same kit. Optional skills chosen by
bee-scout are per project too.

- Bootstrapping: bee-scout lives inside bee-keeper, so bee-keeper must be on in the project first. The setup script
  does that (below); in a project set up without the script, the owner runs
  `claude plugin install bee-keeper@bee-keeper --scope project` once.
- Reload: a skill cannot run `/reload-plugins`. bee-scout installs what was approved, then tells the owner to run
  `/reload-plugins` so the new skills load in the current session.
- One-time cleanup on the owner's machine (part of the build, run with the owner's approval): uninstall the
  user-scope `superpowers@superpowers-dev`, so projects with bee-keeper do not load superpowers twice. Side effect,
  accepted as builder's call: projects without bee-keeper no longer get superpowers until set up. The old-marketplace
  user-scope copies of hive-router and agent-hud are uninstalled in the same cleanup: the marketplace was renamed, so they
  would load twice.
- bee-scout step 1 judges "a default missing" against this project's settings.

### Names

- Plugin: `bee-keeper`, display name "Bee Keeper Skill".
- Skill/command: `bee-scout`, invoked as `/bee-keeper:bee-scout`. Lowercase-hyphen is required for skill names.
- Kit theme: hive (hive-router, hive-worker, agent-hud).

### Updates follow upstream

- Outside entries set no `version` and no `ref`/`sha`, so they track the source repo. Where the source's own
  `plugin.json` sets a version (superpowers 7.0.1, caveman 4.0.1), users get a new copy when the author bumps it; that
  is the authors' release cadence and is accepted.
- Background auto-update is off by default for any non-Anthropic marketplace and no marketplace field turns it on.
  The README tells the owner to turn it on once: `/plugin` → Marketplaces → this marketplace → Enable auto-update.
  Without it, `claude plugin marketplace update bee-keeper` pulls changes.
- Own plugins (`bee-keeper`, `hive-router`, `agent-hud`) and the marketplace start fresh at `0.0.1` and keep pinned
  versions; bump on every release (an unchanged version means users never get the new code).

### Project doc layout (recommended; bee-scout reads it, never requires it)

```
CLAUDE.md
docs/
  PLAN.md            goals, milestones, open questions, owner decisions (source of truth)
  ARCHITECTURE.md    stack, main parts and how they connect, key choices
  superpowers/specs/ and superpowers/plans/   created by superpowers when used
.claude/agents/      copied by the setup script
.claude/settings.json
```

## How it works

### Marketplace (`.claude-plugin/marketplace.json`)

The kit moves to a new public repo, `Mr-Dazai/BeeKeeper-Kit`, with fresh history (no Claude co-author lines). The
marketplace `name` becomes `bee-keeper`, so installs read `<plugin>@bee-keeper`. The old
`Mr-Dazai/Claude-Code-Setup-template` repo is left as it is. Entries:

```json
{ "name": "bee-keeper", "source": "./plugins/bee-keeper", "description": "..." },
{ "name": "superpowers", "source": { "source": "github", "repo": "obra/superpowers" }, "description": "..." },
{ "name": "andrej-karpathy-skills", "source": { "source": "github", "repo": "multica-ai/andrej-karpathy-skills" }, "description": "..." },
{ "name": "taste-skill", "source": { "source": "github", "repo": "Leonxlnx/taste-skill" }, "defaultEnabled": false, "description": "..." },
{ "name": "caveman", "source": { "source": "github", "repo": "JuliusBrussee/caveman" }, "defaultEnabled": false, "description": "..." }
```

graphify gets no entry (it is not a plugin); it lives only in the catalog.

### `bee-keeper` plugin (`plugins/bee-keeper/`)

```
plugins/bee-keeper/
  .claude-plugin/plugin.json   name, displayName "Bee Keeper Skill", version, dependencies
  catalog.json                 every default and optional skill (below)
  skills/bee-scout/SKILL.md
```

`plugin.json` `dependencies`: `["superpowers", "andrej-karpathy-skills", "hive-router", "agent-hud"]`. Bare names
resolve in this marketplace, so no cross-marketplace allowlist is needed. Installing bee-keeper installs and enables
all four. Optional plugins are never dependencies.

`bee-scout`'s frontmatter sets `disable-model-invocation: true` so it runs only when the owner calls it and adds
nothing to the model's per-session skill list.

### `catalog.json`

One entry per skill, the single source for bee-scout and the README table:

- `name`, `tier` (`default` | `optional`), `summary`
- `install`: `{ "plugin": "taste-skill@bee-keeper", "scope": "project" }` or
  `{ "external": ["uv tool install graphifyy", "graphify install"] }`
- `requires`: e.g. `["node>=22", "chromium-browser"]`, `["python>=3.10", "uv"]`
- `signals`: what in the project suggests it (stack files, keywords in ARCHITECTURE/PLAN, size)
- `optIn`: `true` for caveman (never suggested from signals; only listed as available)
- `notes`: hooks it adds and side effects, shown to the owner before approval

### `bee-scout` flow

1. **State.** Run `claude plugin list` and show which defaults and optionals are on for this project. Flag problems:
   a default missing; superpowers also installed from another marketplace (for example `superpowers@superpowers-dev`),
   with the uninstall command to fix the duplicate.
2. **Read**, in order, skipping what is missing: `docs/ARCHITECTURE.md`, `docs/PLAN.md`, the newest file in
   `docs/superpowers/specs/`, `CLAUDE.md`, then stack files (`package.json`, `pyproject.toml`, `requirements*.txt`,
   `Dockerfile`, `go.mod`, `Cargo.toml`, framework configs).
3. **Match** each optional, non-opt-in catalog entry against its `signals`. Starting signals (builder may refine):
   - taste-skill: a web or app UI (React, Vue, Svelte, Next, Astro, HTML pages, Tailwind; or the docs describe a
     dashboard, landing page, site or app screens).
   - graphify: roughly 500+ source files, or the docs describe an inherited/legacy/unfamiliar codebase.
4. **Propose** a short list: each match with one reason quoting what it found, its requirements and the hooks it adds.
   Also list caveman as available (opt-in), and any optional already on that no longer matches (suggest removal; never
   remove without approval).
5. **Ask** the owner which to accept.
6. **Apply** only approved items: plugin entries with `claude plugin install <id> --scope project` (caveman with
   `--scope local`, since terse output is a personal preference and should not be committed for a team); external
   entries are printed as commands for the owner to run, never run by bee-scout. Then tell the owner to run
   `/reload-plugins`.
7. Re-running later re-does steps 1-6 against the grown plan.

### Setup scripts (`scripts/setup.ps1`, `scripts/setup.sh`)

Keep current behaviour and the skip-unless-force rule. Add:

- Copy `templates/PLAN.md` and `templates/ARCHITECTURE.md` (new, headings only) to `<project>/docs/`.
- If `<project>/.claude/settings.json` does not exist, write one with `extraKnownMarketplaces` for
  `Mr-Dazai/BeeKeeper-Kit` and `enabledPlugins: { "bee-keeper@bee-keeper": true }`, so
  anyone who trusts the folder is offered the kit. If it exists, leave it untouched and print
  `claude plugin install bee-keeper@bee-keeper --scope project` for the owner to run.
- Print the next steps: open the project in Claude Code and trust it, enable auto-update once, run
  `/bee-keeper:bee-scout`, then `/reload-plugins`.

### Docs

- README: the one-line install, the tier table, the auto-update step, bee-scout.
- `docs/skills-and-plugins.md`: replace the manual superpowers install with the bee-keeper line; add the three packs
  not adopted and why; keep the existing not-adopted list. `code-review` and `claude-md-management`
  (@claude-plugins-official) stay as manual recommendations there, outside the catalog and outside bee-scout
  (builder's call made in review: they are Anthropic's own and need no entry here).
- `THIRD_PARTY_NOTICES.md`: list each referenced outside plugin with its licence (superpowers MIT, karpathy MIT,
  taste-skill MIT, caveman Apache-2.0 with MIT file, graphify Apache-2.0/MIT), noting they are referenced, not copied.

## Constraints

- Claude Code with plugin `dependencies` support; the README states "run `claude update` first", as the docs already do.
- Plugin and skill names: kebab-case; names must not start with `claude-`.
- LF line endings (existing `.gitattributes`).
- No new runtime code is required: bee-scout is a skill (instructions) plus a JSON catalog.

## Verification

- `claude plugin validate .` on the marketplace and `claude plugin validate plugins/bee-keeper` pass.
- On a clean machine profile (or after removing the marketplace): `claude plugin marketplace add ./` (local path),
  `claude plugin install bee-keeper@bee-keeper`, then `claude plugin list` shows bee-keeper plus all
  four defaults enabled, and taste-skill and caveman not enabled.
- bee-scout dry runs on two scratch projects: a Next.js app (proposes taste-skill), a small FastAPI service (proposes
  nothing, lists caveman as available). Neither installs anything until approved.
- The existing setup script behaviour is unchanged for files that already exist.

## Left to the builder

- Exact wording of descriptions, README and SKILL.md.
- Exact catalog JSON shape beyond the fields above.
- Refining the signal lists and the graphify size threshold.
- Template headings for PLAN.md and ARCHITECTURE.md.
