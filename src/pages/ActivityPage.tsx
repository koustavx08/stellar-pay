import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { TransactionRow } from '../components/TransactionRow'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/States'
import { useWalletContext } from '../context/WalletProvider'
import { useTransactions } from '../hooks/useTransactions'
import { formatTimestamp } from '../lib/stellar'

type Filter = 'all' | 'sent' | 'received'

export function ActivityPage() {
  const { wallet, balance } = useWalletContext()
  const address = wallet.address!
  const transactions = useTransactions(address)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    if (!transactions.data) return null
    if (filter === 'all') return transactions.data
    return transactions.data.filter((record) => record.direction === filter)
  }, [transactions.data, filter])

  /** Groups records under a date heading so a long list stays scannable. */
  const grouped = useMemo(() => {
    if (!visible) return null
    const groups = new Map<string, typeof visible>()

    for (const record of visible) {
      const day = new Date(record.createdAt).toDateString()
      const bucket = groups.get(day)
      if (bucket) bucket.push(record)
      else groups.set(day, [record])
    }

    return [...groups.entries()]
  }, [visible])

  const funded = balance.data?.funded ?? false

  return (
    <div className="page">
      <PageHeader
        title="Activity"
        description="Every payment this account has sent or received on testnet."
        action={
          <Button variant="ghost" onClick={() => void transactions.refresh()} loading={transactions.loading}>
            Refresh
          </Button>
        }
      />

      <div className="filters" role="tablist" aria-label="Filter transactions">
        {(['all', 'sent', 'received'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            className={`filters__tab ${filter === option ? 'is-active' : ''}`}
            onClick={() => setFilter(option)}
          >
            {option === 'all' ? 'All' : option === 'sent' ? 'Sent' : 'Received'}
          </button>
        ))}
      </div>

      <Card>
        {transactions.loading && !transactions.data ? (
          <SkeletonRows rows={6} />
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
        ) : grouped && grouped.length > 0 ? (
          <div className="tx-groups">
            {grouped.map(([day, records]) => (
              <div key={day} className="tx-group">
                <p className="tx-group__label">{formatTimestamp(records[0].createdAt).split(',')[0]}</p>
                <div className="tx-list">
                  {records.map((record) => (
                    <TransactionRow key={record.id} record={record} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filter !== 'all' ? (
          <EmptyState
            icon="≡"
            title={`No ${filter} payments`}
            description="Try a different filter to see the rest of your activity."
            action={
              <Button variant="ghost" onClick={() => setFilter('all')}>
                Show all
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="≡"
            title="No transactions yet"
            description={
              funded
                ? 'Once you send or receive XLM, it will show up here with a link to the ledger.'
                : 'This account is not active on testnet yet. Fund it, then make your first payment.'
            }
            action={
              <Button variant="primary" onClick={() => navigate(funded ? '/send' : '/dashboard')}>
                {funded ? 'Send a payment' : 'Go to dashboard'}
              </Button>
            }
          />
        )}
      </Card>

      {transactions.data && transactions.data.length >= 50 ? (
        <p className="text-muted">
          Showing the 50 most recent payments. Older history is available on the block explorer.
        </p>
      ) : null}
    </div>
  )
}
