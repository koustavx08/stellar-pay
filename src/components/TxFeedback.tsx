import { Alert } from './Alert'
import { CopyButton } from './CopyButton'
import { explorerTxUrl, shortenAddress } from '../lib/stellar'

export type TxOutcome =
  | {
      status: 'success'
      hash: string
      ledger: number
      amount: string
      destination: string
      memo?: string
    }
  | { status: 'error'; message: string }

interface TxFeedbackProps {
  outcome: TxOutcome
  onDismiss: () => void
}

export function TxFeedback({ outcome, onDismiss }: TxFeedbackProps) {
  if (outcome.status === 'error') {
    return (
      <Alert tone="error" title="Transaction failed" onDismiss={onDismiss}>
        <p>{outcome.message}</p>
      </Alert>
    )
  }

  return (
    <Alert tone="success" title="Payment sent" onDismiss={onDismiss}>
      <p>
        Sent <strong>{outcome.amount} XLM</strong> to{' '}
        <code>{shortenAddress(outcome.destination, 6)}</code>
        {outcome.memo ? (
          <>
            {' '}
            with memo <em>“{outcome.memo}”</em>
          </>
        ) : null}
        , included in ledger {outcome.ledger}.
      </p>

      <div className="tx-hash">
        <span className="label">Transaction hash</span>
        <div className="address">
          <code>{outcome.hash}</code>
          <CopyButton value={outcome.hash} />
        </div>
      </div>

      <a className="btn btn--ghost btn--sm" href={explorerTxUrl(outcome.hash)} target="_blank" rel="noreferrer">
        View on Stellar Expert ↗
      </a>
    </Alert>
  )
}
