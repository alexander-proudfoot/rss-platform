// Coaching session types
export type CoachingMode = 'pre-call' | 'post-call' | 'dev-review'

export interface CoachingSession {
  id: string
  mode: CoachingMode
  customerName: string | null
  opportunityName: string | null
  summary: string | null
  startedAt: string
  completedAt: string | null
}

export interface CoachingMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface SessionDetail extends CoachingSession {
  messages: CoachingMessage[]
}

// Job polling
export interface JobStatus {
  status: 'queued' | 'processing' | 'complete' | 'failed'
  result?: { text: string }
  error?: string
  completedAt?: string
}

// Development profile
export interface SalespersonProfile {
  id: string
  display_name: string
  email: string
  current_focus_unit: string | null
  created_at: string
}

// RSS units
export type RssUnit =
  | 'unit_1_positioning'
  | 'unit_2_discovering'
  | 'unit_3_building'
  | 'unit_4_presenting'
  | 'unit_5_resolving_concerns'

export const RSS_UNIT_LABELS: Record<RssUnit, string> = {
  unit_1_positioning: 'Unit 1: Positioning',
  unit_2_discovering: 'Unit 2: Discovering',
  unit_3_building: 'Unit 3: Building',
  unit_4_presenting: 'Unit 4: Presenting',
  unit_5_resolving_concerns: 'Unit 5: Resolving Concerns',
}

// Observations
export interface Observation {
  id: string
  observation_date: string
  meeting_type: string
  unit_assessed: RssUnit
  score: number
  specific_behaviour: string
  created_at: string
}

// Trends
export type TrendDirection = 'improving' | 'plateauing' | 'declining' | 'insufficient_data'

export interface UnitTrend {
  unit: RssUnit
  currentScore: number | null
  averageScore: number
  observationCount: number
  trend: TrendDirection
  scores: Array<{ score: number; date: string }>
}

// Matrix
export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface MatrixPosition {
  id: string
  customer_name: string
  opportunity_name: string | null
  quadrant: Quadrant
  evidence: string
  assessed_at: string
}

export interface MatrixData {
  history: MatrixPosition[]
  currentPositions: MatrixPosition[]
}

// Auth
export interface AuthUser {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}
