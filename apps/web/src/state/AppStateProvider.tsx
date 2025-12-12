import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../../../../packages/core/src/index'

interface AppStateContextValue {
  // Placeholder for future global state values
  settings?: Settings
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value: AppStateContextValue = {}

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return context
}

