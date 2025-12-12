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
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

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

  const value: AppStateContextValue = useMemo(
    () => ({
      services: appServices,
      settings,
      settingsLoading,
      settingsInitialized: Boolean(settings),
      refreshSettings,
    }),
    [settings, settingsLoading, refreshSettings],
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

