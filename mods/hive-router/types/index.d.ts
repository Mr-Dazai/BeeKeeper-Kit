/** A subagent the router placed, from its spawn until its turn ends. */
export type HiveRun = {
  agentId: string
  signature: string
  type: string
  description: string
  step: string
  /** The rung it would start on with nothing learned. */
  baseTier: 'haiku' | 'sonnet' | 'opus'
  startedAt: number
}

/** A finished run, kept briefly so a re-dispatch of the same task can be recognised. */
export type HiveDone = {
  signature: string
  type: string
  description: string
  step: string
  baseTier: 'haiku' | 'sonnet' | 'opus'
  endedAt: number
  outcome: 'win' | 'miss'
}

/** Where the router placed one subagent and why, with what it had learned of that kind of task; read by agent-hud. */
export type HivePlacement = {
  agentId: string
  type: string
  signature: string
  /** The rung it ran on, e.g. `sonnet · high effort`. */
  step: string
  /** The rung it would start on with nothing learned. */
  baseTier: 'haiku' | 'sonnet' | 'opus'
  /** Why: `standard task`, `agent's own model`, `raised after 2 misses`… */
  why: string
  /** Rungs above its starting model. */
  bump: number
  wins: number
  misses: number
  /** How this run went, once it ended. */
  outcome?: 'win' | 'miss'
}

/** The main agent's own work in the turn under way. */
export type HiveMainTurn = { edits: number; spawns: number; isNudged: boolean }

declare module 'claude-code' {
  interface PluginState {
    'hive-router': {
      runs: HiveRun[]
      recent: HiveDone[]
      mainTurn: HiveMainTurn
      placed: HivePlacement[]
    }
  }
}
