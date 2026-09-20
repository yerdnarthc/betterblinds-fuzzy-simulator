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
