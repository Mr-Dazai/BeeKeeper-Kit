// Smooth gauges for surfaces that draw Svg: a rounded bar and the five effort pills.
// SVG cannot read the app's theme, so these use fixed colors close to Claude's dark theme.

export const HEX = {
  claude: '#D97757',
  warning: '#E0B050',
  error: '#E06C6C',
  track: '#FFFFFF',
} as const

export type Level = 'claude' | 'warning' | 'error'

/** A rounded bar `width` × `height` px, filled to `percent` in the level's color. */
export const barSvg = (percent: number, level: Level, width: number, height = 8): string => {
  const p = Math.max(0, Math.min(100, percent))
  const r = height / 2
  const fill = p <= 0 ? 0 : Math.max(height, (width * p) / 100)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" rx="${r}" fill="${HEX.track}" fill-opacity="0.12"/>` +
    (fill ? `<rect width="${fill.toFixed(1)}" height="${height}" rx="${r}" fill="${HEX[level]}"/>` : '') +
    `</svg>`
  )
}

/** `filled` of `total` rounded pills, e.g. effort `high` = 3 of 5. */
export const pillsSvg = (filled: number, total = 5, pill = 9, height = 8, gap = 3): string => {
  const width = total * pill + (total - 1) * gap
  const pills = Array.from({ length: total }, (_, i) => {
    const on = i < filled
    return `<rect x="${i * (pill + gap)}" width="${pill}" height="${height}" rx="2" fill="${on ? HEX.claude : HEX.track}"${on ? '' : ' fill-opacity="0.12"'}/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${pills}</svg>`
}

export const pillsWidth = (total = 5, pill = 9, gap = 3): number => total * pill + (total - 1) * gap
