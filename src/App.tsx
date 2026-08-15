import { useState } from 'react'

import { Alert } from './components/Alert'
import { Header } from './components/Header'
import { Landing } from './components/Landing'
import { PaymentForm } from './components/PaymentForm'
import { TipJarPanel } from './components/TipJarPanel'
import { TxFeedback, type TxOutcome } from './components/TxFeedback'
import { WalletPanel } from './components/WalletPanel'
import { useBalance } from './hooks/useBalance'
import { useTipJar } from './hooks/useTipJar'
import { useWallet } from './hooks/useWallet'

export default function App() {
  const wallet = useWallet()
  const connected = wallet.status === 'connected' && wallet.address !== null
  const balance = useBalance(connected ? wallet.address : null)
  const jar = useTipJar(connected ? wallet.address : null)
  const [outcome, setOutcome] = useState<TxOutcome | null>(null)

  return (
    <div className="app">
      <Header wallet={wallet} />

      <main className="main">
        {wallet.error ? (
          <Alert tone="error" title={wallet.error.message} onDismiss={wallet.clearError}>
            {wallet.error.hint ? <p>{wallet.error.hint}</p> : null}
          </Alert>
        ) : null}

        {!connected ? (
          <Landing connecting={wallet.status === 'connecting'} onConnect={() => void wallet.connect()} />
        ) : (
          <div className="grid">
            {!wallet.onTestnet ? (
              <Alert tone="warning" title={`Freighter is on ${wallet.network}`}>
                <p>Switch the network to Testnet in the extension to use this dApp.</p>
              </Alert>
            ) : null}

            {outcome ? <TxFeedback outcome={outcome} onDismiss={() => setOutcome(null)} /> : null}

            <WalletPanel address={wallet.address!} balance={balance} />

            <PaymentForm
              address={wallet.address!}
              balance={balance.data?.xlm ?? '0'}
              funded={balance.data?.funded ?? false}
              disabled={!wallet.onTestnet}
              onResult={setOutcome}
              onSettled={() => void balance.refresh()}
            />

            <TipJarPanel
              address={wallet.address!}
              balance={balance.data?.xlm ?? '0'}
              funded={balance.data?.funded ?? false}
              disabled={!wallet.onTestnet}
              jar={jar}
              onResult={setOutcome}
              onSettled={() => void balance.refresh()}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Stellar Testnet · Horizon + Soroban + Freighter</span>
        <a href="https://developers.stellar.org/docs" target="_blank" rel="noreferrer">
          Stellar docs ↗
        </a>
      </footer>
    </div>
  )
}
