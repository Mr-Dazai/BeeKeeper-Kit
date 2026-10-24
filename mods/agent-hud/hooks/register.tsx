import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { AgentRun, CompactAsk, ContextFill, LastTask, MainAgent, RateLimit, SessionInfo } from '../types'
import { botCells, botHeight, botSvg, specOf } from './bots'
import { barSvg, pillsSvg, pillsWidth } from './gauges'
import {
  ACCENT,
  EFFORTS,
  GREEN,
  RED,
  barParts,
  costOf,
  displayName,
  effortGauge,
  fillColor,
  fmtDuration,
  nameColor,
  fmtEta,
  fmtTokens,
  fmtUsd,
  levelColor,
  pct,
  prettyModel,
  routeLine,
  folderName,
  shortModel,
  sumTokens,
  windowOf,
} from './hud-lib'

// Agent tracking modeled on johnnyvizz/claude-kit plugins/savvy-progress (MIT); the session card
// (model, effort, limits, location, compact) on xuanji86/claude-statuspane (MIT).

const PANE = 'agent-hud'
const TITLE = 'Agents HUD'
const MAX_RUNS = 100
const CONFIRM_MS = 4000

const agents = atom({ plugin: 'agent-hud', key: 'agents' } as const, [])
const MAIN_DEFAULT: MainAgent = {
  isActive: false,
  model: '',
  tokens: 0,
  costUsd: 0,
  turnTokens: 0,
  turnCostUsd: 0,
  turnCacheRead: 0,
  turns: 0,
  toolCalls: 0,
}
const main = atom({ plugin: 'agent-hud', key: 'main' } as const, MAIN_DEFAULT)
/** State outlives a reload, so a value saved by an older version may lack newer fields. */
const withDefaults = (m: MainAgent): MainAgent => {
  const out = { ...MAIN_DEFAULT, ...m }
  // A counter saved as NaN or null by an older version reads as 0.
  for (const k of ['tokens', 'costUsd', 'turnTokens', 'turnCostUsd', 'turnCacheRead', 'turns', 'toolCalls'] as const) {
    if (!Number.isFinite(out[k])) out[k] = 0
  }
  return out
}
const context = atom({ plugin: 'agent-hud', key: 'context' } as const, null)
const sessionCost = atom({ plugin: 'agent-hud', key: 'sessionCostUsd' } as const, null)
const session = atom({ plugin: 'agent-hud', key: 'session' } as const, { startedAt: 0, dir: null })
const compactAsk = atom({ plugin: 'agent-hud', key: 'compactAsk' } as const, null)
const last = atom({ plugin: 'agent-hud', key: 'last' } as const, null)
const now = atom({ plugin: 'agent-hud', key: 'now' } as const, 0)
// The hive router's placements (its own state, read here): which rung each subagent ran on, and why.
const routerPlaced = { plugin: 'hive-router', key: 'placed' } as const
const isPaneOpen = atom({ plugin: 'agent-hud', key: 'isPaneOpen' } as const, false)

const limitOf = (limits: readonly SessionRateLimit[], kind: string): RateLimit | undefined => {
  const r = limits.find(l => l.kind === kind)
  return r ? { pct: r.percentUsed, resetsAt: r.resetsAt } : undefined
}

const togglePane = async ($: EngineInterface): Promise<boolean> => {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    await update($, isPaneOpen, () => false) // the ui.close hook covers the person closing it
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await update($, isPaneOpen, () => true)
  await $.ui.open({ id: PANE, title: TITLE })
  return true
}

const refreshUsage = async ($: EngineInterface): Promise<void> => {
  const usage = await $.session.usage()
  const fill: ContextFill = { tokens: usage.context.tokens, window: usage.context.window, percent: usage.context.percent }
  await update($, context, () => fill)
  if (usage.cost) await update($, sessionCost, () => usage.cost!.usd)
  await update($, session, (s): SessionInfo => ({
    ...s,
    startedAt: usage.startedAt,
    fiveHour: limitOf(usage.rateLimits, 'five_hour') ?? s.fiveHour,
    week: limitOf(usage.rateLimits, 'seven_day') ?? s.week,
  }))
}

// The working folder's name; kept as it was when the session cannot answer.
const refreshLocation = async ($: EngineInterface): Promise<void> => {
  try {
    const dir = folderName(await $.session.cwd())
    await update($, session, (s): SessionInfo => ({ ...s, dir }))
  } catch {
    // keep the last folder
  }
}

// ⟲ compact: the first press arms it, a second within a few seconds compacts.
const pressCompact = async ($: EngineInterface): Promise<void> => {
  const at = await $.clock.now()
  const ask = await read($, compactAsk)
  if (ask?.state === 'running') return
  if (!(ask?.state === 'armed' && at - ask.at < CONFIRM_MS)) {
    await update($, compactAsk, (): CompactAsk => ({ state: 'armed', at }))
    $.clock.after(CONFIRM_MS, () => void update($, compactAsk, c => (c?.state === 'armed' && c.at === at ? null : c)))
    return
  }
  await update($, compactAsk, (): CompactAsk => ({ state: 'running', at }))
  try {
    await $.session.compact()
  } catch (err) {
    $.ui.toast(`Could not compact: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`)
  } finally {
    await update($, compactAsk, () => null)
  }
}

// ---------------------------------------------------------------------------
// The session card, shared by the band and the pane.

type BotState = 'active' | 'idle' | 'done' | 'failed'

const stateOf = (a: AgentRun): BotState => (a.status === 'running' ? 'active' : a.status === 'failed' ? 'failed' : 'done')

type CardData = {
  m: MainAgent
  list: AgentRun[]
  fill: ContextFill | null
  lastTask: LastTask | null
  total: number | null
  info: SessionInfo
  ask: CompactAsk
  at: number
}

const loadCard = async ($: EngineInterface): Promise<CardData> => {
  const info = await read($, session)
  return {
    m: withDefaults(await read($, main)),
    list: await read($, agents),
    fill: await read($, context),
    lastTask: await read($, last),
    total: await read($, sessionCost),
    info,
    ask: await read($, compactAsk),
    at: (await read($, now)) || info.startedAt,
  }
}

// A bot: an animated Svg where the surface draws one (with its height set, since an animated Svg
// draws in a frame that is otherwise tall), coloured block characters in the terminal.
const drawBot = (els: ElementTable, surface: string, type: string, state: BotState, key: string, size: number, step: 'a' | 'b') => {
  const { Text } = els
  const spec = specOf(type)
  if (surface !== 'terminal' && 'Svg' in els) {
    const Svg = els.Svg
    const source = botSvg(spec, {
      isActive: state === 'active',
      isDim: state === 'done' || state === 'idle',
      isFailed: state === 'failed',
      size,
    })
    return <Svg key={key} source={source} alt={`${type} ${state}`} width={size} height={botHeight(size)} isInteractive={state === 'active'} />
  }
  if (surface === 'terminal' && size > 24 && 'Raster' in els) {
    const Raster = els.Raster
    const r = botCells(spec, { scale: 2, isDim: state !== 'active', legs: state === 'active' ? step : 'both' })
    return <Raster key={key} columns={r.columns} rows={r.rows} cells={r.cells} />
  }
  return (
    <Text key={key} color={state === 'failed' ? RED : spec.body} dimColor={state !== 'active'}>
      {state === 'failed' ? '▟✗▙' : '▟█▙'}
    </Text>
  )
}

// A gauge: a rounded Svg bar where the surface draws Svg, block characters in the terminal.
const drawGauge = (els: ElementTable, surface: string, percent: number, level: 'claude' | 'warning' | 'error', cells: number, key: string) => {
  const { Box, Text } = els
  if (surface !== 'terminal' && 'Svg' in els) {
    const Svg = els.Svg
    const px = cells * 9
    return <Svg key={key} source={barSvg(percent, level, px)} alt={`${Math.round(percent)}%`} width={px} height={8} />
  }
  const [f, rest] = barParts(percent, cells)
  return (
    <Box key={key} flexDirection="row">
      <Text color={level}>{f}</Text>
      <Text dimColor>{rest}</Text>
    </Box>
  )
}

/**
 * The session card's lines, the same in the band and in the pane: model and state, effort,
 * context with compact, rate limits, where and what it costs, how long and how much, the bots
 * and the last task. Returned in priority order with their draw order, so the band can drop
 * the least important when it is short of rows.
 */
const cardLines = ($: EngineInterface, els: ElementTable, surface: string, d: CardData, cols: number, mode: 'band' | 'pane') => {
  const { Box, Text, Button } = els
  const { m, list, fill, lastTask, total, info, ask, at } = d
  const step = Math.floor(at / 1000) % 2 === 0 ? 'a' : 'b'
  const running = list.filter(a => a.status === 'running')
  const recent = list.filter(a => a.status !== 'running').slice(-3)
  const activeCount = running.length + (m.isActive ? 1 : 0)
  const hasSvg = surface !== 'terminal' && 'Svg' in els
  const label = (text: string) => (
    <Box width={7}>
      <Text dimColor>{text}</Text>
    </Box>
  )

  const modelLine = (
    <Box key="l-model" flexDirection="row" gap={1} alignItems="center">
      <Text color="claude" bold>
        {prettyModel(m.model)}
      </Text>
      <Text color={m.isActive ? 'claude' : undefined} dimColor={!m.isActive}>
        {m.isActive ? '● working' : '○ idle'}
      </Text>
      <Text dimColor>· {activeCount} active</Text>
      <Box flexGrow={1} />
      {/* One short, dim control in both places so it never wraps or competes with the model name. */}
      <Button key="hud-toggle" plain dimColor label={mode === 'band' ? '⤢ expand' : '⤡ dock'} onPress={() => togglePane($)} />
    </Box>
  )

  const effortN = m.effort ? EFFORTS.indexOf(m.effort as (typeof EFFORTS)[number]) + 1 : 0
  const effortLine = m.effort ? (
    <Box key="l-effort" flexDirection="row" gap={1} alignItems="center">
      {label('effort')}
      {hasSvg && 'Svg' in els ? (
        <els.Svg key="effort-pills" source={pillsSvg(effortN)} alt={`effort ${m.effort}`} width={pillsWidth()} height={8} />
      ) : (
        <Text color="claude">{effortGauge(m.effort)}</Text>
      )}
      <Text color="claude" bold>
        {m.effort}
      </Text>
    </Box>
  ) : null

  const percent = fill?.percent ?? pct(fill?.tokens, fill?.window ?? 0)
  const hasFill = fill?.percent !== undefined || fill?.tokens !== undefined
  const compactLabel = ask?.state === 'running' ? '⟲ compacting…' : ask?.state === 'armed' ? '⟲ confirm' : '⟲ compact'
  const ctxCells = Math.max(6, Math.min(16, Math.floor((cols - 40) / 2)))
  const ctxLine = (
    <Box key="l-ctx" flexDirection="row" gap={1} alignItems="center">
      {label('ctx')}
      {drawGauge(els, surface, percent, levelColor(percent, 50, 80), ctxCells, 'g-ctx')}
      <Text bold>{hasFill ? `${Math.round(percent)}%` : '—'}</Text>
      <Text dimColor wrap="truncate">
        {fill ? `${fill.tokens === undefined ? '—' : fmtTokens(fill.tokens)}/${fmtTokens(fill.window)}` : ''}
      </Text>
      <Box flexGrow={1} />
      {/* Dim at rest like the expand/dock toggle; full strength once armed, so the confirm stands out. */}
      <Button key="compact" plain dimColor={!ask} label={compactLabel} onPress={() => pressCompact($)} />
    </Box>
  )

  const limitPart = (name: string, l: RateLimit | undefined, key: string) => {
    const level = l ? levelColor(l.pct) : 'claude'
    const eta = l ? fmtEta(l.resetsAt, at) : ''
    return (
      <Box key={key} flexDirection="row" gap={1} alignItems="center">
        {label(name)}
        {drawGauge(els, surface, l?.pct ?? 0, level, 6, `${key}-g`)}
        <Text color={level !== 'claude' ? level : undefined} dimColor={level === 'claude'}>
          {l ? `${Math.round(l.pct)}%` : '—'}
        </Text>
        {eta ? <Text dimColor>{eta}</Text> : null}
      </Box>
    )
  }
  const limitsLine =
    info.fiveHour || info.week ? (
      <Box key="l-limits" flexDirection="row" gap={3}>
        {limitPart('5h', info.fiveHour, 'lim-5h')}
        {limitPart('7d', info.week, 'lim-7d')}
      </Box>
    ) : null

  const whereLine = (
    <Box key="l-where" flexDirection="row" gap={1} alignItems="center">
      <Text bold wrap="truncate">
        {info.dir ?? '—'}
      </Text>
      <Box flexGrow={1} />
      <Text bold>{total !== null ? fmtUsd(total) : '—'}</Text>
    </Box>
  )

  const uptime = info.startedAt ? fmtDuration(Math.max(0, at - info.startedAt)) : '—'
  const statsLine = (
    <Box key="l-stats" flexDirection="row" gap={2}>
      <Text dimColor>⏱ {uptime}</Text>
      <Text dimColor>{m.turns} turns</Text>
      <Text dimColor>{m.toolCalls} tool calls</Text>
      <Text dimColor>{list.length} subagents</Text>
    </Box>
  )

  const cachedShare = lastTask && lastTask.tokens > 0 ? Math.round(((lastTask.cachedTokens ?? 0) / lastTask.tokens) * 100) : 0
  const lastText = lastTask ? (
    <Text dimColor wrap="truncate">
      last · <Text color={nameColor(lastTask.type)} bold>{lastTask.who}</Text> · <Text color="claude">{fmtTokens(lastTask.tokens)} tok</Text>
      {cachedShare ? ` (${cachedShare}% cached)` : ''} · {fmtUsd(lastTask.costUsd)} · {fmtDuration(lastTask.durationMs)}
      {lastTask.isFailed ? ' ✗' : ''}
    </Text>
  ) : (
    <Text dimColor>last · —</Text>
  )
  // In the band the bots ride along with the last task; the pane lists every agent below instead.
  const botsLine = (
    <Box key="l-bots" flexDirection="row" alignItems="center" gap={1}>
      {mode === 'band' ? bot('main', m.isActive ? 'active' : 'idle', 'b-main') : null}
      {mode === 'band' ? running.map(a => bot(a.type, 'active', `b-r-${a.id}`)) : null}
      {mode === 'band' ? recent.map(a => bot(a.type, stateOf(a), `b-d-${a.id}`)) : null}
      {lastText}
    </Box>
  )

  function bot(type: string, state: BotState, key: string) {
    return drawBot(els, surface, type, state, key, 20, step)
  }

  return {
    priority: [modelLine, ctxLine, botsLine, effortLine, whereLine, limitsLine, statsLine],
    order: [modelLine, effortLine, ctxLine, limitsLine, whereLine, statsLine, botsLine],
  }
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'hud',
      description: 'Show or hide the agents HUD: Brain (main agent) and subagents with state, context, tokens and cost',
    })
    await update($, compactAsk, () => null)
    // A pane left open across a reload is still the engine's: match the card to it.
    const paneUp = (await $.ui.panes()).some(p => p.id === PANE)
    await update($, isPaneOpen, () => paneUp)
    const model = await $.session.model().catch(() => '')
    if (model) await update($, main, (m): MainAgent => ({ ...withDefaults(m), model }))
    await refreshUsage($)
    void refreshLocation($)
    // Ticks clocks: every second while anything works, every 30 s for the uptime otherwise.
    let idleTicks = 0
    $.clock.every(1000, () => {
      void (async () => {
        const [list, m] = [await read($, agents), withDefaults(await read($, main))]
        const isBusy = m.isActive || list.some(a => a.status === 'running')
        idleTicks = isBusy ? 0 : idleTicks + 1
        if (!isBusy && idleTicks % 30 !== 0) return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  on('command.run', { command: 'hud' }, async $ => {
    const isOpen = await togglePane($)
    return { text: isOpen ? 'Agents HUD opened.' : 'Agents HUD closed.' }
  })

  // The status line's figures: context fill, session cost and rate limits, whenever they move.
  on('session.measure', async ($, e, next) => {
    const fill: ContextFill = { tokens: e.context.tokens, window: e.context.window, percent: e.context.percent }
    await update($, context, () => fill)
    if (e.cost) await update($, sessionCost, () => e.cost!.usd)
    await update($, session, (s): SessionInfo => ({
      ...s,
      fiveHour: limitOf(e.rateLimits, 'five_hour') ?? s.fiveHour,
      week: limitOf(e.rateLimits, 'seven_day') ?? s.week,
    }))
    return next(e)
  })

  // A compaction empties the live window; no measurement follows until the next response.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && e.trigger !== 'precompute' && !('skip' in result && result.skip)) {
      await update($, context, c => (c ? { window: c.window } : c))
    }
    return result
  })
    // Observing only: a failure here never stops a compaction.
    .catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      const at = await $.clock.now()
      await update($, main, (prev): MainAgent => {
        const m = withDefaults(prev)
        return { ...m, isActive: true, turnStartedAt: at, turnTokens: 0, turnCostUsd: 0, turnCacheRead: 0, turns: m.turns + 1 }
      })
      await update($, now, () => at)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      await update($, agents, list => list.map(a => (a.agentId === agentId ? { ...a, toolCalls: (a.toolCalls ?? 0) + 1 } : a)))
    } else {
      await update($, main, (prev): MainAgent => {
        const m = withDefaults(prev)
        return { ...m, toolCalls: m.toolCalls + 1 }
      })
    }
    return next(e)
  })
    // Counting only: a failure here never blocks the tool call.
    .catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = await $.clock.now()
    const run: AgentRun = {
      id: started.agentId ?? e.tool_use_id,
      agentId: started.agentId,
      type: e.subagentType,
      description: e.description,
      model: started.model,
      status: 'running',
      startedAt: at,
      contextTokens: 0,
      contextMax: windowOf(started.model),
      tokens: 0,
      costUsd: 0,
      steps: 0,
      toolCalls: 0,
    }
    await update($, agents, list => [...list.filter(a => a.id !== run.id), run].slice(-MAX_RUNS))
    await update($, now, () => at)
    return started
  })
    // The HUD only observes: if tracking fails, the spawn goes on as if this hook were not here.
    .catch(($, e, next) => next(e))

  // Every model request: model, effort, live context, tokens and cost, for subagents and the main loop.
  on('turn.step', async function* ($, e, next) {
    const effort = e.effort === undefined ? undefined : String(e.effort)
    const result = yield* next(e)
    const usage = result.usage
    const model = usage?.model || e.model
    const tokens = usage ? sumTokens(usage) : 0
    const cost = usage ? costOf(model, usage, true) : 0
    const cached = usage?.cache_read_input_tokens || 0

    if (e.agentId) {
      const agentId = e.agentId
      await update($, agents, list =>
        list.map((a): AgentRun =>
          a.agentId !== agentId
            ? a
            : {
                ...a,
                model,
                effort: effort ?? a.effort,
                status: 'running',
                endedAt: undefined,
                contextTokens: usage ? tokens : a.contextTokens,
                contextMax: windowOf(model),
                tokens: a.tokens + tokens,
                costUsd: a.costUsd + cost,
                cacheRead: (a.cacheRead ?? 0) + cached,
                steps: a.steps + 1,
              },
        ),
      )
    } else {
      await update($, main, (prev): MainAgent => {
        const m = withDefaults(prev)
        return {
          ...m,
          model,
          effort: effort ?? m.effort,
          tokens: m.tokens + tokens,
          costUsd: m.costUsd + cost,
          turnTokens: m.turnTokens + tokens,
          turnCostUsd: m.turnCostUsd + cost,
          turnCacheRead: (m.turnCacheRead ?? 0) + cached,
        }
      })
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()
    const isFailed = e.reason !== 'answer'

    if (e.agentId) {
      const agentId = e.agentId
      let done: AgentRun | undefined
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          done = {
            ...a,
            status: isFailed ? 'failed' : 'done',
            endedAt: at,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens: sumTokens(e.usage),
                  costUsd: costOf(e.usage.model || a.model, e.usage, false),
                }
              : {}),
          }
          return done
        }),
      )
      if (done) {
        const run = done as AgentRun
        const task: LastTask = {
          who: displayName(run.type, run.description),
          type: run.type,
          tokens: run.tokens,
          costUsd: run.costUsd,
          durationMs: e.durationMs || at - run.startedAt,
          endedAt: at,
          isFailed,
          cachedTokens: run.cacheRead ?? 0,
        }
        await update($, last, () => task)
      }
    } else {
      const m = await update($, main, (prev): MainAgent => ({ ...withDefaults(prev), isActive: false }))
      const tokens = m.turnTokens || (e.usage ? sumTokens(e.usage) : 0)
      if (tokens > 0) {
        const cost = m.turnCostUsd || (e.usage ? costOf(e.usage.model || m.model, e.usage, false) : 0)
        const task: LastTask = {
          who: 'Brain',
          type: 'main',
          tokens,
          costUsd: cost,
          durationMs: e.durationMs || (m.turnStartedAt ? at - m.turnStartedAt : 0),
          endedAt: at,
          isFailed,
          cachedTokens: m.turnTokens ? (m.turnCacheRead ?? 0) : e.usage?.cache_read_input_tokens || 0,
        }
        await update($, last, () => task)
      }
      await refreshUsage($)
      void refreshLocation($) // the session may have changed folder
    }
    await update($, now, () => at)
    return next(e)
  })

  // The person closing the pane (or anything else closing it) brings the card back above the prompt.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    await update($, isPaneOpen, () => false)
    return result
  })
    // Observing only: a failure here never keeps the pane open.
    .catch(($, e, next) => next(e))

  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // The card above the prompt. Hidden while the agents pane is open: the pane carries it then.

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isPaneOpen))) return next(e)
    const els = $.ui.resolve(e)
    const { Box } = els
    const d = await loadCard($)
    const lines = cardLines($, els, e.surface, d, e.props.bodyColumns, 'band')

    // Which lines fit: two rows go to the border; the rest by priority, then drawn in order.
    const room = Math.max(1, e.props.maxRows - 2)
    const shown = new Set(lines.priority.filter(Boolean).slice(0, room))
    const ordered = lines.order.filter(l => l && shown.has(l))

    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="claude" paddingX={1} rowGap="xs">
        {ordered}
      </Box>
    )
  })

  // ---------------------------------------------------------------------------
  // The agents pane: the whole session card, then every agent.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const d = await loadCard($)
    const { m, list, fill, lastTask, total, at } = d
    const cols = e.props.bodyColumns
    const barCells = Math.max(4, Math.min(12, Math.floor(cols / 8)))
    const step = Math.floor(at / 1000) % 2 === 0 ? 'a' : 'b'
    const card = cardLines($, els, e.surface, d, cols, 'pane')
    const { value: placedList = [] } = await $.state.get(routerPlaced)
    const placementOf = (agentId: string | undefined) => (agentId ? placedList.find(p => p.agentId === agentId) : undefined)

    const running = list.filter(a => a.status === 'running')
    const finished = list.filter(a => a.status !== 'running').slice(-20).reverse()
    const subCost = list.reduce((s, a) => s + a.costUsd, 0)

    const ctxCell = (tokens: number | undefined, window: number, key: string) => {
      const p = pct(tokens, window)
      return (
        <Box key={key} flexDirection="row" gap={1} alignItems="center">
          {drawGauge(els, e.surface, p, levelColor(p, 50, 80), barCells, `${key}-g`)}
          <Text dimColor>{Math.round(p)}%</Text>
        </Box>
      )
    }

    const row = (o: {
      key: string
      type: string
      state: BotState
      name: string
      mark: string
      markColor?: string
      isDim: boolean
      model: string
      effort?: string
      ctxTokens: number | undefined
      ctxWindow: number
      tokens: number
      cost: number
      elapsed: string
      tools: number
      note?: string
      route?: { text: string; color?: string }
    }) => (
      <Box key={o.key} flexDirection="row" gap={1} marginBottom={1} alignItems="center">
        {drawBot(els, e.surface, o.type, o.state, `${o.key}-bot`, 40, step)}
        <Box flexDirection="column" flexGrow={1} rowGap="xs">
          <Box flexDirection="row" gap={1}>
            <Text color={o.markColor} dimColor={o.isDim && !o.markColor}>
              {o.mark}
            </Text>
            <Text color={nameColor(o.type)} bold wrap="truncate">
              {o.name}
            </Text>
            <Text dimColor>{o.model}</Text>
            {o.effort ? (
              <Text color={o.isDim ? undefined : 'claude'} dimColor={o.isDim}>
                {effortGauge(o.effort)} {o.effort}
              </Text>
            ) : null}
          </Box>
          <Box flexDirection="row" gap={2} alignItems="center">
            {ctxCell(o.ctxTokens, o.ctxWindow, `${o.key}-ctx`)}
            <Text dimColor tabular>
              {fmtTokens(o.tokens)} tok
            </Text>
            <Text tabular color={o.isDim ? undefined : ACCENT} dimColor={o.isDim}>
              {fmtUsd(o.cost)}
            </Text>
            <Text dimColor tabular>
              {o.tools} tools
            </Text>
            <Text dimColor tabular>
              {o.elapsed}
            </Text>
          </Box>
          {o.note ? (
            <Text dimColor wrap="truncate">
              {o.note}
            </Text>
          ) : null}
          {o.route ? (
            <Text color={o.route.color} dimColor={!o.route.color} wrap="truncate">
              {o.route.text}
            </Text>
          ) : null}
        </Box>
      </Box>
    )

    const agentRow = (a: AgentRun) =>
      row({
        key: `a-${a.id}`,
        type: a.type,
        state: stateOf(a),
        name: displayName(a.type, a.description),
        mark: a.status === 'running' ? '● working' : a.status === 'failed' ? '✗ failed' : '✓ done',
        markColor: a.status === 'running' ? GREEN : a.status === 'failed' ? RED : undefined,
        isDim: a.status !== 'running',
        model: shortModel(a.model),
        effort: a.effort,
        ctxTokens: a.contextTokens,
        ctxWindow: a.contextMax,
        tokens: a.tokens,
        cost: a.costUsd,
        elapsed: fmtDuration((a.endedAt ?? at) - a.startedAt),
        tools: a.toolCalls ?? 0,
        note: a.description,
        route: routeLine(placementOf(a.agentId)),
      })

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} rowGap="xs" marginBottom={1}>
          {card.order.filter(Boolean)}
        </Box>

        <Text dimColor>Brain</Text>
        {row({
          key: 'main',
          type: 'main',
          state: m.isActive ? 'active' : 'idle',
          name: 'Brain',
          mark: m.isActive ? '● working' : '○ idle',
          markColor: m.isActive ? GREEN : undefined,
          isDim: !m.isActive,
          model: shortModel(m.model),
          effort: m.effort,
          ctxTokens: fill?.tokens,
          ctxWindow: fill?.window ?? windowOf(m.model),
          tokens: m.tokens,
          cost: total !== null ? Math.max(0, total - subCost) : m.costUsd,
          elapsed: m.isActive && m.turnStartedAt ? fmtDuration(at - m.turnStartedAt) : '',
          tools: m.toolCalls,
        })}

        <Text dimColor>Active · {running.length}</Text>
        {running.length === 0 ? (
          <Box marginBottom={1}>
            <Text dimColor>No subagents running.</Text>
          </Box>
        ) : (
          running.map(agentRow)
        )}

        {finished.length > 0 ? <Text dimColor>Finished · {finished.length}</Text> : null}
        {finished.map(agentRow)}

        <Box flexDirection="row" gap={2} marginTop={1}>
          <Text dimColor>Session {total !== null ? fmtUsd(total) : '—'}</Text>
          <Text dimColor>Subagents ≈ {fmtUsd(subCost)}</Text>
          {lastTask ? <Text dimColor>Last task {fmtUsd(lastTask.costUsd)}</Text> : null}
        </Box>
        <Text dimColor>Costs are estimates from list prices; /cost has the session total.</Text>
      </Box>
    )
  })
}
