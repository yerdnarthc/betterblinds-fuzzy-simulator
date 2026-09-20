import { useEffect, useState } from 'react'
import Plot from 'react-plotly.js'
import type { Data, Layout } from 'plotly.js'
import { fetchMembershipCurves } from '../api'
import type { MembershipCurveGroup, MembershipCurvesResponse } from '../types'
import {
  CATEGORICAL_SLOTS,
  PLOT_ACCENT,
  PLOT_CONFIG,
  PLOT_FONT_FAMILY,
  PLOT_GRID,
  PLOT_HEADING,
  PLOT_TEXT,
  PLOT_TEXT_DIM,
} from './plotTheme'
import './MembershipChart.css'

interface MembershipChartProps {
  currentLight: number
  currentDelta: number
}

// Fixed name -> categorical-slot assignment (dataviz skill: "assign in
// fixed order, never cycled"). Domain-order low -> high maps onto slot
// 1 -> N; Falling/Stable/Rising reuse the first three slots of Light's set
// — a different chart with its own legend, so reusing hues is fine.
const LIGHT_COLORS: Record<string, string> = {
  Dark: CATEGORICAL_SLOTS[0],
  Moderate: CATEGORICAL_SLOTS[1],
  Bright: CATEGORICAL_SLOTS[2],
  VeryBright: CATEGORICAL_SLOTS[3],
}

const DELTA_COLORS: Record<string, string> = {
  Falling: CATEGORICAL_SLOTS[0],
  Stable: CATEGORICAL_SLOTS[1],
  Rising: CATEGORICAL_SLOTS[2],
}

function buildTraces(group: MembershipCurveGroup, colors: Record<string, string>): Data[] {
  return Object.entries(group.sets).map(([name, ys]) => ({
    type: 'scatter',
    mode: 'lines',
    name,
    x: group.x,
    y: ys,
    line: { color: colors[name], width: 2 },
    hovertemplate: `${name}: %{y:.2f}<extra></extra>`,
  }))
}

function buildLayout(title: string, xTitle: string, currentX: number): Partial<Layout> {
  return {
    title: { text: title, font: { color: PLOT_HEADING, size: 13 } },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: PLOT_FONT_FAMILY, color: PLOT_TEXT, size: 11 },
    margin: { l: 48, r: 16, t: 36, b: 40 },
    height: 300,
    xaxis: {
      title: { text: xTitle },
      gridcolor: PLOT_GRID,
      zerolinecolor: PLOT_GRID,
      linecolor: PLOT_TEXT_DIM,
    },
    yaxis: {
      title: { text: 'Membership' },
      range: [0, 1.05],
      gridcolor: PLOT_GRID,
      zerolinecolor: PLOT_GRID,
      linecolor: PLOT_TEXT_DIM,
    },
    shapes: [
      {
        type: 'line',
        x0: currentX,
        x1: currentX,
        y0: 0,
        y1: 1.05,
        line: { color: PLOT_ACCENT, width: 1.5, dash: 'dot' },
      },
    ],
    legend: { orientation: 'h', y: -0.3, font: { size: 10 } },
  }
}

export default function MembershipChart({ currentLight, currentDelta }: MembershipChartProps) {
  const [curves, setCurves] = useState<MembershipCurvesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Static per config.py — fetched once, not re-fetched as sliders move.
  useEffect(() => {
    fetchMembershipCurves()
      .then(setCurves)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }, [])

  if (error) {
    return (
      <div className="mc-card">
        <p className="error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (!curves) {
    return (
      <div className="mc-card">
        <p className="mc-loading">Loading membership curves...</p>
      </div>
    )
  }

  return (
    <div className="mc-card">
      <h3>Membership Functions</h3>
      <div className="mc-charts">
        <Plot
          data={buildTraces(curves.light, LIGHT_COLORS)}
          layout={buildLayout('Light Intensity', 'L (ADC 0-1023)', currentLight)}
          config={PLOT_CONFIG}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
        <Plot
          data={buildTraces(curves.delta, DELTA_COLORS)}
          layout={buildLayout('Rate of Change', 'dL (-200..200)', currentDelta)}
          config={PLOT_CONFIG}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
