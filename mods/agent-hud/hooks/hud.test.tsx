import { expect, mock, test } from 'claude-code/testing'

import { botCells, botSvg, pixelsOf, specOf } from './bots'
import { DISPLAY_NAMES, WORKER_TITLES, barParts, costOf, displayName, routeLine, effortGauge, fmtDuration, fmtEta, fmtTokens, fmtUsd, iconOf, nameColor, prettyModel, shortModel, folderName, windowOf } from './hud-lib'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const PANE = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

test('prices: one million tokens of each kind on Opus 5.5', async () => {
  const one = { input_tokens: 1e6, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  expect(Math.round(costOf('claude-opus-5-5', one, true) * 1000) / 1000).toBe(4)
  expect(Math.round(costOf('claude-opus-5-5', { ...one, input_tokens: 0, output_tokens: 1e6 }, true) * 1000) / 1000).toBe(20)
  expect(Math.round(costOf('claude-sonnet-5-5', { ...one, input_tokens: 0, cache_read_input_tokens: 1e6 }, true) * 1000) / 1000).toBe(0.2)
  expect(Math.round(costOf('claude-haiku-5-5', one, true) * 1000) / 1000).toBe(0.5) // over 100K prompt: long-prompt price
  expect(Math.round(costOf('claude-haiku-5-5', one, false) * 1000) / 1000).toBe(0.1)
  expect(windowOf('claude-haiku-4-5')).toBe(200_000)
  expect(windowOf('claude-opus-5-5')).toBe(1_000_000)
})

test('icons: known types get theirs, unknown types a stable pick', async () => {
  expect(iconOf('secrets-auditor')).toBe('🔐')
  expect(iconOf('Explore')).toBe('🔭')
  expect(iconOf('superpowers:code-reviewer')).toBe('🔍')
  expect(iconOf('some-new-agent')).toBe(iconOf('some-new-agent'))
})

test('display names: fixed names, bees and queens, pass-through for the rest', async () => {
  const fixed: Record<string, string> = {
    'fastapi-developer': 'API Dev',
    'webhook-engineer': 'Web-Hook Dev',
    'mcp-developer': 'MCP Dev',
    'readme-generator': 'Auditor',
    'arch-guardian': 'Architect',
    'secrets-auditor': 'Guard',
    'milestone-checker': 'BA',
    'surgeon-reviewer': 'Code Review',
  }
  expect(DISPLAY_NAMES).toEqual(fixed)
  for (const [type, name] of Object.entries(fixed)) expect(displayName(type, 'anything')).toBe(name)
  expect(displayName('hive-worker', 'Scaffold the Dockerfile')).toBe('Builder')
  expect(displayName('hive-worker-deep', 'Scaffold the Dockerfile')).toBe('Senior Builder')
  expect(displayName('hive-worker-deep', 'Refactor the router')).toBe('Senior Sculptor')
  expect(displayName('hive-worker', 'find all TODOs')).toBe('Scout')
  expect(displayName('hive-worker', 'Count shell edits')).toBe('Clerk')
  expect(displayName('hive-worker', 'Fix the bug')).toBe('Mechanic')
  expect(displayName('hive-worker', 'write the docs')).toBe('Scribe')
  expect(displayName('hive-worker', 'Audit the hooks')).toBe('Analyst')
  expect(displayName('hive-worker', 'verify it works')).toBe('Tester')
  expect(displayName('hive-worker', 'design a schema')).toBe('Planner')
  expect(displayName('hive-worker', 'Review the diff')).toBe('Inspector')
  expect(displayName('hive-worker', 'Zap things')).toBe('Runner')
  expect(displayName('hive-worker', 'the a to x of all')).toBe('Runner')
  expect(displayName('hive-worker-deep', '')).toBe('Senior Runner')
  expect(displayName('my-plugin:secrets-auditor', '')).toBe('Guard')
  expect(displayName('hive:hive-worker', 'and then review it')).toBe('Runner')
  expect(displayName('hive:hive-worker', 'and fix it')).toBe('Mechanic')
  expect(WORKER_TITLES.find).toBe('Scout')
  expect(displayName('Explore', 'look around')).toBe('explore')
  expect(displayName('some-new-agent', 'whatever')).toBe('some-new-agent')
})

test('formatting', async () => {
  expect(fmtTokens(950)).toBe('950')
  expect(fmtTokens(48_200)).toBe('48.2K')
  expect(fmtTokens(1_250_000)).toBe('1.3M')
  expect(fmtUsd(0.004)).toBe('<$0.01')
  expect(fmtUsd(1.234)).toBe('$1.23')
  expect(fmtDuration(121_000)).toBe('2m01s')
  expect(shortModel('claude-opus-5-5')).toBe('opus-5-5')
  expect(barParts(50, 10)).toEqual(['█████', '░░░░░'])
})

test('session card helpers: model name, effort gauge, reset countdown, folder name', async () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5 (1M)')
  expect(prettyModel('claude-sonnet-4-20250514')).toBe('Sonnet 4')
  expect(effortGauge('high')).toBe('▮▮▮▯▯')
  expect(effortGauge('max')).toBe('▮▮▮▮▮')
  expect(effortGauge(undefined)).toBe('')
  const t0 = Date.parse('2026-10-17T10:00:00Z')
  expect(fmtEta('2026-10-17T12:41:00Z', t0)).toBe('2h41m')
  expect(fmtEta('2026-10-20T14:00:00Z', t0)).toBe('3d4h')
  expect(fmtEta('2026-10-17T09:00:00Z', t0)).toBe('')
  expect(folderName('C:\\Users\\me\\.claude\\worktrees\\template-skills-plugin-commands-608f6f')).toBe('template-skills-plugin-commands')
  expect(folderName('/home/me/proj/')).toBe('proj')
  expect(folderName('/home/me/my-facade')).toBe('my-facade')
})

test('bots: every agent gets a sprite; working bots animate, finished ones stand still', async () => {
  const main = specOf('main')
  expect(main.accessory).toBe('crown')
  expect(main.body).toBe('#E5484D')
  expect(specOf('secrets-auditor').accessory).toBe('visor')
  expect(specOf('brand-new-agent')).toEqual(specOf('brand-new-agent'))
  for (const t of ['general-purpose', 'explore', 'plan', 'claude-code-guide', 'statusline-setup', 'fastapi-developer', 'webhook-engineer', 'mcp-developer', 'surgeon-reviewer', 'readme-generator', 'arch-guardian', 'secrets-auditor', 'milestone-checker', 'code-reviewer', 'hive-worker'])
    expect(specOf(t).body).toBe('#D97757')
  const accents: Record<string, string> = {
    'general-purpose': '#FFFFFF', explore: '#5EEAD4', plan: '#C4B5FD', 'claude-code-guide': '#FDE68A', 'statusline-setup': '#93C5FD',
    'fastapi-developer': '#FFE14D', 'webhook-engineer': '#A5B4FC', 'mcp-developer': '#67E8F9', 'surgeon-reviewer': '#FFFFFF',
    'readme-generator': '#FDE047', 'arch-guardian': '#F5F5F4', 'secrets-auditor': '#FDE047', 'milestone-checker': '#60A5FA',
    'code-reviewer': '#E9D5FF', 'hive-worker': '#A3E635', 'hive-worker-deep': '#FACC15',
  }
  for (const [t, a] of Object.entries(accents)) expect(specOf(t).accent).toBe(a)
  expect(specOf('hive-worker-deep')).toEqual({ body: '#D97757', accent: '#FACC15', accessory: 'antenna' })
  expect(main.accent).toBe('#FFD43B')
  const dimmed = botSvg(specOf('hive-worker'), { isActive: false, isDim: true, size: 22 })
  const faded = dimmed.indexOf('</g>')
  expect(dimmed.slice(0, faded)).not.toContain('fill="#A3E635"')
  expect(dimmed.slice(faded)).toContain('fill="#A3E635"')
  const unknownA = specOf('brand-new-agent')
  const unknownB = specOf('other-new-agent')
  expect(unknownA.body).toBe('#D97757')
  expect(specOf('brand-new-agent').accent).toBe(unknownA.accent)
  expect(unknownA.accent === unknownB.accent && unknownA.accessory === unknownB.accessory).toBe(false)
  const working = botSvg(main, { isActive: true, size: 22 })
  expect(working).toContain('<animate')
  expect(working.length).toBeLessThan(131072)
  expect(botSvg(main, { isActive: false, isDim: true, size: 22 })).not.toContain('<animate')
  const cells = botCells(main, { scale: 2 })
  expect(cells.columns).toBe(8)
  expect(cells.rows).toBe(4)
  expect(cells.cells.length).toBe(Math.ceil((8 * 4 * 12) / 3) * 4)
  // Walk frames differ in the legs.
  expect(pixelsOf(main, 'a')).not.toEqual(pixelsOf(main, 'b'))
})

test('desktop pane draws the main agent as an Svg bot; terminal as a Raster', async $ => {
  const desk = await $.ui.mount({ plugin: 'agent-hud', surface: 'desktop', component: 'Pane', requestId: 'agent-hud', props: PANE as never })
  expect((await desk.findAll({ type: "Svg" })).filter(el => /^main /.test(String(el.props.alt))).length).toBe(1)
  await desk.unmount()
  const term = await $.ui.mount({ plugin: 'agent-hud', surface: 'terminal', component: 'Pane', requestId: 'agent-hud', props: PANE as never })
  expect((await term.findAll({ type: 'Raster' })).length).toBeGreaterThan(0)
  await term.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the band draws the context bar and the agents button before any data`, async $ => {
    const ui = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'AbovePrompt', props: BAND as never })
    expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeDefined()
    expect((await ui.find({ key: 'hud-toggle' }))?.props.label).toBe('⤢ expand')
    expect(await ui.find({ type: 'Text', text: /last · —/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: the pane lists the main agent and says no subagents run`, async $ => {
    const ui = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'Pane', requestId: 'agent-hud', props: PANE as never })
    expect(await ui.find({ type: 'Text', text: /Brain/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /No subagents running/ })).toBeDefined()
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: opening the agents pane hides the card above the prompt; closing it brings the card back`, async ($, on) => {
    mock.clock(on, { now: Date.parse('2026-10-17T10:00:00Z') })
    // The engine's own band, drawn when the card steps aside.
    on('ui.render', { component: 'AbovePrompt' }, (engine, e) => { const { Text } = engine.ui.resolve(e); return <Text>engine band</Text> })
    let open = false
    on('ui.open', () => {
      open = true
      return { value: { isPlaced: true } } as never
    })
    on('ui.close', () => {
      open = false
      return { value: undefined } as never
    })
    on('ui.panes', () => ({ value: open ? [{ id: 'agent-hud', title: 'Agents HUD', isShown: true, isFocused: false, isPlaced: true }] : [] }) as never)

    const band = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'AbovePrompt', props: BAND as never })
    await band.press({ key: 'hud-toggle' })
    expect(open).toBe(true)
    await band.unmount()
    const hidden = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'AbovePrompt', props: BAND as never })
    expect(await hidden.find({ key: 'hud-toggle' })).toBeUndefined()
    await hidden.unmount()

    // The pane carries the whole card, with a button back to the prompt bar.
    const pane = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'Pane', requestId: 'agent-hud', props: PANE as never })
    expect((await pane.find({ key: 'hud-toggle' }))?.props.label).toBe('⤡ dock')
    expect(await pane.find({ type: 'Text', text: /turns/ })).toBeDefined()
    await pane.press({ key: 'hud-toggle' })
    expect(open).toBe(false)
    await pane.unmount()

    const back = await $.ui.mount({ plugin: 'agent-hud', surface, component: 'AbovePrompt', props: BAND as never })
    expect(await back.find({ key: 'hud-toggle' })).toBeDefined()
    await back.unmount()
  })
}

test('router line: rung, reason, record and verdict', async () => {
  expect(routeLine(undefined)).toBeUndefined()
  expect(
    routeLine({ step: 'sonnet · high effort', baseTier: 'sonnet', why: 'raised after 1 miss', bump: 1, wins: 2, misses: 1, outcome: 'win' }),
  ).toEqual({ text: '⇡ sonnet · high effort (+1 over sonnet) · raised after 1 miss · 2 landed · 1 missed · ✓ landed', color: 'warning' })
  expect(routeLine({ step: 'haiku', baseTier: 'haiku', why: 'light task', bump: 0, wins: 0, misses: 0 })).toEqual({
    text: '◆ haiku · light task · first of its kind',
    color: undefined,
  })
  expect(routeLine({ step: 'sonnet', baseTier: 'sonnet', why: 'standard task', bump: 0, wins: 3, misses: 0, outcome: 'miss' })?.color).toBe('error')
})

test('nameColor: Brain is red, every other agent is Claude orange', async () => {
  expect(nameColor('main')).toBe('#E5484D')
  expect(nameColor('hive-worker')).toBe('#D97757')
  expect(nameColor('superpowers:code-reviewer')).toBe('#D97757')
  expect(nameColor('brand-new-agent')).toBe('#D97757')
  expect(specOf('main').body).toBe('#E5484D')
})
