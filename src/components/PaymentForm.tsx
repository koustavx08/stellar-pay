import { type FormEvent, useState } from 'react'

import type { TxOutcome } from './TxFeedback'
import { signXdr } from '../lib/freighter'
import {
  AMOUNT_PATTERN,
  BASE_RESERVE_XLM,
  buildPaymentXdr,
  describeError,
  isValidAddress,
  normalizeAmount,
  submitSignedXdr,
} from '../lib/stellar'

/** Rough allowance for the network fee so the form does not offer the whole balance. */
const FEE_BUFFER_XLM = 0.01
const MEMO_MAX_BYTES = 28

type Stage = 'idle' | 'building' | 'signing' | 'submitting'

const STAGE_LABEL: Record<Exclude<Stage, 'idle'>, string> = {
  building: 'Building transaction…',
  signing: 'Waiting for Freighter…',
  submitting: 'Submitting to testnet…',
}

interface PaymentFormProps {
  address: string
  balance: string
  funded: boolean
  disabled: boolean
  onResult: (outcome: TxOutcome) => void
  onSettled: () => void
}

export function PaymentForm({
  address,
  balance,
  funded,
  disabled,
  onResult,
  onSettled,
}: PaymentFormProps) {
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)

  const spendable = Math.max(Number(balance) - BASE_RESERVE_XLM - FEE_BUFFER_XLM, 0)
  const busy = stage !== 'idle'

  const validate = (): string | null => {
    const to = destination.trim()
    if (!to) return 'Enter a destination address.'
    if (!isValidAddress(to)) return 'That is not a valid Stellar public key (it starts with G).'
    if (to === address) return 'You cannot send XLM to your own address.'

    const trimmedAmount = amount.trim()
    if (!trimmedAmount || !AMOUNT_PATTERN.test(trimmedAmount)) {
      return 'Enter the amount as a plain decimal number, for example 12.5.'
    }
    if ((trimmedAmount.split('.')[1]?.length ?? 0) > 7) {
      return 'XLM supports at most 7 decimal places.'
    }

    const value = Number(trimmedAmount)
    if (!Number.isFinite(value) || value <= 0) {
      return 'Enter an amount greater than 0.'
    }
    if (value > spendable) {
      return `You can send at most ${spendable.toFixed(7)} XLM (1 XLM reserve + fee stay in the account).`
    }
    if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) {
      return `The memo must be ${MEMO_MAX_BYTES} bytes or fewer.`
    }
    return null
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    const problem = validate()
    setValidationError(problem)
    if (problem) return

    const to = destination.trim()

    try {
      const sending = normalizeAmount(amount)

      setStage('building')
      const xdr = await buildPaymentXdr({ source: address, destination: to, amount: sending, memo })

      setStage('signing')
      const signed = await signXdr(xdr, address)

      setStage('submitting')
      const { hash, ledger } = await submitSignedXdr(signed)

      onResult({
        status: 'success',
        hash,
        ledger,
        amount: sending,
        destination: to,
        memo: memo.trim(),
      })
      setDestination('')
      setAmount('')
      setMemo('')
    } catch (cause) {
      onResult({ status: 'error', message: describeError(cause) })
    } finally {
      setStage('idle')
      onSettled()
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Send XLM</h2>
        <span className="tag">Testnet</span>
      </div>

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="label">Destination address</span>
          <input
            className="input"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="GABC…"
            spellCheck={false}
            autoComplete="off"
            disabled={disabled || busy}
          />
        </label>

        <label className="field">
          <span className="label">
            Amount
            <button
              type="button"
              className="link"
              onClick={() => setAmount(spendable.toFixed(7))}
              disabled={disabled || busy || spendable <= 0}
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
              disabled={disabled || busy}
            />
            <span className="input-group__suffix">XLM</span>
          </div>
        </label>

        <label className="field">
          <span className="label">Memo (optional)</span>
          <input
            className="input"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Thanks!"
            maxLength={MEMO_MAX_BYTES}
            disabled={disabled || busy}
          />
        </label>

        {validationError ? <p className="text-error">{validationError}</p> : null}

        {!funded ? (
          <p className="text-muted">Fund your account before sending your first payment.</p>
        ) : null}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={disabled || busy || !funded}
        >
          {busy ? STAGE_LABEL[stage] : 'Send payment'}
        </button>
      </form>
    </section>
  )
}
