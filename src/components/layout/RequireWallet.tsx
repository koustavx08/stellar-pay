import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useWalletContext } from '../../context/WalletProvider'
import { hasCompletedOnboarding } from '../../lib/onboarding'

/**
 * Gate for everything behind a wallet.
 *
 * The wallet session is restored asynchronously on load, so a redirect during
 * `connecting` would bounce a returning user back to the landing page before
 * their session had a chance to resolve. We hold on a loader instead.
 */
export function RequireWallet() {
  const { wallet, connected } = useWalletContext()
  const location = useLocation()

  if (wallet.status === 'connecting') {
    return (
      <div className="route-loader">
        <span className="spinner spinner--lg" aria-hidden="true" />
        <p className="text-muted">Restoring your wallet session…</p>
      </div>
    )
  }

  if (!connected) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  // First-time wallets go through onboarding before reaching the product.
  if (wallet.address && !hasCompletedOnboarding(wallet.address)) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
