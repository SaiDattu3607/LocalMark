/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DAY_MS,
  TRIAL_LENGTH_MS,
  getOrCreateAppState,
  updateAppState as persistAppState,
  type AppState,
} from '../db'

export type AppMode = 'TRIAL' | 'LICENSED' | 'EXPIRED'

interface AppModeContextValue {
  mode: AppMode
  daysLeft: number
  appState: AppState | null
  loading: boolean
  updateAppState: (updates: Partial<AppState>) => Promise<AppState>
}

const AppModeContext = createContext<AppModeContextValue | null>(null)
const FALLBACK_APP_STATE: AppState = {
  trialStartedAt: 0,
  licensed: false,
  licenseKey: null,
  activatedAt: null,
  shownExpiryWarning: false,
}

function getMode(appState: AppState, now = Date.now()): AppMode {
  if (appState.licensed) return 'LICENSED'
  if (now - appState.trialStartedAt < TRIAL_LENGTH_MS) return 'TRIAL'
  return 'EXPIRED'
}

function getDaysLeft(appState: AppState, now = Date.now()): number {
  return Math.max(0, 7 - Math.floor((now - appState.trialStartedAt) / DAY_MS))
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getOrCreateAppState()
      .then((loaded) => {
        if (!cancelled) setAppState(loaded)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateAppState = useCallback(async (updates: Partial<AppState>) => {
    const next = await persistAppState(updates)
    setAppState(next)
    return next
  }, [])

  const value = useMemo<AppModeContextValue>(() => {
    const fallback = appState ?? FALLBACK_APP_STATE

    return {
      mode: getMode(fallback),
      daysLeft: getDaysLeft(fallback),
      appState,
      loading,
      updateAppState,
    }
  }, [appState, loading, updateAppState])

  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  )
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext)
  if (!ctx) throw new Error('useAppMode must be used within AppModeProvider')
  return ctx
}
