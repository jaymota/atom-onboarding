import { Route, Routes } from 'react-router-dom'
import { AdminGate } from './AdminGate'
import { AdminLayout } from './AdminLayout'
import Dashboard from './Dashboard'
import ClientPage from './ClientPage'
import QuoteBuilder from './QuoteBuilder'
import MouEditor from './MouEditor'
import SettingsPage from './SettingsPage'

/** Everything under /admin — locked behind the PIN. */
export default function AdminArea() {
  return (
    <AdminGate>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="client/:id" element={<ClientPage />} />
          <Route path="quote/:id" element={<QuoteBuilder />} />
          <Route path="mou/:id" element={<MouEditor />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AdminGate>
  )
}
