import { type FormEvent, useState } from 'react'

import type { TxOutcome } from './TxFeedback'
import { signXdr } from '../lib/freighter'
import { AMOUNT_PATTERN, BASE_RESERVE_XLM, shortenAddress } from '../lib/stellar'
import {
  CONTRACT_ID,
  MAX_TIP_MESSAGE,
  buildTipXdr,
  describeContractError,
  explorerContractUrl,
  submitTip,
} from '../lib/tipjar'
import type { TipJarState } from '../hooks/useTipJar'

/** Rough allowance for fees, which are higher for contract calls than plain payments. */
const FEE_BUFFER_XLM = 0.5

type Stage = 'idle' | 'building' | 'signing' | 'submitting'

const STAGE_LABEL: Record<Exclude<Stage, 'idle'>, string> = {
  building: 'Simulating call…',
  signing: 'Waiting for Freighter…',
  submitting: 'Invoking contract…',
}

interface TipJarPanelProps {
  address: string
  balance: string
  funded: boolean
  disabled: boolean
  jar: TipJarState
  onResult: (outcome: TxOutcome) => void
  onSettled: () => void
}

export function TipJarPanel({
  address,
  balance,
  funded,
  disabled,
  jar,
  onResult,
  onSettled,
}: TipJarPanelProps) {
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)

  const spendable = Math.max(Number(balance) - BASE_RESERVE_XLM - FEE_BUFFER_XLM, 0)
  const busy = stage !== 'idle'

  const validate = (): string | null => {
    const trimmed = amount.trim()
    if (!trimmed || !AMOUNT_PATTERN.test(trimmed)) {
      return 'Enter the tip as a plain decimal number, for example 5.'
    }
    if ((trimmed.split('.')[1]?.length ?? 0) > 7) {
      return 'XLM supports at most 7 decimal places.'
    }

    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return 'Enter a tip greater than 0.'
    if (value > spendable) {
      return `You can tip at most ${spendable.toFixed(4)} XLM (reserve and contract fees stay behind).`
    }
    if (message.length > MAX_TIP_MESSAGE) {
      return `Your message must be ${MAX_TIP_MESSAGE} characters or fewer.`
    }
    return null
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    const problem = validate()
    setValidationError(problem)
    if (problem) return

    try {
      setStage('building')
      const xdr = await buildTipXdr(address, amount, message)

      setStage('signing')
      const signed = await signXdr(xdr, address)

      setStage('submitting')
      const { hash } = await submitTip(signed)

      onResult({
        status: 'success',
        hash,
        amount: amount.trim(),
        destination: CONTRACT_ID,
        memo: message.trim(),
        kind: 'contract',
      })
      setAmount('')
      setMessage('')
    } catch (cause) {
      onResult({ status: 'error', message: describeContractError(cause) })
    } finally {
      setStage('idle')
      onSettled()
      void jar.refresh()
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Tip jar</h2>
        <span className="tag">Soroban contract</span>
      </div>

      <p className="text-muted">
        This one does not send a plain payment. It calls the <code>tip</code> function on a Soroban
        contract deployed to testnet, which pulls the XLM in and records who gave what on-chain.
      </p>

      <dl className="stats">
        <div className="stat">
          <dt className="stat__label">Total tipped</dt>
          <dd className="stat__value">{jar.stats ? `${jar.stats.totalTips} XLM` : '—'}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Tips received</dt>
          <dd className="stat__value">{jar.stats ? jar.stats.tipCount : '—'}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">In the jar</dt>
          <dd className="stat__value">{jar.stats ? `${jar.stats.balance} XLM` : '—'}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">You tipped</dt>
          <dd className="stat__value">{jar.yourTips ? `${jar.yourTips} XLM` : '—'}</dd>
        </div>
      </dl>

      {jar.stats?.lastMessage ? (
        <p className="quote">“{jar.stats.lastMessage}”</p>
      ) : null}

      {jar.error ? <p className="text-error">{jar.error}</p> : null}

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="label">
            Tip amount
            <button
              type="button"
              className="link"
              onClick={() => setAmount(spendable.toFixed(4))}
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
          <span className="label">Message (optional)</span>
          <input
            className="input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Nice work!"
            maxLength={MAX_TIP_MESSAGE}
            disabled={disabled || busy}
          />
        </label>

        {validationError ? <p className="text-error">{validationError}</p> : null}

        {!funded ? <p className="text-muted">Fund your account before tipping.</p> : null}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={disabled || busy || !funded}
        >
          {busy ? STAGE_LABEL[stage] : 'Send tip via contract'}
        </button>
      </form>

      <p className="text-muted">
        Contract{' '}
        <a href={explorerContractUrl()} target="_blank" rel="noreferrer">
          {shortenAddress(CONTRACT_ID, 6)} ↗
        </a>
      </p>
    </section>
  )
}
