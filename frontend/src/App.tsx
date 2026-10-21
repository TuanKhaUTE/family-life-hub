import './App.css'
import './features/auth/auth.css'

import { AuthFlow } from './features/auth/AuthFlow'

function App() {
  return (
    <main id="top" className="app-frame">
      <div className="ambient-shape ambient-shape--peach" aria-hidden="true" />
      <div className="ambient-shape ambient-shape--sage" aria-hidden="true" />
      <AuthFlow />
    </main>
  )
}

export default App
