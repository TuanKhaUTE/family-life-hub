interface AuthStatusScreenProps {
  kind: 'loading' | 'error'
  message?: string
  onRetry?: () => void
}

export function AuthStatusScreen({
  kind,
  message = 'Đang mở không gian gia đình…',
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
        <h1 id="auth-error-title">Chưa thể mở cửa</h1>
        <p className="auth-copy">
          Kết nối đang bị gián đoạn. Không gian gia đình của bạn vẫn an toàn.
        </p>
        <button className="primary-button" type="button" onClick={onRetry}>
          Thử lại
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
      <h1>Góc nhỏ của cả nhà</h1>
      <p className="auth-copy">{message}</p>
      <span className="loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </section>
  )
}
