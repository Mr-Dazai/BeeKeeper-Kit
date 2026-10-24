// Pixel bots: one Claude-style crab bot per agent type, each with its own color and accessory.
// Pure functions (no `$`): an SVG for surfaces that draw Svg, half-block cells for the terminal.

import { CLAUDE_ORANGE, bareType } from './hud-lib'

/** 16 × 13 grid: rows 0-2 hold the accessory, rows 3-12 the bot (as in the reference image). */
export const W = 16
export const H = 13

// Body: B = body color, E = eye. Legs (rows 11-12) are drawn separately so they can walk.
const BODY = [
  '................',
  '................',
  '................',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBEBBBBBBEBB..',
  '..BBEBBBBBBEBB..',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
]
const LEGS_A = [3, 10] // first pair of a walk cycle
const LEGS_B = [5, 12] // second pair

type Pixel = { x: number; y: number; color: string }

/**
 * Accessory art over the grid. `a` = accent color, `k` = dark, `w` = white, `.` = none.
 * Rows may reach into the body (rows 3-10) for face or chest marks.
 */
type Accessory = readonly string[]

const ACC: Record<string, Accessory> = {
  crown: ['...a..a..a..a...', '...aaaaaaaaaa...', '...aaaaaaaaaa...'],
  antenna: ['.......aa.......', '........a.......', '........a.......'],
  bolt: ['........aa......', '.......aa.......', '......aa........'],
  hook: ['.........aa.....', '..........a.....', '.......aaaa.....'],
  plug: ['.....a....a.....', '.....a....a.....', '....aaaaaaaa....'],
  cross: ['.......ww.......', '......wwww......', '.......ww.......'],
  pencil: ['.............ka.', '............aa..', '...........aa...'],
  pillar: ['...aaaaaaaaaa...', '....a.a..a.a....', '....a.a..a.a....'],
  // Visor across the eyes plus a lock on the chest.
  visor: ['', '', '', '', '', '..kkkkkkkkkkkk..', '..kkkkkkkkkkkk..', '', '', '.......aa.......', '.......aa.......'],
  flag: ['.........aaaa...', '.........aaa....', '.........k......'],
  goggles: ['', '', '', '', '...aaa....aaa...', '...awa....awa...', '...aaa....aaa...'],
  partyhat: ['.......aa.......', '......aaaa......', '.....aaaaaa.....'],
  monocle: ['', '', '', '', '..........aaa...', '..........a.a...', '..........aaa...', '............a...'],
  bow: ['', '', '', '', '', '', '', '', '', '......a..a......', '.......aa.......'],
  none: [],
}

export type BotSpec = { body: string; accent: string; accessory: keyof typeof ACC }


/** The main agent and every known agent type. */
// EXAMPLE: bots for one project's agents. Edit to match your own agents.
// Unknown types get a stable pooled bot and their own name.
const SPECS: Record<string, BotSpec> = {
  main: { body: '#E5484D', accent: '#FFD43B', accessory: 'crown' },
  'general-purpose': { body: CLAUDE_ORANGE, accent: '#FFFFFF', accessory: 'antenna' },
  explore: { body: CLAUDE_ORANGE, accent: '#5EEAD4', accessory: 'goggles' },
  plan: { body: CLAUDE_ORANGE, accent: '#C4B5FD', accessory: 'partyhat' },
  'claude-code-guide': { body: CLAUDE_ORANGE, accent: '#FDE68A', accessory: 'monocle' },
  'statusline-setup': { body: CLAUDE_ORANGE, accent: '#93C5FD', accessory: 'antenna' },
  'fastapi-developer': { body: CLAUDE_ORANGE, accent: '#FFE14D', accessory: 'bolt' },
  'webhook-engineer': { body: CLAUDE_ORANGE, accent: '#A5B4FC', accessory: 'hook' },
  'mcp-developer': { body: CLAUDE_ORANGE, accent: '#67E8F9', accessory: 'plug' },
  'surgeon-reviewer': { body: CLAUDE_ORANGE, accent: '#FFFFFF', accessory: 'cross' },
  'readme-generator': { body: CLAUDE_ORANGE, accent: '#FDE047', accessory: 'pencil' },
  'arch-guardian': { body: CLAUDE_ORANGE, accent: '#F5F5F4', accessory: 'pillar' },
  'secrets-auditor': { body: CLAUDE_ORANGE, accent: '#FDE047', accessory: 'visor' },
  'milestone-checker': { body: CLAUDE_ORANGE, accent: '#60A5FA', accessory: 'flag' },
  'code-reviewer': { body: CLAUDE_ORANGE, accent: '#E9D5FF', accessory: 'monocle' },
  'hive-worker': { body: CLAUDE_ORANGE, accent: '#A3E635', accessory: 'antenna' },
  'hive-worker-deep': { body: CLAUDE_ORANGE, accent: '#FACC15', accessory: 'antenna' },
}

// Bright accents that read on the orange body.
const POOL_ACCENT = ['#FFFFFF', '#5EEAD4', '#93C5FD', '#A3E635', '#C4B5FD', '#F9A8D4', '#FDE047', '#67E8F9']
const POOL_ACC: (keyof typeof ACC)[] = ['antenna', 'bow', 'partyhat', 'goggles', 'flag', 'monocle']

const hash = (s: string): number => {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** `main`, a known agent type, or a stable mix for any other type. */
export const specOf = (type: string): BotSpec => {
  const bare = type === 'main' ? 'main' : bareType(type)
  if (Object.hasOwn(SPECS, bare)) return SPECS[bare]!
  const h = hash(bare)
  return { body: CLAUDE_ORANGE, accent: POOL_ACCENT[h % POOL_ACCENT.length]!, accessory: POOL_ACC[(h >>> 4) % POOL_ACC.length]! }
}

const EYE = '#141414'
const DARK = '#141414'
const WHITE = '#FFFFFF'

/** Every lit pixel of one frame. `legs` picks which pair is down in a walk cycle (both when still). */
export const pixelsOf = (spec: BotSpec, legs: 'both' | 'a' | 'b' = 'both'): Pixel[] => {
  const grid: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null))
  BODY.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === 'B') grid[y]![x] = spec.body
      else if (c === 'E') grid[y]![x] = EYE
    }),
  )
  ;(ACC[spec.accessory] ?? []).forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (y >= H || x >= W) return
      if (c === 'a') grid[y]![x] = spec.accent
      else if (c === 'k') grid[y]![x] = DARK
      else if (c === 'w') grid[y]![x] = WHITE
    }),
  )
  const down = legs === 'a' ? LEGS_A : legs === 'b' ? LEGS_B : [...LEGS_A, ...LEGS_B]
  const up = legs === 'a' ? LEGS_B : legs === 'b' ? LEGS_A : []
  for (const x of down) {
    grid[11]![x] = spec.body
    grid[12]![x] = spec.body
  }
  for (const x of up) grid[11]![x] = spec.body // a lifted leg is one pixel shorter
  const out: Pixel[] = []
  grid.forEach((row, y) => row.forEach((color, x) => color && out.push({ x, y, color })))
  return out
}

const rects = (px: Pixel[]): string => px.map(p => `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="${p.color}"/>`).join('')

/**
 * SVG of one bot. `isActive`: it walks (legs alternate) and bobs; otherwise it stands still,
 * faded when `isDim`. `isFailed` draws a red cross over it.
 */
export const botSvg = (spec: BotSpec, o: { isActive: boolean; isDim?: boolean; isFailed?: boolean; size: number }): string => {
  const w = o.size
  const h = Math.round((o.size * H) / W)
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" shape-rendering="crispEdges">`
  if (!o.isActive) {
    // Only the body fades; eyes and accessory stay at full brightness.
    const fade = o.isDim ? ' opacity="0.5"' : ''
    const all = pixelsOf(spec)
    const bodyPx = all.filter(p => p.color === spec.body)
    const restPx = all.filter(p => p.color !== spec.body)
    const cross = o.isFailed
      ? `<path d="M3 3 L13 11 M13 3 L3 11" stroke="#E06C6C" stroke-width="1.5" stroke-linecap="square"/>`
      : ''
    return `${open}<g${fade}>${rects(bodyPx)}</g>${rects(restPx)}${cross}</svg>`
  }
  // Working: two walk frames swapped by SMIL (legs a down / legs b down), a half-pixel bob,
  // eyes that blink every few seconds, and a spark that pulses beside the head.
  const frame = (legs: 'a' | 'b') =>
    `<g opacity="${legs === 'a' ? 1 : 0}">${rects(pixelsOf(spec, legs))}` +
    `<animate attributeName="opacity" values="${legs === 'a' ? '1;0' : '0;1'}" keyTimes="0;0.5" calcMode="discrete" dur="0.5s" repeatCount="indefinite"/></g>`
  const blink =
    `<g opacity="0"><rect x="4" y="5" width="1" height="2" fill="${spec.body}"/><rect x="11" y="5" width="1" height="2" fill="${spec.body}"/>` +
    `<rect x="4" y="6" width="1" height="1" fill="${EYE}"/><rect x="11" y="6" width="1" height="1" fill="${EYE}"/>` +
    `<animate attributeName="opacity" values="0;1;0" keyTimes="0;0.94;0.97" calcMode="discrete" dur="3.2s" repeatCount="indefinite"/></g>`
  const spark =
    `<g fill="${spec.accent}"><rect x="14" y="1" width="1" height="1"/><rect x="15" y="0" width="1" height="1" opacity="0.6"/><rect x="13" y="0" width="1" height="1" opacity="0.6"/>` +
    `<animate attributeName="opacity" values="0.2;1;0.2" dur="1s" repeatCount="indefinite"/></g>`
  return (
    `${open}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -0.5;0 0" dur="0.5s" repeatCount="indefinite"/>` +
    `${frame('a')}${frame('b')}${blink}</g>${spark}</svg>`
  )
}

// ---------------------------------------------------------------------------
// Terminal: half-block cells. Each cell is two vertical pixels: ▀ with the top pixel as
// foreground and the bottom one as background. `scale` 2 halves the bot (8 × 4 cells).

const DEFAULT_BG = 0x01000000
const UPPER = 0x2580 // ▀
const toRgb = (hex: string, dim: boolean): number => {
  let n = parseInt(hex.slice(1), 16)
  if (dim) {
    const r = ((n >> 16) & 0xff) >> 1
    const g = ((n >> 8) & 0xff) >> 1
    const b = (n & 0xff) >> 1
    n = (r << 16) | (g << 8) | b
  }
  return n
}

export const botCells = (
  spec: BotSpec,
  o: { scale: 1 | 2; isDim?: boolean; legs?: 'both' | 'a' | 'b' },
): { columns: number; rows: number; cells: string } => {
  const px = pixelsOf(spec, o.legs ?? 'both')
  const at = new Map(px.map(p => [`${p.x},${p.y}`, p.color]))
  // Sample the grid at the scale (any lit pixel in the block lights it).
  const sw = Math.ceil(W / o.scale)
  const sh = Math.ceil(H / o.scale)
  const sample = (sx: number, sy: number): string | undefined => {
    for (let dy = 0; dy < o.scale; dy++)
      for (let dx = 0; dx < o.scale; dx++) {
        const c = at.get(`${sx * o.scale + dx},${sy * o.scale + dy}`)
        if (c) return c
      }
    return undefined
  }
  const columns = sw
  const rows = Math.ceil(sh / 2)
  const words = new Uint32Array(columns * rows * 3)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const top = sample(c, r * 2)
      const bottom = sample(c, r * 2 + 1)
      const i = (r * columns + c) * 3
      if (!top && !bottom) {
        words[i] = 0x20
        words[i + 1] = DEFAULT_BG
        words[i + 2] = DEFAULT_BG
      } else if (top) {
        words[i] = UPPER
        words[i + 1] = toRgb(top, !!o.isDim)
        words[i + 2] = bottom ? toRgb(bottom, !!o.isDim) : DEFAULT_BG
      } else {
        words[i] = 0x2584 // ▄ bottom only
        words[i + 1] = toRgb(bottom!, !!o.isDim)
        words[i + 2] = DEFAULT_BG
      }
    }
  return { columns, rows, cells: toBase64(new Uint8Array(words.buffer)) }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const toBase64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : B64[c & 63]
  }
  return out
}

/** Height in px of a bot drawn `size` px wide. */
export const botHeight = (size: number): number => Math.round((size * H) / W)
