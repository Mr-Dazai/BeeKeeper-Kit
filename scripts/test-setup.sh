#!/usr/bin/env bash
# Tests scripts/setup.sh against temp dirs. Usage: bash scripts/test-setup.sh
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
setup="$root/scripts/setup.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }

# Case 1: fresh dir
t="$tmp/fresh"; mkdir -p "$t"
bash "$setup" "$t" >/dev/null 2>&1
s="$t/.claude/settings.json"
if [ -f "$t/CLAUDE.md" ] && [ -f "$t/docs/PLAN.md" ] && [ -f "$t/docs/ARCHITECTURE.md" ] && [ -f "$s" ] \
  && grep -q '^  "extraKnownMarketplaces": {$' "$s" \
  && grep -q '^    "bee-keeper": {$' "$s" \
  && grep -q '^      "source": { "source": "github", "repo": "Mr-Dazai/BeeKeeper-Kit" }$' "$s" \
  && grep -q '^    "bee-keeper@bee-keeper": true$' "$s"; then
  ok "fresh dir seeds docs and settings"
else bad "fresh dir seeds docs and settings"; fi

# Case 2: existing settings.json untouched, also with --force
t="$tmp/existing"; mkdir -p "$t/.claude"
printf '{"permissions":{}}' > "$t/.claude/settings.json"
cp "$t/.claude/settings.json" "$tmp/orig.json"
out="$(bash "$setup" "$t" 2>&1)"; out2="$(bash "$setup" "$t" --force 2>&1)"
if cmp -s "$tmp/orig.json" "$t/.claude/settings.json" \
  && echo "$out" | grep -qF 'claude plugin install bee-keeper@bee-keeper --scope project' \
  && echo "$out2" | grep -qF 'claude plugin install bee-keeper@bee-keeper --scope project'; then
  ok "existing settings.json unchanged, hint printed"
else bad "existing settings.json unchanged, hint printed"; fi

# Case 3: second run skips everything
t="$tmp/again"; mkdir -p "$t"
bash "$setup" "$t" >/dev/null 2>&1
out="$(bash "$setup" "$t" 2>&1)"
n_skip="$(echo "$out" | grep -c '^skip')"
n_copied="$(echo "$out" | grep -c '^copied')"
if [ "$n_skip" -gt 0 ] && [ "$n_copied" -eq 0 ]; then ok "second run only skips"; else bad "second run only skips"; fi

# Case 4: path with a space
t="$tmp/with space"; mkdir -p "$t"
if bash "$setup" "$t" >/dev/null 2>&1 && [ -f "$t/.claude/settings.json" ] && [ -f "$t/docs/PLAN.md" ]; then
  ok "directory with a space"
else bad "directory with a space"; fi

exit "$fail"
