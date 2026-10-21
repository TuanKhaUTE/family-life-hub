interface AuthStatusScreenProps {
  kind: 'loading' | 'error'
  message?: string
  onRetry?: () => void
}

export function AuthStatusScreen({
  kind,
  message = 'Opening your family home…',
  onRetry,
}: AuthStatusScreenProps) {
  if (kind === 'error') {
    return (
      <section
        className="auth-card auth-status"
        role="alert"
        aria-labelledby="auth-error-title"
      >
        <div className="brand-mark brand-mark--small" aria-hidden="true">
          <span>⌂</span>
        </div>
        <p className="eyebrow">Family Life Hub</p>
        <h1 id="auth-error-title">We couldn’t open the door</h1>
        <p className="auth-copy">
          Something interrupted the connection. Your family space is still
          safe.
        </p>
        <button className="primary-button" type="button" onClick={onRetry}>
          Try again
        </button>
      </section>
    )
  }

  return (
    <section
      className="auth-card auth-status"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="brand-mark" aria-hidden="true">
        <span>⌂</span>
      </div>
      <p className="eyebrow">Family Life Hub</p>
      <h1>A little place for everyone</h1>
      <p className="auth-copy">{message}</p>
      <span className="loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </section>
  )
}
