import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { WalletMenu } from './WalletMenu'
import { useWalletContext } from '../../context/WalletProvider'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '◫' },
  { to: '/send', label: 'Send', icon: '↑' },
  { to: '/receive', label: 'Receive', icon: '↓' },
  { to: '/activity', label: 'Activity', icon: '≡' },
  { to: '/tip-jar', label: 'Tip Jar', icon: '◈' },
  { to: '/wallet', label: 'Wallet', icon: '◉' },
]

/** Nav shown in the mobile bottom bar — Wallet lives in the header menu there. */
const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.to !== '/wallet')

export function AppShell() {
  const { wallet } = useWalletContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // A route change should never leave the wallet dropdown hanging open.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <NavLink to="/dashboard" className="brand">
          <span className="brand__mark" aria-hidden="true">
            ✦
          </span>
          <span className="brand__name">Stellar Pay</span>
        </NavLink>

        <nav className="nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}
            >
              <span className="nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell__sidebar-foot">
          <span className="network-badge">
            <span className="network-badge__dot" aria-hidden="true" />
            Stellar Testnet
          </span>
          <p className="text-muted shell__disclaimer">
            Test network only. No real funds are involved.
          </p>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <NavLink to="/dashboard" className="brand brand--compact">
            <span className="brand__mark" aria-hidden="true">
              ✦
            </span>
            <span className="brand__name">Stellar Pay</span>
          </NavLink>

          <div className="topbar__actions">
            {!wallet.onTestnet && wallet.network ? (
              <span className="network-badge network-badge--warn">
                <span className="network-badge__dot" aria-hidden="true" />
                {wallet.network}
              </span>
            ) : (
              <span className="network-badge topbar__network">
                <span className="network-badge__dot" aria-hidden="true" />
                Testnet
              </span>
            )}

            <WalletMenu open={menuOpen} onToggle={() => setMenuOpen((value) => !value)} />
          </div>
        </header>

        <main className="shell__content">
          {/*
            A toast disappears, but a wrong network breaks every action on
            every page — so it needs a banner that stays until it is fixed.
          */}
          {wallet.network && !wallet.onTestnet ? (
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon" aria-hidden="true">
                !
              </span>
              <div>
                <p className="banner__title">Freighter is on {wallet.network}</p>
                <p className="banner__body">
                  Switch the network to Testnet in the extension. Sending and contract calls will
                  fail until you do.
                </p>
              </div>
            </div>
          ) : null}

          <Outlet />
        </main>

        <nav className="tabbar" aria-label="Main">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}
            >
              <span className="tabbar__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="tabbar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
