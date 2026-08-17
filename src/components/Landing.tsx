import { CONTRACT_ID, explorerContractUrl } from '../lib/tipjar'
import { shortenAddress } from '../lib/stellar'

interface LandingProps {
  connecting: boolean
  onConnect: () => void
}

const STEPS = [
  'Install the Freighter browser extension and create a wallet.',
  'Switch the network inside Freighter to Testnet.',
  'Connect here, fund your account with the faucet, then send XLM or tip the contract.',
]

export function Landing({ connecting, onConnect }: LandingProps) {
  return (
    <section className="landing">
      <h1 className="landing__title">Send XLM and tip a smart contract</h1>
      <p className="landing__lead">
        Connect your Freighter wallet to make a real payment on the Stellar testnet, or tip a Soroban
        contract deployed on-chain — no real funds involved.
      </p>

      <button type="button" className="btn btn--primary btn--lg" onClick={onConnect} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect Freighter'}
      </button>

      <ol className="landing__steps">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span className="landing__step-index">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <p className="text-muted">
        Tip jar contract{' '}
        <a href={explorerContractUrl()} target="_blank" rel="noreferrer">
          {shortenAddress(CONTRACT_ID, 6)} ↗
        </a>{' '}
        — live on Stellar testnet.
      </p>
    </section>
  )
}
