import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HiveDone, HiveMainTurn, HivePlacement, HiveRun } from '../types'
import { MAIN_EDIT_NUDGE, REDISPATCH_WINDOW_MS, STEP_DOWN_AFTER } from './rules'
import { EMPTY, bare, climb, decide, isWriteCommand, ladderOf, onMiss, onWin, reportsShort, sameTask, stepLabel } from './route'
import type { Learned, SpawnFacts } from './route'

const runs = atom({ plugin: 'hive-router', key: 'runs' } as const, [])
const recent = atom({ plugin: 'hive-router', key: 'recent' } as const, [])
const placements = atom({ plugin: 'hive-router', key: 'placed' } as const, [])
const mainTurn = atom({ plugin: 'hive-router', key: 'mainTurn' } as const, { edits: 0, spawns: 0, isNudged: false })

const KEY = 'learned:'
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

// What the router has learned lives in $.store, so it carries across sessions.
const getLearned = async ($: EngineInterface, signature: string): Promise<Learned> => {
  const v = (await $.store.get(KEY + signature)) as Partial<Learned> | undefined
  return { ...EMPTY, ...(v ?? {}) }
}

const setLearned = async ($: EngineInterface, signature: string, l: Learned): Promise<void> => {
  await $.store.set(KEY + signature, l)
}

const allLearned = async ($: EngineInterface): Promise<[string, Learned][]> => {
  const keys = (await $.store.keys()).filter(k => k.startsWith(KEY)).sort()
  const out: [string, Learned][] = []
  for (const k of keys) out.push([k.slice(KEY.length), await getLearned($, k.slice(KEY.length))])
  return out
}

/** The type part of a signature, `hive-worker|standard|scaffold` → `hive-worker`. */
const typeOfSig = (signature: string): string => signature.split('|')[0] ?? signature

/** Where the next run of this kind of task will start. */
const nextStep = (signature: string, l: Learned): string =>
  stepLabel(climb(typeOfSig(signature), l.base ?? { tier: 'sonnet', deep: false }, l.bump))

const recordOutcome = async ($: EngineInterface, run: HiveRun, outcome: 'win' | 'miss', at: number, reason: string): Promise<void> => {
  const before = { ...(await getLearned($, run.signature)), base: { tier: run.baseTier, deep: false } }
  const after = outcome === 'miss' ? onMiss(before, at) : onWin(before, at)
  await setLearned($, run.signature, after)
  const done: HiveDone = {
    signature: run.signature,
    type: run.type,
    description: run.description,
    step: run.step,
    baseTier: run.baseTier,
    endedAt: at,
    outcome,
  }
  await update($, recent, list => [...list, done].slice(-50))
  await update($, placements, list =>
    list.map((p): HivePlacement =>
      p.agentId === run.agentId ? { ...p, outcome, bump: after.bump, wins: after.wins, misses: after.misses } : p,
    ),
  )
  if (outcome === 'miss') {
    $.ui.toast(`hive: ${run.type} fell short (${reason}) → this kind of task now starts on ${nextStep(run.signature, after)}`)
  } else if (after.bump < before.bump) {
    $.ui.toast(`hive: ${run.type} landed ${STEP_DOWN_AFTER} in a row → stepping back to ${nextStep(run.signature, after)}`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'hive',
      description: 'Hive router: show what it learned, or `up` / `down` / `reset` the last finished task kind',
      argumentHint: '[up|down|reset|show]',
    })
    await update($, runs, () => [])
    return started
  })

  // ---- Routing: pick the model (and effort variant) before a subagent starts ----

  on('agent.spawn', async ($, e, next) => {
    const facts: SpawnFacts = {
      subagentType: e.subagentType,
      description: e.description,
      prompt: e.prompt,
      model: e.model,
      fork: e.fork,
      isTeammate: e.isTeammate,
      hasWorkflow: e.workflow !== undefined,
      isResume: e.resume !== undefined,
    }
    const at = await $.clock.now()
    if (!e.parentAgentId) await update($, mainTurn, (m): HiveMainTurn => ({ ...m, spawns: m.spawns + 1 }))

    // The same task sent again soon after a run "finished": the main agent was not satisfied, so that run missed.
    const probe = decide(facts)
    if (probe.signature) {
      const list = await read($, recent)
      const prior = [...list].reverse().find(r => r.outcome === 'win' && at - r.endedAt < REDISPATCH_WINDOW_MS && sameTask(r.description, e.description))
      if (prior) {
        await setLearned($, prior.signature, {
          ...onMiss(await getLearned($, prior.signature), at),
          base: { tier: prior.baseTier, deep: false },
        })
        await update($, recent, l =>
          l.map(r => (r.endedAt === prior.endedAt && r.signature === prior.signature ? { ...r, outcome: 'miss' as const } : r)),
        )
        $.ui.toast(`hive: "${e.description}" sent again → counting the last run as a miss`)
      }
    }

    const learned = probe.signature ? await getLearned($, probe.signature) : EMPTY
    const d = decide(facts, () => learned)
    const type = bare(e.subagentType)
    const placed = d.action === 'set' ? d.step : (d.base ?? null)

    const started = await (d.action === 'set'
      ? next({ ...e, model: d.step.tier, ...(d.subagentType ? { subagentType: d.subagentType } : {}) })
      : next(e))
    if (started.deny !== undefined) return started

    if (d.action === 'set') $.ui.toast(`hive: ${type} → ${stepLabel(d.step)} · ${d.why}`)
    if (d.signature && started.agentId && placed) {
      const run: HiveRun = {
        agentId: started.agentId,
        signature: d.signature,
        type,
        description: e.description,
        step: stepLabel(placed),
        baseTier: (d.base ?? placed).tier,
        startedAt: at,
      }
      await update($, runs, list => [...list, run].slice(-50))
      const placement: HivePlacement = {
        agentId: started.agentId,
        type,
        signature: d.signature,
        step: run.step,
        baseTier: run.baseTier,
        why: d.why,
        bump: learned.bump,
        wins: learned.wins,
        misses: learned.misses,
      }
      await update($, placements, list => [...list.filter(p => p.agentId !== placement.agentId), placement].slice(-100))
    }
    return started
  })
    // A routing failure never blocks a spawn: it runs on the model it would have had.
    .catch(($, e, next) => next(e))

  // ---- Learning: how each placed run went ----

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      const list = await read($, runs)
      const run = list.find(r => r.agentId === agentId)
      if (run) {
        await update($, runs, l => l.filter(r => r.agentId !== agentId))
        const at = await $.clock.now()
        // Stopped by the person: says nothing about the model.
        if (!e.isAborted) {
          const isShort = e.reason !== 'answer' || reportsShort(e.answer)
          await recordOutcome($, run, isShort ? 'miss' : 'win', at, e.reason !== 'answer' ? e.reason : 'reported PARTIAL')
        }
      }
    }
    return next(e)
  })
    .catch(($, e, next) => next(e))

  // ---- The main agent as manager: a nudge when it does the work itself ----

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await update($, mainTurn, (): HiveMainTurn => ({ edits: 0, spawns: 0, isNudged: false }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e)
    // Bash is counted only when its command changes files.
    const isShellEdit = e.tool === 'Bash' && isWriteCommand(e.command)
    if (!EDIT_TOOLS.has(String(e.tool)) && !isShellEdit) return next(e)
    const m = await update($, mainTurn, (prev): HiveMainTurn => ({ ...prev, edits: prev.edits + 1 }))
    if (m.edits >= MAIN_EDIT_NUDGE && m.spawns === 0 && !m.isNudged) {
      await update($, mainTurn, (prev): HiveMainTurn => ({ ...prev, isNudged: true }))
      await $.session.append({
        message: {
          type: 'user',
          content: [
            {
              type: 'text',
              text:
                `[hive-router] You have made ${m.edits} edits (including shell edits) yourself this turn without starting a subagent. ` +
                'Per CLAUDE.md you are the project manager: hand the remaining implementation to a specialist or ' +
                'hive-worker with a clear brief, then review its result. Keep only one-line changes for yourself.',
            },
          ],
        },
      })
      $.ui.toast('hive: main agent reminded to delegate')
    }
    return next(e)
  })
    .catch(($, e, next) => next(e))

  // ---- /hive: what it learned, and the owner's own verdicts ----

  on('command.run', { command: 'hive' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    const at = await $.clock.now()
    const lastDone = (await read($, recent)).at(-1)

    if (arg === 'up' || arg === 'down') {
      if (!lastDone) return { text: 'Nothing has finished yet to rate.' }
      const before = { ...(await getLearned($, lastDone.signature)), base: { tier: lastDone.baseTier, deep: false } }
      const after = arg === 'up' ? onMiss(before, at) : { ...before, bump: Math.max(0, before.bump - 1), streak: 0, at }
      await setLearned($, lastDone.signature, after)
      const ladder = ladderOf(lastDone.type)
      return {
        text:
          `${arg === 'up' ? 'Raised' : 'Lowered'} "${lastDone.signature}" (last: ${lastDone.description}, ran on ${lastDone.step}). ` +
          `Next time it starts on ${nextStep(lastDone.signature, after)} (${after.bump} of ${ladder.length - 1} possible rungs up).`,
      }
    }

    if (arg === 'reset') {
      const learned = await allLearned($)
      for (const [sig] of learned) await $.store.delete(KEY + sig)
      return { text: `Cleared what the hive router learned (${learned.length} task kinds).` }
    }

    const learned = await allLearned($)
    if (learned.length === 0) return { text: 'The hive router has not learned anything yet: every task runs on its starting model.' }
    const rows = learned.map(([sig, l]) => `- ${sig}: +${l.bump} rung(s) → next on ${nextStep(sig, l)} · ${l.wins} landed · ${l.misses} missed`)
    return {
      text: `What the hive router learned (raised task kinds start higher; ${STEP_DOWN_AFTER} landed in a row steps one back down):\n${rows.join('\n')}\n\nUse /hive up or /hive down to rate the last finished task, /hive reset to forget.`,
    }
  })
}
