import { create } from 'zustand'
import type { SessionRecord, ExecutionExerciseRecord, ExecutionSetLogRecord } from '../lib/api'

type SessionState = {
  sessionId: string | null
  session: SessionRecord | null
  isActive: boolean
  isPaused: boolean
  startedAt: Date | null
  elapsedSeconds: number
}

type SessionActions = {
  setSession: (session: SessionRecord) => void
  updateSet: (execExId: string, setId: string, updates: Partial<ExecutionSetLogRecord>) => void
  addExercise: (exercise: ExecutionExerciseRecord) => void
  removeExercise: (execExId: string) => void
  addSet: (execExId: string, set: ExecutionSetLogRecord) => void
  removeSet: (execExId: string, setId: string) => void
  updateExerciseNotes: (execExId: string, notes: string | null) => void
  startTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  clearSession: () => void
}

let _timerInterval: ReturnType<typeof setInterval> | null = null

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  sessionId: null,
  session: null,
  isActive: false,
  isPaused: false,
  startedAt: null,
  elapsedSeconds: 0,

  setSession: (session) => {
    const startedAt = new Date(session.startedAt)
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    set({ session, sessionId: session.id, isActive: true, startedAt, elapsedSeconds: Math.max(0, elapsed) })
  },

  updateSet: (execExId, setId, updates) => {
    const session = get().session
    if (!session) return
    set({
      session: {
        ...session,
        exercises: session.exercises.map(ex =>
          ex.id !== execExId ? ex : {
            ...ex,
            sets: ex.sets.map(s => s.id !== setId ? s : { ...s, ...updates }),
          }
        ),
      },
    })
  },

  addExercise: (exercise) => {
    const session = get().session
    if (!session) return
    set({ session: { ...session, exercises: [...session.exercises, exercise] } })
  },

  removeExercise: (execExId) => {
    const session = get().session
    if (!session) return
    set({ session: { ...session, exercises: session.exercises.filter(ex => ex.id !== execExId) } })
  },

  addSet: (execExId, newSet) => {
    const session = get().session
    if (!session) return
    set({
      session: {
        ...session,
        exercises: session.exercises.map(ex =>
          ex.id !== execExId ? ex : { ...ex, sets: [...ex.sets, newSet] }
        ),
      },
    })
  },

  removeSet: (execExId, setId) => {
    const session = get().session
    if (!session) return
    set({
      session: {
        ...session,
        exercises: session.exercises.map(ex =>
          ex.id !== execExId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
        ),
      },
    })
  },

  updateExerciseNotes: (execExId, notes) => {
    const session = get().session
    if (!session) return
    set({
      session: {
        ...session,
        exercises: session.exercises.map(ex =>
          ex.id !== execExId ? ex : { ...ex, exerciseNotes: notes }
        ),
      },
    })
  },

  startTimer: () => {
    if (_timerInterval) clearInterval(_timerInterval)
    set({ isPaused: false })
    _timerInterval = setInterval(() => {
      set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 }))
    }, 1000)
  },

  pauseTimer: () => {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    set({ isPaused: true })
  },

  resumeTimer: () => {
    if (_timerInterval) clearInterval(_timerInterval)
    set({ isPaused: false })
    _timerInterval = setInterval(() => {
      set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 }))
    }, 1000)
  },

  stopTimer: () => {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
  },

  clearSession: () => {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    set({ sessionId: null, session: null, isActive: false, isPaused: false, startedAt: null, elapsedSeconds: 0 })
  },
}))
