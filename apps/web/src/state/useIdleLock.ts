import { useEffect } from 'react'
import { useAppState } from './AppStateProvider'

export function useIdleLock() {
  const { auth, settingsInitialized, settings, idleLock, recordActivity, lockIdle } = useAppState()

  useEffect(() => {
    if (!settingsInitialized || !auth.isAuthenticated) return
    if (!settings?.idle_lock_minutes || settings.idle_lock_minutes <= 0) return

    const handleActivity = () => {
      recordActivity()
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'touchstart']
    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [settingsInitialized, auth.isAuthenticated, settings?.idle_lock_minutes, recordActivity])

  useEffect(() => {
    if (!settingsInitialized || !auth.isAuthenticated) return
    const idleMinutes = settings?.idle_lock_minutes ?? 0
    if (idleMinutes <= 0) return

    const idleTimeoutMs = idleMinutes * 60 * 1000
    const interval = window.setInterval(() => {
      if (!auth.isAuthenticated || idleLock.isLocked) return
      const last = idleLock.lastActivityAt
      if (!last) return
      const diff = Date.now() - last
      if (diff >= idleTimeoutMs) {
        lockIdle()
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [settingsInitialized, auth.isAuthenticated, settings?.idle_lock_minutes, idleLock.isLocked, idleLock.lastActivityAt, lockIdle])
}

export default useIdleLock
