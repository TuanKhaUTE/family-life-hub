import './App.css'
import './features/auth/auth.css'

import { AuthFlow } from './features/auth/AuthFlow'
import { OfflineBanner } from './features/app/OfflineBanner'

function App() {
  return (
    <main id="top" className="app-frame">
      <div className="ambient-shape ambient-shape--peach" aria-hidden="true" />
      <div className="ambient-shape ambient-shape--sage" aria-hidden="true" />
      <OfflineBanner />
      <AuthFlow />
    </main>
  )
}

export default App
