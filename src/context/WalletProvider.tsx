import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

import { useToast } from '../components/ui/Toast'
import { type BalanceState, useBalance } from '../hooks/useBalance'
import { type Wallet, useWallet } from '../hooks/useWallet'

interface WalletContextValue {
  wallet: Wallet
  balance: BalanceState
  /** True once a wallet is connected and usable. */
  connected: boolean
}

const WalletContext = createContext<WalletContextValue | null>(null)

/**
 * Single source of truth for wallet + balance.
 *
 * The underlying `useWallet` / `useBalance` hooks are unchanged; this only
 * hoists them so every route reads the same instance instead of each page
 * opening its own Freighter poll and Horizon request.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const connected = wallet.status === 'connected' && wallet.address !== null
  const balance = useBalance(connected ? wallet.address : null)
  const toast = useToast()

  // Announce connection changes once per transition, not on every render.
  const previousAddress = useRef<string | null>(null)
  useEffect(() => {
    const current = connected ? wallet.address : null

    if (current && current !== previousAddress.current) {
      toast.push({ tone: 'success', title: 'Wallet connected' })
    } else if (!current && previousAddress.current) {
      toast.push({ tone: 'info', title: 'Wallet disconnected' })
    }

    previousAddress.current = current
  }, [connected, wallet.address, toast])

  // Surface a wrong-network wallet immediately: every action would fail otherwise.
  const warnedNetwork = useRef<string | null>(null)
  useEffect(() => {
    if (!connected || !wallet.network) return
    if (wallet.onTestnet) {
      warnedNetwork.current = null
      return
    }
    if (warnedNetwork.current === wallet.network) return

    warnedNetwork.current = wallet.network
    toast.push({
      tone: 'warning',
      title: `Freighter is on ${wallet.network}`,
      detail: 'Switch to Testnet to send payments.',
    })
  }, [connected, wallet.network, wallet.onTestnet, toast])

  // Connection failures (rejected popup, missing extension) deserve a toast too.
  const shownError = useRef<string | null>(null)
  useEffect(() => {
    if (!wallet.error) {
      shownError.current = null
      return
    }
    if (shownError.current === wallet.error.message) return

    shownError.current = wallet.error.message
    toast.push({
      tone: 'error',
      title: wallet.error.message,
      detail: wallet.error.hint,
    })
  }, [wallet.error, toast])

  const value = useMemo(
    () => ({ wallet, balance, connected }),
    [wallet, balance, connected],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWalletContext must be used inside a WalletProvider')
  return context
}
