export type AgentStatus = 'running' | 'done' | 'failed'

/** One subagent run, from its spawn to its turn.complete. */
export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  /** Reasoning effort of its latest model request. */
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  /** Prompt + output of its latest model request: how full its window is. */
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  toolCalls: number
  /** Of `tokens`, how many were cache reads. */
  cacheRead?: number
}

/** The main conversation's own agent. */
export type MainAgent = {
  isActive: boolean
  model: string
  effort?: string
  turnStartedAt?: number
  /** Whole session, main loop only. */
  tokens: number
  costUsd: number
  /** The turn in progress, main loop only; reset at each turn.start. */
  turnTokens: number
  turnCostUsd: number
  /** Of `turnTokens`, how many were cache reads. */
  turnCacheRead?: number
  turns: number
  toolCalls: number
}

/** The live context window as the status line has it. */
export type ContextFill = {
  tokens?: number
  window: number
  percent?: number
}

export type RateLimit = { pct: number; resetsAt?: string }

/** Session-wide facts: when it began, where it runs, and the plan's rate limits. */
export type SessionInfo = {
  startedAt: number
  dir: string | null
  fiveHour?: RateLimit
  week?: RateLimit
}

/** The ⟲ compact button: pressed once (armed) or compacting, and since when. */
export type CompactAsk = { state: 'armed' | 'running'; at: number } | null

/** The most recently completed task: a main turn or a subagent run. */
export type LastTask = {
  who: string
  type: string
  tokens: number
  costUsd: number
  durationMs: number
  endedAt: number
  isFailed: boolean
  /** Of `tokens`, how many were cache reads. */
  cachedTokens?: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-hud': {
      agents: AgentRun[]
      main: MainAgent
      context: ContextFill | null
      sessionCostUsd: number | null
      session: SessionInfo
      compactAsk: CompactAsk
      last: LastTask | null
      now: number
      /** The agents pane is open, so the card above the prompt steps aside. */
      isPaneOpen: boolean
    }
  }
}
