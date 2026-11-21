import { Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { WalletsPage } from '@/pages/WalletsPage'
import { WalletAnalysisPage } from '@/pages/WalletAnalysisPage'
// TOKENS PAGE DISABLED — page kept in the tree, just not routed. Old links go to the wallets page.
// import { TokensPage } from '@/pages/TokensPage'
import { InsidersPage } from '@/pages/InsidersPage'
import { ScannerPage } from '@/pages/ScannerPage'
import { WatchlistPage } from '@/pages/WatchlistPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      <Route path="/wallets" element={<WalletsPage />} />
      <Route path="/wallets/:address" element={<WalletAnalysisPage />} />
      {/* TOKENS PAGE DISABLED — un-comment together with the import above to restore it.
      <Route path="/tokens" element={<TokensPage />} />
      */}
      <Route path="/tokens" element={<Navigate to="/wallets" replace />} />
      <Route path="/scanner" element={<ScannerPage />} />
      <Route path="/insiders" element={<InsidersPage />} />
      <Route path="/watchlist" element={<WatchlistPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
