import type { FuzzyEvaluateRequest, FuzzyEvaluateResponse } from './types'

// Flask's default `flask run` port. See README.md Quickstart.
const API_BASE = 'http://127.0.0.1:5000'

export async function evaluateFuzzy(
  input: FuzzyEvaluateRequest,
): Promise<FuzzyEvaluateResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/fuzzy/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    // `fetch` throws TypeError("Failed to fetch") when the server isn't reachable.
    // That raw message confuses beginners, so we explain what actually happened.
    throw new Error(
      `Cannot reach ${API_BASE} — is the Flask backend running? In a second terminal run:  cd backend && .venv\\Scripts\\activate && flask run`,
    )
  }

  if (!response.ok) {
    throw new Error(`Fuzzy API error: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as FuzzyEvaluateResponse
}
