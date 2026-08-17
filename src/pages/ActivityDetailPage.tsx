import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader, StatusBadge } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/States'
import { useWalletContext } from '../context/WalletProvider'
import {
  type PaymentRecord,
  type TransactionDetail,
  describeError,
  explorerAccountUrl,
  explorerTxUrl,
  formatTimestamp,
  formatXlmAmount,
  getPaymentById,
  getTransactionDetail,
  shortenAddress,
} from '../lib/stellar'

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { wallet } = useWalletContext()
  const address = wallet.address!
  const navigate = useNavigate()

  const [record, setRecord] = useState<PaymentRecord | null>(null)
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true

    setLoading(true)
    setError(null)

    getPaymentById(id, address)
      .then(async (found) => {
        if (!active) return
        setRecord(found)
        // Ledger and fee live on the transaction, so fetch it only once we
        // know which transaction the operation belongs to.
        if (found) {
          const tx = await getTransactionDetail(found.hash)
          if (active) setDetail(tx)
        }
      })
      .catch((cause) => {
        if (active) setError(describeError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, address])

  const outgoing = record?.direction === 'sent'

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Transaction"
        description="Details as recorded on the Stellar ledger."
        action={
          <Button variant="ghost" onClick={() => navigate('/activity')}>
            Back to activity
          </Button>
        }
      />

      {loading ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState
            message={error}
            action={
              <Button variant="secondary" onClick={() => navigate('/activity')}>
                Back to activity
              </Button>
            }
          />
        </Card>
      ) : !record ? (
        <Card>
          <EmptyState
            icon="?"
            title="Transaction not found"
            description="This operation is not on the testnet ledger, or it is not a payment."
            action={
              <Link to="/activity" className="btn btn--primary">
                Back to activity
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="tx-detail">
          <div className="tx-detail__head">
            <span className={`tx-detail__icon ${outgoing ? 'is-out' : 'is-in'}`} aria-hidden="true">
              {outgoing ? '↑' : '↓'}
            </span>
            <p className="tx-detail__amount">
              {outgoing ? '−' : '+'}
              {formatXlmAmount(record.amount)} <span className="unit">{record.assetCode}</span>
            </p>
            {/* Horizon only returns operations from successfully applied
                transactions, so anything listed here has settled. */}
            <StatusBadge tone={detail?.successful === false ? 'error' : 'ok'}>
              {detail?.successful === false ? 'Failed' : 'Success'}
            </StatusBadge>
          </div>

          <dl className="detail-list">
            <DetailRow label="Type">
              {record.kind === 'create_account'
                ? 'Account creation'
                : outgoing
                  ? 'Payment sent'
                  : 'Payment received'}
            </DetailRow>

            <DetailRow label="From">
              <a
                href={explorerAccountUrl(record.from)}
                target="_blank"
                rel="noreferrer"
                className="detail-list__link"
              >
                <code title={record.from}>{shortenAddress(record.from, 8)}</code>
              </a>
            </DetailRow>

            <DetailRow label="To">
              <a
                href={explorerAccountUrl(record.to)}
                target="_blank"
                rel="noreferrer"
                className="detail-list__link"
              >
                <code title={record.to}>{shortenAddress(record.to, 8)}</code>
              </a>
            </DetailRow>

            <DetailRow label="Date">{formatTimestamp(record.createdAt)}</DetailRow>

            {detail ? <DetailRow label="Ledger">{detail.ledger}</DetailRow> : null}

            {detail?.feeCharged ? (
              <DetailRow label="Fee">
                {formatXlmAmount(String(Number(detail.feeCharged) / 10_000_000))} XLM
              </DetailRow>
            ) : null}

            {detail?.memo ? <DetailRow label="Memo">{detail.memo}</DetailRow> : null}

            <DetailRow label="Network">Stellar Testnet</DetailRow>
          </dl>

          <div className="field-row">
            <span className="label">Transaction hash</span>
            <div className="address">
              <code>{record.hash}</code>
              <CopyButton value={record.hash} />
            </div>
          </div>

          <a
            className="btn btn--secondary btn--block"
            href={explorerTxUrl(record.hash)}
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Explorer ↗
          </a>
        </Card>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-list__row">
      <dt className="detail-list__label">{label}</dt>
      <dd className="detail-list__value">{children}</dd>
    </div>
  )
}
