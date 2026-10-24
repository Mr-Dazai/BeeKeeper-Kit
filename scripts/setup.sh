#!/usr/bin/env bash
# Usage: scripts/setup.sh <target-project-path> [--force]
# Copies agents/core/*.md to <target>/.claude/agents/, CLAUDE.template.md to <target>/CLAUDE.md,
# templates/PLAN.md and templates/ARCHITECTURE.md to <target>/docs/, and templates/settings.json to
# <target>/.claude/settings.json (enables the bee-keeper plugin). Existing docs, CLAUDE.md and agents are
# skipped unless --force; an existing settings.json is never touched.
# No network, no other side effects.
set -eu

force=0
target=""
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    *) target="$arg" ;;
  esac
done

if [ -z "$target" ]; then
  echo "Usage: $0 <target-project-path> [--force]" >&2
  exit 1
fi
if [ ! -d "$target" ]; then
  echo "Target folder not found: $target" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$target/.claude/agents"
mkdir -p "$dest"

for f in "$root"/agents/core/*.md; do
  name="$(basename "$f")"
  if [ -e "$dest/$name" ] && [ "$force" -ne 1 ]; then
    echo "skip   $name (exists; use --force to overwrite)"
  else
    cp "$f" "$dest/$name"
    echo "copied $name"
  fi
done

if [ -e "$target/CLAUDE.md" ]; then
  echo "skip   CLAUDE.md (exists)"
else
  cp "$root/CLAUDE.template.md" "$target/CLAUDE.md"
  echo "copied CLAUDE.md"
fi

mkdir -p "$target/docs"
for name in PLAN.md ARCHITECTURE.md; do
  if [ -e "$target/docs/$name" ] && [ "$force" -ne 1 ]; then
    echo "skip   docs/$name (exists; use --force to overwrite)"
  else
    cp "$root/templates/$name" "$target/docs/$name"
    echo "copied docs/$name"
  fi
done

if [ -e "$target/.claude/settings.json" ]; then
  echo "skip   .claude/settings.json (exists) — run: claude plugin install bee-keeper@bee-keeper --scope project"
else
  cp "$root/templates/settings.json" "$target/.claude/settings.json"
  echo "copied .claude/settings.json"
fi

cat <<'EOT'

Next steps:
  1. Open the project in Claude Code and trust the folder; accept the bee-keeper install it offers.
  2. Turn on auto-update once: /plugin → Marketplaces → bee-keeper → Enable auto-update.
  3. Run /bee-keeper:bee-scout, then /reload-plugins.
  4. Edit CLAUDE.md, docs/PLAN.md, docs/ARCHITECTURE.md and the EDIT sections in arch-guardian, secrets-auditor and milestone-checker.
EOT
