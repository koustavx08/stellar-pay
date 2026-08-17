import { Link } from 'react-router-dom'

import {
  type PaymentRecord,
  formatRelativeTime,
  formatXlmAmount,
  shortenAddress,
} from '../lib/stellar'

interface TransactionRowProps {
  record: PaymentRecord
}

export function TransactionRow({ record }: TransactionRowProps) {
  const outgoing = record.direction === 'sent'

  return (
    <Link to={`/activity/${record.id}`} className="tx-row">
      <span className={`tx-row__icon ${outgoing ? 'is-out' : 'is-in'}`} aria-hidden="true">
        {outgoing ? '↑' : '↓'}
      </span>

      <div className="tx-row__main">
        <p className="tx-row__title">
          {outgoing ? 'Sent' : 'Received'}
          {record.kind === 'create_account' ? (
            <span className="tx-row__tag">Account created</span>
          ) : null}
        </p>
        <p className="tx-row__meta">
          {outgoing ? 'To' : 'From'} <code>{shortenAddress(record.counterparty, 4)}</code>
        </p>
      </div>

      <div className="tx-row__side">
        <p className={`tx-row__amount ${outgoing ? 'is-out' : 'is-in'}`}>
          {outgoing ? '−' : '+'}
          {formatXlmAmount(record.amount)} {record.assetCode}
        </p>
        <p className="tx-row__time">{formatRelativeTime(record.createdAt)}</p>
      </div>
    </Link>
  )
}
