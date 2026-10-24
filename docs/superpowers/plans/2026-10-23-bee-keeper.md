# Bee Keeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this kit into the `bee-keeper` marketplace: one per-project install that brings the default plugins, plus a `bee-scout` skill that picks optional skills from the project's plan; then publish it as 0.0.1 in a new public repo `Mr-Dazai/BeeKeeper-Kit`.

**Architecture:** Pure configuration and instructions, no runtime code: a marketplace JSON with local and GitHub entries, a `bee-keeper` plugin whose `dependencies` pull the defaults, a `catalog.json` read by the `bee-scout` SKILL.md, and setup scripts that seed docs and project settings. Publishing copies the tree into a fresh repo with new history.

**Tech Stack:** Claude Code plugin manifests (`marketplace.json`, `plugin.json`, `SKILL.md`), bash + PowerShell, `claude plugin validate|install|list`, `gh`.

**Spec:** `docs/superpowers/specs/2026-10-23-bee-keeper-design.md`

## Global Constraints

- Marketplace name `bee-keeper`; repo `Mr-Dazai/BeeKeeper-Kit` (public); install ids `<plugin>@bee-keeper`.
- Own versions all `0.0.1`: marketplace `metadata.version`, `bee-keeper`, `hive-router`, `agent-hud`.
- Outside entries (`superpowers`, `andrej-karpathy-skills`, `taste-skill`, `caveman`) set no `version`, `ref` or `sha`. Entry names equal their manifest names.
- `bee-keeper` `dependencies`: `["superpowers", "andrej-karpathy-skills", "hive-router", "agent-hud"]`. Optionals are never dependencies.
- `bee-scout` frontmatter: `disable-model-invocation: true`.
- Optional installs: taste-skill `--scope project`, caveman `--scope local`, graphify printed only (`uv tool install graphifyy`, `graphify install`), never run.
- Setup scripts never overwrite an existing file without `--force` / `-Force`; existing `.claude/settings.json` is never edited.
- No `Co-Authored-By` or "Generated with Claude Code" lines in any commit or PR. LF line endings.

## Review Focus

- A project that already has `.claude/settings.json` (e.g. permissions) → setup leaves it byte-identical and prints the install line. Test in Task 3.
- Setup run twice → second run copies nothing and exits 0. Test in Task 3.
- Target path with spaces (`C:\Users\x\My Project`) → both scripts work. Test in Task 3.
- superpowers also installed from `superpowers-dev` → bee-scout reports the duplicate with the exact uninstall command. Pinned in Task 2's SKILL.md and checked in Task 5.
- Project with no `docs/` and no stack files → bee-scout says it found nothing to go on and proposes nothing (only lists caveman). Checked in Task 5.

---

### Task 1: Marketplace and bee-keeper plugin manifest

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Create: `plugins/bee-keeper/.claude-plugin/plugin.json`
- Modify: `mods/hive-router/.claude-plugin/plugin.json`, `mods/agent-hud/.claude-plugin/plugin.json` (version → `0.0.1`)
- Modify: `mods/agent-hud/README.md`, `mods/hive-router/README.md` (install lines → `@bee-keeper`, `Mr-Dazai/BeeKeeper-Kit`)

**Interfaces:**
- Produces: marketplace `bee-keeper` with entries `bee-keeper` (`./plugins/bee-keeper`), `hive-router`, `agent-hud`, `superpowers` (`github obra/superpowers`), `andrej-karpathy-skills` (`github multica-ai/andrej-karpathy-skills`), `taste-skill` (`github Leonxlnx/taste-skill`, `defaultEnabled: false`), `caveman` (`github JuliusBrussee/caveman`, `defaultEnabled: false`).
- `plugins/bee-keeper/.claude-plugin/plugin.json`: `name "bee-keeper"`, `displayName "Bee Keeper Skill"`, `version "0.0.1"`, `author {name: "Mr-Dazai"}`, `license "MIT"`, the dependencies above.

- [ ] **Step 1:** Write the manifests. If `claude plugin validate` warns that `defaultEnabled` is unknown on a marketplace entry, drop it from both entries (the dependency list already keeps optionals out).
- [ ] **Step 2:** Run `claude plugin validate .` and `claude plugin validate plugins/bee-keeper`. Expected: `✔ Validation passed` for both.
- [ ] **Step 3:** Commit `feat: bee-keeper marketplace and plugin manifest`.

### Task 2: catalog.json and bee-scout skill

**Files:**
- Create: `plugins/bee-keeper/catalog.json`
- Create: `plugins/bee-keeper/skills/bee-scout/SKILL.md`

**Interfaces:**
- Consumes: install ids from Task 1.
- Produces: `catalog.json` = `{ "version": 1, "skills": [Entry] }`, `Entry` = `{ name, tier: "default"|"optional", summary, install: {plugin, scope} | {external: string[]}, requires: string[], signals: {files: string[], keywords: string[], minSourceFiles?: number}, optIn: boolean, notes }`. Seven entries: the four defaults (signals empty), taste-skill, graphify (`minSourceFiles: 500`, keywords `legacy`, `inherited`, `unfamiliar`), caveman (`optIn: true`).
- SKILL.md frontmatter: `name: bee-scout`, a one-line `description`, `disable-model-invocation: true`. Body references `${CLAUDE_PLUGIN_ROOT}/catalog.json` and follows the spec's 7-step flow verbatim in order (state → read → match → propose → ask → apply → reload note).

- [ ] **Step 1:** Write `catalog.json`; validate it parses: `python -c "import json;d=json.load(open('plugins/bee-keeper/catalog.json'));assert len(d['skills'])==7"`. Expected: no output, exit 0.
- [ ] **Step 2:** Write SKILL.md. It must include: the duplicate check (`superpowers@superpowers-dev` → `claude plugin uninstall superpowers@superpowers-dev --scope user`); the empty-project message; never running `external` commands; ending with "run `/reload-plugins`".
- [ ] **Step 3:** `claude plugin validate plugins/bee-keeper`. Expected: passed, skills (1) `bee-scout`.
- [ ] **Step 4:** Commit `feat: bee-scout skill and catalog`.

### Task 3: Setup scripts and doc templates

**Files:**
- Create: `templates/PLAN.md`, `templates/ARCHITECTURE.md` (headings only)
- Modify: `scripts/setup.sh`, `scripts/setup.ps1`
- Test: `scripts/test-setup.sh` (bash, runs setup.sh against temp dirs)

**Interfaces:**
- Consumes: install id `bee-keeper@bee-keeper`, repo `Mr-Dazai/BeeKeeper-Kit`.
- Produces: setup writes `<t>/docs/PLAN.md`, `<t>/docs/ARCHITECTURE.md` (skip if present), and `<t>/.claude/settings.json` only when absent, containing exactly `extraKnownMarketplaces.bee-keeper.source = {source: "github", repo: "Mr-Dazai/BeeKeeper-Kit"}` and `enabledPlugins["bee-keeper@bee-keeper"] = true`.

- [ ] **Step 1: Failing test** `scripts/test-setup.sh` with cases: fresh dir → all files exist and settings JSON has the two keys; pre-existing `settings.json` with `{"permissions":{}}` → unchanged (cmp) and output contains `claude plugin install bee-keeper@bee-keeper --scope project`; second run → every line starts with `skip`; dir with a space in its name → succeeds.
- [ ] **Step 2:** Run `bash scripts/test-setup.sh`. Expected: FAIL (no docs/settings yet).
- [ ] **Step 3:** Implement in `setup.sh`, then mirror in `setup.ps1` (write JSON with `-Encoding utf8` without BOM via `[IO.File]::WriteAllText`). Update the "Next steps" text per spec.
- [ ] **Step 4:** `bash scripts/test-setup.sh` → PASS; run `powershell -File scripts/setup.ps1 -Target <tmp>` once and check the same files appear.
- [ ] **Step 5:** Commit `feat: setup seeds docs and enables bee-keeper per project`.

### Task 4: Docs

**Files:**
- Modify: `README.md`, `docs/skills-and-plugins.md`, `docs/hive-workflow.md` (install lines only), `THIRD_PARTY_NOTICES.md`

- [ ] **Step 1:** README: title BeeKeeper; quick start = setup script → open and trust project → enable auto-update (`/plugin` → Marketplaces → bee-keeper → Enable auto-update) → `/bee-keeper:bee-scout` → `/reload-plugins`; tier table; manual install line `claude plugin marketplace add Mr-Dazai/BeeKeeper-Kit` + `claude plugin install bee-keeper@bee-keeper --scope project`; one-time cleanup note for `superpowers@superpowers-dev`.
- [ ] **Step 2:** skills-and-plugins.md and THIRD_PARTY_NOTICES.md per spec.
- [ ] **Step 3:** `grep -rn "claude-code-setup-template\|Claude-Code-Setup-template" --exclude-dir=.git .` → only the spec's one historical mention.
- [ ] **Step 4:** Commit `docs: BeeKeeper readme, plugin notes and notices`.

### Task 5: End-to-end verification (local)

- [ ] **Step 1:** `claude plugin marketplace add ./` from the repo root. Expected: `Successfully added marketplace: bee-keeper`.
- [ ] **Step 2:** In a temp project: `claude plugin install bee-keeper@bee-keeper --scope project`, then `claude plugin list`. Expected: bee-keeper, superpowers, andrej-karpathy-skills, hive-router, agent-hud enabled; taste-skill and caveman not installed.
- [ ] **Step 3:** Check karpathy adds no hooks: `claude plugin details andrej-karpathy-skills` shows Hooks (0).
- [ ] **Step 4:** Dry-run bee-scout by having a subagent follow SKILL.md against two scratch projects (Next.js `package.json` with `next`, `react`; FastAPI `pyproject.toml`), answering "no" to every install. Expected: Next.js → proposes taste-skill with a reason; FastAPI → proposes nothing, lists caveman as available; both report the superpowers duplicate on this machine.
- [ ] **Step 5:** Remove the local marketplace: `claude plugin marketplace remove bee-keeper`.

### Task 6: Publish to Mr-Dazai/BeeKeeper-Kit as 0.0.1

- [ ] **Step 1:** `git archive HEAD | tar -x -C <new-folder>` (fresh folder; brings tracked files only, no history).
- [ ] **Step 2:** In that folder: `git init -b main`, `git add -A`, `git commit -m "BeeKeeper 0.0.1"` (no trailers), `git tag v0.0.1`.
- [ ] **Step 3:** `claude plugin validate .` → passed. Scan for secrets with the plugin-authoring `scan_secrets` tool before pushing.
- [ ] **Step 4:** `gh repo create Mr-Dazai/BeeKeeper-Kit --public --source . --push`, then `git push origin v0.0.1`.
- [ ] **Step 5:** From a temp project: `claude plugin marketplace add Mr-Dazai/BeeKeeper-Kit` → `Successfully added marketplace: bee-keeper`; `claude plugin install bee-keeper@bee-keeper --scope project` succeeds.
- [ ] **Step 6 (owner's approval):** one-time cleanup: `claude plugin uninstall superpowers@superpowers-dev --scope user`; move the user-scope hive-router and agent-hud from `claude-code-setup-template` to `bee-keeper` (uninstall old ids, the per-project install covers them).
