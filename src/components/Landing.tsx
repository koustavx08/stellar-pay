interface LandingProps {
  connecting: boolean
  onConnect: () => void
}

const STEPS = [
  'Install the Freighter browser extension and create a wallet.',
  'Switch the network inside Freighter to Testnet.',
  'Connect here, fund your account with the faucet, and send XLM.',
]

export function Landing({ connecting, onConnect }: LandingProps) {
  return (
    <section className="landing">
      <h1 className="landing__title">Send XLM on the Stellar testnet</h1>
      <p className="landing__lead">
        Connect your Freighter wallet to see your balance and make a real payment on testnet — no
        real funds involved.
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
    </section>
  )
}
