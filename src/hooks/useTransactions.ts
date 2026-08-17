import { useCallback, useEffect, useState } from 'react'

import { type PaymentRecord, describeError, getPaymentHistory } from '../lib/stellar'

export interface TransactionsState {
  data: PaymentRecord[] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Payment history for one account, straight from Horizon.
 *
 * `data` stays null until the first load resolves, so the UI can tell
 * "not loaded yet" apart from "loaded, and there is genuinely nothing here" —
 * they need different empty states.
 */
export function useTransactions(address: string | null, limit = 50): TransactionsState {
  const [data, setData] = useState<PaymentRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setData(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setData(await getPaymentHistory(address, limit))
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setLoading(false)
    }
  }, [address, limit])

  useEffect(() => {
    setData(null)
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
