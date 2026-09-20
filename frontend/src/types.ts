// Mirrors backend/fuzzy/config.py + the frozen contract in IMPLEMENTATION_PLAN.md §2.4.
// Change one, change the other, in the same PR — see CONTRIBUTING.md's "Contract rule".

export interface FuzzyEvaluateRequest {
  lightIntensity: number
  lightChange: number
}

export interface FuzzyMemberships {
  dark: number
  moderate: number
  bright: number
  veryBright: number
  falling: number
  stable: number
  rising: number
}

export interface FuzzyRule {
  id: string
  light: string
  change: string
  output: string
  activation: number
}

export type MotorDirection = 'open' | 'stop' | 'close'

export interface FuzzyEvaluateResponse {
  memberships: FuzzyMemberships
  rules: FuzzyRule[]
  // Normalized actuator velocity in [-1, 1]: negative = opening,
  // 0 = stop (|u| <= 0.05 deadband), positive = closing. The scene
  // integrates this per frame — it is a persistent signal, not a target.
  motorCommand: number
  direction: MotorDirection
}

// Phase 6: GET /api/fuzzy/surface — a grid sweep of L x dL -> motorCommand
// for the 3D control-surface plot. Same normalization as motorCommand above.
export interface SurfaceResponse {
  light: number[]
  delta: number[]
  // motorCommand[i][j] is the value at (light[i], delta[j]).
  motorCommand: number[][]
}

// Phase 6: GET /api/fuzzy/membership-curves — each linguistic set's
// membership degree sampled across its domain, for the 2D MF plots.
export interface MembershipCurveGroup {
  domain: [number, number]
  x: number[]
  sets: Record<string, number[]>
}

export interface MembershipCurvesResponse {
  light: MembershipCurveGroup
  delta: MembershipCurveGroup
}
