import { useEffect, useState } from 'react'
import './App.css'

type BackendStatus = 'checking' | 'connected' | 'unavailable'

const backendStatusCopy: Record<BackendStatus, string> = {
  checking: 'Checking connection…',
  connected: 'Connected',
  unavailable: 'Unavailable',
}

function App() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>('checking')

  useEffect(() => {
    let isCurrent = true

    async function checkBackend(): Promise<void> {
      try {
        const response = await fetch('/api/health')
        const data: unknown = await response.json()
        const isHealthy =
          response.ok &&
          typeof data === 'object' &&
          data !== null &&
          'status' in data &&
          data.status === 'ok'

        if (!isHealthy) {
          throw new Error('Backend health check failed')
        }

        if (isCurrent) {
          setBackendStatus('connected')
        }
      } catch {
        if (isCurrent) {
          setBackendStatus('unavailable')
        }
      }
    }

    void checkBackend()

    return () => {
      isCurrent = false
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="page-title">
        <p className="eyebrow">Development foundation</p>
        <h1 id="page-title">Family Life Hub</h1>
        <p className="intro">
          A warm, simple home for the family tools we will build together.
        </p>

        <div className="status-list" aria-label="Application status">
          <article className="status-card">
            <span className="status-dot status-dot--ready" aria-hidden="true" />
            <div>
              <h2>Frontend status</h2>
              <p>Ready</p>
            </div>
          </article>

          <article className="status-card">
            <span
              className={`status-dot status-dot--${backendStatus}`}
              aria-hidden="true"
            />
            <div>
              <h2>Backend connection</h2>
              <p role="status" aria-live="polite">
                {backendStatusCopy[backendStatus]}
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
