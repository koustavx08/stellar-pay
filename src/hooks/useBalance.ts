import { useCallback, useEffect, useState } from 'react'

import { type AccountBalance, describeError, getXlmBalance } from '../lib/stellar'

export interface BalanceState {
  data: AccountBalance | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useBalance(address: string | null): BalanceState {
  const [data, setData] = useState<AccountBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setData(await getXlmBalance(address))
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    setData(null)
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
