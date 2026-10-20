import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import IntakeForm from './pages/IntakeForm'
import { PageSpinner } from './components/ui'

// Pages are loaded only when needed, so the public form stays fast.
const QuoteView = lazy(() => import('./pages/QuoteView'))
const DetailsForm = lazy(() => import('./pages/DetailsForm'))
const AdminArea = lazy(() => import('./admin/AdminArea'))

// GitHub Pages serves real paths like /admin via 404.html; move them into the #/ route.
if (typeof window !== 'undefined' && window.location.pathname !== '/' && !window.location.hash) {
  const path = window.location.pathname.replace(/\/+$/, '')
  window.history.replaceState(null, '', `/#${path}${window.location.search}`)
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<IntakeForm />} />
          <Route path="/q/:token" element={<QuoteView />} />
          <Route path="/details/:token" element={<DetailsForm />} />
          <Route path="/admin/*" element={<AdminArea />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
