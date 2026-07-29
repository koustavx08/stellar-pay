import { useState } from 'react'

import { CopyButton } from './CopyButton'
import type { BalanceState } from '../hooks/useBalance'
import {
  BASE_RESERVE_XLM,
  describeError,
  explorerAccountUrl,
  fundWithFriendbot,
} from '../lib/stellar'

interface WalletPanelProps {
  address: string
  balance: BalanceState
}

export function WalletPanel({ address, balance }: WalletPanelProps) {
  const [funding, setFunding] = useState(false)
  const [fundError, setFundError] = useState<string | null>(null)

  const fund = async () => {
    setFunding(true)
    setFundError(null)
    try {
      await fundWithFriendbot(address)
      await balance.refresh()
    } catch (cause) {
      setFundError(describeError(cause))
    } finally {
      setFunding(false)
    }
  }

  const amount = balance.data?.xlm ?? '0'
  const spendable = Math.max(Number(amount) - BASE_RESERVE_XLM, 0)

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Wallet</h2>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void balance.refresh()}
          disabled={balance.loading}
        >
          {balance.loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="field-row">
        <span className="label">Address</span>
        <div className="address">
          <code>{address}</code>
          <CopyButton value={address} />
        </div>
      </div>

      <div className="balance">
        <span className="label">XLM balance</span>
        <p className="balance__amount">
          {balance.loading && !balance.data ? (
            <span className="skeleton" />
          ) : (
            <>
              {formatXlm(amount)} <span className="balance__unit">XLM</span>
            </>
          )}
        </p>
        {balance.data?.funded ? (
          <p className="balance__hint">
            {formatXlm(String(spendable))} XLM spendable · {BASE_RESERVE_XLM} XLM locked as account
            reserve
          </p>
        ) : null}
      </div>

      {balance.error ? <p className="text-error">{balance.error}</p> : null}

      {balance.data && !balance.data.funded ? (
        <p className="text-muted">
          This account does not exist on testnet yet. Fund it with the faucet to activate it.
        </p>
      ) : null}

      {fundError ? <p className="text-error">{fundError}</p> : null}

      <div className="card__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void fund()}
          disabled={funding || balance.data?.funded === true}
        >
          {funding ? 'Requesting…' : 'Fund with Friendbot'}
        </button>
        <a
          className="btn btn--ghost"
          href={explorerAccountUrl(address)}
          target="_blank"
          rel="noreferrer"
        >
          View on explorer ↗
        </a>
      </div>
    </section>
  )
}

export function formatXlm(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '0'
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 7 })
}
