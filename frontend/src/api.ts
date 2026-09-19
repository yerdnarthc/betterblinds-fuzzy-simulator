import type { FuzzyEvaluateRequest, FuzzyEvaluateResponse } from './types'

// Flask's default `flask run` port. See README.md Quickstart.
const API_BASE = 'http://127.0.0.1:5000'

export async function evaluateFuzzy(
  input: FuzzyEvaluateRequest,
): Promise<FuzzyEvaluateResponse> {
  const response = await fetch(`${API_BASE}/api/fuzzy/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Fuzzy API error: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as FuzzyEvaluateResponse
}
