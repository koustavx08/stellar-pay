import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { RequireWallet } from './components/layout/RequireWallet'
import { ToastProvider } from './components/ui/Toast'
import { WalletProvider } from './context/WalletProvider'
import { ActivityDetailPage } from './pages/ActivityDetailPage'
import { ActivityPage } from './pages/ActivityPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ReceivePage } from './pages/ReceivePage'
import { SendPage } from './pages/SendPage'
import { TipJarPage } from './pages/TipJarPage'
import { WalletPage } from './pages/WalletPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <WalletProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Everything below requires a connected wallet. */}
            <Route element={<RequireWallet />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/send" element={<SendPage />} />
                <Route path="/receive" element={<ReceivePage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/activity/:id" element={<ActivityDetailPage />} />
                <Route path="/tip-jar" element={<TipJarPage />} />
                <Route path="/wallet" element={<WalletPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WalletProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
