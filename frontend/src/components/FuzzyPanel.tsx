import type { ReactNode } from 'react'
import type { FuzzyEvaluateResponse, FuzzyMemberships, FuzzyRule } from '../types'
import './FuzzyPanel.css'

interface FuzzyPanelProps {
  result: FuzzyEvaluateResponse | null
  error: string | null
}

const LIGHT_SETS: [keyof FuzzyMemberships, string][] = [
  ['dark', 'Dark'],
  ['moderate', 'Moderate'],
  ['bright', 'Bright'],
  ['veryBright', 'Very Bright'],
]

const DELTA_SETS: [keyof FuzzyMemberships, string][] = [
  ['falling', 'Falling'],
  ['stable', 'Stable'],
  ['rising', 'Rising'],
]

const OUTPUT_SETS = ['FastOpen', 'SlowOpen', 'Stop', 'SlowClose', 'FastClose'] as const

// Mirrors backend/fuzzy/config.py's RULES (frozen contract, IMPLEMENTATION_PLAN.md
// §2.3). Only labels live here — no fuzzy math — so the matrix can render fired
// vs. unfired cells without a second API round trip. Keep in sync with config.py.
const RULE_MATRIX: { id: string; light: string; delta: string; output: string }[] = [
  { id: 'R01', light: 'Dark', delta: 'Falling', output: 'FastOpen' },
  { id: 'R02', light: 'Dark', delta: 'Stable', output: 'SlowOpen' },
  { id: 'R03', light: 'Dark', delta: 'Rising', output: 'Stop' },
  { id: 'R04', light: 'Moderate', delta: 'Falling', output: 'SlowOpen' },
  { id: 'R05', light: 'Moderate', delta: 'Stable', output: 'Stop' },
  { id: 'R06', light: 'Moderate', delta: 'Rising', output: 'SlowClose' },
  { id: 'R07', light: 'Bright', delta: 'Falling', output: 'Stop' },
  { id: 'R08', light: 'Bright', delta: 'Stable', output: 'SlowClose' },
  { id: 'R09', light: 'Bright', delta: 'Rising', output: 'FastClose' },
  { id: 'R10', light: 'VeryBright', delta: 'Falling', output: 'SlowClose' },
  { id: 'R11', light: 'VeryBright', delta: 'Stable', output: 'FastClose' },
  { id: 'R12', light: 'VeryBright', delta: 'Rising', output: 'FastClose' },
]

// Matches ClassroomScene's TILT_DEADBAND / backend's MOTOR_STOP_BAND so the
// scene and this panel never disagree about what "stopped" means.
const STOP_BAND = 0.05

function keyOf(name: string): keyof FuzzyMemberships {
  return (name.charAt(0).toLowerCase() + name.slice(1)) as keyof FuzzyMemberships
}

function pct(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

// Per-output-set peak activation, mirroring the backend's aggregation step
// (max across rules sharing an output) so the bars read the same story as
// the centroid — just without re-deriving the sampled MF shape client-side.
function outputActivations(rules: FuzzyRule[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const set of OUTPUT_SETS) acc[set] = 0
  for (const rule of rules) {
    acc[rule.output] = Math.max(acc[rule.output] ?? 0, rule.activation)
  }
  return acc
}

function explainSentence(result: FuzzyEvaluateResponse): string {
  const { rules, memberships, motorCommand, direction } = result
  if (rules.length === 0) {
    return `No rule reads above zero here — motor holds at ${motorCommand.toFixed(3)} (${direction}).`
  }
  const top = [...rules].sort((a, b) => b.activation - a.activation)[0]
  const lightDeg = memberships[keyOf(top.light)]
  const changeDeg = memberships[keyOf(top.change)]
  const stopped = Math.abs(motorCommand) <= STOP_BAND
  const verb = stopped ? 'holds near stop' : direction === 'close' ? 'closes' : 'opens'
  return `${top.light} ${lightDeg.toFixed(2)} ∧ ${top.change} ${changeDeg.toFixed(2)} → ${top.output} (rule ${top.id}, activation ${top.activation.toFixed(2)}). Motor ${verb} at ${motorCommand.toFixed(3)}.`
}

function MembershipBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="fp-bar-row">
      <span className="fp-bar-label">{label}</span>
      <div className="fp-bar-track">
        <div className="fp-bar-fill" style={{ width: pct(value) }} />
      </div>
      <span className="fp-bar-value">{value.toFixed(2)}</span>
    </div>
  )
}

function OutputBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="fp-bar-row">
      <span className="fp-bar-label">{label}</span>
      <div className="fp-bar-track">
        <div className="fp-bar-fill fp-bar-fill--output" style={{ width: pct(value) }} />
      </div>
      <span className="fp-bar-value">{value.toFixed(2)}</span>
    </div>
  )
}

export default function FuzzyPanel({ result, error }: FuzzyPanelProps) {
  let body: ReactNode
  if (error) {
    body = (
      <p className="error" role="alert">
        {error}
        <br />
        <small>
          Tip: you need two terminals — backend on :5000 and frontend on :5173. See README
          Quickstart.
        </small>
      </p>
    )
  } else if (!result) {
    body = <p className="fp-loading">Loading...</p>
  } else {
    const activeIds = new Set(result.rules.map((r) => r.id))
    const outputs = outputActivations(result.rules)
    const sortedRules = [...result.rules].sort((a, b) => b.activation - a.activation)

    body = (
      <>
        <section className="fp-section">
          <h3>Memberships</h3>
          <div className="fp-membership-cols">
            <div>
              <h4>Light</h4>
              {LIGHT_SETS.map(([key, label]) => (
                <MembershipBar key={key} label={label} value={result.memberships[key]} />
              ))}
            </div>
            <div>
              <h4>Rate of Change</h4>
              {DELTA_SETS.map(([key, label]) => (
                <MembershipBar key={key} label={label} value={result.memberships[key]} />
              ))}
            </div>
          </div>
        </section>

        <section className="fp-section">
          <h3>Rule Matrix</h3>
          <div className="fp-matrix" role="table">
            {RULE_MATRIX.map((rule) => (
              <div
                key={rule.id}
                className={`fp-matrix-cell${activeIds.has(rule.id) ? ' fp-matrix-cell--active' : ''}`}
                title={`${rule.id}: ${rule.light} + ${rule.delta} → ${rule.output}`}
              >
                <span className="fp-matrix-id">{rule.id}</span>
                <span className="fp-matrix-output">{rule.output}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="fp-section">
          <h3>Active Rules</h3>
          {sortedRules.length === 0 ? (
            <p className="fp-loading">No rules fired above zero.</p>
          ) : (
            <ul className="fp-rule-list">
              {sortedRules.map((rule) => (
                <li key={rule.id}>
                  <span className="fp-rule-id">{rule.id}</span>
                  <span className="fp-rule-desc">
                    {rule.light} ∧ {rule.change} → {rule.output}
                  </span>
                  <div className="fp-bar-track fp-bar-track--inline">
                    <div className="fp-bar-fill" style={{ width: pct(rule.activation) }} />
                  </div>
                  <span className="fp-bar-value">{rule.activation.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="fp-section">
          <h3>Aggregated Output</h3>
          {OUTPUT_SETS.map((set) => (
            <OutputBar key={set} label={set} value={outputs[set]} />
          ))}
          <div className="fp-motor-readout">
            <span className="fp-motor-value">{result.motorCommand.toFixed(3)}</span>
            <span className={`fp-motor-direction fp-motor-direction--${result.direction}`}>
              {result.direction.toUpperCase()}
            </span>
          </div>
        </section>

        <section className="fp-section fp-explain">
          <h3>Explain Current Output</h3>
          <p>{explainSentence(result)}</p>
        </section>
      </>
    )
  }

  return (
    <div id="fuzzy-panel" className="fp-inner">
      <h2>Fuzzy Panel</h2>
      {body}
    </div>
  )
}
