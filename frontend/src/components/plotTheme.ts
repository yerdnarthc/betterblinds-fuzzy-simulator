// Shared Plotly styling for MembershipChart + ControlSurface, so the two
// Phase 6 charts read as one system with each other and with the app's
// dark pixel-system theme (index.css).
import type { Config } from 'plotly.js'

export const PLOT_FONT_FAMILY = 'ui-monospace, "Cascadia Mono", Consolas, monospace'
export const PLOT_TEXT = '#9bb0b8' // --text
export const PLOT_TEXT_DIM = '#6e8892' // --text-dim
export const PLOT_HEADING = '#f2ede0' // --text-h
export const PLOT_GRID = 'rgba(155, 176, 184, 0.15)' // --text at low alpha: recessive gridlines
export const PLOT_ACCENT = '#fec837' // --accent: used for the "you are here" marker

// Dataviz skill's validated 8-hue categorical order, dark-surface steps
// (references/palette.md). Fixed per linguistic-set name, never cycled —
// see MembershipChart.tsx for the name -> slot assignment.
export const CATEGORICAL_SLOTS = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
] as const

// Diverging pair (polarity: open <-> close) from the same skill, validated
// as a 2-slot pair against the dark surface — see the ControlSurface build
// notes for why motorCommand (a signed value) maps naturally to this.
export const DIVERGING_OPEN = '#3987e5' // blue
export const DIVERGING_STOP = '#8a8a86' // neutral gray midpoint
export const DIVERGING_CLOSE = '#e66767' // red

export const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  toImageButtonOptions: { format: 'png', scale: 2, filename: 'betterblinds-fuzzy-chart' },
}
