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
}

interface AuthState {
  isAuthenticated: boolean
  username?: string
}

export const SESSION_STORAGE_KEY = 'ASEEL_POS_SESSION'

const defaultAuthState: AuthState = { isAuthenticated: false }

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
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
  }, [])

  const logout = useCallback(() => {
    setAuth(defaultAuthState)
    localStorage.removeItem(SESSION_STORAGE_KEY)
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
    }),
    [settings, settingsLoading, refreshSettings, auth, markAuthenticated, logout],
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

