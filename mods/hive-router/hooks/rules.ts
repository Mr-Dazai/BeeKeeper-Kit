// The routing rules. Edit freely: the mod reloads on save.

export type Tier = 'haiku' | 'sonnet' | 'opus'

/**
 * Per agent type (the part after any `plugin:` prefix, lowercase):
 * a tier to always use, or `'file'` to keep the model the agent's own definition names.
 * Types not listed here and not in TASK_ROUTED are left alone.
 */
// EXAMPLE: these are the example project's specialists. Edit this list to match your own
// .claude/agents. An agent type that is not listed is simply left on its own model.
export const BY_TYPE: Record<string, Tier | 'file'> = {
  // Built-in agents
  explore: 'haiku',
  'claude-code-guide': 'haiku',
  'statusline-setup': 'haiku',
  plan: 'opus',
  // This project's specialists: their files already name model and effort.
  'fastapi-developer': 'file',
  'webhook-engineer': 'file',
  'mcp-developer': 'file',
  'readme-generator': 'file',
  'arch-guardian': 'file',
  'secrets-auditor': 'file',
  'milestone-checker': 'file',
  'surgeon-reviewer': 'file',
  // superpowers' reviewer: a judgment task
  'code-reviewer': 'opus',
}

/** Generalist types whose model is chosen from the task itself. */
export const TASK_ROUTED = new Set(['hive-worker', 'general-purpose'])

/** Read in order; a heavy match beats a light one. Matched against the task's description and the start of its brief. */
export const HEAVY: readonly RegExp[] = [
  /\barchitect(ure|ural)?\b/i,
  /\bdesign\b/i,
  /\bsecurity\b|\bthreat\b|\bvulnerab/i,
  /\bauth(entication|orization)?\b|\bed25519\b|\bsignature\b/i,
  /\broot cause\b|\brace condition\b|\bconcurren(t|cy)\b|\bdeadlock\b/i,
  /\bmigration (plan|strategy)\b|\bdata model\b|\bschema design\b/i,
  /\bfinal review\b|\breview (the )?(whole|branch|pr)\b|\bmilestone gate\b/i,
  /\btrade-?offs?\b|\bevaluate (options|approaches)\b/i,
]

export const LIGHT: readonly RegExp[] = [
  /^(find|search|locate|list|grep|count|look up|lookup)\b/i,
  /\b(find|search for|locate|list) (all|every|the) /i,
  /\bsummari[sz]e\b|\bsummary of\b/i,
  /\b(status|inventory) (of|check)\b/i,
  /\b(format|reformat|rename|typo|spelling|sort imports|lint fix)\b/i,
  /\bread (and|then) report\b|\bwhat (does|is) .{0,40}\?$/i,
]

export const DEFAULT_TIER: Tier = 'sonnet'

/**
 * The models the specialists' own files name, so an escalation knows where they start.
 * Keep in step with .claude/agents/*.md.
 */
// EXAMPLE: these are the example project's specialists and the models their files name.
// Edit this list to match your own .claude/agents. An unknown type is simply left on its own model.
export const SPECIALIST_BASE: Record<string, Tier> = {
  'milestone-checker': 'haiku',
  'secrets-auditor': 'sonnet',
  'arch-guardian': 'sonnet',
  'readme-generator': 'sonnet',
  'fastapi-developer': 'sonnet',
  'webhook-engineer': 'sonnet',
  'mcp-developer': 'sonnet',
  'surgeon-reviewer': 'opus',
}

/** hive-worker's high-effort twin; the ladder's `deep` steps switch to it. */
export const DEEP_VARIANT: Record<string, string> = { 'hive-worker': 'hive-worker-deep' }

// ---- Learning ----

/** Misses push a kind of task one step up; this many successes in a row at a raised step bring it one back down. */
export const STEP_DOWN_AFTER = 5

/** The main agent re-dispatching the same task this soon after a run counts that run as a miss. */
export const REDISPATCH_WINDOW_MS = 30 * 60_000

/** Edits the main agent makes itself in one turn, with no subagent started, before it is reminded to delegate. */
export const MAIN_EDIT_NUDGE = 5

/** The brief is long; the first part says what the task is. */
export const BRIEF_CHARS = 1500

// ---- Shell edits: a Bash command that changes files counts as one edit ----

/**
 * Parts of a shell command that never change a file: file-descriptor copies (`2>&1`, `>&2`) and output sent to /dev/null.
 * Removed from the command before WRITE_COMMANDS is matched. Global, so every occurrence goes.
 */
export const WRITE_EXCLUDED: readonly RegExp[] = [/\d*>&\s*(\d+|-)/g, /&?\d*>{1,2}\s*\/dev\/null(?![\w./-])/g]

/**
 * Patterns that a shell command changes files. Matched against the command with WRITE_EXCLUDED removed.
 * Read-only forms (`git status`, `ls`, `npx tsc --noEmit`) match none of these.
 * Known limit: a `>` inside quotes (`python -c "a>b"`) reads as a redirect.
 */
export const WRITE_COMMANDS: readonly RegExp[] = [
  // output sent to a file: `> f`, `>> f`, `2> f`, `&> f`, `cat <<EOF > f`
  /(?<![-=<>])&?\d*>{1,2}\s*(?=[^\s&(=])/,
  // tee writes its input to files, with or without -a
  /(?:^|[;&|(]\s*)(?:sudo\s+)?tee(?=\s|$)/,
  // sed in place
  /\bsed\b[^|;&]*?\s(?:-[a-zA-Z]*i\S*|--in-place\b)/,
  // file commands
  /(?:^|[;&|(]\s*)(?:sudo\s+)?(?:mv|cp|rm|rmdir|mkdir|touch|patch)(?=\s|$)/,
  // a script read from stdin: `python - <<EOF`, `python3 <<EOF`, `node - <<EOF`
  /\b(?:python3?|node)\s+-(?=\s|<|$)/,
  /\bpython3?\s*<</,
  // python -c / node -e that open a file for writing
  /\bpython3?\s+-c\b.*?(?:\.write\s*\(|\.write_(?:text|bytes)\s*\(|\bopen\s*\([^)]*,\s*['"][rbt]*[wax+])/,
  /\bnode\s+(?:-e|--eval)\b.*\b(?:writeFile|appendFile)(?:Sync)?\s*\(/,
  // git commands that rewrite the working tree (`--check` and `--staged` only read or touch the index)
  /\bgit\s+apply\b(?![^|;&]*--(?:check|stat|numstat|summary)\b)/,
  /\bgit\s+checkout\s+--(?=\s|$)/,
  /\bgit\s+restore\b(?![^|;&]*--staged\b)/,
  // formatters and fixers that write in place
  /\bprettier\b[^|;&]*\s--write\b/,
  /\bruff\s+format\b(?![^|;&]*--(?:check|diff)\b)/,
  /\bruff\s+check\b[^|;&]*--fix\b/,
  /\beslint\b[^|;&]*--fix\b/,
]
