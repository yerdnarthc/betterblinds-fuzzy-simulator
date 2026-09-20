import { useEffect, useState } from 'react'
import Plot from 'react-plotly.js'
import type { Data, Layout } from 'plotly.js'
import { fetchSurface } from '../api'
import type { SurfaceResponse } from '../types'
import {
  DIVERGING_CLOSE,
  DIVERGING_OPEN,
  DIVERGING_STOP,
  PLOT_ACCENT,
  PLOT_CONFIG,
  PLOT_FONT_FAMILY,
  PLOT_GRID,
  PLOT_TEXT,
  PLOT_TEXT_DIM,
} from './plotTheme'
import './ControlSurface.css'

interface ControlSurfaceProps {
  currentLight: number
  currentDelta: number
  currentMotorCommand: number
}

// motorCommand is a signed polarity value (negative = open, 0 = stop,
// positive = close) — exactly the diverging case (dataviz skill), not a
// magnitude. Two hues + a neutral gray midpoint, not a rainbow.
const DIVERGING_COLORSCALE: [number, string][] = [
  [0, DIVERGING_OPEN],
  [0.5, DIVERGING_STOP],
  [1, DIVERGING_CLOSE],
]

export default function ControlSurface({
  currentLight,
  currentDelta,
  currentMotorCommand,
}: ControlSurfaceProps) {
  const [surface, setSurface] = useState<SurfaceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The grid is a pure function of config.py, not of the live sliders —
  // fetched once, not re-fetched as L/dL change.
  useEffect(() => {
    fetchSurface()
      .then(setSurface)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }, [])

  if (error) {
    return (
      <div className="cs-card">
        <p className="error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (!surface) {
    return (
      <div className="cs-card">
        <p className="cs-loading">Loading control surface...</p>
      </div>
    )
  }

  const data: Data[] = [
    {
      type: 'surface',
      x: surface.delta,
      y: surface.light,
      z: surface.motorCommand,
      colorscale: DIVERGING_COLORSCALE,
      cmin: -1,
      cmax: 1,
      showscale: true,
      colorbar: {
        title: { text: 'Motor', font: { color: PLOT_TEXT, size: 11 } },
        tickvals: [-1, 0, 1],
        ticktext: ['Open', 'Stop', 'Close'],
        tickfont: { color: PLOT_TEXT, size: 10 },
        len: 0.7,
      },
      contours: {
        z: { show: true, usecolormap: true, project: { z: true } },
      },
      hovertemplate:
        'L=%{y:.0f}, dL=%{x:.0f}<br>motor=%{z:.3f}<extra></extra>',
    },
    {
      type: 'scatter3d',
      mode: 'markers',
      // No `name`/legend entry: a single "you are here" marker doesn't need
      // an identity box (dataviz skill — the caption + hover already say
      // what it is), and a floating legend was overlapping the colorbar.
      showlegend: false,
      x: [currentDelta],
      y: [currentLight],
      z: [currentMotorCommand],
      marker: { size: 6, color: PLOT_ACCENT, symbol: 'diamond' },
      hovertemplate: `You are here: L=%{y:.0f}, dL=%{x:.0f}, motor=%{z:.3f}<extra></extra>`,
    },
  ]

  const layout: Partial<Layout> = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: PLOT_FONT_FAMILY, color: PLOT_TEXT, size: 11 },
    // r reserves real space for the colorbar instead of letting it float
    // over the z-axis; margin(0) was the actual cause of the overlap.
    margin: { l: 10, r: 90, t: 30, b: 10 },
    height: 620,
    showlegend: false,
    scene: {
      xaxis: {
        title: { text: 'dL (rate of change)' },
        gridcolor: PLOT_GRID,
        linecolor: PLOT_TEXT_DIM,
        color: PLOT_TEXT,
      },
      yaxis: {
        title: { text: 'L (light intensity)' },
        gridcolor: PLOT_GRID,
        linecolor: PLOT_TEXT_DIM,
        color: PLOT_TEXT,
      },
      zaxis: {
        title: { text: 'Motor command' },
        range: [-1, 1],
        gridcolor: PLOT_GRID,
        linecolor: PLOT_TEXT_DIM,
        color: PLOT_TEXT,
      },
      bgcolor: 'transparent',
      aspectmode: 'cube',
      camera: { eye: { x: 1.7, y: -1.7, z: 1.0 } },
    },
  }

  return (
    <div className="cs-card">
      <h3>Control Surface</h3>
      <p className="cs-caption">
        L x dL &rarr; motor command, swept across the full domain. The gold marker
        tracks the current slider position.
      </p>
      <Plot
        data={data}
        layout={layout}
        config={PLOT_CONFIG}
        useResizeHandler
        style={{ width: '100%', height: '620px' }}
      />
    </div>
  )
}
