import { Alert } from './Alert'
import { CopyButton } from './CopyButton'
import { explorerTxUrl, shortenAddress } from '../lib/stellar'

export type TxOutcome =
  | {
      status: 'success'
      hash: string
      /** Horizon reports the ledger inline; the Soroban RPC path does not. */
      ledger?: number
      amount: string
      destination: string
      memo?: string
      /** 'payment' is a classic Horizon operation, 'contract' a Soroban invocation. */
      kind?: 'payment' | 'contract'
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

  const isContract = outcome.kind === 'contract'

  return (
    <Alert tone="success" title={isContract ? 'Tip sent' : 'Payment sent'} onDismiss={onDismiss}>
      <p>
        {isContract ? 'Tipped' : 'Sent'} <strong>{outcome.amount} XLM</strong>{' '}
        {isContract ? 'through contract' : 'to'}{' '}
        <code>{shortenAddress(outcome.destination, 6)}</code>
        {outcome.memo ? (
          <>
            {' '}
            with {isContract ? 'message' : 'memo'} <em>“{outcome.memo}”</em>
          </>
        ) : null}
        {outcome.ledger ? `, included in ledger ${outcome.ledger}` : ''}.
      </p>

      <div className="tx-hash">
        <span className="label">Transaction hash</span>
        <div className="address">
          <code>{outcome.hash}</code>
          <CopyButton value={outcome.hash} />
        </div>
      </div>

      <a
        className="btn btn--ghost btn--sm"
        href={explorerTxUrl(outcome.hash)}
        target="_blank"
        rel="noreferrer"
      >
        View on Stellar Expert ↗
      </a>
    </Alert>
  )
}
