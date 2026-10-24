// Pure routing and learning: no `$`, so tests call it directly.

import { BRIEF_CHARS, BY_TYPE, DEEP_VARIANT, DEFAULT_TIER, HEAVY, LIGHT, SPECIALIST_BASE, STEP_DOWN_AFTER, TASK_ROUTED, WRITE_COMMANDS, WRITE_EXCLUDED } from './rules'
import type { Tier } from './rules'

export type SpawnFacts = {
  subagentType: string
  description: string
  prompt: string
  model?: string
  fork: boolean
  isTeammate?: true
  hasWorkflow: boolean
  isResume: boolean
}

/** One rung: a model, and whether to run the high-effort variant of the agent. */
export type Step = { tier: Tier; deep: boolean }

export type Decision =
  | { action: 'keep'; why: string; signature?: string; base?: Step }
  | { action: 'set'; step: Step; subagentType?: string; why: string; signature: string; base: Step }

/** What the router has learned about one kind of task, kept across sessions. */
export type Learned = { bump: number; streak: number; misses: number; wins: number; at: number; base?: Step }

export const EMPTY: Learned = { bump: 0, streak: 0, misses: 0, wins: 0, at: 0 }

export const bare = (type: string): string => type.replace(/^[^:]*:/, '').toLowerCase()

const STOP = new Set(['the', 'a', 'an', 'and', 'to', 'for', 'of', 'in', 'on', 'with', 'all', 'this', 'that', 'it'])

/** The task's first real word, `scaffold`, `find`, `design`…: what kind of work it is. */
export const verbOf = (description: string): string =>
  description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find(w => w.length > 1 && !STOP.has(w)) ?? 'task'

export const tierOfTask = (description: string, prompt: string): { tier: Tier; why: string; kind: string } => {
  const text = `${description}\n${prompt.slice(0, BRIEF_CHARS)}`
  const heavy = HEAVY.findIndex(re => re.test(text))
  if (heavy >= 0) return { tier: 'opus', why: 'heavy task', kind: `heavy${heavy}` }
  // Light only from the short description, so a light verb deep in a long brief does not downgrade real work.
  if (LIGHT.some(re => re.test(description.trim()))) return { tier: 'haiku', why: 'light task', kind: 'light' }
  return { tier: DEFAULT_TIER, why: 'standard task', kind: 'standard' }
}

/** The rungs a type can climb: deep rungs only where it has a high-effort variant. */
export const ladderOf = (type: string): Step[] => {
  const hasDeep = Object.hasOwn(DEEP_VARIANT, type)
  const tiers: Tier[] = ['haiku', 'sonnet', 'opus']
  return tiers.flatMap(tier => (hasDeep ? [{ tier, deep: false }, { tier, deep: true }] : [{ tier, deep: false }]))
}

/** `base` moved `bump` rungs up its type's ladder, held to the ends. */
export const climb = (type: string, base: Step, bump: number): Step => {
  const ladder = ladderOf(type)
  const at = ladder.findIndex(s => s.tier === base.tier && s.deep === base.deep)
  const i = Math.max(0, Math.min(ladder.length - 1, (at < 0 ? 0 : at) + bump))
  return ladder[i]!
}

export const isTop = (type: string, step: Step): boolean => {
  const ladder = ladderOf(type)
  const top = ladder[ladder.length - 1]!
  return top.tier === step.tier && top.deep === step.deep
}

export const stepLabel = (s: Step): string => `${s.tier}${s.deep ? ' · high effort' : ''}`

export const decide = (f: SpawnFacts, learned: (signature: string) => Learned = () => EMPTY): Decision => {
  if (f.model) return { action: 'keep', why: `explicit model ${f.model}` }
  if (f.fork) return { action: 'keep', why: 'fork inherits' }
  if (f.isTeammate || f.hasWorkflow || f.isResume) return { action: 'keep', why: 'not a fresh dispatch' }
  const type = bare(f.subagentType)

  let signature: string
  let base: Step
  let why: string
  const fixed = Object.hasOwn(BY_TYPE, type) ? BY_TYPE[type] : undefined
  if (fixed === 'file') {
    signature = type
    base = { tier: SPECIALIST_BASE[type] ?? DEFAULT_TIER, deep: false }
    why = "agent's own model"
  } else if (fixed) {
    signature = type
    base = { tier: fixed, deep: false }
    why = `${type} → ${fixed}`
  } else if (TASK_ROUTED.has(type)) {
    const t = tierOfTask(f.description, f.prompt)
    signature = `${type}|${t.kind}|${verbOf(f.description)}`
    base = { tier: t.tier, deep: false }
    why = t.why
  } else {
    return { action: 'keep', why: 'unrouted type' }
  }

  const l = learned(signature)
  const step = climb(type, base, l.bump)
  const raised = l.bump > 0 && (step.tier !== base.tier || step.deep !== base.deep)
  if (raised) why = `raised after ${l.misses} miss${l.misses === 1 ? '' : 'es'}`
  // A specialist on its own model needs nothing changed: its file already says so.
  if (fixed === 'file' && !raised) return { action: 'keep', why, signature, base }
  const variant = step.deep ? DEEP_VARIANT[type] : undefined
  return { action: 'set', step, subagentType: variant, why, signature, base }
}

/** A run fell short: one rung up, and the streak starts over. */
export const onMiss = (l: Learned, at: number): Learned => ({ ...l, bump: l.bump + 1, streak: 0, misses: l.misses + 1, at })

/** A run landed: count it, and after a long enough streak at a raised rung, try one rung lower. */
export const onWin = (l: Learned, at: number): Learned => {
  const streak = l.streak + 1
  if (l.bump > 0 && streak >= STEP_DOWN_AFTER) return { ...l, bump: l.bump - 1, streak: 0, wins: l.wins + 1, at }
  return { ...l, streak, wins: l.wins + 1, at }
}

/** A shell command that changes files, by the patterns in rules.ts. Harmless fd copies and /dev/null output are removed first. */
export const isWriteCommand = (command: string): boolean => {
  const live = WRITE_EXCLUDED.reduce((c, re) => c.replace(re, ' '), command)
  return WRITE_COMMANDS.some(re => re.test(live))
}

/** A worker's own report says it fell short (BLOCKED is a missing input, not a weak model). */
export const reportsShort = (answer: string): boolean => /RESULT:\s*PARTIAL\b/i.test(answer)

/** Two descriptions name the same task: same words, order and case aside. */
export const sameTask = (a: string, b: string): boolean => {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 1 && !STOP.has(w))
      .sort()
      .join(' ')
  return norm(a) !== '' && norm(a) === norm(b)
}
