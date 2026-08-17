import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import { markOnboardingComplete } from '../lib/onboarding'
import {
  BASE_RESERVE_XLM,
  describeError,
  formatXlmAmount,
  fundWithFriendbot,
  shortenAddress,
} from '../lib/stellar'

const TOTAL_STEPS = 3

export function OnboardingPage() {
  const { wallet, balance, connected } = useWalletContext()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [funding, setFunding] = useState(false)

  if (!connected || !wallet.address) return <Navigate to="/" replace />

  const address = wallet.address
  const funded = balance.data?.funded ?? false

  const finish = () => {
    markOnboardingComplete(address)
    navigate('/dashboard', { replace: true })
  }

  const fund = async () => {
    setFunding(true)
    try {
      await fundWithFriendbot(address)
      await balance.refresh()
      toast.push({
        tone: 'success',
        title: 'Account funded',
        detail: 'Friendbot sent you test XLM.',
      })
    } catch (cause) {
      toast.push({ tone: 'error', title: 'Funding failed', detail: describeError(cause) })
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__head">
          <div className="brand brand--compact">
            <span className="brand__mark" aria-hidden="true">
              ✦
            </span>
            <span className="brand__name">Stellar Pay</span>
          </div>
          <button type="button" className="link" onClick={finish}>
            Skip
          </button>
        </div>

        <div className="onboarding__progress" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span key={index} className={`onboarding__dot ${index <= step ? 'is-active' : ''}`} />
          ))}
        </div>

        {step === 0 ? (
          <StepWelcome />
        ) : step === 1 ? (
          <StepIdentity address={address} network={wallet.network} onTestnet={wallet.onTestnet} />
        ) : (
          <StepReady
            balance={balance.data?.xlm ?? null}
            loading={balance.loading}
            funded={funded}
            funding={funding}
            onFund={() => void fund()}
          />
        )}

        <div className="onboarding__actions">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button variant="primary" onClick={() => setStep((value) => value + 1)}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              Go to dashboard
            </Button>
          )}
        </div>
      </div>

      <p className="onboarding__foot text-muted">
        Step {step + 1} of {TOTAL_STEPS} · Stellar Testnet
      </p>
    </div>
  )
}

function StepWelcome() {
  return (
    <div className="onboarding__step">
      <span className="onboarding__icon" aria-hidden="true">
        ✦
      </span>
      <h1 className="onboarding__title">Welcome to Stellar Pay</h1>
      <p className="onboarding__body">
        A place to send and receive XLM on the Stellar test network. Everything here runs against
        the real testnet ledger, so every payment you make is genuinely recorded on-chain — just
        with tokens that carry no real value.
      </p>
    </div>
  )
}

function StepIdentity({
  address,
  network,
  onTestnet,
}: {
  address: string
  network: string | null
  onTestnet: boolean
}) {
  return (
    <div className="onboarding__step">
      <span className="onboarding__icon" aria-hidden="true">
        ◉
      </span>
      <h1 className="onboarding__title">Your wallet is your account</h1>
      <p className="onboarding__body">
        There is no signup and no password. Your Stellar address identifies you, and Freighter keeps
        the keys. Disconnect whenever you like — nothing is stored on a server.
      </p>

      <div className="onboarding__detail">
        <div className="onboarding__row">
          <span className="label">Your address</span>
          <div className="address">
            <code>{shortenAddress(address, 8)}</code>
            <CopyButton value={address} />
          </div>
        </div>

        <div className="onboarding__row">
          <span className="label">Network</span>
          <span className={`network-badge ${onTestnet ? '' : 'network-badge--warn'}`}>
            <span className="network-badge__dot" aria-hidden="true" />
            {onTestnet ? 'Stellar Testnet' : (network ?? 'Unknown')}
          </span>
        </div>
      </div>

      {!onTestnet ? (
        <p className="text-warn">
          Switch Freighter to Testnet before sending anything, or transactions will fail.
        </p>
      ) : null}
    </div>
  )
}

function StepReady({
  balance,
  loading,
  funded,
  funding,
  onFund,
}: {
  balance: string | null
  loading: boolean
  funded: boolean
  funding: boolean
  onFund: () => void
}) {
  return (
    <div className="onboarding__step">
      <span className="onboarding__icon" aria-hidden="true">
        ↑
      </span>
      <h1 className="onboarding__title">
        {funded ? "You're ready to send XLM" : 'Fund your account to get started'}
      </h1>
      <p className="onboarding__body">
        {funded
          ? 'Your account is active on testnet and holds a balance. You can send a payment, share your address to receive one, or tip the Soroban contract.'
          : 'New Stellar accounts start empty and need a minimum balance before they exist on the ledger. Friendbot is the testnet faucet — it will send you test XLM.'}
      </p>

      <div className="onboarding__detail">
        <div className="onboarding__row">
          <span className="label">Balance</span>
          <span className="onboarding__balance">
            {loading && balance === null ? (
              <Skeleton width="6ch" />
            ) : (
              <>
                {formatXlmAmount(balance ?? '0')} <span className="unit">XLM</span>
              </>
            )}
          </span>
        </div>

        {funded ? (
          <p className="text-muted">
            {BASE_RESERVE_XLM} XLM stays locked as the account reserve and cannot be sent.
          </p>
        ) : (
          <Button variant="primary" onClick={onFund} loading={funding} block>
            {funding ? 'Requesting test XLM' : 'Fund with Friendbot (testnet)'}
          </Button>
        )}
      </div>
    </div>
  )
}
