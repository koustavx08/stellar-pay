import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { TransactionRow } from '../components/TransactionRow'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import { useTransactions } from '../hooks/useTransactions'
import {
  BASE_RESERVE_XLM,
  describeError,
  formatXlmAmount,
  fundWithFriendbot,
  shortenAddress,
} from '../lib/stellar'

const RECENT_LIMIT = 5

export function DashboardPage() {
  const { wallet, balance } = useWalletContext()
  const address = wallet.address!
  const transactions = useTransactions(address, RECENT_LIMIT)
  const toast = useToast()
  const navigate = useNavigate()
  const [funding, setFunding] = useState(false)

  const funded = balance.data?.funded ?? false
  const total = Number(balance.data?.xlm ?? '0')
  const spendable = Math.max(total - BASE_RESERVE_XLM, 0)

  const fund = async () => {
    setFunding(true)
    try {
      await fundWithFriendbot(address)
      await Promise.all([balance.refresh(), transactions.refresh()])
      toast.push({ tone: 'success', title: 'Account funded with test XLM' })
    } catch (cause) {
      toast.push({ tone: 'error', title: 'Funding failed', detail: describeError(cause) })
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Your Stellar testnet account at a glance."
        action={
          <Button
            variant="ghost"
            onClick={() => {
              void balance.refresh()
              void transactions.refresh()
            }}
            loading={balance.loading}
          >
            Refresh
          </Button>
        }
      />

      <section className="balance-card">
        <div className="balance-card__head">
          <span className="label">Available balance</span>
          <span className="network-badge network-badge--sm">
            <span className="network-badge__dot" aria-hidden="true" />
            Testnet
          </span>
        </div>

        <p className="balance-card__amount">
          {balance.loading && !balance.data ? (
            <Skeleton width="8ch" height="1em" />
          ) : (
            <>
              {formatXlmAmount(balance.data?.xlm ?? '0')} <span className="unit">XLM</span>
            </>
          )}
        </p>

        {/*
          No USD figure is shown: the app has no price feed, and inventing a
          conversion rate for a testnet token would be misleading.
        */}
        {funded ? (
          <p className="balance-card__hint">
            {formatXlmAmount(String(spendable))} XLM spendable · {BASE_RESERVE_XLM} XLM locked as
            account reserve
          </p>
        ) : balance.data ? (
          <p className="balance-card__hint">
            This account is not active on testnet yet. Fund it to get started.
          </p>
        ) : null}

        <div className="balance-card__foot">
          <div className="address address--plain">
            <code title={address}>{shortenAddress(address, 6)}</code>
            <CopyButton value={address} />
          </div>
        </div>

        {balance.error ? <p className="text-error">{balance.error}</p> : null}
      </section>

      <div className="quick-actions">
        <button type="button" className="quick-action" onClick={() => navigate('/send')}>
          <span className="quick-action__icon" aria-hidden="true">
            ↑
          </span>
          <span className="quick-action__label">Send</span>
        </button>

        <button type="button" className="quick-action" onClick={() => navigate('/receive')}>
          <span className="quick-action__icon" aria-hidden="true">
            ↓
          </span>
          <span className="quick-action__label">Receive</span>
        </button>

        <button
          type="button"
          className="quick-action"
          onClick={() => void fund()}
          disabled={funding || funded}
        >
          <span className="quick-action__icon" aria-hidden="true">
            {funding ? '…' : '+'}
          </span>
          <span className="quick-action__label">{funded ? 'Funded' : 'Fund'}</span>
        </button>

        <button type="button" className="quick-action" onClick={() => navigate('/tip-jar')}>
          <span className="quick-action__icon" aria-hidden="true">
            ◈
          </span>
          <span className="quick-action__label">Tip Jar</span>
        </button>
      </div>

      <Card
        title="Recent activity"
        action={
          <Link to="/activity" className="link">
            View all
          </Link>
        }
      >
        {transactions.loading && !transactions.data ? (
          <SkeletonRows rows={3} />
        ) : transactions.error ? (
          <ErrorState
            title="Could not load activity"
            message={transactions.error}
            action={
              <Button variant="secondary" onClick={() => void transactions.refresh()}>
                Try again
              </Button>
            }
          />
        ) : transactions.data && transactions.data.length > 0 ? (
          <div className="tx-list">
            {transactions.data.map((record) => (
              <TransactionRow key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="≡"
            title="No transactions yet"
            description={
              funded
                ? 'Payments you send and receive will appear here.'
                : 'Fund your account with the testnet faucet to make your first payment.'
            }
            action={
              funded ? (
                <Button variant="primary" onClick={() => navigate('/send')}>
                  Send a payment
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void fund()} loading={funding}>
                  Fund with Friendbot
                </Button>
              )
            }
          />
        )}
      </Card>
    </div>
  )
}
