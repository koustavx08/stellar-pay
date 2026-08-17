import { shortenAddress } from '../lib/stellar'
import type { Wallet } from '../hooks/useWallet'

interface HeaderProps {
  wallet: Wallet
}

export function Header({ wallet }: HeaderProps) {
  const connected = wallet.status === 'connected' && wallet.address

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__mark" aria-hidden="true">
          ✦
        </span>
        <div>
          <p className="header__title">Stellar Pay</p>
          <p className="header__subtitle">Testnet payments + Soroban</p>
        </div>
      </div>

      <div className="header__actions">
        {wallet.network ? (
          <span className={`badge ${wallet.onTestnet ? 'badge--ok' : 'badge--warn'}`}>
            {wallet.network}
          </span>
        ) : null}

        {connected ? (
          <div className="header__account">
            <span className="header__address" title={wallet.address ?? ''}>
              {shortenAddress(wallet.address!, 5)}
            </span>
            <button type="button" className="btn btn--ghost" onClick={wallet.disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void wallet.connect()}
            disabled={wallet.status === 'connecting'}
          >
            {wallet.status === 'connecting' ? 'Connecting…' : 'Connect Freighter'}
          </button>
        )}
      </div>
    </header>
  )
}
