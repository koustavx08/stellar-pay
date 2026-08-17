import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import { signXdr } from '../lib/freighter'
import {
  AMOUNT_PATTERN,
  BASE_RESERVE_XLM,
  MIN_CREATE_ACCOUNT_XLM,
  buildPaymentXdr,
  describeError,
  explorerTxUrl,
  formatXlmAmount,
  isValidAddress,
  normalizeAmount,
  shortenAddress,
  submitSignedXdr,
} from '../lib/stellar'

/** Matches the buffer the original form used so validation behaviour is unchanged. */
const FEE_BUFFER_XLM = 0.01
const MEMO_MAX_BYTES = 28

type Step = 'recipient' | 'amount' | 'review' | 'success'

interface Result {
  hash: string
  ledger?: number
  amount: string
  destination: string
  memo: string
}

const STEP_ORDER: Step[] = ['recipient', 'amount', 'review']

export function SendPage() {
  const { wallet, balance } = useWalletContext()
  const navigate = useNavigate()
  const toast = useToast()

  const address = wallet.address!
  const [step, setStep] = useState<Step>('recipient')
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'building' | 'signing' | 'submitting'>('idle')
  const [result, setResult] = useState<Result | null>(null)

  const funded = balance.data?.funded ?? false
  const spendable = Math.max(Number(balance.data?.xlm ?? '0') - BASE_RESERVE_XLM - FEE_BUFFER_XLM, 0)
  const busy = stage !== 'idle'

  const validateRecipient = (): string | null => {
    const to = destination.trim()
    if (!to) return 'Enter a destination address.'
    if (!isValidAddress(to)) return 'That is not a valid Stellar public key (it starts with G).'
    if (to === address) return 'You cannot send XLM to your own address.'
    return null
  }

  const validateAmount = (): string | null => {
    const trimmed = amount.trim()
    if (!trimmed || !AMOUNT_PATTERN.test(trimmed)) {
      return 'Enter the amount as a plain decimal number, for example 12.5.'
    }
    if ((trimmed.split('.')[1]?.length ?? 0) > 7) return 'XLM supports at most 7 decimal places.'

    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return 'Enter an amount greater than 0.'
    if (value > spendable) {
      return `You can send at most ${spendable.toFixed(7)} XLM (1 XLM reserve + fee stay in the account).`
    }
    if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) {
      return `The memo must be ${MEMO_MAX_BYTES} bytes or fewer.`
    }
    return null
  }

  const advance = () => {
    const problem = step === 'recipient' ? validateRecipient() : validateAmount()
    setError(problem)
    if (problem) return
    setStep(step === 'recipient' ? 'amount' : 'review')
  }

  const back = () => {
    setError(null)
    setStep(step === 'review' ? 'amount' : 'recipient')
  }

  const submit = async () => {
    // Guard against a double click landing two payments on the network.
    if (busy) return

    const to = destination.trim()
    setError(null)

    try {
      const sending = normalizeAmount(amount)

      setStage('building')
      const xdr = await buildPaymentXdr({ source: address, destination: to, amount: sending, memo })

      setStage('signing')
      const signed = await signXdr(xdr, address)

      setStage('submitting')
      const { hash, ledger } = await submitSignedXdr(signed)

      setResult({ hash, ledger, amount: sending, destination: to, memo: memo.trim() })
      setStep('success')
      toast.push({ tone: 'success', title: 'Payment sent', detail: `${sending} XLM delivered.` })
      void balance.refresh()
    } catch (cause) {
      const message = describeError(cause)
      setError(message)
      toast.push({ tone: 'error', title: 'Payment failed', detail: message })
    } finally {
      setStage('idle')
    }
  }

  const reset = () => {
    setDestination('')
    setAmount('')
    setMemo('')
    setResult(null)
    setError(null)
    setStep('recipient')
  }

  if (step === 'success' && result) {
    return <SuccessView result={result} onSendAnother={reset} onDone={() => navigate('/dashboard')} />
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Send XLM" description="Transfer XLM to any Stellar testnet address." />

      <ol className="stepper" aria-label="Progress">
        {STEP_ORDER.map((name, index) => {
          const current = STEP_ORDER.indexOf(step)
          const state = index < current ? 'is-done' : index === current ? 'is-current' : ''
          return (
            <li key={name} className={`stepper__item ${state}`}>
              <span className="stepper__index">{index < current ? '✓' : index + 1}</span>
              <span className="stepper__label">
                {name === 'recipient' ? 'Recipient' : name === 'amount' ? 'Amount' : 'Review'}
              </span>
            </li>
          )
        })}
      </ol>

      {!funded ? (
        <Card>
          <p className="text-muted">
            Your account is not funded yet. Add test XLM from the dashboard before sending a
            payment.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </Button>
        </Card>
      ) : (
        <Card>
          {step === 'recipient' ? (
            <div className="form">
              <label className="field">
                <span className="label">Recipient address</span>
                <input
                  className="input"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="GABC…"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                />
                <span className="field__hint">
                  A Stellar public key, 56 characters starting with G. New accounts need at least{' '}
                  {MIN_CREATE_ACCOUNT_XLM} XLM to be created.
                </span>
              </label>

              {error ? <p className="text-error">{error}</p> : null}

              <Button variant="primary" onClick={advance} block>
                Continue
              </Button>
            </div>
          ) : step === 'amount' ? (
            <div className="form">
              <div className="review__line">
                <span className="label">To</span>
                <code>{shortenAddress(destination.trim(), 6)}</code>
              </div>

              <label className="field">
                <span className="label">
                  Amount
                  <button
                    type="button"
                    className="link"
                    onClick={() => setAmount(spendable.toFixed(7))}
                    disabled={spendable <= 0}
                  >
                    Max {spendable.toFixed(2)}
                  </button>
                </span>
                <div className="input-group">
                  <input
                    className="input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    autoFocus
                  />
                  <span className="input-group__suffix">XLM</span>
                </div>
                <span className="field__hint">
                  {formatXlmAmount(String(spendable))} XLM available after the{' '}
                  {BASE_RESERVE_XLM} XLM reserve and network fee.
                </span>
              </label>

              <label className="field">
                <span className="label">Memo (optional)</span>
                <input
                  className="input"
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="Invoice 042"
                  maxLength={MEMO_MAX_BYTES}
                />
                <span className="field__hint">Public note attached to the transaction.</span>
              </label>

              {error ? <p className="text-error">{error}</p> : null}

              <div className="form__actions">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button variant="primary" onClick={advance}>
                  Review payment
                </Button>
              </div>
            </div>
          ) : (
            <div className="form">
              <div className="review">
                <p className="review__amount">
                  {formatXlmAmount(amount.trim())} <span className="unit">XLM</span>
                </p>

                <div className="review__line">
                  <span className="label">To</span>
                  <code title={destination.trim()}>{shortenAddress(destination.trim(), 8)}</code>
                </div>
                <div className="review__line">
                  <span className="label">From</span>
                  <code title={address}>{shortenAddress(address, 8)}</code>
                </div>
                {memo.trim() ? (
                  <div className="review__line">
                    <span className="label">Memo</span>
                    <span>{memo.trim()}</span>
                  </div>
                ) : null}
                <div className="review__line">
                  <span className="label">Network</span>
                  <span>Stellar Testnet</span>
                </div>
                <div className="review__line">
                  <span className="label">Network fee</span>
                  {/* BASE_FEE is 100 stroops per operation; this payment has one. */}
                  <span>0.00001 XLM</span>
                </div>
              </div>

              <p className="review__warning">
                Stellar payments are irreversible. Check the recipient address before confirming.
              </p>

              {error ? <p className="text-error">{error}</p> : null}

              <div className="form__actions">
                <Button variant="ghost" onClick={back} disabled={busy}>
                  Back
                </Button>
                <Button variant="primary" onClick={() => void submit()} loading={busy}>
                  {stage === 'building'
                    ? 'Building transaction'
                    : stage === 'signing'
                      ? 'Waiting for Freighter'
                      : stage === 'submitting'
                        ? 'Submitting'
                        : 'Confirm and send'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function SuccessView({
  result,
  onSendAnother,
  onDone,
}: {
  result: Result
  onSendAnother: () => void
  onDone: () => void
}) {
  return (
    <div className="page page--narrow">
      <Card className="success">
        <span className="success__icon" aria-hidden="true">
          ✓
        </span>
        <h1 className="success__title">Payment sent successfully</h1>
        <p className="success__amount">
          {formatXlmAmount(result.amount)} <span className="unit">XLM</span>
        </p>

        <div className="review">
          <div className="review__line">
            <span className="label">To</span>
            <code title={result.destination}>{shortenAddress(result.destination, 8)}</code>
          </div>
          {result.memo ? (
            <div className="review__line">
              <span className="label">Memo</span>
              <span>{result.memo}</span>
            </div>
          ) : null}
          {result.ledger ? (
            <div className="review__line">
              <span className="label">Ledger</span>
              <span>{result.ledger}</span>
            </div>
          ) : null}
        </div>

        <div className="field-row">
          <span className="label">Transaction hash</span>
          <div className="address">
            <code>{result.hash}</code>
            <CopyButton value={result.hash} />
          </div>
        </div>

        <div className="form__actions form__actions--stack">
          <a
            className="btn btn--secondary"
            href={explorerTxUrl(result.hash)}
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Explorer ↗
          </a>
          <Button variant="primary" onClick={onSendAnother}>
            Send another payment
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Back to dashboard
          </Button>
        </div>

        <Link to="/activity" className="link">
          See it in your activity
        </Link>
      </Card>
    </div>
  )
}
