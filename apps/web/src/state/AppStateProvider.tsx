import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '@core/index'
import { appServices } from '../api/appServices'
import { loadSettings } from '../api/settingsApi'

interface AppStateContextValue {
  services: typeof appServices
  settings: Settings | null
  settingsLoading: boolean
  settingsInitialized: boolean
  refreshSettings: () => Promise<void>
  auth: AuthState
  markAuthenticated: (username?: string) => void
  logout: () => void
  idleLock: IdleLockState
  recordActivity: () => void
  lockIdle: () => void
  unlockIdle: () => void
}

interface AuthState {
  isAuthenticated: boolean
  username?: string
}

interface IdleLockState {
  isLocked: boolean
  lastActivityAt: number | null
}

export const SESSION_STORAGE_KEY = 'ASEEL_POS_SESSION'

const defaultAuthState: AuthState = { isAuthenticated: false }
const defaultIdleLockState: IdleLockState = { isLocked: false, lastActivityAt: null }

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [idleLock, setIdleLock] = useState<IdleLockState>(defaultIdleLockState)
  const [auth, setAuth] = useState<AuthState>(() => {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return defaultAuthState
    try {
      const parsed = JSON.parse(raw) as Partial<AuthState>
      if (parsed.isAuthenticated) {
        return { isAuthenticated: true, username: parsed.username }
      }
      if (raw === 'logged_in') {
        return { isAuthenticated: true }
      }
    } catch (err) {
      console.warn('Unable to parse auth session', err)
    }
    return defaultAuthState
  })

  const refreshSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const data = await loadSettings()
      setSettings(data)
    } catch (err) {
      console.error('Unable to refresh settings', err)
      setSettings(null)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  const markAuthenticated = useCallback((username?: string) => {
    const next: AuthState = { isAuthenticated: true, username }
    setAuth(next)
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next))
    setIdleLock({ isLocked: false, lastActivityAt: Date.now() })
  }, [])

  const logout = useCallback(() => {
    setAuth(defaultAuthState)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setIdleLock(defaultIdleLockState)
  }, [])

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setIdleLock(defaultIdleLockState)
      return
    }
    setIdleLock((prev) => ({
      isLocked: false,
      lastActivityAt: prev.lastActivityAt ?? Date.now(),
    }))
  }, [auth.isAuthenticated])

  const recordActivity = useCallback(() => {
    if (!auth.isAuthenticated) return
    setIdleLock((prev) => {
      if (prev.isLocked) return prev
      return { ...prev, lastActivityAt: Date.now() }
    })
  }, [auth.isAuthenticated])

  const lockIdle = useCallback(() => {
    setIdleLock((prev) => ({ ...prev, isLocked: true }))
  }, [])

  const unlockIdle = useCallback(() => {
    setIdleLock({ isLocked: false, lastActivityAt: Date.now() })
  }, [])

  const value: AppStateContextValue = useMemo(
    () => ({
      services: appServices,
      settings,
      settingsLoading,
      settingsInitialized: Boolean(settings),
      refreshSettings,
      auth,
      markAuthenticated,
      logout,
      idleLock,
      recordActivity,
      lockIdle,
      unlockIdle,
    }),
    [
      settings,
      settingsLoading,
      refreshSettings,
      auth,
      markAuthenticated,
      logout,
      idleLock,
      recordActivity,
      lockIdle,
      unlockIdle,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return context
}

