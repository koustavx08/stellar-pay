import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader, StatusBadge } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import {
  BASE_RESERVE_XLM,
  describeError,
  explorerAccountUrl,
  formatXlmAmount,
  fundWithFriendbot,
} from '../lib/stellar'

export function WalletPage() {
  const { wallet, balance } = useWalletContext()
  const address = wallet.address!
  const navigate = useNavigate()
  const toast = useToast()
  const [funding, setFunding] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  const funded = balance.data?.funded ?? false
  const total = Number(balance.data?.xlm ?? '0')
  const spendable = Math.max(total - BASE_RESERVE_XLM, 0)

  const fund = async () => {
    setFunding(true)
    try {
      await fundWithFriendbot(address)
      await balance.refresh()
      toast.push({ tone: 'success', title: 'Account funded with test XLM' })
    } catch (cause) {
      toast.push({ tone: 'error', title: 'Funding failed', detail: describeError(cause) })
    } finally {
      setFunding(false)
    }
  }

  const disconnect = () => {
    wallet.disconnect()
    navigate('/')
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Wallet" description="Your account details and connection status." />

      <Card title="Account">
        <div className="field-row">
          <span className="label">Address</span>
          <div className="address">
            <code>{address}</code>
            <CopyButton value={address} />
          </div>
        </div>

        <div className="detail-list">
          <div className="detail-list__row">
            <dt className="detail-list__label">Network</dt>
            <dd className="detail-list__value">
              <span className={`network-badge ${wallet.onTestnet ? '' : 'network-badge--warn'}`}>
                <span className="network-badge__dot" aria-hidden="true" />
                {wallet.onTestnet ? 'Stellar Testnet' : (wallet.network ?? 'Unknown')}
              </span>
            </dd>
          </div>

          <div className="detail-list__row">
            <dt className="detail-list__label">Account status</dt>
            <dd className="detail-list__value">
              {balance.loading && !balance.data ? (
                <Skeleton width="8ch" />
              ) : funded ? (
                <StatusBadge tone="ok">Active on testnet</StatusBadge>
              ) : (
                <StatusBadge tone="warn">Not funded</StatusBadge>
              )}
            </dd>
          </div>

          <div className="detail-list__row">
            <dt className="detail-list__label">Wallet</dt>
            <dd className="detail-list__value">Freighter</dd>
          </div>
        </div>

        {!wallet.onTestnet && wallet.network ? (
          <p className="text-warn">
            Freighter is on {wallet.network}. Switch it to Testnet to use this app.
          </p>
        ) : null}
      </Card>

      <Card title="Balance">
        <div className="balance-split">
          <div>
            <span className="label">Total</span>
            <p className="balance-split__value">
              {balance.loading && !balance.data ? (
                <Skeleton width="6ch" />
              ) : (
                <>
                  {formatXlmAmount(balance.data?.xlm ?? '0')} <span className="unit">XLM</span>
                </>
              )}
            </p>
          </div>

          <div>
            <span className="label">Spendable</span>
            <p className="balance-split__value">
              {balance.loading && !balance.data ? (
                <Skeleton width="6ch" />
              ) : (
                <>
                  {formatXlmAmount(String(spendable))} <span className="unit">XLM</span>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-muted">
          {BASE_RESERVE_XLM} XLM is permanently locked as the Stellar base reserve and cannot be
          sent while the account stays open.
        </p>

        {balance.error ? <p className="text-error">{balance.error}</p> : null}

        <div className="card__actions">
          <Button variant="ghost" onClick={() => void balance.refresh()} loading={balance.loading}>
            Refresh balance
          </Button>
          {!funded ? (
            <Button variant="secondary" onClick={() => void fund()} loading={funding}>
              Fund with Friendbot (testnet)
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Connection">
        <div className="card__actions">
          <a
            className="btn btn--ghost"
            href={explorerAccountUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            Open in explorer ↗
          </a>

          {confirmingDisconnect ? (
            <div className="confirm">
              <p className="confirm__text">
                Disconnect this wallet? You can reconnect at any time from the landing page.
              </p>
              <div className="confirm__actions">
                <Button variant="ghost" onClick={() => setConfirmingDisconnect(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDisconnect(true)}>
              Disconnect wallet
            </Button>
          )}
        </div>

        <p className="text-muted">
          Disconnecting only clears this app&apos;s session. Freighter keeps your keys, and site
          permissions are managed inside the extension.
        </p>
      </Card>
    </div>
  )
}
