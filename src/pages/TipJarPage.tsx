import { type FormEvent, useState } from 'react'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import { useTipJar } from '../hooks/useTipJar'
import { signXdr } from '../lib/freighter'
import {
  AMOUNT_PATTERN,
  BASE_RESERVE_XLM,
  explorerTxUrl,
  formatXlmAmount,
  shortenAddress,
} from '../lib/stellar'
import {
  CONTRACT_ID,
  MAX_TIP_MESSAGE,
  buildTipXdr,
  describeContractError,
  explorerContractUrl,
  submitTip,
} from '../lib/tipjar'

/** Contract calls cost more than a plain payment, so the buffer is larger. */
const FEE_BUFFER_XLM = 0.5

type Stage = 'idle' | 'building' | 'signing' | 'submitting'

export function TipJarPage() {
  const { wallet, balance } = useWalletContext()
  const address = wallet.address!
  const jar = useTipJar(address)
  const toast = useToast()

  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const funded = balance.data?.funded ?? false
  const spendable = Math.max(Number(balance.data?.xlm ?? '0') - BASE_RESERVE_XLM - FEE_BUFFER_XLM, 0)
  const busy = stage !== 'idle'

  const validate = (): string | null => {
    const trimmed = amount.trim()
    if (!trimmed || !AMOUNT_PATTERN.test(trimmed)) {
      return 'Enter the tip as a plain decimal number, for example 5.'
    }
    if ((trimmed.split('.')[1]?.length ?? 0) > 7) return 'XLM supports at most 7 decimal places.'

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
    if (busy) return

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

      setLastHash(hash)
      setAmount('')
      setMessage('')
      toast.push({ tone: 'success', title: 'Tip sent', detail: 'The contract recorded your tip.' })
      void balance.refresh()
    } catch (cause) {
      const detail = describeContractError(cause)
      toast.push({ tone: 'error', title: 'Tip failed', detail })
      setValidationError(detail)
    } finally {
      setStage('idle')
      void jar.refresh()
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Tip Jar"
        description="A Soroban smart contract deployed on Stellar testnet."
        action={
          <Button variant="ghost" onClick={() => void jar.refresh()} loading={jar.loading}>
            Refresh
          </Button>
        }
      />

      <Card>
        <p className="text-muted">
          This is not a plain payment. It calls the <code>tip</code> function on a Rust smart
          contract, which pulls the XLM in and records who gave what on-chain.
        </p>

        <div className="stats">
          <div className="stat">
            <dt className="stat__label">In the jar</dt>
            <dd className="stat__value">
              {jar.stats ? `${formatXlmAmount(jar.stats.balance)} XLM` : <Skeleton width="6ch" />}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Total tipped</dt>
            <dd className="stat__value">
              {jar.stats ? `${formatXlmAmount(jar.stats.totalTips)} XLM` : <Skeleton width="6ch" />}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Tips received</dt>
            <dd className="stat__value">
              {jar.stats ? jar.stats.tipCount : <Skeleton width="3ch" />}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat__label">You tipped</dt>
            <dd className="stat__value">
              {jar.yourTips !== null ? `${formatXlmAmount(jar.yourTips)} XLM` : <Skeleton width="6ch" />}
            </dd>
          </div>
        </div>

        {jar.error ? (
          <ErrorState
            title="Could not read the contract"
            message={jar.error}
            action={
              <Button variant="secondary" onClick={() => void jar.refresh()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {jar.stats?.lastMessage ? (
          <div className="quote-block">
            <span className="label">Latest message</span>
            <p className="quote">“{jar.stats.lastMessage}”</p>
          </div>
        ) : jar.stats ? (
          <EmptyState icon="◈" title="No messages yet" description="Be the first to leave one." />
        ) : null}
      </Card>

      <Card title="Send a tip">
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span className="label">
              Amount
              <button
                type="button"
                className="link"
                onClick={() => setAmount(spendable.toFixed(4))}
                disabled={busy || spendable <= 0}
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
                disabled={busy || !funded}
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
              disabled={busy || !funded}
            />
            <span className="field__hint">
              Stored on-chain, up to {MAX_TIP_MESSAGE} characters.
            </span>
          </label>

          {validationError ? <p className="text-error">{validationError}</p> : null}

          {!funded ? (
            <p className="text-muted">Fund your account before tipping.</p>
          ) : null}

          <Button type="submit" variant="primary" block loading={busy} disabled={!funded}>
            {stage === 'building'
              ? 'Simulating call'
              : stage === 'signing'
                ? 'Waiting for Freighter'
                : stage === 'submitting'
                  ? 'Invoking contract'
                  : 'Send tip via contract'}
          </Button>
        </form>

        {lastHash ? (
          <div className="tip-receipt">
            <span className="label">Last tip transaction</span>
            <div className="address">
              <code>{lastHash}</code>
              <CopyButton value={lastHash} />
            </div>
            <a
              className="btn btn--ghost btn--sm"
              href={explorerTxUrl(lastHash)}
              target="_blank"
              rel="noreferrer"
            >
              View on Stellar Explorer ↗
            </a>
          </div>
        ) : null}
      </Card>

      <Card title="Contract">
        <div className="field-row">
          <span className="label">Contract ID</span>
          <div className="address">
            <code>{CONTRACT_ID}</code>
            <CopyButton value={CONTRACT_ID} />
          </div>
        </div>
        <a className="btn btn--ghost" href={explorerContractUrl()} target="_blank" rel="noreferrer">
          {shortenAddress(CONTRACT_ID, 6)} on explorer ↗
        </a>
      </Card>
    </div>
  )
}
