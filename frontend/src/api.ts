import type {
  FuzzyEvaluateRequest,
  FuzzyEvaluateResponse,
  MembershipCurvesResponse,
  SurfaceResponse,
} from './types'

// Flask's default `flask run` port. See README.md Quickstart.
const API_BASE = 'http://127.0.0.1:5000'

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
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

  return (await response.json()) as T
}

export function evaluateFuzzy(input: FuzzyEvaluateRequest): Promise<FuzzyEvaluateResponse> {
  return fetchJSON<FuzzyEvaluateResponse>('/api/fuzzy/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

// Phase 6: control-surface grid (see backend/fuzzy/surface.py). Defaults
// match the backend's own defaults — passed explicitly so the two stay
// in sync without one silently drifting from the other.
export function fetchSurface(lightSteps = 61, deltaSteps = 41): Promise<SurfaceResponse> {
  const params = new URLSearchParams({
    lightSteps: String(lightSteps),
    deltaSteps: String(deltaSteps),
  })
  return fetchJSON<SurfaceResponse>(`/api/fuzzy/surface?${params}`)
}

// Phase 6: 2D membership-function curves for the MF plots.
export function fetchMembershipCurves(steps = 121): Promise<MembershipCurvesResponse> {
  const params = new URLSearchParams({ steps: String(steps) })
  return fetchJSON<MembershipCurvesResponse>(`/api/fuzzy/membership-curves?${params}`)
}
