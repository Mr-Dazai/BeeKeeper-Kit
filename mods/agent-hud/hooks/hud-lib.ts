// Pure helpers: prices, icons and formatting. No `$` here, so tests can call them directly.

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

// [input, output, cache read, cache write (1h)] in USD per million tokens.
// List prices from the claude-api skill's model table (cached 2026-10-06); cache writes at the
// 1-hour rate (2x input), which is what Claude Code writes on a subscription. An estimate, not a bill.
type Price = readonly [number, number, number, number]
const PRICES: readonly (readonly [RegExp, Price])[] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.2, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]
// Haiku 5.5 bills prompts over 100K tokens at these prices instead.
const HAIKU_LONG: Price = [0.5, 2.5, 0.05, 1]
const FALLBACK: Price = [4, 20, 0.2, 8]

export const sumTokens = (u: Usage): number =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

/** `isRequest`: the usage is one model request, so prompt-length pricing applies. */
export const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const id = model.toLowerCase()
  const prompt = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
  const price = isRequest && prompt > 100_000 && /haiku-5-5/.test(id) ? HAIKU_LONG : (PRICES.find(([re]) => re.test(id))?.[1] ?? FALLBACK)
  const [i, o, r, w] = price
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

/** Haiku 4.5 and Claude 3 models have a 200K window; current models 1M. */
export const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

// ---------------------------------------------------------------------------
// Icons: one per agent type. Unknown types get a stable pick from POOL.

export const MAIN_ICON = '🧠'

const ICONS: Record<string, string> = {
  // Built-in agent types
  'general-purpose': '🤖',
  explore: '🔭',
  plan: '🗺️',
  'claude-code-guide': '📘',
  'statusline-setup': '🎛️',
  // This project's agents (.claude/agents)
  'fastapi-developer': '⚡',
  'webhook-engineer': '🪝',
  'mcp-developer': '🔌',
  'surgeon-reviewer': '🩺',
  'readme-generator': '📝',
  'arch-guardian': '🏛️',
  'secrets-auditor': '🔐',
  'milestone-checker': '🏁',
  // superpowers
  'code-reviewer': '🔍',
}
const POOL = ['🦊', '🐙', '🦉', '🐝', '🦄', '🐢', '🦀', '🐬', '🦜', '🐺', '🦋', '🐳']

/** `superpowers:code-reviewer` → `code-reviewer`. */
export const bareType = (type: string): string => type.replace(/^[^:]*:/, '').toLowerCase()

// ---------------------------------------------------------------------------
// Display names: shown in the UI only. Everything else keys on the real agent type.

// EXAMPLE: display names for one project's agents. Edit to match your own agents.
// Unknown types get their own (real) name.
export const DISPLAY_NAMES: Record<string, string> = {
  'fastapi-developer': 'API Dev',
  'webhook-engineer': 'Web-Hook Dev',
  'mcp-developer': 'MCP Dev',
  'readme-generator': 'Auditor',
  'arch-guardian': 'Architect',
  'secrets-auditor': 'Guard',
  'milestone-checker': 'BA',
  'surgeon-reviewer': 'Code Review',
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'to', 'for', 'of', 'in', 'on', 'with', 'all', 'this', 'that', 'it'])

/** Job title for a task verb (lowercase). Unknown verbs become `Runner`. */
export const WORKER_TITLES: Record<string, string> = {}
const addTitles = (title: string, verbs: string[]) => {
  for (const v of verbs) WORKER_TITLES[v] = title
}
addTitles('Scout', ['find', 'search', 'locate', 'list', 'lookup'])
addTitles('Builder', ['scaffold', 'build', 'create', 'add', 'implement', 'wire', 'set', 'setup', 'make'])
addTitles('Mechanic', ['fix', 'repair', 'patch', 'debug', 'resolve'])
addTitles('Scribe', ['write', 'document', 'draft', 'docs', 'describe'])
addTitles('Analyst', ['research', 'investigate', 'explore', 'analyze', 'analyse', 'check', 'audit', 'inspect', 'compare'])
addTitles('Tester', ['test', 'verify', 'validate'])
addTitles('Sculptor', ['refactor', 'clean', 'rename', 'format', 'tidy', 'simplify'])
addTitles('Planner', ['design', 'plan', 'architect'])
addTitles('Inspector', ['review'])
addTitles('Clerk', ['summarize', 'summarise', 'count', 'report'])

/** First meaningful word of a task description, lowercased: `find all TODOs` → `find`. */
const verbOf = (description: string): string => {
  const word = (description || '')
    .split(/[^A-Za-z0-9'-]+/)
    .find(w => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()))
  return word ? word.toLowerCase() : ''
}

const titleOf = (description: string): string => {
  const verb = verbOf(description)
  return Object.hasOwn(WORKER_TITLES, verb) ? WORKER_TITLES[verb]! : 'Runner'
}

/** Friendly UI name: fixed names for this project's agents, a job title (`Senior ` for deep) for hive workers. */
export const displayName = (type: string, description: string): string => {
  const bare = bareType(type)
  if (Object.hasOwn(DISPLAY_NAMES, bare)) return DISPLAY_NAMES[bare]!
  if (bare === 'hive-worker') return titleOf(description)
  if (bare === 'hive-worker-deep') return `Senior ${titleOf(description)}`
  return bare
}

export const iconOf = (type: string): string => {
  const bare = bareType(type)
  if (Object.hasOwn(ICONS, bare)) return ICONS[bare]!
  let h = 0
  for (const ch of bare) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return POOL[h % POOL.length]!
}

// ---------------------------------------------------------------------------
// Formatting

export const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return String(Math.round(n))
}

export const fmtUsd = (n: number): string => (n >= 100 ? `$${n.toFixed(0)}` : n >= 0.01 || n === 0 ? `$${n.toFixed(2)}` : '<$0.01')

export const fmtDuration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

/** `claude-opus-5-5` → `opus-5-5`. */
export const shortModel = (model: string): string => model.replace(/^claude-/, '').replace(/-\d{8}$/, '') || '—'

export const pct = (tokens: number | undefined, window: number): number =>
  tokens === undefined || window <= 0 ? 0 : Math.max(0, Math.min(100, (tokens / window) * 100))

/** Filled and empty parts of a text bar `width` cells wide. */
export const barParts = (percent: number, width: number): [string, string] => {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width)
  return ['█'.repeat(filled), '░'.repeat(Math.max(0, width - filled))]
}

/** `claude-opus-5-5[1m]` → `Opus 5.5 (1M)`; anything else as given. Pattern from xuanji86/claude-statuspane (MIT). */
export const prettyModel = (id: string): string => {
  const m = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/.exec(id)
  if (!m || !m[1]) return id || '—'
  return `${m[1][0]?.toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}${m[4] ? ' (1M)' : ''}`
}

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

/** `high` → `▮▮▮▯▯`; empty for a level it does not know. */
export const effortGauge = (effort: string | undefined): string => {
  const n = effort ? EFFORTS.indexOf(effort as (typeof EFFORTS)[number]) + 1 : 0
  return n ? `${'▮'.repeat(n)}${'▯'.repeat(EFFORTS.length - n)}` : ''
}

/** Time until an ISO reset moment: `2h41m`, `19h25m`, `3d4h`; empty when unknown or past. */
export const fmtEta = (resetsAt: string | undefined, now: number): string => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

/** Theme color for a used-up share: Claude's accent, then warning, then error. */
export const levelColor = (percent: number, warnAt = 60, errAt = 85): 'claude' | 'warning' | 'error' =>
  percent >= errAt ? 'error' : percent >= warnAt ? 'warning' : 'claude'

/**
 * The working folder's own name, without the random `-1a2b3c` tag a worktree gets:
 * `C:\a\worktrees\fix-hud-608f6f` → `fix-hud`. A tag needs a digit, so `my-facade` stays.
 */
export const folderName = (dir: string): string => {
  const name = dir.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? dir
  return name.replace(/-(?=[0-9a-f]*\d)[0-9a-f]{6}$/, '')
}

export const GREEN = '#5fbf8f'
export const AMBER = '#e0b050'
export const RED = '#e06c6c'
export const ACCENT = '#8f8cf4'

export const fillColor = (percent: number): string => (percent >= 85 ? RED : percent >= 60 ? AMBER : GREEN)

// One line under an agent's row: the rung the hive router put it on, why, and its record for that kind of task.
export type Placement = { step: string; baseTier: string; why: string; bump: number; wins: number; misses: number; outcome?: 'win' | 'miss' }

export const routeLine = (p: Placement | undefined): { text: string; color?: string } | undefined => {
  if (!p) return undefined
  const rung = p.bump > 0 ? `⇡ ${p.step} (+${p.bump} over ${p.baseTier})` : `◆ ${p.step}`
  const record = p.wins + p.misses > 0 ? ` · ${p.wins} landed · ${p.misses} missed` : ' · first of its kind'
  const verdict = p.outcome === 'miss' ? ' · ✗ counted as a miss' : p.outcome === 'win' ? ' · ✓ landed' : ''
  const color = p.outcome === 'miss' ? 'error' : p.bump > 0 ? 'warning' : undefined
  return { text: `${rung} · ${p.why}${record}${verdict}`, color }
}


export const BRAIN_RED = '#E5484D'
export const CLAUDE_ORANGE = '#D97757'

export const nameColor = (type: string): string => (type === 'main' ? BRAIN_RED : CLAUDE_ORANGE)
