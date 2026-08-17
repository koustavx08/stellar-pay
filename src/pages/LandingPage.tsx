import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'
import { useWalletContext } from '../context/WalletProvider'
import { CONTRACT_ID, explorerContractUrl } from '../lib/tipjar'
import { hasCompletedOnboarding } from '../lib/onboarding'
import { shortenAddress } from '../lib/stellar'

const STEPS = [
  {
    title: 'Connect Freighter',
    body: 'Your wallet is your account. No email, no password, no signup form.',
  },
  {
    title: 'Fund from the faucet',
    body: 'New testnet accounts start empty. One click gets you test XLM to work with.',
  },
  {
    title: 'Send and receive',
    body: 'Transfer XLM to any Stellar address and watch it settle in seconds.',
  },
]

const FEATURES = [
  {
    icon: '↑',
    title: 'Payments in seconds',
    body: 'Stellar settles in about five seconds for a fraction of a cent, so a transfer feels immediate rather than pending.',
  },
  {
    icon: '◉',
    title: 'You hold the keys',
    body: 'Keys never leave Freighter. This app builds a transaction and asks your wallet to sign it — nothing more.',
  },
  {
    icon: '≡',
    title: 'Real transaction history',
    body: 'Every payment is read back from the Stellar ledger, with a hash you can verify on a public explorer.',
  },
  {
    icon: '◈',
    title: 'A live smart contract',
    body: 'The tip jar is a Soroban contract written in Rust and deployed to testnet, not a simulated demo.',
  },
]

export function LandingPage() {
  const { wallet, connected } = useWalletContext()
  const navigate = useNavigate()

  // A returning wallet should not have to re-click through the landing page.
  useEffect(() => {
    if (!connected || !wallet.address) return
    navigate(hasCompletedOnboarding(wallet.address) ? '/dashboard' : '/onboarding', {
      replace: true,
    })
  }, [connected, wallet.address, navigate])

  const connecting = wallet.status === 'connecting'

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            ✦
          </span>
          <span className="brand__name">Stellar Pay</span>
        </div>

        <div className="landing__nav-actions">
          <span className="network-badge">
            <span className="network-badge__dot" aria-hidden="true" />
            Stellar Testnet
          </span>
          <Button variant="primary" onClick={() => void wallet.connect()} loading={connecting}>
            {connecting ? 'Connecting' : 'Connect Wallet'}
          </Button>
        </div>
      </header>

      <section className="hero">
        <div className="hero__content">
          <span className="pill">Built on Stellar</span>
          <h1 className="hero__title">Simple, fast payments powered by Stellar.</h1>
          <p className="hero__lead">
            Send and receive XLM with a wallet you control. Stellar Pay turns your Freighter wallet
            into an account — connect once and start moving value in seconds.
          </p>

          <div className="hero__actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => void wallet.connect()}
              loading={connecting}
            >
              {connecting ? 'Connecting' : 'Connect Wallet'}
            </Button>
            <a className="btn btn--ghost btn--lg" href="#how-it-works">
              How it works
            </a>
          </div>

          <p className="hero__note">
            Runs on the Stellar test network. No real funds are ever involved.
          </p>
        </div>

        {/*
          Decorative product illustration, not account data. It is labelled
          "Preview" and hidden from assistive tech so it can never be mistaken
          for a real balance or a real transaction.
        */}
        <div className="hero__panel" aria-hidden="true">
          <div className="preview-card">
            <div className="preview-card__head">
              <span className="label">Available balance</span>
              <span className="pill pill--muted">Preview</span>
            </div>
            <p className="preview-card__amount">
              1,250.00 <span>XLM</span>
            </p>
            <div className="preview-card__row">
              <span className="preview-card__avatar" />
              <div>
                <p className="preview-card__label">Sent to</p>
                <code>GBNV…G2PW</code>
              </div>
              <span className="status status--ok">Success</span>
            </div>
            <div className="preview-card__row">
              <span className="preview-card__avatar" />
              <div>
                <p className="preview-card__label">Received from</p>
                <code>GAH4…JTJN</code>
              </div>
              <span className="status status--ok">Success</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing__section" id="how-it-works">
        <div className="section-head">
          <h2 className="section-title">How it works</h2>
          <p className="section-lead">Three steps from wallet to first payment.</p>
        </div>

        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="steps__item">
              <span className="steps__index">{index + 1}</span>
              <h3 className="steps__title">{step.title}</h3>
              <p className="steps__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing__section">
        <div className="section-head">
          <h2 className="section-title">What you get</h2>
          <p className="section-lead">
            A payments product built on real Stellar infrastructure, not a mock-up.
          </p>
        </div>

        <div className="features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature">
              <span className="feature__icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3 className="feature__title">{feature.title}</h3>
              <p className="feature__body">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing__section">
        <div className="custody">
          <div>
            <h2 className="section-title">Self-custody by default</h2>
            <p className="custody__body">
              Stellar Pay never asks for a private key, seed phrase, or password, and has no server
              holding your funds. Transactions are assembled in your browser and handed to Freighter
              for signing — you approve every single one, and you can disconnect at any time.
            </p>
            <ul className="custody__list">
              <li>Keys stay in your wallet extension</li>
              <li>Every transaction needs your explicit approval</li>
              <li>No account data is stored on any server</li>
            </ul>
          </div>

          <div className="custody__aside">
            <p className="label">Soroban tip jar contract</p>
            <a href={explorerContractUrl()} target="_blank" rel="noreferrer" className="custody__link">
              {shortenAddress(CONTRACT_ID, 6)} ↗
            </a>
            <p className="text-muted">
              Deployed to Stellar testnet and verifiable on a public block explorer.
            </p>
          </div>
        </div>
      </section>

      <footer className="landing__footer">
        <div className="brand brand--compact">
          <span className="brand__mark" aria-hidden="true">
            ✦
          </span>
          <span className="brand__name">Stellar Pay</span>
        </div>

        <p className="text-muted">Stellar Testnet · Horizon + Soroban + Freighter</p>

        <div className="landing__footer-links">
          <a href="https://developers.stellar.org/docs" target="_blank" rel="noreferrer">
            Stellar docs
          </a>
          <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
            Freighter
          </a>
          <Link to="/dashboard">Open app</Link>
        </div>
      </footer>
    </div>
  )
}
