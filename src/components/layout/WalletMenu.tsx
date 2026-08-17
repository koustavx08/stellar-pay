import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useWalletContext } from '../../context/WalletProvider'
import { explorerAccountUrl, shortenAddress } from '../../lib/stellar'
import { CopyButton } from '../CopyButton'

interface WalletMenuProps {
  open: boolean
  onToggle: () => void
}

export function WalletMenu({ open, onToggle }: WalletMenuProps) {
  const { wallet, balance } = useWalletContext()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside and Escape both close the menu, as a dropdown should.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onToggle()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onToggle])

  if (!wallet.address) return null

  const disconnect = () => {
    wallet.disconnect()
    navigate('/')
  }

  return (
    <div className="wallet-menu" ref={containerRef}>
      <button
        type="button"
        className="wallet-menu__trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="wallet-menu__avatar" aria-hidden="true" />
        <span className="wallet-menu__address">{shortenAddress(wallet.address, 4)}</span>
        <span className="wallet-menu__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="wallet-menu__panel" role="menu">
          <div className="wallet-menu__head">
            <p className="label">Connected wallet</p>
            <div className="address">
              <code>{shortenAddress(wallet.address, 8)}</code>
              <CopyButton value={wallet.address} />
            </div>
            <p className="wallet-menu__balance">
              {balance.data ? `${balance.data.xlm} XLM` : 'Loading balance…'}
            </p>
          </div>

          <div className="wallet-menu__items">
            <Link to="/wallet" className="wallet-menu__item" role="menuitem">
              Wallet details
            </Link>
            <a
              className="wallet-menu__item"
              href={explorerAccountUrl(wallet.address)}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
            >
              View on explorer ↗
            </a>
            <button
              type="button"
              className="wallet-menu__item wallet-menu__item--danger"
              onClick={disconnect}
              role="menuitem"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
