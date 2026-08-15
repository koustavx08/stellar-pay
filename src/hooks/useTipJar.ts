import { useCallback, useEffect, useState } from 'react'

import { type TipJarStats, describeContractError, readStats, readTipsBy } from '../lib/tipjar'

export interface TipJarState {
  stats: TipJarStats | null
  /** How much the connected address has tipped, in XLM. Null when disconnected. */
  yourTips: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTipJar(address: string | null): TipJarState {
  const [stats, setStats] = useState<TipJarStats | null>(null)
  const [yourTips, setYourTips] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // The jar panel only renders while connected, so there is nothing to show
    // (and no reason to hit the RPC) until there is an address.
    if (!address) {
      setStats(null)
      setYourTips(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [nextStats, given] = await Promise.all([readStats(), readTipsBy(address)])
      setStats(nextStats)
      setYourTips(given)
    } catch (cause) {
      setError(describeContractError(cause))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { stats, yourTips, loading, error, refresh }
}
