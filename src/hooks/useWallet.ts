import { useCallback, useEffect, useRef, useState } from 'react'

import {
  FreighterError,
  connectWallet,
  isTestnet,
  restoreSession,
  type WalletSession,
} from '../lib/freighter'

const POLL_INTERVAL_MS = 4000

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

  /** Set once the user disconnects, so the poller does not silently re-connect them. */
  const dismissed = useRef(false)

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      const next = await connectWallet()
      dismissed.current = false
      setSession(next)
      setStatus('connected')
    } catch (cause) {
      setStatus('disconnected')
      setSession(null)
      setError({
        message: cause instanceof Error ? cause.message : 'Could not connect to Freighter.',
        hint: cause instanceof FreighterError ? cause.hint : undefined,
      })
    }
  }, [])

  /**
   * Freighter has no "revoke access" API, so disconnecting is a local action:
   * we drop the session here and stop reading the wallet. To remove the site
   * permission itself, the user does it from the extension.
   */
  const disconnect = useCallback(() => {
    dismissed.current = true
    setSession(null)
    setStatus('disconnected')
    setError(null)
  }, [])

  // Restore a previously approved session on load, and keep the address and
  // network in sync when the user switches either one inside the extension.
  useEffect(() => {
    let active = true

    const sync = async () => {
      if (dismissed.current) return
      try {
        const next = await restoreSession()
        if (!active) return

        setSession((current) => {
          if (!next) {
            setStatus('disconnected')
            return null
          }
          setStatus('connected')
          if (current?.address === next.address && current.network === next.network) return current
          return next
        })
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
