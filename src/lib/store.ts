import { create } from 'zustand'
import type { AuthUser, CoachingSession, SalespersonProfile, UnitTrend, MatrixData } from '../types'
import { apiFetch } from './api'
import { getAuthUser } from './auth'

interface AppState {
  // Auth
  user: AuthUser | null
  userLoading: boolean
  loadUser: () => Promise<void>

  // Sessions
  sessions: CoachingSession[]
  sessionsLoading: boolean
  loadSessions: () => Promise<void>

  // Profile
  profile: SalespersonProfile | null
  profileLoading: boolean
  loadProfile: () => Promise<void>

  // Trends
  trends: UnitTrend[]
  trendsLoading: boolean
  loadTrends: () => Promise<void>

  // Matrix
  matrixData: MatrixData | null
  matrixLoading: boolean
  loadMatrix: () => Promise<void>
}

export const useStore = create<AppState>((set) => ({
  user: null,
  userLoading: true,
  loadUser: async () => {
    set({ userLoading: true })
    try {
      const user = await getAuthUser()
      set({ user })
    } finally {
      set({ userLoading: false })
    }
  },

  sessions: [],
  sessionsLoading: false,
  loadSessions: async () => {
    set({ sessionsLoading: true })
    try {
      const sessions = await apiFetch<CoachingSession[]>('/api/sessions')
      set({ sessions })
    } finally {
      set({ sessionsLoading: false })
    }
  },

  profile: null,
  profileLoading: false,
  loadProfile: async () => {
    set({ profileLoading: true })
    try {
      const profile = await apiFetch<SalespersonProfile | null>('/api/profile')
      set({ profile })
    } finally {
      set({ profileLoading: false })
    }
  },

  trends: [],
  trendsLoading: false,
  loadTrends: async () => {
    set({ trendsLoading: true })
    try {
      const trends = await apiFetch<UnitTrend[]>('/api/profile/trends')
      set({ trends })
    } finally {
      set({ trendsLoading: false })
    }
  },

  matrixData: null,
  matrixLoading: false,
  loadMatrix: async () => {
    set({ matrixLoading: true })
    try {
      const matrixData = await apiFetch<MatrixData>('/api/matrix/positions')
      set({ matrixData })
    } finally {
      set({ matrixLoading: false })
    }
  },
}))
