import { useCallback, useEffect, useRef, useState } from 'react'

import {
  FreighterError,
  connectWallet,
  isTestnet,
  restoreSession,
  type WalletSession,
} from '../lib/freighter'

const POLL_INTERVAL_MS = 4000

/** Remembers an explicit disconnect so a reload does not silently re-connect. */
const DISCONNECTED_KEY = 'stellar-pay:disconnected'

export type WalletStatus = 'disconnected' | 'connecting' | 'connected'

export interface WalletError {
  message: string
  hint?: string
}

export interface Wallet {
  status: WalletStatus
  address: string | null
  network: string | null
  onTestnet: boolean
  error: WalletError | null
  connect: () => Promise<void>
  disconnect: () => void
  clearError: () => void
}

export function useWallet(): Wallet {
  const [session, setSession] = useState<WalletSession | null>(null)
  const [status, setStatus] = useState<WalletStatus>('disconnected')
  const [error, setError] = useState<WalletError | null>(null)

  /** True while the user has explicitly disconnected; blocks the background sync. */
  const dismissed = useRef(readDismissed())
  /** True while the Freighter popup is open, so the sync cannot clobber the attempt. */
  const connecting = useRef(false)

  const connect = useCallback(async () => {
    connecting.current = true
    setStatus('connecting')
    setError(null)
    try {
      const next = await connectWallet()
      dismissed.current = false
      writeDismissed(false)
      setSession(next)
      setStatus('connected')
    } catch (cause) {
      setSession(null)
      setStatus('disconnected')
      setError({
        message: cause instanceof Error ? cause.message : 'Could not connect to Freighter.',
        hint: cause instanceof FreighterError ? cause.hint : undefined,
      })
    } finally {
      connecting.current = false
    }
  }, [])

  /**
   * Freighter has no "revoke access" API, so disconnecting is a local action:
   * we drop the session here and stop reading the wallet. To remove the site
   * permission itself, the user does it from the extension.
   */
  const disconnect = useCallback(() => {
    dismissed.current = true
    writeDismissed(true)
    setSession(null)
    setStatus('disconnected')
    setError(null)
  }, [])

  // Restore a previously approved session on load, and keep the address and
  // network in sync when the user switches either one inside the extension.
  useEffect(() => {
    let active = true

    const sync = async () => {
      if (dismissed.current || connecting.current) return
      try {
        const next = await restoreSession()
        if (!active || dismissed.current || connecting.current) return

        if (!next) {
          setSession(null)
          setStatus('disconnected')
          return
        }

        setSession((current) =>
          current?.address === next.address && current.network === next.network ? current : next,
        )
        setStatus('connected')
      } catch {
        // A transient extension error should not tear down a working session.
      }
    }

    void sync()
    const timer = setInterval(sync, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return {
    status,
    address: session?.address ?? null,
    network: session?.network ?? null,
    onTestnet: session ? isTestnet(session.network) : false,
    error,
    connect,
    disconnect,
    clearError: useCallback(() => setError(null), []),
  }
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISCONNECTED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeDismissed(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(DISCONNECTED_KEY, 'true')
    else window.localStorage.removeItem(DISCONNECTED_KEY)
  } catch {
    // Storage can be unavailable in private mode; the session just won't persist.
  }
}
