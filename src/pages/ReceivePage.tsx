import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

import { CopyButton } from '../components/CopyButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useWalletContext } from '../context/WalletProvider'
import { explorerAccountUrl } from '../lib/stellar'

export function ReceivePage() {
  const { wallet } = useWalletContext()
  const address = wallet.address!
  const toast = useToast()
  const [qr, setQr] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)

  // The QR encodes the raw address so any Stellar wallet can scan it.
  useEffect(() => {
    let active = true
    setQr(null)
    setQrError(false)

    QRCode.toDataURL(address, {
      width: 512,
      margin: 1,
      color: { dark: '#0b1020', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQr(url)
      })
      .catch(() => {
        if (active) setQrError(true)
      })

    return () => {
      active = false
    }
  }, [address])

  const share = async () => {
    // The Web Share sheet is mobile-only; copying is the desktop equivalent.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Stellar address', text: address })
        return
      } catch {
        // A cancelled share sheet is not an error worth reporting.
        return
      }
    }

    try {
      await navigator.clipboard.writeText(address)
      toast.push({ tone: 'success', title: 'Address copied' })
    } catch {
      toast.push({ tone: 'error', title: 'Could not copy the address' })
    }
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Receive XLM" description="Share this address to receive XLM." />

      <Card className="receive">
        <div className="receive__qr">
          {qr ? (
            <img src={qr} alt={`QR code for the Stellar address ${address}`} />
          ) : qrError ? (
            <div className="receive__qr-fallback">
              <p className="text-muted">
                The QR code could not be generated. You can still copy the address below.
              </p>
            </div>
          ) : (
            <Skeleton width="100%" height="100%" />
          )}
        </div>

        <span className="network-badge">
          <span className="network-badge__dot" aria-hidden="true" />
          Stellar Testnet
        </span>

        <div className="field-row receive__address">
          <span className="label">Your address</span>
          <div className="address">
            <code>{address}</code>
            <CopyButton value={address} />
          </div>
        </div>

        <div className="form__actions form__actions--stack">
          <Button variant="primary" onClick={() => void share()}>
            Share address
          </Button>
          <a
            className="btn btn--ghost"
            href={explorerAccountUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer ↗
          </a>
        </div>

        <p className="text-muted receive__note">
          Only send Stellar testnet assets to this address. Testnet XLM has no monetary value.
        </p>
      </Card>
    </div>
  )
}
